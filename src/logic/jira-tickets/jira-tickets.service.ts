import { Injectable, OnModuleInit } from '@nestjs/common';
import { ElasticService } from '../elastic/elastic.service';
import { GeminiService } from '../gemini/gemini.service';
import { normalizeName } from 'src/utils/textNormalizer';
import { ConfigService } from '@nestjs/config';
import { JiraUtils } from 'src/utils/jiraUtils';
import { JiraPlan } from './types';

interface JiraIssue {
    key: string;
    fields: {
        summary: string;
        description?: string;
        assignee?: {
            displayName: string;
            accountId: string;
        };
        status: {
            name: string;
        };
        updated: string;
    };
}

interface JiraResponse {
    issues: JiraIssue[];
}

@Injectable()
export class JiraTicketsService implements OnModuleInit {
    private readonly jiraUtils: JiraUtils;
    private jiraPriorities: any;
    constructor(
        private readonly configService: ConfigService,
        private readonly elasticService: ElasticService,
        private readonly geminiService: GeminiService
    ) {
        this.jiraUtils = new JiraUtils(configService);
    }
    async onModuleInit() {
        const res = await this.jiraUtils.jiraGet("/rest/api/3/priority");
        this.jiraPriorities = res;
        // return res; // [{id:"1", name:"Highest"}, ...]
    }
    async mapSeverityToPriorityId(severity: "high" | "medium" | "low") {
        const pri = this.jiraPriorities; // get [{id,name},...]
        const byName = new Map(pri.map((p: any) => [p.name.toLowerCase(), p.id]));
        return pri.find((p: any) => p.name.toLowerCase() === severity)
        // prefer these if they exist; fall back to any reasonable match
        // if (severity === "high")   return byName.get("high")   ?? byName.get("highest") ?? pri[0].id;
        // if (severity === "medium") return byName.get("medium") ?? pri.find((p:any)=>/med/i.test(p.name))?.id ?? pri[0].id;
        // return byName.get("low") ?? byName.get("lowest") ?? pri[pri.length-1].id;
    }
    async ingestProject(projectKey: string) {
        const data = await this.jiraUtils.getAllIssues(projectKey, [
            "summary", "description", "assignee", "status", "updated"
        ]);
        // return data.issues[1].fields.description.content;
        for (const issue of data.issues.splice(0, 100)) {
            await this.handleJiraIssue(issue,projectKey);
        }
    }
    async handleJiraIssue(issue,projectKey: string) {
        console.log("issue", issue);
        
        const f = issue.fields;
        const descriptionText = this.getDescriptionText(f.description);
        const search_text = f.summary + ' ' + descriptionText;
        const [vec] = await this.geminiService.embedTexts([search_text]);
        const doc = {
            key: issue.key,
            project: projectKey,
            summary: f.summary,
            description: descriptionText || null,
            status: f.status?.name,
            assignee_displayName: f.assignee?.displayName || null,
            assignee_accountId: f.assignee?.accountId || null,
            assignee_normalized: normalizeName(f.assignee?.displayName),
            updated: f.updated,
            search_text,
            embedding: vec
        };

        // upsert into Elastic
        const rsp = await this.elasticService.elasticPost(`/jira_issues/_update/${issue.key}`, {
            doc,
            doc_as_upsert: true
        });
        console.log(`Indexed ${issue.key}`);
    }

