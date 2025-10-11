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
        
        const systemPrompt = intentPrompt()
        const history = conversationId ? await this.chatMemoryService.getRecentHistoryAsc(conversationId) : [];
        const conversation = await this.chatMemoryService.ensureConversation("123456", "", conversationId);

        const intentAnswer = await this.geminiService.complete(systemPrompt, userMessage(conversation.conversationState, query), history)
        
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
            
        const message = await this.chatMemoryService.addMessage(conversation.id, 'user', query, "user.message", [], fileAttachments);
        
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

                answer = intent;
                break;
        }
        return await this.chatMemoryService.addMessage(conversationId, 'assistant', answer.answer, type, answer.sources);
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
