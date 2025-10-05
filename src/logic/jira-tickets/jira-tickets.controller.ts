import { Controller, Post, Body, HttpException, HttpStatus, Get } from '@nestjs/common';
import { JiraTicketsService } from './jira-tickets.service';
import z from 'zod';

interface IngestRequest {
    projectKey: string;
}

@Controller('jira-tickets')
export class JiraTicketsController {
    
    constructor(private readonly jiraTicketsService: JiraTicketsService) { 
    }
    @Get('getProjects') 
    async getProjects() {
        return this.jiraTicketsService.getProjects();
    }
    @Post('ingest')
    async ingestProject(@Body() body: IngestRequest) {
        try {
            const { projectKey } = body;

            if (!projectKey?.trim()) {
                throw new HttpException('Project key is required', HttpStatus.BAD_REQUEST);
            }

           return await this.jiraTicketsService.ingestProject(projectKey);
            return { message: `Successfully ingested project: ${projectKey}` };
        } catch (err: any) {
            if (err instanceof HttpException) {
                throw err;
            }
            throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @Post('query')
    async query(@Body() body: any) {

        const schema = z.object({
            query: z.string().min(1),
            size: z.number().optional().default(20),
            projectHint: z.string().optional(),
            defaultDateField: z.enum(["created", "updated", "resolutiondate", "duedate"]).optional().default("updated")
        });
        const p = schema.parse(body);
        
        return this.jiraTicketsService.ask(p);
    }
}
