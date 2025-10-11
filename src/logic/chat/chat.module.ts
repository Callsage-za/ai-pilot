import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatMemoryModule } from '../chat-memory/chat-memory.module';
import { GeminiModule } from '../gemini/gemini.module';
import { JiraTicketsModule } from '../jira-tickets/jira-tickets.module';
import { PolicyDocumentsModule } from '../policy-documents/policy-documents.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { SpeechModule } from '../speech/speech.module';
import { CallSearchModule } from '../call-search/call-search.module';

@Module({
    imports: [
        ChatMemoryModule,
        GeminiModule,
        JiraTicketsModule,
        PolicyDocumentsModule,
        FileUploadModule,
        SpeechModule,
        CallSearchModule
    ],
    controllers: [ChatController],
    providers: [ChatService],
    exports: [ChatService],
})
export class ChatModule {}
