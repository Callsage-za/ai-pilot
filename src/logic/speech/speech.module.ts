import { Module } from '@nestjs/common';
import { SpeechService } from './speech.service';
import { SpeechController } from './speech.controller';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { GeminiModule } from '../gemini/gemini.module';
import { ElasticModule } from '../elastic/elastic.module';
import { JiraTicketsModule } from '../jira-tickets/jira-tickets.module';
import { ChatMemoryModule } from '../chat-memory/chat-memory.module';

@Module({
    imports: [
        FileUploadModule,
        GeminiModule,
        ElasticModule,
        JiraTicketsModule,
        ChatMemoryModule
    ],
    controllers: [SpeechController],
    providers: [SpeechService],
    exports: [SpeechService],
})
export class SpeechModule {}
