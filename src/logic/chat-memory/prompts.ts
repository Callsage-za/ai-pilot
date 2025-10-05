export const SUMMARIZE_SYSTEM = `
You are a helpful assistant for Jira & Docs queries.
Summarize the conversation so far focusing on WHO, WHAT (projects/issues), WHEN (dates), and constraints.
<=120 words. Bullet points. No fluff.
`;

export const REWRITE_SYSTEM = `
You rewrite follow-up questions into fully self-contained Jira/Elastic queries.
Resolve pronouns (he/this/it/they) from the conversation context + summary.
Output ONLY the rewritten query, nothing else.
`;

export function buildRewriteUser(
    summary: string | undefined,
    history: { role: string; content: string }[],
    userInput: string
) {
    const hist = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    return `
CONVERSATION SUMMARY:
${summary ?? '(none)'}
----
RECENT MESSAGES:
${hist}
----
FOLLOW-UP FROM USER:
${userInput}
----
Rewrite the user message into a single explicit question that includes resolved names
(e.g., "Matthew Piper"), project names/keys, and any date/status constraints you can infer.
If info is insufficient, keep it explicit with what is known. Output only the rewritten query.
`;
}
