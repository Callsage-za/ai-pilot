import { Module } from '@nestjs/common';
import { JiraTicketsService } from './jira-tickets.service';
import { JiraTicketsController } from './jira-tickets.controller';
import { ElasticModule } from '../elastic/elastic.module';
import { GeminiModule } from '../gemini/gemini.module';
import { JiraCredentialsModule } from '../jira-credentials/jira-credentials.module';

@Module({
    imports: [ElasticModule, GeminiModule, JiraCredentialsModule],
    controllers: [JiraTicketsController],
    providers: [JiraTicketsService],
    exports: [JiraTicketsService]
})
export class JiraTicketsModule {}
