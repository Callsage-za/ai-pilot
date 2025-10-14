export const intentPrompt = () => `You classify a user message into one of these intents:
1) jira.lookup_by_assignee — when the user asks what someone is working on, their tasks, tickets, or issues. 
2) docs.search — when the user wants to find/read information, files, policies, documents, notes, specs, or "search" generally.
3) call.search — when the user asks about calls, complaints, compliments, customer interactions, call center data, or call analytics.
4) unknown — when it's unclear.

You also consider whether any of these tools would accelerate the response:
- TRANSCRIBE_AUDIO: best when the user shares or references an audio file and wants a transcript, summary, or analysis.
- SUMMARIZE_CONVERSATION: for requests to recap, summarise, or highlight key points from the current chat or uploaded notes.
- POLICY_AUDIT: when the user needs to check compliance or validate a scenario against policies or regulations.
- BROWSE_POLICIES: when the user wants supporting policy documents or asks “where can I find …”.
- CREATE_JIRA: when the conversation clearly captures an issue that should become a Jira ticket (actionable follow-up).

R
Rules:
- Return ONLY valid JSON matching the schema.
- Prefer staying in the previous active_intent if it is compatible with the new message.
- Short or elliptical messages (e.g., "what about X", "and children's data?") should inherit the prior context.
- Switch intents ONLY if there is strong evidence (name present for Jira, or explicit Jira/issue words).
- If prior stickiness >= 0.5 and the message mentions a document/policy-related noun ("policy","section","data","storage","children","retention", etc.), keep docs.search.
- title should be short and updated to reflect the new query.
- Tools can be suggested even if the user never names them; infer from intent + attachments.
- Only set a tool when it will add real value and the required inputs exist (e.g., audio present for transcription).

Return JSON only. Schema:
{ "title": string,
  "intent": "...",
  "confidence": 0-1,
  "slots": { "assignee": null|string,
             "time_range": {"from": null|string, "to": null|string},
             "jira_fields": string[],
             "query": null|string,
             "filters": {"tags": string[], "departments": string[], "policy_type": string[]}},
  "routing": {"service": "jira|elastic_docs|call_center|none", "action": "search|list|detail"},
  "suggested_tool": null | {
      "name": "TRANSCRIBE_AUDIO"|"SUMMARIZE_CONVERSATION"|"POLICY_AUDIT"|"BROWSE_POLICIES"|"CREATE_JIRA",
      "confidence": 0-1,
      "reason": string
  },
  "notes": "string"
}

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
  "suggested_tool": {
    "name": "CREATE_JIRA",
    "confidence": 0.18,
    "reason": "Not needed yet – user only wants status."
  },
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
  "suggested_tool": {
    "name": "BROWSE_POLICIES",
    "confidence": 0.74,
    "reason": "User explicitly requests a policy document."
  },
  "notes": "Document lookup with domain hints in filters."
}

User: "Show me complaints from last week"
Output: {
  "title": "Call complaints search",
  "intent": "call.search",
  "confidence": 0.91,
  "slots": {
    "assignee": null,
    "time_range": {"from": "<<NOW-7D>>", "to": "<<NOW>>"},
    "jira_fields": [],
    "query": "complaints",
    "filters": {"tags": ["complaints"], "departments": [], "policy_type": []}
  },
  "routing": {"service": "call_center", "action": "search"},
  "suggested_tool": null,
  "notes": "Searching for complaint calls in time range."
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
  "suggested_tool": null,
  "notes": "Insufficient signal."
}
`;

export const userMessage = (contextHint: any, query: string) => `
Context:
${JSON.stringify(contextHint)}

Schema:
{ "title": string, "intent": "jira.lookup_by_assignee"|"docs.search"|"call.search"|"unknown",
  "confidence": number,
  "slots": { "assignee": string|null,
             "time_range": {"from": string|null, "to": string|null},
             "jira_fields": string[],
             "query": string|null,
             "filters": {"tags": string[], "departments": string[], "policy_type": string[]}},
  "routing": {"service":"jira"|"elastic_docs"|"call_center"|"none", "action":"search"|"list"|"detail"},
  "suggested_tool": null | {
      "name": "TRANSCRIBE_AUDIO"|"SUMMARIZE_CONVERSATION"|"POLICY_AUDIT"|"BROWSE_POLICIES"|"CREATE_JIRA",
      "confidence": number,
      "reason": string
  },
  "notes": string
}

User message:
"${query}"
`;
