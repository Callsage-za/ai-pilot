import { Controller, Post, Get, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { JiraCredentialsService } from './jira-credentials.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@Controller('jira-credentials')
@UseGuards(JwtAuthGuard)
export class JiraCredentialsController {
  constructor(private readonly jiraCredentialsService: JiraCredentialsService) {}

  @Post()
  async saveCredentials(
    @Request() req: { user: User },
    @Body() body: {
      jiraUrl: string;
      jiraUser: string;
      jiraApiKey: string;
      projectKey?: string;
    }
  ) {
    return await this.jiraCredentialsService.saveCredentials(
      req.user.organizationId,
      body.jiraUrl,
      body.jiraUser,
      body.jiraApiKey,
      body.projectKey
    );
  }

  @Get()
  async getCredentials(@Request() req: { user: User }) {
    return await this.jiraCredentialsService.getCredentials(req.user.organizationId);
  }

  @Delete()
  async deleteCredentials(@Request() req: { user: User }) {
    await this.jiraCredentialsService.deleteCredentials(req.user.organizationId);
    return { message: 'Jira credentials deleted successfully' };
  }
}

