import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
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
  @Get('users')
  async getUsers(@Request() req: { user: User }) {
    return await this.jiraTicketsService.getUsers(req.user.organizationId);
  }
  @Get()
  async getTickets(@Request() req: { user: User }) {
    return await this.jiraTicketsService.getAllTickets(req.user);
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

  @Put(':ticketKey/assign')
  async assignTicket(
    @Request() req: { user: User },
    @Param('ticketKey') ticketKey: string,
    @Body() body: { assigneeId: string }
  ) {
    await this.jiraTicketsService.reassignIssue(ticketKey, body.assigneeId, req.user.organizationId);
    return { message: `Successfully assigned ticket ${ticketKey}` };
  }

  @Post('assign-from-chat')
  async assignTicketFromChat(
    @Request() req: { user: User },
    @Body() body: { ticketKey: string; assigneeName: string }
  ) {
    return await this.jiraTicketsService.assignTicketFromChat(body.ticketKey, body.assigneeName, req.user.organizationId);
  }
}