    async handleJiraIssueDeletion(issue: any) {
        
        try {
            // Delete the document from Elasticsearch using a direct fetch call
            const esUrl = this.configService.get('ELASTIC_URL') || '';
            const esPass = this.configService.get('ELASTIC_API_KEY') || '';
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `APIKey ${esPass}`
            };

            const response = await fetch(`${esUrl}/jira_issues/_doc/${issue.key}`, {
                method: "DELETE",
                headers
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Elasticsearch delete error ${response.status}: ${text}`);
            }

            const result = await response.json();
            console.log(`✅ Successfully deleted JIRA issue ${issue.key} from Elasticsearch`);
            return result;
        } catch (error) {
            console.error(`❌ Failed to delete JIRA issue ${issue.key} from Elasticsearch:`, error);
            // Don't throw the error to avoid webhook retries for non-existent documents
            if (error.status === 404) {
                console.log(`Issue ${issue.key} was not found in Elasticsearch (already deleted)`);
            } else {
                console.error(`Unexpected error deleting issue ${issue.key}:`, error);
            }
        }
    }
    async getProjects() {
        return this.jiraUtils.getProjects();
    }
    private getDescriptionText(description?: any): string {
        if(typeof description === 'string') return description;
        const parts: string[] = [];
        if (description) {
            description.content.forEach((c: any) => {
                if (c.content && c.content.length > 0) {
                    c.content.forEach((c1: any) => {
                        if (c1.type && c1.type === 'text') {
                            parts.push(c1.text);
                        }
                    });
                }
            });
        }
        return parts.join(' ');
    }


    async ask(query: any) {
        const plan = await this.extractJiraPlan(query.query);

        let assignee = { accountId: undefined, displayName: undefined } as { accountId?: string; displayName?: string };

        if (plan.assignee_text) {
            assignee = await this.resolveAssignee(plan.assignee_text);
        }
        const filters = await this.buildJiraFilters(plan, assignee);
        const results = await this.hybridQuery({
            userQuery: query.query,
            size: 10,
            filters,
            plan,
            who: assignee
        });

        try {

            const SYSTEM = `
            You are a helpful assistant that summarizes Jira issues into structured JSON.
            Given a Jira search payload, analyze all tickets and produce a high-level summary.
            Extract the key, title, summary, and confidence from the provided data.
            Return only valid JSON in the format:
            {
              "answer": string, 
              "sources": [
                {
                  "type": "jira ticket",
                  "snippet": string,
                  "title": string,
                  "confidence": number,
                  "key": string
                }
              ]
            }
            `;

            const USER = `
            Jira payload:
            ${JSON.stringify({ assignee, plan, results })}
            
            Summarize the tickets — include total count, key themes, progress status, and any notable blockers.
            Each source should represent a ticket with a short summary snippet.
            `;
            const answer = await this.geminiService.complete(SYSTEM, USER, [], 0.2);
            const processedAnswer = JSON.parse(answer.text?.replace(/^```json\s*|\s*```$/g, ""))

            // await this.mem.addMessage(conv.id, 'assistant', answer.text);
            return {
                type: "jira_ticket",
                query: query.query,
                answer: processedAnswer.answer,
                sources: processedAnswer.sources.map((h) => ({
                    type: "jira_ticket",
                    id: h.key,
                    title: h.tiele,
                    snippet: (h.summary || h.snippet),
                    score: h.confidence,
                    confidence: h.confidence
                })),
            }
        } catch (err: any) {
            throw new Error(`Search failed: ${err.message}`);
        }

        return { assignee, plan, results };
        // const result = await this.geminiService.generateContent(query);
        // return result;
    }

    async buildJiraFilters(plan: JiraPlan, assignee: { accountId?: string; displayName?: string }): Promise<any> {
        const filters: any[] = [];

        // Base entity filters
        if (plan.project) filters.push({ term: { project: plan.project } });
        if (assignee.accountId) filters.push({ term: { assignee_accountId: assignee.accountId } });

        // Status sets
        const OPEN = plan.intent === "working" ? ["To Do", "In Progress", "Selected for Development"] : ["Open"];
        const DONE = plan.intent === "completed" ? ["Done", "Closed", "Resolved", "Released"] : ["Done"];

        // Helper: optional date window
        const addDateWindow = () => {
            const field = plan.dateField;
            if (!field) return;
            if (!plan.startISO && !plan.endISO) return;
            const range: any = {};
            if (plan.startISO) range.gte = plan.startISO;
            if (plan.endISO) range.lte = plan.endISO;
            filters.push({ range: { [field]: range } });
        };

        switch (plan.intent) {
            case "working": {
                // Open/active work
                filters.push({ terms: { status: OPEN } });
                // If a date window was requested, apply it to chosen field (default upstream = "updated")
                addDateWindow();
                break;
            }

            case "completed": {
                // Must be in a done status OR have a resolution date
                filters.push({
                    bool: {
                        should: [
                            { terms: { status: DONE } },
                            { exists: { field: "resolutiondate" } }
                        ],
                        minimum_should_match: 1
                    }
                });

                // Date window applies to resolutiondate by default (planner should set dateField="resolutiondate")
                addDateWindow();
                break;
            }

            case "missed": {
                // “Missed” = still open AND (overdue OR stale). You can pick which via missedMode.
                filters.push({ terms: { status: OPEN } });

                const mode = plan.intent === "missed" ? "both" : "overdue";
                const days = plan.intent === "missed" ? 10 : 0;

                // If caller supplied an explicit date window, we respect it on the chosen field
                if (plan.startISO || plan.endISO) {
                    addDateWindow();
                } else {
                    // No explicit window → derive using duedate/updated
                    const should: any[] = [];
                    if (mode === "both" || mode === "overdue") {
                        should.push({ range: { duedate: { lt: "now/d" } } });
                    }
                    if (mode === "both") {
                        should.push({ range: { updated: { lte: `now-${days}d/d` } } });
                    }
                    // Require at least one of the conditions
                    filters.push({
                        bool: {
                            should,
                            minimum_should_match: 1
                        }
                    });
                }
                break;
            }

            case "generic":
            default: {
                // No status constraint; only apply date window if given
                addDateWindow();
                break;
            }
        }

        return filters;
    }

    async hybridQuery({
        userQuery,
        size,
        filters,
        plan,
        who
    }: {
        userQuery?: string;
        size: number;
        filters: any[];
        plan: JiraPlan;
        who: { accountId?: string; displayName?: string };
    }) {
        const keywords = (plan.keywords ?? "").trim();
        const bm25Body = {
            query: {
                bool: {
                    ...(keywords && {
                        must: [
                            {
                                multi_match: {
                                    query: keywords,
                                    fields: ["summary^3", "description", "search_text"],
                                    operator: "and"
                                }
                            }
                        ]
                    }),
                    filter: filters
                }
            },
            size
        };
        // 1) BM25 leg (structured + keywords)
        const bm25 = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/jira_issues/_search", bm25Body);

        // 2) KNN leg (only if a query is provided)
        let knnHits: any[] = [];
        if (userQuery) {
            const [qvec] = await this.geminiService.embedTexts([userQuery]);
            const knn = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/jira_issues/_search", {
                knn: {
                    field: "embedding",
                    query_vector: qvec,
                    k: Math.max(200, size * 10),
                    num_candidates: 1000,
                    filter: filters.length ? { bool: { filter: filters } } : undefined
                },
                size: size,
                min_score: 0.8            // <— move threshold here (top-level)

            });
            knnHits = knn.hits.hits;
        }

        // 3) RRF merge
        const map = new Map<string, any>();
        const add = (list: any[], w = 1) =>
            list.forEach((h, i) => {
                const cur = map.get(h._id) || { ...h, rrf: 0 };
                cur.rrf += w * (1 / (60 + i));
                map.set(h._id, cur);
            });

        add(bm25.hits.hits, 1);
        add(knnHits, 1);
        let merged = Array.from(map.values())
            .sort((a, b) => b.rrf - a.rrf)
            .slice(0, size);
        const DONE = new Set(["Done", "Closed", "Resolved", "Released"]);
        if (plan.intent === "completed") {
            merged = merged.filter(h => DONE.has(h?._source?.status) || !!h?._source?.resolutiondate);
        }
        return {
            plan,                                // what Gemini extracted (debug)
            assigneeResolved: who,               // { accountId, displayName }
            dateFieldUsed: plan.dateField,
            total: merged.length,
            results: merged.map(h => ({
                key: h._source?.key,
                project: h._source?.project,
                status: h._source?.status,
                assignee: h._source?.assignee_displayName,
                created: h._source?.created,
                updated: h._source?.updated,
                duedate: h._source?.duedate,
                resolutiondate: h._source?.resolutiondate,
                summary: h._source?.summary,
                score: h._score
            }))
        };
    }

    async resolveAssignee(nameOrQuery = "") {
        const body = {
            size: 0,
            query: {
                bool: {
                    should: [
                        // 1) normal text match (uses analyzer, supports fuzziness)
                        { match: { assignee_normalized: { query: nameOrQuery, fuzziness: "AUTO" } } },

                        // 2) prefixy behavior for "mat" → "matthew"
                        { match_phrase_prefix: { assignee_normalized: { query: nameOrQuery } } },

                        // 3) wildcard on the keyword field as a last resort (slower but robust)
                        { wildcard: { "assignee_displayName": { value: `*${nameOrQuery.toLowerCase()}*`, case_insensitive: true } } }
                    ],
                    minimum_should_match: 1
                }
            },
            aggs: {
                by_assignee: {
                    terms: { field: "assignee_accountId", size: 5, missing: "__none__" },
                    aggs: {
                        latest: {
                            top_hits: {
                                _source: { includes: ["assignee_displayName", "assignee_accountId"] },
                                size: 1,
                                sort: [{ updated: "desc" }]
                            }
                        }
                    }
                }
            }
        };

        const rsp = await this.elasticService.elasticPost("/jira_issues/_search", body);
        const buckets = rsp.aggregations?.by_assignee?.buckets ?? [];
        const best = buckets.find((b: any) => b.key && b.key !== "__none__");
        if (!best) return {};
        const hit = best.latest.hits.hits[0]?._source;
        return { accountId: hit?.assignee_accountId, displayName: hit?.assignee_displayName };
    }
    async extractJiraPlan(nlQuery: string): Promise<JiraPlan> {
        const system = `
      You translate a user question into Jira search filters.
      Return ONLY compact JSON (no prose) with keys:
      {
        "intent":"working|missed|completed|generic",
        "assignee_text": string?,       // name as written by the user
        "project": string?,             // short key like "CRM" if clearly present
        "dateField":"created|updated|resolutiondate|duedate"?, // pick the best field
        "startISO": string?,            // UTC ISO start if query has time window
        "endISO": string?,              // UTC ISO end if query has time window
        "keywords": string?             // short search terms if helpful
      }
      
      Rules:
      - "completed|done|resolved|closed|finished|shipped" -> intent="completed", prefer dateField="resolutiondate".
      - "missed|overdue|late|stale|not updated|behind|SLA" -> intent="missed", prefer "updated" (stale) or "duedate" (overdue).
      - "working|assigned|open" -> intent="working".
      - If query mentions time windows (e.g., "yesterday", "last week", "Aug 2025"), convert to UTC ISO 8601 and fill startISO/endISO.
      - If dates are absent, omit them. Never invent dates.
      - Output valid JSON only.
      `.trim();

        const { text } = await this.geminiService.generateContent([
            { role: "user", content: nlQuery }
        ], system);

        // Be defensive: strip code fences if the model wraps JSON
        const jsonText = text.trim().replace(/^```json\s*|\s*```$/g, "");
        try {
            const plan = JSON.parse(jsonText) as JiraPlan;
            // Minimal hardening
            if (!plan.intent) plan.intent = "generic";
            return plan;
        } catch {
            return { intent: "generic", keywords: nlQuery };
        }
    }

    async createJiraIssue({ title, description, priority }: { title: string; description: string; priority: "high" | "medium" | "low" }) {
        const priorityStruct = await this.mapSeverityToPriorityId(priority);

        // Convert plain text description to Jira ADF format
        const adfDescription = {
            type: "doc",
            version: 1,
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: description
                        }
                    ]
                }
            ]
        };

        const jiraIssue = await this.jiraUtils.jiraPost(`/rest/api/3/issue`, {
            fields: {
                project: { key: "SAG" },
                summary: title,
                issuetype: { name: "Task" },
                priority: { id: priorityStruct.id }, // Use ID instead of name
                description: adfDescription
            }
        });
       return jiraIssue;
    }

    async addAttachment(issueKey: string, filePath: string) {
        return this.jiraUtils.addAttachment(issueKey, filePath);
    }
}
