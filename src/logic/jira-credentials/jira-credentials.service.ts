import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JiraCredentials } from '../../entities/jira-credentials.entity';

@Injectable()
export class JiraCredentialsService {
  constructor(
    @InjectRepository(JiraCredentials)
    private readonly jiraCredentialsRepository: Repository<JiraCredentials>,
  ) {}

  async saveCredentials(organizationId: string, jiraUrl: string, jiraUser: string, jiraApiKey: string, projectKey?: string): Promise<JiraCredentials> {
    // Check if credentials already exist for this organization
    const existingCredentials = await this.jiraCredentialsRepository.findOne({
      where: { organizationId }
    });

    if (existingCredentials) {
      // Update existing credentials
      existingCredentials.jiraUrl = jiraUrl;
      existingCredentials.jiraUser = jiraUser;
      existingCredentials.jiraApiKey = jiraApiKey;
      existingCredentials.projectKey = projectKey || '';
      existingCredentials.isActive = true;
      return await this.jiraCredentialsRepository.save(existingCredentials);
    } else {
      // Create new credentials
      const credentials = this.jiraCredentialsRepository.create({
        organizationId,
        jiraUrl,
        jiraUser,
        jiraApiKey,
        projectKey,
        isActive: true
      });
      return await this.jiraCredentialsRepository.save(credentials);
    }
  }

  async getCredentials(organizationId: string): Promise<JiraCredentials | null> {
    return await this.jiraCredentialsRepository.findOne({
      where: { organizationId, isActive: true }
    });
  }

  async deleteCredentials(organizationId: string): Promise<void> {
    await this.jiraCredentialsRepository.update(
      { organizationId },
      { isActive: false }
    );
  }
}

