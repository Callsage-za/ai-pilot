import { Injectable } from '@nestjs/common';
import { ChatMessage, Role } from './types';
import { REWRITE_SYSTEM, SUMMARIZE_SYSTEM, buildRewriteUser } from './prompts';
import { GeminiService } from '../gemini/gemini.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatMemoryService {
  private MAX_MESSAGES = 12;   // prompt budget
  private SUMMARIZE_AT = 10;   // when to update summary

  constructor(
    private readonly geminiService: GeminiService,
    private readonly prisma: PrismaService
  ) {}

  async ensureConversation(userId: string, conversationId?: string) {
    if (conversationId) {
      const c = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
      if (c) return c;
    }
    return this.prisma.conversation.create({ data: { userId } });
  }

  async addMessage(conversationId: string, role: Role, content: string) {
    return this.prisma.message.create({ data: { conversationId, role, content } });
  }

  async getRecentHistoryAsc(conversationId: string, limit = this.MAX_MESSAGES): Promise<ChatMessage[]> {
    // Pull newest first then reverse, or fetch ascending directly
    const msgs = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { ts: 'asc' },        // important: chronological for LLMs
      take: undefined                // we’ll slice at the end to keep last N
    });
    const tail = msgs.slice(Math.max(0, msgs.length - limit));
    return tail.map(m => ({ role: m.role as Role, content: m.content, ts: m.ts.getTime() }));
  }

  async getSummary(conversationId: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { summary: true }
    });
    return c?.summary ?? undefined;
  }

  async setSummary(conversationId: string, summary: string) {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { summary }
    });
  }

  private async maybeSummarize(conversationId: string) {
    const count = await this.prisma.message.count({ where: { conversationId } });
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
}
