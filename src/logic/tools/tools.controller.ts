import { BadRequestException, Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { ToolsService } from './tools.service';
import * as executeToolDto from './dto/execute-tool.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}
  @UseGuards(JwtAuthGuard)  
  @Post('execute')
  async execute(@Request() req: { user: User }, @Body() body: executeToolDto.ExecuteToolDto) {
    switch (body.tool) {
      case executeToolDto.ToolActionType.TRANSCRIBE_AUDIO:
        return this.toolsService.transcribeAudio(body.fileIds);
      case executeToolDto.ToolActionType.SUMMARIZE_CONVERSATION:
        return this.toolsService.summarizeConversation(body.conversationId, body.input);
      case executeToolDto.ToolActionType.POLICY_AUDIT:
        return this.toolsService.policyAudit(body.input ?? '', body.conversationId ?? '', req.user.id, req.user.organizationId);
      case executeToolDto.ToolActionType.CREATE_JIRA:
        return this.toolsService.createJiraIssueFromPrompt(body.input ?? '', body.conversationId);
      case executeToolDto.ToolActionType.BROWSE_POLICIES:
        return this.toolsService.browsePolicies(body.input ?? '', req.user.id, req.user.organizationId);
      default:
        throw new BadRequestException('Unknown tool action');
    }
  }
}
