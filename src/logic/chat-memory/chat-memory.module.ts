import { Module } from '@nestjs/common';
import { ChatMemoryService } from './chat-memory.service';
import { GeminiModule } from '../gemini/gemini.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PolicyService } from './policy.service';
import { CallMemoryService } from './call-memory.service';

@Module({
    imports: [GeminiModule, PrismaModule],
    exports: [ChatMemoryService, PolicyService, CallMemoryService],
    providers: [ChatMemoryService, PolicyService, CallMemoryService],
})
export class ChatMemoryModule {}
