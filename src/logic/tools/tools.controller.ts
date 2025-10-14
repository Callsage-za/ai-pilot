import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { ToolsService } from './tools.service';
import * as executeToolDto from './dto/execute-tool.dto';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post('execute')
  async execute(@Body() body: executeToolDto.ExecuteToolDto) {
    switch (body.tool) {
      case executeToolDto.ToolActionType.TRANSCRIBE_AUDIO:
        return this.toolsService.transcribeAudio(body.fileIds);
      case executeToolDto.ToolActionType.SUMMARIZE_CONVERSATION:
        return this.toolsService.summarizeConversation(body.conversationId, body.input);
      case executeToolDto.ToolActionType.POLICY_AUDIT:
        return this.toolsService.policyAudit(body.input ?? '', body.conversationId);
      case executeToolDto.ToolActionType.CREATE_JIRA:
        return this.toolsService.createJiraIssueFromPrompt(body.input ?? '', body.conversationId);
      case executeToolDto.ToolActionType.BROWSE_POLICIES:
        return this.toolsService.browsePolicies(body.input ?? '');
      default:
        throw new BadRequestException('Unknown tool action');
    }
  }
}
