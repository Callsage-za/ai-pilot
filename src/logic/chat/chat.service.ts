import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ChatMemoryService } from '../chat-memory/chat-memory.service';
import { intentPrompt, userMessage } from './prompt';
import { GeminiService } from '../gemini/gemini.service';
import { JiraTicketsService } from '../jira-tickets/jira-tickets.service';
import z from 'zod';
import { PolicyDocumentsService } from '../policy-documents/policy-documents.service';
import { ConvState } from '../../utils/types';
import { FileUploadService } from '../file-upload/file-upload.service';
import { SpeechService } from '../speech/speech.service';
import { CallSearchService } from '../call-search/call-search.service';

@Injectable()
export class ChatService {

    constructor(private readonly chatMemoryService: ChatMemoryService,
        private readonly geminiService: GeminiService,
        private readonly jiraService: JiraTicketsService,
        private readonly policyDocumentsService: PolicyDocumentsService,
        private readonly fileUploadService: FileUploadService,
        private readonly speechService: SpeechService,
        private readonly callSearchService: CallSearchService) { }


    async ask(body: { query: string; conversationId: string; fileNames: string[] }) {
        let { query, conversationId, fileNames } = body;

        // Process uploaded files if any
        if (fileNames && fileNames.length > 0) {
            await this.processUploadedFiles(fileNames);
        }

        // Language detection and translation
        const originalLanguage = await this.geminiService.detectLanguage(query);
        const originalQuery = query;
        let englishQuery = query;

        // Translate to English if not already in English
        if (originalLanguage !== 'en') {
            englishQuery = await this.geminiService.translateText(query, originalLanguage, 'en');
            console.log(`Translated from ${originalLanguage}: "${originalQuery}" -> "${englishQuery}"`);
        }

        const systemPrompt = intentPrompt()
        const history = conversationId ? await this.chatMemoryService.getRecentHistoryAsc(conversationId) : [];
        const conversation = await this.chatMemoryService.ensureConversation("123456", "", conversationId);

        const intentAnswer = await this.geminiService.complete(systemPrompt, userMessage(conversation.conversationState, englishQuery), history)

        const intent = JSON.parse(intentAnswer.text?.replace(/^```json\s*|\s*```$/g, ""))
        conversation.conversationState = {
            active_intent: intent.intent,
            topic: intent.title,
            last_switched_at: Date.now(),
            stickiness: intent.confidence
        };
        await this.chatMemoryService.setConversationState(conversation.id, conversation.conversationState);
        await this.chatMemoryService.updateConversationTitle(conversation.id, intent.title);
        // Get file attachments for this message
        const fileAttachments = fileNames && fileNames.length > 0
            ? await this.getFileAttachments(fileNames)
            : [];

        // Create message with language information
        const messageData: any = {
            conversationId: conversation.id,
            role: 'user',
            content: originalLanguage !== 'en' ? englishQuery : originalQuery,
            originalContent: originalLanguage !== 'en' ? originalQuery : null,
            originalLanguage: originalLanguage !== 'en' ? originalLanguage : null,
            englishContent: originalLanguage !== 'en' ? englishQuery : null,
            type: "user.message",
            attachments: fileAttachments
        };

        const message = await this.chatMemoryService.addMessageWithLanguage(messageData);

        // Update file uploads with messageId if files were attached
        if (fileNames && fileNames.length > 0 && message) {
            await this.linkFilesToMessage(fileNames, message.id);
        }

        conversationId = conversation.id;
        let answer: any = null;
        let type: string = "general";
        switch (intent.intent) {
            case "jira.lookup_by_assignee":

                const schema = z.object({
                    query: z.string().min(1),
                    size: z.number().optional().default(20),
                    projectHint: z.string().optional(),
                    defaultDateField: z.enum(["created", "updated", "resolutiondate", "duedate"]).optional().default("updated")
                });
                const p = schema.parse({ query });

                answer = await this.jiraService.ask(p);
                type = "jira_ticket";
                break;
            case "docs.search":

                const querySearch = String(query ?? "");
                const size = Number(5);

                if (!querySearch.trim()) {
                    throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
                }

                const result = await this.policyDocumentsService.searchDocs(querySearch, size, conversationId, "123456");
                answer = result;
                type = "docs.search";
                break;
            case "call.search":
                const callQuery = intent.slots.query || query;
                const callFilters = {
                    tags: intent.slots.filters?.tags || [],
                    time_range: intent.slots.time_range || null
                };

                answer = await this.callSearchService.searchCalls(callQuery, callFilters);

                type = "call.search";
                break;
            // return this.docsService.searchDocs(intent.slots.query, 5, conversationId, "1234");
            default:
                // Generate intelligent response using Gemini
                const systemPrompt = `You are a helpful AI assistant for a call center management system. 
                                                        
                                        Your capabilities include:
                                        • **Call Center Data** - Search through calls, complaints, and compliments
                                        • **Task Management** - Find out what team members are working on  
                                        • **Document Search** - Look up policies, procedures, and company information

                                        Always respond in a friendly, helpful manner. If the user's question is unclear or you can't determine their intent, provide a helpful response that:
                                        1. Acknowledges their question
                                        2. Explains what you can help with
                                        3. Suggests specific things they can ask about
                                        4. Always end with a follow-up question to encourage engagement

                                        Be conversational and warm, but professional.`;

                const userPrompt = `User asked: "${englishQuery}"

Please provide a helpful response that guides them on what you can help with.`;

                const geminiResponse = await this.geminiService.complete(systemPrompt, userPrompt, history);

                answer = {
                    answer: geminiResponse.text || "I'm here to help! I can assist you with call center data, task management, and document searches. What would you like to know?",
                    sources: []
                };
                type = "general";
                break;
        }

        // Translate response back to original language if needed
        let finalAnswer = answer.answer;
        if (originalLanguage !== 'en') {
            console.log(`Translating response from English to ${originalLanguage}...`);
            finalAnswer = await this.geminiService.translateText(answer.answer, 'en', originalLanguage);
            console.log(`✅ Translation complete: "${answer.answer}" -> "${finalAnswer}"`);
        } else {
            console.log(`✅ Response already in English, no translation needed`);
        }

        // Create assistant message with language information
        // The 'content' field will contain the response in the user's original language
        const assistantMessageData: any = {
            conversationId,
            role: 'assistant',
            content: originalLanguage !== 'en' ? finalAnswer : answer.answer, // Response in user's language
            originalContent: originalLanguage !== 'en' ? finalAnswer : null,   // Original language version
            originalLanguage: originalLanguage !== 'en' ? originalLanguage : null, // User's language
            englishContent: originalLanguage !== 'en' ? answer.answer : null, // English version
            type,
            source: answer.sources
        };

        console.log(`✅ Final response in ${originalLanguage !== 'en' ? originalLanguage : 'English'}: "${assistantMessageData.content}"`);
        return await this.chatMemoryService.addMessageWithLanguage(assistantMessageData);
    }

