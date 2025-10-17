import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JiraCredentials } from '../../entities/jira-credentials.entity';
import { JiraCredentialsService } from './jira-credentials.service';
import { JiraCredentialsController } from './jira-credentials.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JiraCredentials])],
  providers: [JiraCredentialsService],
  controllers: [JiraCredentialsController],
  exports: [JiraCredentialsService],
})
export class JiraCredentialsModule {}

