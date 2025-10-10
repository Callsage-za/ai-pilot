import { Injectable } from '@nestjs/common';
import { PolicyService } from '../chat-memory/policy.service';
import { extractTextFromFile, splitIntoChunks } from 'src/utils/textNormalizer';
import { GeminiService } from '../gemini/gemini.service';
import { Policy } from '../chat-memory/types';
import { PolicyDocument, PolicyDocumentType, PolicyDocumentUploadData, SearchHit, SearchResult } from 'src/utils/types';
import { ChatMemoryService } from '../chat-memory/chat-memory.service';
import { ElasticService } from '../elastic/elastic.service';
import { getPolicyPrompt } from './prompts';


@Injectable()
export class PolicyDocumentsService {
  constructor(private readonly policyDocSaveService: PolicyService,
    private readonly geminiService: GeminiService,
    private readonly policyService: PolicyService,
    private readonly mem: ChatMemoryService,
    private readonly elasticService: ElasticService,
  ) {
  }
  private documents: PolicyDocument[] = [];

  async createPolicyDocument(data: PolicyDocumentUploadData,localPath:string): Promise<PolicyDocument> {
    const document: PolicyDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title: data.title,
      description: data.description,
      type: data.type,
      fileName: data.fileName,
      filePath: data.filePath,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: data.uploadedBy,
      headers: data.headers,
      isProcessed: false,
      version: data.version,
      effectiveDate: data.effectiveDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId: data.parentId,
    };