    getAllConversations() {
        return this.chatMemoryService.getConversations();
    }
    getConversationMessages(conversationId: string) {
        return this.chatMemoryService.getRecentHistoryAsc(conversationId);
    }

    private async processUploadedFiles(fileIds: string[]) {
        for (const fileId of fileIds) {
            try {
                // Get file upload record by ID
                const fileUpload = await this.fileUploadService.getFileUpload(fileId);

                if (!fileUpload) {
                    console.warn(`File upload not found for ID: ${fileId}`);
                    continue;
                }

                // Check if already processed
                if (fileUpload.isProcessed) {
                    console.log(`File already processed: ${fileUpload.originalName}`);
                    continue;
                }

                // Process based on file type
                if (this.speechService.isAudioFile(fileUpload.mimeType)) {
                    console.log(`Processing audio file: ${fileUpload.originalName}`);
                    await this.processAudioFile(fileUpload);
                } else if (this.speechService.isDocumentFile(fileUpload.mimeType)) {
                    console.log(`Processing document file: ${fileUpload.originalName}`);
                    await this.processDocumentFile(fileUpload);
                } else {
                    console.log(`Unsupported file type: ${fileUpload.originalName} (${fileUpload.mimeType})`);
                }

                // Mark as processed
                await this.fileUploadService.markAsProcessed(fileUpload.id);
                console.log(`File processed successfully: ${fileUpload.originalName}`);

            } catch (error) {
                console.error(`Error processing file ${fileId}:`, error);
                // Continue processing other files even if one fails
            }
        }
    }

    private async processAudioFile(fileUpload: any) {
        // Create a temporary file for processing
        const fs = require('fs');
        const path = require('path');
        const tempPath = `/tmp/${fileUpload.id}_${fileUpload.originalName}`;

        try {
            // Copy file to temp location for processing
            fs.copyFileSync(fileUpload.localPath, tempPath);

            // Process with speech service
            const result = await this.speechService.callSpeech(tempPath, fileUpload.originalName, fileUpload.externalPath);
            console.log(`Audio processing result for ${fileUpload.originalName}:`, result);

        } finally {
            // Clean up temp file
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    private async processDocumentFile(fileUpload: any) {
        // TODO: Implement document processing logic
        console.log(`Document processing not yet implemented for: ${fileUpload.originalName}`);
        // This could include:
        // - Text extraction
        // - Content indexing
        // - Metadata extraction
        // - etc.
    }

    private async getFileAttachments(fileIds: string[]) {
        const attachments: any[] = [];
        for (const fileId of fileIds) {
            try {
                const fileUpload = await this.fileUploadService.getFileUpload(fileId);
                if (fileUpload) {
                    attachments.push({
                        id: fileUpload.id,
                        originalName: fileUpload.originalName,
                        externalPath: fileUpload.externalPath,
                        fileSize: fileUpload.fileSize,
                        mimeType: fileUpload.mimeType,
                        isProcessed: fileUpload.isProcessed
                    });
                }
            } catch (error) {
                console.error(`Error getting file attachment ${fileId}:`, error);
            }
        }
        return attachments;
    }

    private async linkFilesToMessage(fileIds: string[], messageId: string) {
        for (const fileId of fileIds) {
            try {
                await this.fileUploadService.updateFileMessageId(fileId, messageId);
            } catch (error) {
                console.error(`Error linking file ${fileId} to message ${messageId}:`, error);
            }
        }
    }
}
