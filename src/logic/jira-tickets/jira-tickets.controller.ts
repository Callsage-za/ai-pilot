import { Controller, Post, Body, HttpException, HttpStatus, Get, Param, Put, UseGuards, Request } from '@nestjs/common';
import { JiraTicketsService } from './jira-tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';
import { Public } from '../auth/decorators/public.decorator';
import z from 'zod';

interface IngestRequest {
    projectKey: string;
}

@Controller('jira-tickets')
@UseGuards(JwtAuthGuard)
export class JiraTicketsController {
    
    constructor(private readonly jiraTicketsService: JiraTicketsService) { 
    }
    @Public()
    @Post('jira-update')
    async jiraUpdate(@Body() body: any) {
        
        // Handle different webhook events
        if (body.webhookEvent === 'jira:issue_deleted') {
            console.log("Issue deleted event received");
            await this.jiraTicketsService.handleJiraIssueDeletion(body.issue);
        } else if (body.webhookEvent === 'jira:issue_updated' || body.webhookEvent === 'jira:issue_created') {
            console.log("Issue updated/created event received");
            await this.jiraTicketsService.handleJiraIssue(body.issue, body.key);
        } else {
            console.log("Unknown webhook event:", body.webhookEvent);
        }
        
        return { message: "OK" };
    }
    @Get('getProjects') 
    async getProjects() {
        return this.jiraTicketsService.getProjects();
    }

    @Get('issue-types/:projectKey')
    async getIssueTypes(@Param('projectKey') projectKey: string) {
        return this.jiraTicketsService.getAvailableIssueTypes(projectKey);
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

    @Post('issue')
    async createIssue(@Body() body: any) {
        const schema = z.object({
            title: z.string().min(1),
            description: z.string().min(1),
            priority: z.enum(['high', 'medium', 'low']).default('medium'),
            labels: z.array(z.string().min(1)).optional(),
            dueDate: z.string().optional(),
            assigneeAccountId: z.string().optional(),
            projectKey: z.string().min(1).optional(),
            issueType: z.string().min(1).optional(),
            extraFields: z.record(z.string(), z.any()).optional()
        });

        const payload = schema.parse(body);
        return this.jiraTicketsService.createJiraIssue(payload);
    }

    @Post('issue/:issueKey/comment')
    async addComment(@Param('issueKey') issueKey: string, @Body() body: any) {
        const schema = z.object({
            comment: z.string().min(1)
        });
        const payload = schema.parse(body);
        return this.jiraTicketsService.addComment(issueKey, payload.comment);
    }

    @Post('issue/:issueKey/transition')
    async transitionIssue(@Param('issueKey') issueKey: string, @Body() body: any) {
        const schema = z.object({
            state: z.string().min(1)
        });
        const payload = schema.parse(body);
        return this.jiraTicketsService.transitionIssue(issueKey, payload.state);
    }

    @Post('issue/:issueKey/assign')
    async assignIssue(@Param('issueKey') issueKey: string, @Body() body: any) {
        const schema = z.object({
            accountId: z.string().min(1)
        });
        const payload = schema.parse(body);
        return this.jiraTicketsService.reassignIssue(issueKey, payload.accountId);
    }

    @Get()
    async getAllTickets(@Request() req: { user: User }) {
        return this.jiraTicketsService.getAllTickets(req.user);
    }

    @Get('users')
    async getUsers() {
        return this.jiraTicketsService.getUsers();
    }

    @Put(':issueKey/assign')
    async assignTicket(@Param('issueKey') issueKey: string, @Body() body: { assigneeId: string }) {
        return this.jiraTicketsService.reassignIssue(issueKey, body.assigneeId);
    }
}
