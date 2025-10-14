import { BadRequestException, Injectable } from '@nestjs/common';
import { SpeechService } from '../speech/speech.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { ChatMemoryService } from '../chat-memory/chat-memory.service';
import { GeminiService } from '../gemini/gemini.service';
import { PolicyDocumentsService } from '../policy-documents/policy-documents.service';
import { JiraTicketsService } from '../jira-tickets/jira-tickets.service';
import { ToolActionType } from './dto/execute-tool.dto';
import * as path from 'path';

@Injectable()
export class ToolsService {
  constructor(
    private readonly speechService: SpeechService,
    private readonly fileUploadService: FileUploadService,
    private readonly chatMemoryService: ChatMemoryService,
    private readonly geminiService: GeminiService,
    private readonly policyDocumentsService: PolicyDocumentsService,
    private readonly jiraTicketsService: JiraTicketsService,
  ) {}

  async transcribeAudio(fileIds: string[] = []) {
    if (!fileIds?.length) {
      throw new BadRequestException('Audio transcription requires at least one uploaded file');
    }

    const results: any[] = [];

    for (const fileId of fileIds) {
      const file = await this.fileUploadService.getFileUpload(fileId);
      console.log(file);
      
      if (!file) {
        throw new BadRequestException(`File with id ${fileId} was not found`);
      }
     
      if (!this.speechService.isAudioFile(file.mimeType)) {
        throw new BadRequestException(`File ${file.originalName} is not an audio file`);
      }

      const localPath = file.localPath;
      const filename = path.basename(localPath);
      const transcriptionResult = await this.speechService.callSpeech(localPath, filename, file.user, file.externalPath);

      await this.fileUploadService.markAsProcessed(fileId);

      results.push({ 
        fileId,
        fileName: file.originalName,
        summary: transcriptionResult?.summary,
        transcript: transcriptionResult?.transcript,
        classification: transcriptionResult?.classification,
        call: transcriptionResult?.call,
        audioPath: transcriptionResult?.audioPath ?? file.externalPath,
      });
    }

    const primary = results[0];
    const transcriptPreview = primary?.transcript
      ? primary.transcript.slice(0, 1500)
      : undefined;

    const messageLines: string[] = [];
    messageLines.push('### Transcription Complete');

    if (primary?.summary) {
      messageLines.push(`**Summary:** ${primary.summary}`);
    }

    if (primary?.classification) {
      const classification = primary.classification;
      messageLines.push(
        `**Classification:** ${classification.classification ?? 'unknown'} (${classification.severity ?? 'n/a'} severity, sentiment: ${classification.sentiment ?? 'n/a'})`,
      );
      if (classification.intents?.length) {
        messageLines.push(`**Intents:** ${classification.intents.join(', ')}`);
      }
    }

    if (transcriptPreview) {
      messageLines.push('\n---\n');
      messageLines.push('```');
      messageLines.push(transcriptPreview);
      messageLines.push('```');
    }

    const sources = results.map((result) => ({
      type: 'file.audio',
      title: result.fileName,
      snippet: result.summary ?? 'Audio transcription',
      key: result.audioPath,
    }));

    return {
      tool: ToolActionType.TRANSCRIBE_AUDIO,
      message: messageLines.join('\n'),
      data: results,
      sources,
    };
  }

