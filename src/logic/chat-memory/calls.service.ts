import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CallsService {
    constructor(private readonly prisma: PrismaService) {
    }
    async saveCallLocallyAndIndex({
        callId, startedAt, endedAt, agentId, customerId,
        transcriptText, transcriptUri, transcriptSha256, language,
        summary, classification, sentiment, severity, intents, entities, evidence, classifierConf,
        policyAudit
    }: {
        callId: string;
        startedAt: Date;
        endedAt?: Date;
        agentId?: string;
        customerId?: string;
        transcriptText?: string;
        transcriptUri?: string;
        transcriptSha256?: string;
        language?: string;
        summary?: string;
        classification?: string;
        sentiment?: string;
        severity?: string;
        intents?: string[];
        entities?: any;
        evidence?: any[];
        classifierConf?: number;
        policyAudit?: any;
    }) {
        // 1) Upsert to Postgres (source of truth)
        const call = await this.prisma?.call?.upsert({
            where: { callId },
            create: {
                callId, startedAt, endedAt, durationSec: endedAt ? Math.max(0, Math.round((+endedAt - +startedAt) / 1000)) : null,
                agentId, customerId,
                transcriptText, transcriptUri, transcriptSha256, language,
                summary, classification, sentiment, severity, intentsJson: intents ?? [],
                entities: entities ?? undefined,
                evidence: evidence ?? undefined,
                classifierConf: classifierConf ?? null,
                policyAudit: policyAudit ?? null
            },
            update: {
                endedAt, durationSec: endedAt ? Math.max(0, Math.round((+endedAt - +startedAt) / 1000)) : undefined,
                agentId, customerId,
                transcriptText, transcriptUri, transcriptSha256, language,
                summary, classification, sentiment, severity, intentsJson: intents ?? undefined,
                entities: entities ?? undefined,
                evidence: evidence ?? undefined,
                classifierConf: classifierConf ?? undefined,
                policyAudit: policyAudit ?? undefined
            }
        });

        // 2) Index to Elastic (lightweight doc for search/analytics)



        return call;
    }
    async getCall(callId: string) {
        return this.prisma.call.findUnique({ where: { callId } });
    }

    // List calls for a manager dashboard: DB filters first
    async listCalls({ since, until, classification, agentId }: {
        since?: Date; until?: Date; classification?: string; agentId?: string;
    }) {
        return this.prisma.call.findMany({
            where: {
                startedAt: { gte: since, lte: until },
                classification: classification ?? undefined,
                agentId: agentId ?? undefined
            },
            orderBy: { startedAt: "desc" },
            take: 200
        });
    }
}