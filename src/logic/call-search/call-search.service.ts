import { Injectable } from '@nestjs/common';
import { ElasticService } from '../elastic/elastic.service';
import { SearchHit } from 'src/utils/types';
import { GeminiService } from '../gemini/gemini.service';

@Injectable()
export class CallSearchService {
    constructor(
        private readonly elasticService: ElasticService,
        private readonly geminiService: GeminiService
    ) { }
    async searchCalls(query: string, filters: any = {}, organizationId?: string) {
        delete filters.time_range;
        try {
            // Parse relative date expressions
            if (filters.time_range) {
                filters.time_range = this.parseTimeRange(filters.time_range);
            }
            // Search in Elasticsearch for calls
            const searchQuery = {
                query: {
                    bool: {
                        must: [
                            {
                                multi_match: {
                                    query: query,
                                    fields: ["transcript", "summary", "intent", "classification"],
                                    fuzziness: "AUTO"
                                }
                            }
                        ],
                        filter: []
                    }
                },
                size: 20,
                sort: [
                    { timestamp: { order: "desc" } }
                ]
            };

            // Add organization ID filter if provided
            if (organizationId) {
                (searchQuery.query.bool.filter as any[]).push({
                    term: { "organizationId": organizationId }
                });
            }

            // Add filters if provided
            if (filters.tags && filters.tags.length > 0) {
                (searchQuery.query.bool.filter as any[]).push({
                    terms: { "classification.keyword": filters.tags }
                });
            }

            if (filters.time_range) {
                const timeFilter: any = { range: { timestamp: {} } };
                if (filters.time_range.from) {
                    timeFilter.range.timestamp.gte = filters.time_range.from;
                }
                if (filters.time_range.to) {
                    timeFilter.range.timestamp.lte = filters.time_range.to;
                }
                (searchQuery.query.bool.filter as any[]).push(timeFilter);
            }

            const response = await this.elasticService.elasticPost('/calls/_search', searchQuery);
            const hits = await this.searchVectors(query, organizationId);
            
            return {
                answer: this.formatCallResults(hits, query),
                sources: hits.map((hit: any) => {
                    return {
                        id: hit._id,
                        title: `Call - ${hit.checker.intent || 'Unknown'}`,
                        snippet: hit.checker.summary || hit.checker.transcript?.substring(0, 200) || 'No summary available',
                        score: hit._score,
                        key: hit.checker.audioPath,
                        type: "file.audio"
                    }
                })
            };

        } catch (error) {
            console.error('Error searching calls:', error);
            return {
                answer: "Sorry, I couldn't search the call data at the moment. Please try again later.",
                sources: []
            };
        }
    }

