import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Policy } from "./types";
import { Call, PolicyDocument } from "src/utils/types";

@Injectable()
export class CallMemoryService {
    constructor(private readonly prisma: PrismaService) {

    }
    async saveCall(call: Call) {
        return this.prisma.audioFile.create({
            data: {
                path: call.path,
                transcript: call.transcript,
                summary: call.summary,
                classification: call.classification,
                sentiment: call.sentiment,
                severity: call.severity,
                resolved: call.resolved || false,
                audioEntity: call.audioEntity ? {
                    create: {
                        accountId: call.audioEntity.accountId,
                        orderId: call.audioEntity.orderId,
                        product: call.audioEntity.product,
                    }
                } : undefined,
                evidence: call.audioEvidence ? {
                    create: call.audioEvidence.map(evidence => ({
                        text: evidence.text,
                        startMs: evidence.startMs.toString(),
                        endMs: evidence.endMs.toString(),
                    }))
                } : undefined,
            }
        });
    }
    async getCall(id: string) {
        return this.prisma.call.findUnique({ where: { id } });
    }
}