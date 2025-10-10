export const intentPrompt = () => `You classify a user message into one of these intents:
1) jira.lookup_by_assignee — when the user asks what someone is working on, their tasks, tickets, or issues. 
2) docs.search — when the user wants to find/read information, files, policies, documents, notes, specs, or “search” generally.
3) unknown — when it's unclear.

R
Rules:
- Return ONLY valid JSON matching the schema.
- Prefer staying in the previous active_intent if it is compatible with the new message.
- Short or elliptical messages (e.g., "what about X", "and children's data?") should inherit the prior context.
- Switch intents ONLY if there is strong evidence (name present for Jira, or explicit Jira/issue words).
- If prior stickiness >= 0.5 and the message mentions a document/policy-related noun ("policy","section","data","storage","children","retention", etc.), keep docs.search.
- title should be short and updated to reflect the new query.

Return JSON only. Schema:
{ "title": string, "intent": "...", "confidence": 0-1, "slots": { "assignee": null|string, "time_range": {"from": null|string, "to": null|string}, "jira_fields": string[], "query": null|string, "filters": {"tags": string[], "departments": string[], "policy_type": string[]}}, "routing": {"service": "jira|elastic_docs|none", "action": "search|list|detail"}, "notes": "string" }

Examples:

User: "What is Matthew working on?"
Output: {
  "title": "Work info request",
  "intent": "jira.lookup_by_assignee",
  "confidence": 0.93,
  "slots": {
    "assignee": "Matthew",
    "time_range": {"from": "<<NOW-14D>>", "to": "<<NOW>>"},
    "jira_fields": ["summary","status","issueType"],
    "query": null,
    "filters": {"tags": [], "departments": [], "policy_type": []}
  },
  "routing": {"service": "jira", "action": "search"},
  "notes": "Asks about a person's current tickets."
}

User: "search the call center onboarding policy"
Output: {
  "title": "Search for call center onboarding policy",
  "intent": "docs.search",
  "confidence": 0.88,
  "slots": {
    "assignee": null,
    "time_range": {"from": null, "to": null},
    "jira_fields": [],
    "query": "call center onboarding policy",
    "filters": {"tags": ["onboarding"], "departments": ["operations"], "policy_type": ["call_center"]}
  },
  "routing": {"service": "elastic_docs", "action": "search"},
  "notes": "Document lookup with domain hints in filters."
}

User: "hmm not sure"
Output: {
  "title": "General question",
  "intent": "unknown",
  "confidence": 0.32,
  "slots": {
    "assignee": null,
    "time_range": {"from": null, "to": null},
    "jira_fields": [],
    "query": null,
    "filters": {"tags": [], "departments": [], "policy_type": []}
  },
  "routing": {"service": "none", "action": "list"},
  "notes": "Insufficient signal."
}
`;

export const userMessage = (contextHint: any, query: string) => `
Context:
${JSON.stringify(contextHint)}

Schema:
{ "title": string, "intent": "jira.lookup_by_assignee"|"docs.search"|"unknown",
  "confidence": number,
  "slots": { "assignee": string|null,
             "time_range": {"from": string|null, "to": string|null},
             "jira_fields": string[],
             "query": string|null,
             "filters": {"tags": string[], "departments": string[], "policy_type": string[]}},
  "routing": {"service":"jira"|"elastic_docs"|"none", "action":"search"|"list"|"detail"},
  "notes": string
}

User message:
"${query}"
`;