import { Module } from '@nestjs/common';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { SpeechModule } from '../speech/speech.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { ChatMemoryModule } from '../chat-memory/chat-memory.module';
import { GeminiModule } from '../gemini/gemini.module';
import { PolicyDocumentsModule } from '../policy-documents/policy-documents.module';
import { JiraTicketsModule } from '../jira-tickets/jira-tickets.module';

@Module({
  imports: [
    SpeechModule,
    FileUploadModule,
    ChatMemoryModule,
    GeminiModule,
    PolicyDocumentsModule,
    JiraTicketsModule,
  ],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
