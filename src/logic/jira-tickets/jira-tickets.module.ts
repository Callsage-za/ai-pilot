import { Module } from '@nestjs/common';
import { JiraTicketsService } from './jira-tickets.service';
import { JiraTicketsController } from './jira-tickets.controller';
import { ElasticModule } from '../elastic/elastic.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
    imports: [ElasticModule, GeminiModule],
    controllers: [JiraTicketsController],
    providers: [JiraTicketsService],
    exports: [JiraTicketsService]
})
export class JiraTicketsModule {}
