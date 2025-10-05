import { Injectable } from '@nestjs/common';
import { ElasticService } from '../elastic/elastic.service';
import { GeminiService } from '../gemini/gemini.service';
import fg from 'fast-glob';
import fs from 'node:fs/promises';
import path from 'path';
import { extractTextFromFile, normalizeText, splitIntoChunks } from 'src/utils/textNormalizer';
import { ChatMemoryService } from '../chat-memory/chat-memory.service';
import { getPolicyPrompt } from './prompts';
import { PolicyService } from '../chat-memory/policy.service';
import { z } from "zod";
import { Policy } from '../chat-memory/types';


export interface SearchHit {
    id: string;
    score: number;
    title: string;
    snippet: string;
    rrf: number;
}

export interface SearchResult {
    hits: SearchHit[];
    answer: string;
    query: string;
    sources: any[];
}

@Injectable()
export class DocsService {

    constructor(
        private readonly elasticService: ElasticService,
        private readonly geminiService: GeminiService,
        private readonly mem: ChatMemoryService,
        private readonly policyService: PolicyService
    ) { }

    async searchDocs(query: string, size: number = 5, conversationId: string, userId: string): Promise<SearchResult> {

        const conv = await this.mem.ensureConversation(userId, conversationId);
        const history = await this.mem.getRecentHistoryAsc(conv.id);
        await this.mem.addMessage(conv.id, 'user', query);


        try {
            // --- BM25 keyword search ---
            const bm25 = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/kb_docs/_search", {
                query: {
                    multi_match: {
                        query,
                        fields: ["title^2", "content"],
                        fuzziness: "AUTO"     // catch typos / close variants
                    }
                },
                size
            });



            // --- Vector kNN (semantic) search ---
            const [qvec] = await this.geminiService.embedTexts([query]);

            const knn = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/kb_docs/_search", {
                knn: {
                    field: "chunk_embedding",
                    query_vector: qvec,
                    k: 100,
                    num_candidates: 1000
                },
                size
            });

            // --- Reciprocal Rank Fusion (simple merge) ---
            const map = new Map<string, any>();
            function add(list: any[], weight = 1) {
                list.forEach((hit: any, i: number) => {
                    const cur = map.get(hit._id) || { ...hit, rrf: 0 };
                    cur.rrf += weight * (1 / (60 + i));  // k=60 typical
                    map.set(hit._id, cur);
                });
            }
            add(bm25.hits.hits, 1);
            add(knn.hits.hits, 1);
            const merged = Array.from(map.values()).sort((a, b) => b.rrf - a.rrf).slice(0, size);

            const hits: SearchHit[] = merged.map(h => ({
                id: h._id,
                score: h._score,
                title: h._source?.title,
                snippet: (h._source?.content || ""),
                rrf: h.rrf
            }));
            const context = merged
                .map((h, i) => `Doc ${i + 1}: ${h._source?.title}\n${h._source?.content}`)
                .join("\n\n");
            const prompt = `You are a helpful assistant. Use the following documents to answer the question.\n\nDocuments:\n${context}\n\nQuestion: ${query}\n\nAnswer concisely and cite which document(s) you used.`;
            // const answer = await this.geminiService.complete("null", [{ role: "user", content: prompt }], [], 0.2);

            const SYSTEM = `You are a helpful assistant. Answer using ONLY the provided documents. 
            - Cite sources like [#1], [#2].
            - If unsure or docs don't support it, say you don't know. Keep it concise.`;

            const USER = `Documents:\n${context}\n\nQuestion: ${query}\n\nAnswer (with citations):`;

            const answer = await this.geminiService.complete(SYSTEM, USER, history.filter(h => h.role === 'user' || h.role === 'model'), 0.2);
            await this.mem.addMessage(conv.id, 'assistant', answer.text);
            return {
                query,
                answer: answer.text,
                sources: merged.map((h) => ({
                    id: h._id,
                    title: h._source?.title,
                    snippet: (h._source?.content || "")
                })),
                hits
            }
        } catch (err: any) {
            throw new Error(`Search failed: ${err.message}`);
        }
    }


    async injestPolicyDocs(filePath: string) {
        const { text } = await extractTextFromFile(filePath);
        const systemPrompt = "You extract sections VERBATIM from the provided TEXT. Do NOT paraphrase or correct words. Copy text exactly as it appears.";
        const userPrompt = getPolicyPrompt(text);
        let geminiAnswer = await this.geminiService.generateContent(systemPrompt, userPrompt);
        const checker: Policy = JSON.parse(geminiAnswer.text.replace(/^```json\s*|\s*```$/g, ""));
        
        const policy=await this.policyService.savePolicyFromLLM(checker);
        const answer:any=await this.policyService.getPolicyData(policy.documentId);
        const sectionsBulk: any[] = [];

        for (const s of answer.sections) {
            const [vec] = await this.geminiService.embedTexts([`${s.title}\n\n${s.exact_text}`]); // 768-dim
            const doc = {
                policy_id: answer.document_id || answer.id,
                section_id: s.id,
                parent_id: s.parent_id || s.parentId,
                level: s.level,
                title: s.title,
                body: s.exact_text,          // <- maps to "body" in your mapping
                vec,                         // <- maps to "vec" dense_vector
                version: answer.version
            };
            // Use deterministic ID so re-ingest overwrites cleanly
            const _id = `${answer.document_id ?? answer.id}__${s.id}`;
            sectionsBulk.push({ index: { _index: "policy_sections", _id } });
            sectionsBulk.push(doc);

        }
        await this.elasticService.elasticBulkSave(sectionsBulk);
        console.log(`Indexed ${answer.sections.length} sections from ${filePath}`);

        const chunksBulk: any[] = [];
        for (const s of answer.sections) {
            const chunks = splitIntoChunks(s.exact_text || s.exactText);
            for (let i = 0; i < chunks.length; i++) {
                const text = chunks[i];
                const [vec] = await this.geminiService.embedTexts([text.text]);
                const doc = {
                    policy_id: answer.document_id||answer.id,
                    section_id: s.id,
                    chunk_id: i,
                    text:text.text,
                    vec,
                    version: answer.version
                };
                const _id = `${answer.document_id||answer.id}__${s.id}__${i}`;
                chunksBulk.push({ index: { _index: "policy_chunks", _id } });
                chunksBulk.push(doc);

            }
        }
        await this.elasticService.elasticBulkSave(chunksBulk);
        console.log(`Indexed ${answer.sections.length * chunksBulk.length} chunks from ${filePath}`);
        return answer;
    }

    async injestDocs(docFolder: string) {
        const files = await fg([`${docFolder}/**/*.{pdf,docx,txt,md}`]);
        console.log(`Found ${files.length} files`);

        for (const file of files) {
            const docId = path.basename(file);
            const { text } = await extractTextFromFile(file);
            const chunks = splitIntoChunks(text);
            const embeddings = await this.geminiService.embedTexts(chunks.map(c => c.text));
            // // Build bulk payload
            const body: any[] = [];
            for (let i = 0; i < chunks.length; i++) {
                const c = chunks[i];
                body.push({ index: { _index: "kb_docs", _id: `${docId}_${i}` } });
                body.push({
                    doc_id: docId,
                    source_path: file,
                    page: undefined, // we didn’t track pages in step 2, can add later
                    chunk_index: c.chunk_index,
                    title: path.basename(file),
                    content: c.text,
                    chunk_embedding: embeddings[i]
                });
            }

            await this.elasticService.elasticBulkSave(body);
            console.log(`Indexed ${chunks.length} chunks from ${file}`);
        }
    }






}
