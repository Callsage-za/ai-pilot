import { Injectable } from '@nestjs/common';
import { PolicyService } from '../chat-memory/policy.service';
import { extractTextFromFile, splitIntoChunks } from 'src/utils/textNormalizer';
import { GeminiService } from '../gemini/gemini.service';
import { Policy } from '../chat-memory/types';
import { PolicyDocument, PolicyDocumentType, PolicyDocumentUploadData, SearchHit, SearchResult } from 'src/utils/types';
import { ChatMemoryService } from '../chat-memory/chat-memory.service';
import { ElasticService } from '../elastic/elastic.service';
import { getPolicyPrompt } from './prompts';
import { v4 as uuidv4 } from 'uuid';
import { SocketGateway } from '../socket-gateway/socket.gateway';
import { Organization } from 'src/entities/organization.entity';


@Injectable()
export class PolicyDocumentsService {
  constructor(
    private readonly policyDocSaveService: PolicyService,
    private readonly geminiService: GeminiService,
    private readonly policyService: PolicyService,
    private readonly mem: ChatMemoryService,
    private readonly elasticService: ElasticService,
    private readonly socketGateway: SocketGateway,
  ) {
  }
  private documents: PolicyDocument[] = [];

  async createPolicyDocument(data: PolicyDocumentUploadData,localPath:string, organizationId: string): Promise<PolicyDocument> {
    const document: PolicyDocument = {
      id:uuidv4(),
      title: data.title,
      description: data?.description || '',
      type: data.type,
      fileName: data.fileName,
      filePath: data.filePath,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: data.uploadedBy||undefined,
      headers: data.headers,
      isProcessed: false,
      version: data?.version||undefined,
      effectiveDate: data.effectiveDate,
      createdAt: new Date(),
      updatedAt: new Date(),
      parentId: data?.parentId||undefined,
      organization: { id: organizationId } as Organization,
    };

    await this.policyDocSaveService.savePolicyDocument(document);
    await this.injestPolicyDocs(localPath, organizationId, data.parentId, document.filePath);
    this.socketGateway.broadcast('documents.updated', { document });
    this.socketGateway.emitMessage({ type: 'documents.updated', document });
    return document;
  }

  async getPolicyDocumentById(id: string, organizationId?: string): Promise<PolicyDocument | null> {
    const documents = await this.policyDocSaveService.getAllPolicyDocuments(organizationId);
    return documents.find(doc => doc.id === id) || null;
  }

  async getPolicyDocumentsByType(type: PolicyDocumentType, organizationId?: string): Promise<PolicyDocument[]> {
    const documents = await this.policyDocSaveService.getAllPolicyDocuments(organizationId);
    return documents
      .filter(doc => doc.type === type)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAllPolicyDocuments(organizationId?: string): Promise<PolicyDocument[]> {
    const aa = await this.policyDocSaveService.getAllPolicyDocuments(organizationId);
    return aa;
  }

  async getPolicyDocumentsBySection(section: string, organizationId?: string): Promise<PolicyDocument[]> {
    // Map section names to PolicyDocumentType
    const sectionToTypeMap: Record<string, PolicyDocumentType> = {
      'policies': PolicyDocumentType.CODE_OF_CONDUCT,
      'hr': PolicyDocumentType.ONBOARDING,
    };

    const type = sectionToTypeMap[section.toLowerCase()];
    if (!type) {
      return [];
    }

    return this.getPolicyDocumentsByType(type, organizationId);
  }

  async updatePolicyDocumentHeaders(id: string, headers: any, organizationId?: string): Promise<PolicyDocument> {
    const document = await this.getPolicyDocumentById(id, organizationId);
    if (!document) {
      throw new Error('Document not found');
    }

    document.headers = headers;
    document.updatedAt = new Date();
    await this.policyDocSaveService.savePolicyDocument(document);
    return document;
  }

  async markPolicyDocumentAsProcessed(id: string, organizationId?: string): Promise<PolicyDocument> {
    const document = await this.getPolicyDocumentById(id, organizationId);
    if (!document) {
      throw new Error('Document not found');
    }

    document.isProcessed = true;
    document.updatedAt = new Date();
    await this.policyDocSaveService.savePolicyDocument(document);
    return document;
  }

  async deletePolicyDocument(id: string, organizationId?: string): Promise<PolicyDocument> {
    const document = await this.getPolicyDocumentById(id, organizationId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Delete from database
    await this.policyDocSaveService.deletePolicyDocument(id);
    return document;
  }

  async searchPolicyDocuments(query: string, organizationId?: string): Promise<PolicyDocument[]> {
    const documents = await this.policyDocSaveService.getAllPolicyDocuments(organizationId);
    const lowercaseQuery = query.toLowerCase();
    return documents
      .filter(doc =>
        doc.title.toLowerCase().includes(lowercaseQuery) ||
        (doc.description && doc.description.toLowerCase().includes(lowercaseQuery))
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getPolicyDocumentTypes(): Promise<PolicyDocumentType[]> {
    return Object.values(PolicyDocumentType);
  }

  async policyDocumentsSearch(query: string,userId: string, organizationId: string): Promise<SearchResult> {
    return this.searchDocs(query, 5, "asdasd", userId, organizationId);
  }

  async injestPolicyDocs(filePath: string, organizationId: string, department?: string, externalPath?: string) {
    console.log("injestPolicyDocs", filePath, department, externalPath, organizationId);
    
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
        department: department ?? "General",
        externalPath: externalPath ?? "",
        organizationId: organizationId
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
          version: answer.version,
          organizationId: organizationId
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

  async searchDocs(query: string, size: number = 5, conversationId: string, userId: string, organizationId: string): Promise<SearchResult> {
    console.log("searching docs", query, size, conversationId, userId);
    const history = await this.mem.getRecentHistoryAsc(conversationId);


    try {
      // --- BM25 keyword search ---
      const bm25Query: any = {
        query: {
          multi_match: {
            query,
            fields: ["title^2", "body"],
            fuzziness: "AUTO"     // catch typos / close variants
          }
        },
        size
      };

      // Add organization ID filter if provided
      if (organizationId) {
        bm25Query.query = {
          bool: {
            must: [bm25Query.query],
            filter: [
              { term: { "organizationId": organizationId } }
            ]
          }
        };
      }

      const bm25 = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/policy_sections/_search", bm25Query);



      // --- Vector kNN (semantic) search ---
      const [qvec] = await this.geminiService.embedTexts([query]);

      const knnQuery: any = {
        knn: {
          field: "vec",
          query_vector: qvec,
          k: 100,
          num_candidates: 1000
        },
        size
      };

      // Add organization ID filter if provided
      if (organizationId) {
        knnQuery.knn.filter = {
          term: { "organizationId": organizationId }
        };
      }

      const knn = await this.elasticService.elasticPost<{ hits: { hits: any[] } }>("/policy_sections/_search", knnQuery);

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
      console.log("merged", merged);
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
        score: h.score,
        key: h._source?.externalPath
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