  async summarizeConversation(conversationId?: string, input?: string) {
    const history = conversationId
      ? await this.chatMemoryService.getRecentHistoryAsc(conversationId, 20)
      : [];

    if (!history.length && !input) {
      throw new BadRequestException('Provide a conversation or text to summarize');
    }

    const contextText = history
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You are an expert contact center analyst.
Summarize the conversation focusing on:
- Customer intent and tone
- Key actions already taken
- Outstanding follow-ups or risks
Provide actionable bullet points and keep it under 200 words.`;

    const userPrompt = `Conversation:
${contextText || '(no history)'}

Additional notes:
${input ?? 'None provided'}

Return a concise markdown summary with sections for **Overview**, **Key Points**, and **Next Steps**.`;

    const { text } = await this.geminiService.complete(systemPrompt, userPrompt, history, 0.2);

    return {
      tool: ToolActionType.SUMMARIZE_CONVERSATION,
      message: text?.trim() || 'No summary generated.',
    };
  }

  async policyAudit(query: string, conversationId?: string) {
    if (!query?.trim()) {
      throw new BadRequestException('Policy audit requires a question or description');
    }

    const result = await this.policyDocumentsService.policyDocumentsSearch(query);

    return {
      tool: ToolActionType.POLICY_AUDIT,
      message: result.answer || 'No relevant policy guidance found.',
      sources: result.sources,
      data: result,
    };
  }

  async browsePolicies(query: string) {
    if (!query?.trim()) {
      throw new BadRequestException('Provide a topic to browse policies');
    }

    const result = await this.policyDocumentsService.policyDocumentsSearch(query);

    return {
      tool: ToolActionType.BROWSE_POLICIES,
      message: result.answer || 'No matching policies found.',
      sources: result.sources,
      data: result,
    };
  }

  async createJiraIssueFromPrompt(input: string, conversationId?: string) {
    if (!input?.trim()) {
      throw new BadRequestException('Describe the issue that should become a Jira ticket');
    }

    const history = conversationId
      ? await this.chatMemoryService.getRecentHistoryAsc(conversationId, 12)
      : [];

    const historySummary = history
      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `You help support agents convert requests into Jira tickets.
Return JSON ONLY with keys: title, description, priority, labels?, dueDate?, assigneeAccountId?, projectKey?, issueType?, comment?, status?, extraFields?.
- priority must be one of: high, medium, low
- status, when provided, should be "in_progress" or "done" (or the Jira status name)
- title under 15 words
- issueType should be one of: Task, Story, Epic, Sub-task (use "Task" as default if unsure)
- description should be 2-4 short paragraphs with bullet remedial steps if needed
- labels must be an array of short strings when present
- assigneeAccountId should be the Jira accountId (if unknown, omit it)
- dueDate should be in YYYY-MM-DD format
- extraFields can include any additional Jira field payload (object)
- comment is optional follow-up text that should be added after ticket creation
`;

    const { text } = await this.geminiService.complete(
      systemPrompt,
      `Conversation context:\n${historySummary || 'None'}\n\nRequest:\n${input}`,
      history,
      0.2,
    );

    let plan: any;
    try {
      console.log('text', text);
      plan = JSON.parse(text?.replace(/^```json\s*|\s*```$/g, '') || '{}');
    } catch (error) {
      throw new BadRequestException('Could not interpret Jira ticket details from the assistant response');
    }

    if (!plan?.title || !plan?.description ) {
      throw new BadRequestException('Unable to derive Jira ticket details from the request');
    }

    console.log('plan', plan);
    const priority = String(plan.priority)?.toLowerCase()||'medium';
    
    console.log('priority', priority);
    const labels = Array.isArray(plan.labels) ? plan.labels.map((label: any) => String(label)) : undefined;
    const dueDate = typeof plan.dueDate === 'string' ? plan.dueDate : undefined;
    const assigneeAccountId = typeof plan.assigneeAccountId === 'string'
      ? plan.assigneeAccountId
      : (typeof plan.assignee === 'string' ? plan.assignee : undefined);
    const projectKey = typeof plan.projectKey === 'string' && plan.projectKey.trim().length > 0
      ? plan.projectKey.trim()
      : undefined;
    const issueType = typeof plan.issueType === 'string' && plan.issueType.trim().length > 0
      ? plan.issueType.trim()
      : undefined;
    const extraFields = typeof plan.extraFields === 'object' && plan.extraFields !== null
      ? plan.extraFields
      : undefined;

    const ticket = await this.jiraTicketsService.createJiraIssue({
      title: plan.title,
      description: plan.description,
      priority: priority as "high" | "medium" | "low",
      labels,
      dueDate,
      assigneeAccountId,
      projectKey,
      issueType,
      extraFields,
    });

    const followUpMessages: string[] = [`Created Jira issue **${ticket.key}** with priority **${priority}**.`];

    if (plan.comment) {
      try {
        await this.jiraTicketsService.addComment(ticket.key, String(plan.comment));
        followUpMessages.push('Added follow-up comment to the ticket.');
      } catch (error) {
        console.error('Failed to add comment to Jira issue', error);
        followUpMessages.push('Unable to add comment automatically.');
      }
    }

    if (plan.status) {
      try {
        const transition = await this.jiraTicketsService.transitionIssue(ticket.key, String(plan.status));
        followUpMessages.push(`Moved ticket to **${transition.transition}**.`);
      } catch (error) {
        console.error('Failed to transition Jira issue', error);
        followUpMessages.push('Could not update ticket status automatically.');
      }
    }

    return {
      tool: ToolActionType.CREATE_JIRA,
      message: followUpMessages.join(' '),
      data: {
        issueKey: ticket.key,
        fields: ticket.fields,
      },
    };
  }
}