    this.documents.push(document);
    await this.policyDocSaveService.savePolicyDocument(document);
    await this.injestPolicyDocs(localPath, data.parentId);
    return document;
  }

  async getPolicyDocumentById(id: string): Promise<PolicyDocument | null> {
    return this.documents.find(doc => doc.id === id) || null;
  }

  async getPolicyDocumentsByType(type: PolicyDocumentType): Promise<PolicyDocument[]> {
    return this.documents
      .filter(doc => doc.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllPolicyDocuments(): Promise<PolicyDocument[]> {
    const aa = await this.policyDocSaveService.getAllPolicyDocuments();
    return aa;
  }

  async getPolicyDocumentsBySection(section: string): Promise<PolicyDocument[]> {
    // Map section names to PolicyDocumentType
    const sectionToTypeMap: Record<string, PolicyDocumentType> = {
      'policies': PolicyDocumentType.CODE_OF_CONDUCT,
      'hr': PolicyDocumentType.ONBOARDING,
    };

    const type = sectionToTypeMap[section.toLowerCase()];
    if (!type) {
      return [];
    }

    return this.getPolicyDocumentsByType(type);
  }

  async updatePolicyDocumentHeaders(id: string, headers: any): Promise<PolicyDocument> {
    const document = this.documents.find(doc => doc.id === id);
    if (!document) {
      throw new Error('Document not found');
    }

    document.headers = headers;
    document.updatedAt = new Date();
    return document;
  }

  async markPolicyDocumentAsProcessed(id: string): Promise<PolicyDocument> {
    const document = this.documents.find(doc => doc.id === id);
    if (!document) {
      throw new Error('Document not found');
    }

    document.isProcessed = true;
    document.updatedAt = new Date();
    return document;
  }

  async deletePolicyDocument(id: string): Promise<PolicyDocument> {
    const index = this.documents.findIndex(doc => doc.id === id);
    if (index === -1) {
      throw new Error('Document not found');
    }

    return this.documents.splice(index, 1)[0];
  }

  async searchPolicyDocuments(query: string): Promise<PolicyDocument[]> {
    const lowercaseQuery = query.toLowerCase();
    return this.documents
      .filter(doc =>
        doc.title.toLowerCase().includes(lowercaseQuery) ||
        (doc.description && doc.description.toLowerCase().includes(lowercaseQuery))
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPolicyDocumentTypes(): Promise<PolicyDocumentType[]> {
    return Object.values(PolicyDocumentType);
  }

  async policyDocumentsSearch(query: string): Promise<SearchResult> {
    return this.searchDocs(query, 5, "asdasd", "123456");
  }

  async injestPolicyDocs(filePath: string, department?: string) {
    const { text } = await extractTextFromFile(filePath);
    const systemPrompt = "You extract sections VERBATIM from the provided TEXT. Do NOT paraphrase or correct words. Copy text exactly as it appears.";
    const userPrompt = getPolicyPrompt(text);
    let geminiAnswer = await this.geminiService.generateContent(systemPrompt, userPrompt);
    const checker: Policy = JSON.parse(geminiAnswer.text.replace(/^```json\s*|\s*```$/g, ""));
    const policy = await this.policyService.savePolicyFromLLM(checker);
    const answer: any = await this.policyService.getPolicyData(policy.documentId);
    const sectionsBulk: any[] = [];
    for (const s of answer.sections) {
      const [vec] = await this.geminiService.embedTexts([`${s.title}\n\n${s.exactText}`]); // 768-dim
      const doc = {
        policy_id: answer.document_id || answer.id,
        section_id: s.id,
        parent_id: s.parent_id || s.parentId,
        level: s.level,
        title: s.title,
        body: s.exact_text || s.exactText,          // <- maps to "body" in your mapping
        vec,                         // <- maps to "vec" dense_vector
        version: answer.version,
        department: department ?? "General"
      };
      // Use deterministic ID so re-ingest overwrites cleanly
      const _id = `${answer.document_id ?? answer.id}__${s.id}`;
      sectionsBulk.push({ index: { _index: "policy_sections", _id } });
      sectionsBulk.push(doc);

    }
    await this.elasticService.elasticBulkSave(sectionsBulk);
    const chunksBulk: any[] = [];
    for (const s of answer.sections) {
      const chunks = splitIntoChunks(s.exact_text || s.exactText);
      for (let i = 0; i < chunks.length; i++) {
        const text = chunks[i];
        const [vec] = await this.geminiService.embedTexts([text.text]);
        const doc = {
          policy_id: answer.document_id || answer.id,
          section_id: s.id,
          chunk_id: i,
          text: text.text,
          vec,
          version: answer.version
        };
        const _id = `${answer.document_id || answer.id}__${s.id}__${i}`;
        chunksBulk.push({ index: { _index: "policy_chunks", _id } });
        chunksBulk.push(doc);

      }
    }
    await this.elasticService.elasticBulkSave(chunksBulk);
    console.log(`Indexed ${answer.sections.length * chunksBulk.length} chunks from ${filePath}`);
    return answer;
  }

  async searchDocs(query: string, size: number = 5, conversationId: string, userId: string): Promise<SearchResult> {
    console.log("searching docs", query, size, conversationId, userId);
    const history = await this.mem.getRecentHistoryAsc(conversationId);


    try {
      // --- BM25 keyword search ---
      const bm25 = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/policy_sections/_search", {
        query: {
          multi_match: {
            query,
            fields: ["title^2", "body"],
            fuzziness: "AUTO"     // catch typos / close variants
          }
        },
        size
      });



      // --- Vector kNN (semantic) search ---
      const [qvec] = await this.geminiService.embedTexts([query]);

      const knn = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/policy_sections/_search", {
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
        snippet: (h._source?.body || ""),
        rrf: h.rrf,
        checker: h._source
      }));
      const context = merged
        .map((h, i) => `Doc ${i + 1}: ${h._source?.title}\n${h._source?.body}`)
        .join("\n\n");
      const prompt = `You are a helpful assistant. Use the following documents to answer the question.\n\nDocuments:\n${context}\n\nQuestion: ${query}\n\nAnswer concisely and cite which document(s) you used.`;
      // const answer = await this.geminiService.complete("null", [{ role: "user", content: prompt }], [], 0.2);

      const SYSTEM = `You are a helpful assistant. Answer using ONLY the provided documents. 
        - Cite sources like.
        - If unsure or docs don't support it, say you don't know. Keep it concise.`;

      const USER = `Documents:\n${context}\n\nQuestion: ${query}\n\nAnswer (with citations):`;

      const answer = await this.geminiService.complete(SYSTEM, USER, history.filter(h => h.role === 'user' || h.role === 'model'||h.role === 'assistant'), 0.2);
      const sources = merged.map((h) => ({
        type: "doc",
        id: h._id,
        title: h._source?.title,
        snippet: (h._source?.body || ""),
        score: h.score
      }))
      return {
        query,
        answer: answer.text,
        sources: sources,
        hits,
      };
      
    } catch (err: any) {
      throw new Error(`Search failed: ${err.message}`);
    }
  }
}
