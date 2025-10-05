import { Module } from '@nestjs/common';
import { ChatMemoryService } from './chat-memory.service';
import { GeminiModule } from '../gemini/gemini.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PolicyService } from './policy.service';
import { CallsService } from './calls.service';

@Module({
    imports: [GeminiModule, PrismaModule],
    exports: [ChatMemoryService, PolicyService, CallsService],
    providers: [ChatMemoryService, PolicyService, CallsService],
})
export class ChatMemoryModule {}
