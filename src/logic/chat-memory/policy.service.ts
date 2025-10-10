import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Policy } from "./types";
import { PolicyDocument } from "src/utils/types";

@Injectable()
export class PolicyService {
    constructor(private readonly prisma: PrismaService) {

    }
    async savePolicyDocument(payload: PolicyDocument) {
        const { id, version ,} = payload;

        return this.prisma.$transaction(async (tx:any) => {
            const policyDocument = await tx?.policyDocument?.upsert({ where: { id }, update: { version }, create: { ...payload } });
            // const policy = await tx.policy.upsert({ where: { documentId: id ?? '' }, update: { version }, create: { documentId: id ?? '', version } });
        });
    }
    async getAllPolicyDocuments() {
       return this.prisma.$transaction(async (tx:any) => {
            const policyDocuments = await tx?.policyDocument?.findMany();
            return policyDocuments;
        });
       
    }
    async savePolicyFromLLM(payload: Policy) {
        const { document_id, version, sections } = payload;

        return this.prisma.$transaction(async (tx) => {
            // 1) Upsert policy shell
            const policy = await tx.policy.upsert({
                where: { documentId: document_id },
                update: { version },
                create: { documentId: document_id, version }
            });

            // 2) Replace all sections for this policy (simplest + consistent)
            await tx.policySection.deleteMany({ where: { policyId: policy.id } });

            // 3) Bulk insert sections
            // createMany is fastest; ensure prisma >=4.8
            await tx.policySection.createMany({
                data: sections.map(s => ({
                    policyId: policy.id,
                    sectionId: s.id,
                    parentId: s.parent_id ?? null,
                    level: s.level,
                    title: s.title,
                    exactText: s.exact_text,
                    sha256: s.sha256
                })),
            });

            return policy;
        });
    }



    /** Get policy by documentId with top-level meta only */
async getPolicy(documentId: string) {
    return this.prisma.policy.findUnique({ where: { documentId } });
}

/** Get one section by (documentId, sectionId) */
async getSection(documentId: string, sectionId: string) {
    const policy = await this.prisma.policy.findUnique({ where: { documentId } });
    if (!policy) return null;
    return this.prisma.policySection.findUnique({
        where: { policyId_sectionId: { policyId: policy.id, sectionId } } as any
    });
}
async getPolicyData(documentId: string): Promise<Policy | null> {
    const policy:any = await this.prisma.policy.findUnique({ where: { documentId } });
    if (!policy) return null;
    const sections = await this.prisma.policySection.findMany({
        where: { policyId: policy.id },
        orderBy: [{ level: 'asc' }, { sectionId: 'asc' }]
    });
    return {
        ...policy,
        document_id: policy.policyId,
        sections
    }
}

/** List children of a given parent section (by dotted id) */
async listChildren(documentId: string, parentSectionId: string | null) {
    const policy = await this.prisma.policy.findUnique({ where: { documentId } });
    if (!policy) return [];
    return this.prisma.policySection.findMany({
        where: { policyId: policy.id, parentId: parentSectionId ?? null },
        orderBy: [{ level: 'asc' }, { sectionId: 'asc' }]
    });
}

/** Get a whole policy flattened (ordered) */
async listAllSections(documentId: string) {
    const policy = await this.prisma.policy.findUnique({ where: { documentId } });
    if (!policy) return [];
    return this.prisma.policySection.findMany({
        where: { policyId: policy.id },
        orderBy: [{ level: 'asc' }, { sectionId: 'asc' }]
    });
}

/** Build an in-memory tree (parent → children) */
async getPolicyTree(documentId: string) {
    const policy = await this.prisma.policy.findUnique({ where: { documentId } });
    if (!policy) return null;

    const rows = await this.prisma.policySection.findMany({
        where: { policyId: policy.id },
        orderBy: [{ level: 'asc' }, { sectionId: 'asc' }]
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