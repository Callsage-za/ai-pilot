export const getPolicyPrompt = (text: string) => {
    return `Return JSON ONLY in this shape:
                                {
                                "document_id": "<DOC_ID>",
                                "version": "<YYYY-MM-DD>",
                                "sections": [
                                    {
                                    "id": "1",
                                    "title": "Short Title",
                                    "parent_id": null,
                                    "level": 1,
                                    "exact_text": "VERBATIM TEXT FOR THIS SECTION",
                                    "sha256": "<sha256 of exact_text>"
                                    }
                                ]
                                }

                                Rules:
                                - Build a useful 2–4 level outline with dotted numbering for "id" (1, 1.1, 1.2.1).
                                - "exact_text" MUST be copied exactly from TEXT (same characters & whitespace).
                                - Titles ≤ 10 words; infer from first sentence if needed.
                                - Cover all substantive content; skip boilerplate headers/footers.
                                - Compute sha256 over the raw bytes of exact_text.

                                TEXT:
                                <<<BEGIN>>>
                                ${text}
                                <<<END>>>`;
}