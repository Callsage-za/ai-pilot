import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { Policy } from "src/entities/policy.entity";
import { PolicySection } from "src/entities/policy-section.entity";
import { PolicyDocument } from "src/entities";
import { Policy as PolicyType } from "./types";
@Injectable()
export class PolicyService {
    constructor(
        @InjectRepository(PolicyDocument)
        private readonly policyDocumentRepository: Repository<PolicyDocument>,
        @InjectRepository(Policy)
        private readonly policyRepository: Repository<Policy>,
        @InjectRepository(PolicySection)
        private readonly policySectionRepository: Repository<PolicySection>,
    ) {

    }
    async savePolicyDocument(payload: PolicyDocument) {
        const { id, version, } = payload;

        const policyDocument=await this.policyDocumentRepository.findOne({ where: { id } });
        if(!policyDocument){
            return this.policyDocumentRepository.save(payload);
        }
        return this.policyDocumentRepository.update(id || '', payload);

        // const policy = await tx.policy.upsert({ where: { documentId: id ?? '' }, update: { version }, create: { documentId: id ?? '', version } });

    }
    async getAllPolicyDocuments() {
        return this.policyDocumentRepository.find();
    }
    async savePolicyFromLLM(payload: PolicyType) {
        const { document_id, version, sections } = payload;
        let policy=await this.policyRepository.findOne({ where: { documentId: document_id } });
        if(!policy){
            policy=await this.policyRepository.save({ documentId: document_id, version });
        }
        // 1) Upsert policy shell

        // 2) Replace all sections for this policy (simplest + consistent)

        // 3) Bulk insert sections
        // createMany is fastest; ensure prisma >=4.8
        const policySections = sections.map(s => ({
            policyId: policy.id,
            sectionId: s.id,
            parentId: s.parent_id ?? undefined,
            level: s.level,
            title: s.title,
            exactText: s.exact_text,
            sha256: s.sha256
        }));
        await this.policySectionRepository.save(policySections);
        return policy;
    }



    /** Get policy by documentId with top-level meta only */
    async getPolicy(documentId: string) {
        return this.policyRepository.findOne({ where: { documentId } });
    }

    /** Get one section by (documentId, sectionId) */
    async getSection(documentId: string, sectionId: string) {
        const policy = await this.policyRepository.findOne({ where: { documentId } });
        if (!policy) return null;
        return this.policySectionRepository.findOne({
            where: { policyId_sectionId: { policyId: policy.id, sectionId } } as any
        });
    }
    async getPolicyData(documentId: string): Promise<Policy | null> {
        const policy: any = await this.policyRepository.findOne({ where: { documentId } });
        if (!policy) return null;
        const sections = await this.policySectionRepository.find({
            where: { policyId: policy.id },
            order: { level: 'asc', sectionId: 'asc' }
        });
        return {
            ...policy,
            document_id: policy.policyId,
            sections
        }
    }

    /** List children of a given parent section (by dotted id) */
    async listChildren(documentId: string, parentSectionId: string | null) {
        const policy = await this.policyRepository.findOne({ where: { documentId } });
        if (!policy) return [];
        return this.policySectionRepository.find({
            where: { policyId: policy.id, parentId: parentSectionId ?? undefined },
            order: { level: 'asc', sectionId: 'asc' }
        });
    }

    /** Get a whole policy flattened (ordered) */
    async listAllSections(documentId: string) {
        const policy = await this.policyRepository.findOne({ where: { documentId } });
        if (!policy) return [];
        return this.policySectionRepository.find({
            where: { policyId: policy.id },
            order: { level: 'asc', sectionId: 'asc' }
        });
    }

    /** Build an in-memory tree (parent → children) */
    async getPolicyTree(documentId: string) {
        const policy = await this.policyRepository.findOne({ where: { documentId } });
        if (!policy) return null;

        const rows = await this.policySectionRepository.find({
            where: { policyId: policy.id },
            order: { level: 'asc', sectionId: 'asc' }
        });

        const byId = new Map(rows.map(r => [r.sectionId, { ...r, children: [] as any[] }]));
        const roots: any[] = [];
        for (const r of byId.values()) {
            const record = r as any;
            if (record.parentId && byId.has(record.parentId)) {
                const parent = byId.get(record.parentId) as any;
                parent.children.push(record);
            } else {
                roots.push(record);
            }
        }
        return { documentId, version: policy.version, sections: roots };
    }
}