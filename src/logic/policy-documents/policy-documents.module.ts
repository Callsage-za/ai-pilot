import { Module } from '@nestjs/common';
import { PolicyDocumentsController } from './policy-documents.controller';
import { PolicyDocumentsService } from './policy-documents.service';
import { ChatMemoryModule } from '../chat-memory/chat-memory.module';
import { GeminiModule } from '../gemini/gemini.module';
import { ElasticModule } from '../elastic/elastic.module';
import { SocketGatewayModule } from '../socket-gateway/socket-gateway.module';

@Module({
  imports: [ChatMemoryModule, GeminiModule, ElasticModule, SocketGatewayModule],
  controllers: [PolicyDocumentsController],
  providers: [PolicyDocumentsService],
  exports: [PolicyDocumentsService],
})
export class PolicyDocumentsModule {}
