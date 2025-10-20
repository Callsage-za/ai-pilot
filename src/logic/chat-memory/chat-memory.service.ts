import { Injectable } from '@nestjs/common';
import { ChatMessage, ConversationState, Role } from './types';
import { REWRITE_SYSTEM, SUMMARIZE_SYSTEM, buildRewriteUser } from './prompts';
import { GeminiService } from '../gemini/gemini.service';
import { InfoSource as InfoSourceType } from '../../utils/types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, Message, InfoSource, MessageAttachments } from 'src/entities';

@Injectable()
export class ChatMemoryService {

  private MAX_MESSAGES = 12;   // prompt budget
  private SUMMARIZE_AT = 10;   // when to update summary

  constructor(
    private readonly geminiService: GeminiService,
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(InfoSource)
    private readonly infoSourceRepository: Repository<InfoSource>,
    @InjectRepository(MessageAttachments)
    private readonly messageAttachmentsRepository: Repository<MessageAttachments>,
  ) { }

  async ensureConversation(userId: string, organizationId: string, conversationId?: string) {
    if (conversationId) {
      const c = await this.conversationRepository.findOne({
        where: {
          id: conversationId,
          userId,
          organizationId
        }
      });
      if (c) return c;
    }
    return this.conversationRepository.save({ userId, organizationId, title: '' });
  }


  async addMessageWithLanguage(messageData: any) {
    // Extract source from messageData
    const { source, attachments, ...messageFields } = messageData;
    console.log('attachments', attachments);

    // Save the message first
    const message = await this.messageRepository.save(messageFields);

    // Handle source relationships separately if provided
    if (source && source.length > 0) {
      const sourceEntities = source.map((s: any) => ({
        messageId: message.id,
        type: s.type || 'unknown',
        title: s.title || s.snippet || "unknown",
        snippet: s.snippet || s.title || "unknown",
        score: s.score,
        confidence: s.confidence,
        key: s.key
      }));
      console.log('attachments', attachments);
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.mimeType.startsWith('audio/')) {
            const messageAttachment = await this.messageAttachmentsRepository.save({
              messageId: message.id,
              type: 'audio',
              name: attachment.originalName,
              path: attachment.path
            });
          }
          // await this.fileUploadService.saveFileUpload(attachment, message.id);
        }
      }
      // Save sources using the InfoSource repository
      await this.infoSourceRepository.save(sourceEntities);
    }

    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        console.log('attachment', attachment);
        if (attachment.mimeType.startsWith('audio/')) {
          await this.messageAttachmentsRepository.save({
            messageId: message.id,
            type: 'audio',
            name: attachment.originalName,
            path: attachment.externalPath,
            mimeType: attachment.mimeType,
          });
        }
      }
    }
    return this.messageRepository.findOne({
      where: { id: message.id },
      relations: {
        source: true,
        messageAttachments: true
      }
    });
  }

  async getRecentHistoryAsc(conversationId: string, limit = this.MAX_MESSAGES): Promise<ChatMessage[]> {
    // Pull newest first then reverse, or fetch ascending directly
    const msgs = await this.messageRepository.find({
      where: { conversationId },
      order: { ts: 'asc' },        // important: chronological for LLMs
      relations: {
        source: true,
        messageAttachments: true
      }
    });
    const tail = msgs.slice(Math.max(0, msgs.length - limit));
    return tail.map(m => ({
      role: m.role as Role,
      content: m.content,
      ts: m.ts.getTime(),
      source: m.source,
      attachments: m.attachments,
      messageAttachments: m.messageAttachments,
      id: m.id,
      type: m.type
    }));
  }

  async getSummary(conversationId: string) {
    const c = await this.conversationRepository.findOne({
      where: { id: conversationId },
      select: { summary: true }
    });
    return c?.summary ?? undefined;
  }

  async setSummary(conversationId: string, summary: string) {
    await this.conversationRepository.update(conversationId, {
      summary
    });
  }
  async setConversationState(conversationId: string, conversationState: any) {
    await this.conversationRepository.update(conversationId, {
      conversationState
    });
  }

  async updateConversationTitle(conversationId: string, title: string) {
    const conversation = await this.conversationRepository.findOne({ where: { id: conversationId } });
    if (conversation) {
      if (conversation.title == "null" || conversation.title == "") {
        await this.conversationRepository.update(conversationId, {
          title
        });
      }

    }
  }

  private async maybeSummarize(conversationId: string) {
    const count = await this.messageRepository.count({ where: { conversationId } });
    if (count >= this.SUMMARIZE_AT) {
      const hist = await this.getRecentHistoryAsc(conversationId, this.MAX_MESSAGES);
      // Map to Gemini’s expected roles via complete()
      const summary = await this.geminiService.complete(
        SUMMARIZE_SYSTEM,
        'Summarize the conversation so far.',
        hist.filter(h => h.role === 'user' || h.role === 'assistant'), // ignore 'system'
        0.2
      );
      await this.setSummary(conversationId, summary);
    }
  }

  async rewrite(conversationId: string, userInput: string): Promise<string> {
    await this.maybeSummarize(conversationId);

    const [hist, summary] = await Promise.all([
      this.getRecentHistoryAsc(conversationId, this.MAX_MESSAGES),
      this.getSummary(conversationId)
    ]);

    const chatHist = hist.filter(h => h.role === 'user' || h.role === 'assistant');
    const userPrompt = buildRewriteUser(
      summary,
      chatHist.map(h => ({ role: h.role, content: h.content })),
      userInput
    );

    const explicit = await this.geminiService.complete(
      REWRITE_SYSTEM,
      userPrompt,
      chatHist,
      0.2
    );
    return explicit;
  }
  getConversations() {
    return this.conversationRepository.find()
  }

  async getConversationsByUser(userId: string, organizationId: string) {
    return this.conversationRepository.find({
      where: {
        userId,
        organizationId
      },
      order: {
        createdAt: 'DESC'
      }
    });
  }

  async getRecentHistoryAscForUser(conversationId: string, userId: string, organizationId: string, limit = this.MAX_MESSAGES): Promise<ChatMessage[]> {
    // First verify the conversation belongs to the user
    const conversation = await this.conversationRepository.findOne({
      where: {
        id: conversationId,
        userId,
        organizationId
      }
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    return this.getRecentHistoryAsc(conversationId, limit);
  }
}