    private formatCallResults(hits: any[], query: string): string {
        if (hits.length === 0) {
            return `No calls found matching "${query}". Try adjusting your search terms or time range.`;
        }

        const results = hits.slice(0, 5); // Limit to top 5 results
        let answer = `Found ${hits.length} call(s) matching "${query}":\n\n`;

        results.forEach((hit, index) => {
            const call = hit.checker;
            answer += `${index + 1}. **${call.intent?.toUpperCase() || 'UNKNOWN'}** (${call.severity || 'N/A'} severity)\n`;
            answer += `   - Summary: ${call.summary || 'No summary available'}\n`;
            // answer += `   - Date: ${new Date(call.startedAt).toLocaleDateString()}\n`;
            if (call.customerId) {
                answer += `   - Customer ID: ${call.customerId}\n`;
            }
            // answer += `   - Sentiment: ${call.sentiment || 'N/A'}\n\n`;
            answer += `   - Transcript: ${call.transcript || 'No transcript available'}\n\n`;
        });

        return answer;
    }
    async searchVectors(query: string, organizationId?: string) {
        const [qvec] = await this.geminiService.embedTexts([query]);
        
        const knnQuery: any = {
            knn: {
                field: "embedding",
                query_vector: qvec,
                k: 100,
                num_candidates: 1000
            }
        };

        // Add organization ID filter if provided
        if (organizationId) {
            knnQuery.knn.filter = {
                term: { "organizationId": organizationId }
            };
        }

        const knn = await this.elasticService.elasticPost('/calls/_search', knnQuery);
        const map = new Map<string, any>();
        function add(list: any[], weight = 1) {
            list.forEach((hit: any, i: number) => {
                const cur = map.get(hit._id) || { ...hit, rrf: 0 };
                cur.rrf += weight * (1 / (60 + i));  // k=60 typical
                map.set(hit._id, cur);
            });
        }
        add(knn.hits.hits, 1);
        const merged = Array.from(map.values()).sort((a, b) => b.rrf - a.rrf).slice(0, 20);

        const hits: SearchHit[] = merged.map(h => ({
            id: h._source.id,
            score: h._score,
            title: h._source?.summary,
            snippet: (h._source?.transcript || ""),
            rrf: h.rrf,
            checker: h._source
        }));
        return hits;
    }
    async getCallAnalytics(filters: any = {}, organizationId?: string) {
        try {
            // Parse relative date expressions
            if (filters.time_range) {
                filters.time_range = this.parseTimeRange(filters.time_range);
            }

            const analyticsQuery: any = {
                size: 0,
                aggs: {
                    by_classification: {
                        terms: { field: "classification.keyword" }
                    },
                    by_sentiment: {
                        terms: { field: "sentiment.keyword" }
                    },
                    by_severity: {
                        terms: { field: "severity.keyword" }
                    },
                    timeline: {
                        date_histogram: {
                            field: "timestamp",
                            calendar_interval: "day"
                        }
                    }
                }
            };

            // Build query with filters
            const queryFilters: any[] = [];
            
            if (filters.time_range) {
                queryFilters.push({
                    range: {
                        timestamp: {
                            gte: filters.time_range.from,
                            lte: filters.time_range.to
                        }
                    }
                });
            }

            // Add organization ID filter if provided
            if (organizationId) {
                queryFilters.push({
                    term: { "organizationId": organizationId }
                });
            }

            if (queryFilters.length > 0) {
                analyticsQuery.query = {
                    bool: {
                        filter: queryFilters
                    }
                };
            }

            const response = await this.elasticService.elasticPost('/calls/_search', analyticsQuery);

            return {
                answer: this.formatAnalyticsResults(response.aggregations),
                sources: []
            };

        } catch (error) {
            console.error('Error getting call analytics:', error);
            return {
                answer: "Sorry, I couldn't retrieve call analytics at the moment. Please try again later.",
                sources: []
            };
        }
    }

    private formatAnalyticsResults(aggs: any): string {
        let answer = "## Call Analytics Summary\n\n";

        // Classification breakdown
        if (aggs.by_classification?.buckets) {
            answer += "**By Classification:**\n";
            aggs.by_classification.buckets.forEach((bucket: any) => {
                answer += `- ${bucket.key}: ${bucket.doc_count} calls\n`;
            });
            answer += "\n";
        }

        // Sentiment breakdown
        if (aggs.by_sentiment?.buckets) {
            answer += "**By Sentiment:**\n";
            aggs.by_sentiment.buckets.forEach((bucket: any) => {
                answer += `- ${bucket.key}: ${bucket.doc_count} calls\n`;
            });
            answer += "\n";
        }

        // Severity breakdown
        if (aggs.by_severity?.buckets) {
            answer += "**By Severity:**\n";
            aggs.by_severity.buckets.forEach((bucket: any) => {
                answer += `- ${bucket.key}: ${bucket.doc_count} calls\n`;
            });
            answer += "\n";
        }

        return answer;
    }

    private parseTimeRange(timeRange: any): any {
        const now = new Date();

        const parseRelativeDate = (dateStr: string): string => {
            if (!dateStr || !dateStr.startsWith('<<') || !dateStr.endsWith('>>')) {
                return dateStr; // Return as-is if not a relative date
            }

            const relative = dateStr.slice(2, -2); // Remove << and >>
            const match = relative.match(/NOW([+-]\d+)([DWMY])/);

            if (!match) {
                return dateStr; // Return as-is if can't parse
            }

            const offset = parseInt(match[1]);
            const unit = match[2];
            const date = new Date(now);

            switch (unit) {
                case 'D':
                    date.setDate(date.getDate() + offset);
                    break;
                case 'W':
                    date.setDate(date.getDate() + (offset * 7));
                    break;
                case 'M':
                    date.setMonth(date.getMonth() + offset);
                    break;
                case 'Y':
                    date.setFullYear(date.getFullYear() + offset);
                    break;
            }

            return date.toISOString();
        };

        return {
            from: timeRange.from ? parseRelativeDate(timeRange.from) : timeRange.from,
            to: timeRange.to ? parseRelativeDate(timeRange.to) : timeRange.to
        };
    }
}
