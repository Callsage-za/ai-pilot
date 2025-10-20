import { Injectable } from "@nestjs/common";
import { Call, PolicyDocument } from "src/utils/types";
import { AudioFile } from "src/entities/audio-file.entity";
import { Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { AudioEntities, AudioEvidence } from "src/entities";

@Injectable()
export class CallMemoryService {
    constructor(

        @InjectRepository(AudioFile)
        private readonly audioFileRepository: Repository<AudioFile>,
        @InjectRepository(AudioEntities)
        private readonly audioEntitiesRepository: Repository<AudioEntities>,
        @InjectRepository(AudioEvidence)
        private readonly audioEvidenceRepository: Repository<AudioEvidence>,
    ) {

    }
    async saveCall(call: Call, userId: string, organizationId: string) {
        const audioFileData: Partial<AudioFile> = {
            path: call.path,
            transcript: call.transcript,
            summary: call.summary,
            classification: call?.classification,
            sentiment: call?.sentiment,
            severity: call?.severity,
            resolved: call.resolved || false,
            userId,
            organizationId,
        }
        const audioFile = await this.audioFileRepository.save(audioFileData);
        const audioEntity = await this.audioEntitiesRepository.save({
            accountId: call.audioEntity.accountId,
            orderId: call.audioEntity.orderId,
            product: call.audioEntity.product,
            audioId: audioFile.id,
        });
        const audioEvidence = await this.audioEvidenceRepository.save(call.audioEvidence.map(evidence => ({
            text: evidence.text,
            startMs: evidence.startMs,
            endMs: evidence.endMs,
            audioId: audioFile.id,
        })));
        return this.audioFileRepository.findOne({
            where: { id: audioFile.id }, relations: {
                audioEntity: true,
                evidence: true,
            }
        });

    }
    async getCall(id: string) {
        return this.audioFileRepository.findOne({ where: { id }, relations: {
            audioEntity: true,
            evidence: true,
        } });
    }
    async getAllAudioFiles(userId: string, organizationId: string) {
        return this.audioFileRepository.find({
            where: {
                userId,
                organizationId
            },
            relations: {
                audioEntity: true,
                evidence: true,
            }
        })
    }

    async updateClassification(id: string, classification: string, userId: string, organizationId: string) {
        const audioFile = await this.audioFileRepository.findOne({
            where: { id, userId, organizationId }
        });

        if (!audioFile) {
            throw new Error('Audio file not found or access denied');
        }

        audioFile.classification = classification as any;
        return this.audioFileRepository.save(audioFile);
    }
}