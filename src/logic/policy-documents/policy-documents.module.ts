import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PolicyDocumentsController } from './policy-documents.controller';
import { PolicyDocumentsService } from './policy-documents.service';
import { ChatMemoryModule } from '../chat-memory/chat-memory.module';
import { GeminiModule } from '../gemini/gemini.module';
import { ElasticModule } from '../elastic/elastic.module';

@Module({
  imports: [PrismaModule,ChatMemoryModule,ChatMemoryModule,GeminiModule,ElasticModule ],
  controllers: [PolicyDocumentsController],
  providers: [PolicyDocumentsService],
  exports: [PolicyDocumentsService],
})
export class PolicyDocumentsModule {}
