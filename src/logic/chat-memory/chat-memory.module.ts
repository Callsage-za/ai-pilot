import { Module } from '@nestjs/common';
import { ChatMemoryService } from './chat-memory.service';
import { GeminiModule } from '../gemini/gemini.module';
import { PolicyService } from './policy.service';
import { CallMemoryService } from './call-memory.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation, Message, Policy, PolicySection, PolicyDocument, AudioFile, AudioEntities, AudioEvidence, InfoSource } from 'src/entities';

@Module({
    imports: [
        GeminiModule,
        TypeOrmModule.forFeature([Conversation, Message, Policy, PolicySection, PolicyDocument, AudioFile, AudioEntities, AudioEvidence, InfoSource])
    ],
    exports: [ChatMemoryService, PolicyService, CallMemoryService],
    providers: [ChatMemoryService, PolicyService, CallMemoryService],
})
export class ChatMemoryModule {}
