import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JiraTicketsService } from './jira-tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@Controller('jira-tickets')
@UseGuards(JwtAuthGuard)
export class JiraTicketsController {
  constructor(private readonly jiraTicketsService: JiraTicketsService) {}

  @Get('projects')
  async getProjects(@Request() req: { user: User }) {
    return await this.jiraTicketsService.getProjects(req.user.organizationId);
  }

  @Get('projects/:projectKey/issue-types')
  async getProjectIssueTypes(
    @Request() req: { user: User },
    @Body() body: { projectKey: string }
  ) {
    return await this.jiraTicketsService.getProjectIssueTypes(body.projectKey, req.user.organizationId);
  }

  @Post('ingest')
  async ingestProject(
    @Request() req: { user: User },
    @Body() body: { projectKey: string }
  ) {
    await this.jiraTicketsService.ingestProject(body.projectKey, req.user.organizationId);
    return { message: `Successfully ingested project ${body.projectKey}` };
  }
}