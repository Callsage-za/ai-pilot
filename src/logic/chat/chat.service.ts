import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ChatMemoryService } from '../chat-memory/chat-memory.service';
import { intentPrompt, userMessage } from './prompt';
import { GeminiService } from '../gemini/gemini.service';
import { JiraTicketsService } from '../jira-tickets/jira-tickets.service';
import z from 'zod';
import { PolicyDocumentsService } from '../policy-documents/policy-documents.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { SpeechService } from '../speech/speech.service';
import { CallSearchService } from '../call-search/call-search.service';
import { SocketGateway } from '../socket-gateway/socket.gateway';
import { ToolsService } from '../tools/tools.service';
import { ToolActionType } from '../tools/dto/execute-tool.dto';
import { User } from '../../entities/user.entity';

@Injectable()
export class ChatService {

    constructor(private readonly chatMemoryService: ChatMemoryService,
        private readonly geminiService: GeminiService,
        private readonly jiraService: JiraTicketsService,
        private readonly policyDocumentsService: PolicyDocumentsService,
        private readonly fileUploadService: FileUploadService,
        private readonly speechService: SpeechService,
        private readonly callSearchService: CallSearchService,
        private readonly socketGateway: SocketGateway,
        private readonly toolsService: ToolsService) { }


    async ask(body: { query: string; conversationId: string; fileNames: string[]; selectedTool?: string; toolParams?: any }, user: User) {
        let { query, conversationId, fileNames, selectedTool, toolParams } = body;

        // Process uploaded files if any and get their processed content
        let fileContext = '';
        if (fileNames && fileNames.length > 0) {
            fileContext = await this.getProcessedFileContent(fileNames);
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

        // Enhance query with processed file content if available
        let enhancedQuery = englishQuery;
        if (fileContext) {
            enhancedQuery = `${englishQuery}\n\nContext from attached files:\n${fileContext}`;
            console.log(`Enhanced query with file context: ${fileContext.length} characters`);
        }

        const systemPrompt = intentPrompt()
        const history = conversationId ? await this.chatMemoryService.getRecentHistoryAsc(conversationId) : [];
        const conversation = await this.chatMemoryService.ensureConversation(user.id, user.organizationId, conversationId);

        const intentAnswer = await this.geminiService.complete(systemPrompt, userMessage(conversation.conversationState, enhancedQuery), history);
        let intent: any;
        try {
            intent = JSON.parse(intentAnswer.text?.replace(/^```json\s*|\s*```$/g, "") || "{}");
        } catch (error) {
            console.warn("Failed to parse intent answer", error, intentAnswer.text);
            intent = {
                title: 'General conversation',
                intent: 'unknown',
                confidence: 0.1,
                slots: {},
                routing: { service: 'none', action: 'list' },
                suggested_tool: null,
            };
        }
        console.log("intent", intent);
        
        if (fileNames && fileNames.length > 0) {
            intent.intent = "document.upload"
        }
        const nextConversationState: any = {
            ...(conversation.conversationState ?? {}),
            active_intent: intent.intent,
            topic: intent.title,
            last_switched_at: Date.now(),
            stickiness: intent.confidence,
            suggested_tool: intent?.suggested_tool?.name ?? null,
            suggested_tool_confidence: intent?.suggested_tool?.confidence ?? null,
        };
        conversation.conversationState = nextConversationState;
        await this.chatMemoryService.updateConversationTitle(conversation.id, intent.title);
        conversation.title = conversation.title || intent.title;
        // Get file attachments for this message
        const fileAttachments = fileNames && fileNames.length > 0
            ? await this.getFileAttachments(fileNames)
            : [];

        // Create message with language information
        const messageData: any = {
            conversationId: conversation.id,
            userId: user.id,
            role: 'user',
            content: originalLanguage !== 'en' ? englishQuery : originalQuery,
            originalContent: originalLanguage !== 'en' ? originalQuery : null,
            originalLanguage: originalLanguage !== 'en' ? originalLanguage : null,
            englishContent: originalLanguage !== 'en' ? englishQuery : null,
            type: "user.message",
            attachments: fileAttachments
        };

        const message = await this.chatMemoryService.addMessageWithLanguage(messageData);
        const userMessagePayload = {
            conversationId: conversation.id,
            message,
            role: 'user'
        };
        this.socketGateway.broadcast('conversations.message', userMessagePayload);
        this.socketGateway.emitMessage({ type: 'conversations.message', ...userMessagePayload });

        // Update file uploads with messageId if files were attached
        if (fileNames && fileNames.length > 0 && message) {
            await this.linkFilesToMessage(fileNames, message.id);
        }

        conversationId = conversation.id;
        let answer: any = null;
        let type: string = "general";
        const inferredToolSuggestion = this.inferFallbackToolSuggestion(englishQuery, fileAttachments);
        
        // If a tool is explicitly selected in the body, use that instead of intent suggestions
        let effectiveToolSuggestion = intent?.suggested_tool ?? inferredToolSuggestion;
        if (selectedTool) {
            effectiveToolSuggestion = {
                name: selectedTool,
                confidence: 1.0, // High confidence since user explicitly selected it
                reason: 'User explicitly selected tool'
            };
        }

        if (!intent?.suggested_tool && inferredToolSuggestion) {
            if (!conversation.conversationState) {
                conversation.conversationState = {};
            }
            conversation.conversationState.suggested_tool = inferredToolSuggestion.name;
            conversation.conversationState.suggested_tool_confidence = inferredToolSuggestion.confidence;
        }

        await this.chatMemoryService.setConversationState(conversation.id, conversation.conversationState);

        const toolExecution = await this.maybeExecuteSuggestedTool(effectiveToolSuggestion, {
            conversationId: conversation.id,
            englishQuery,
            enhancedQuery,
            fileIds: fileNames,
            attachments: fileAttachments,
            userId: user.id,
            organizationId: user.organizationId,
            selectedTool,
            toolParams
        });
        console.log("toolExecution", toolExecution);
        
        if (toolExecution) {
            answer = {
                answer: toolExecution.message,
                sources: toolExecution.sources ?? []
            };
            type = `tool.${toolExecution.tool.toLowerCase()}`;
            conversation.conversationState = {
                ...(conversation.conversationState ?? {}),
                last_tool_run: toolExecution.tool,
                last_tool_at: Date.now()
            };
            await this.chatMemoryService.setConversationState(conversation.id, conversation.conversationState);
        }

        if (!answer) {
            switch (intent.intent) {
                case "jira.lookup_by_assignee":

                    const schema = z.object({
                        query: z.string().min(1),
                        size: z.number().optional().default(20),
                        projectHint: z.string().optional(),
                        defaultDateField: z.enum(["created", "updated", "resolutiondate", "duedate"]).optional().default("updated")
                    });
                    const p = schema.parse({ query });

                    answer = await this.jiraService.ask(p, user.organizationId);
                    type = "jira_ticket";
                    break;
                case "docs.search":

                    const querySearch = String(query ?? "");
                    const size = Number(5);

                    if (!querySearch.trim()) {
                        throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
                    }

                    const result = await this.policyDocumentsService.searchDocs(querySearch, size, conversationId, "123456", user.organizationId);
                    answer = result;
                    type = "docs.search";
                    break;
                case "call.search":
                    const callQuery = intent.slots.query || query;
                    const callFilters = {
                        tags: intent.slots.filters?.tags || [],
                        time_range: intent.slots.time_range || null
                    };

                    answer = await this.callSearchService.searchCalls(callQuery, callFilters, user.organizationId);

                    type = "call.search";
                    break;
                case "document.upload":
                    const systemPromptDoc = `You are an intelligent AI assistant specialized in document analysis and call center operations. 
                                                        
                Your expertise includes:
                • **Policy Document Analysis** - Extract key information, identify compliance requirements, and explain policy implications
                • **Audio Transcription Support** - Help with call analysis, sentiment detection, and extracting actionable insights from conversations
                • **Multilingual Processing** - Handle documents and conversations in multiple languages with accurate translation
                • **Call Center Intelligence** - Search through calls, complaints, compliments, and customer interactions
                • **Task Management** - Track team activities and project status
                • **Document Search** - Find specific policies, procedures, and company information

                When users upload documents or ask questions, provide contextually relevant responses that:
                1. **For Policy Documents**: Highlight key sections, compliance requirements, and practical implications
                2. **For Audio Files**: Offer to analyze sentiment, extract key topics, or identify action items
                3. **For Translations**: Provide accurate translations while maintaining context and meaning
                4. **For General Queries**: Offer specific, actionable insights based on available data

                Always be helpful, professional, and focus on providing actionable insights that help users make informed decisions.`;

                    const userPromptDoc = `User asked: "${englishQuery}"

                                        Based on your expertise in document analysis, audio processing, and call center operations, provide a helpful response that:
                                        1. Acknowledges their specific question or document upload
                                        2. Explains how you can help with their particular need (policy analysis, audio transcription, translation, etc.)
                                        3. Suggests specific next steps or questions they can ask
                                        4. Offers to analyze uploaded documents or process audio files if relevant

                                        Focus on being actionable and specific to their context. and document information is ${fileContext}`;

                    const geminiResponseDoc = await this.geminiService.complete(systemPromptDoc, userPromptDoc, history);

                    answer = {
                        answer: geminiResponseDoc.text || "I'm here to help! I can assist you with call center data, task management, and document searches. What would you like to know?",
                        sources: []
                    };
                    type = "general";
                    break;
                // return this.docsService.searchDocs(intent.slots.query, 5, conversationId, "1234");
                default:
                    // Generate intelligent response using Gemini
                    const systemPrompt = `You are an expert AI assistant specialized in call center operations, document analysis, and multilingual communication. 
                                                        
                                        Your core capabilities include:
                                        • **Policy Document Intelligence** - Analyze policy documents, extract compliance requirements, and explain implications
                                        • **Audio Analysis & Transcription** - Process call recordings, detect sentiment, extract key topics, and identify action items
                                        • **Multilingual Support** - Handle conversations and documents in multiple languages with accurate translation
                                        • **Call Center Analytics** - Search through calls, complaints, compliments, and customer interactions
                                        • **Task & Project Management** - Track team activities, deadlines, and project status
                                        • **Document Search & Retrieval** - Find specific policies, procedures, and company information

                                        When responding to users:
                                        1. **For Policy Questions**: Provide specific policy references, compliance notes, and practical implications
                                        2. **For Audio/Call Analysis**: Offer sentiment analysis, topic extraction, and actionable insights
                                        3. **For Translation Needs**: Provide accurate translations while maintaining context and professional tone
                                        4. **For General Queries**: Give specific, actionable responses based on available data

                                        Always be professional, helpful, and focus on providing actionable insights that help users make informed decisions.`;

                    const userPrompt = `User asked: "${enhancedQuery}"

Based on your expertise in call center operations, document analysis, and multilingual processing, provide a helpful response that:
1. Acknowledges their specific question or request
2. Explains how you can help with their particular need (policy analysis, call search, audio processing, translation, etc.)
3. Suggests specific next steps or questions they can ask
4. Offers to search through available data or process documents if relevant

Focus on being actionable and specific to their context.`;

                    const geminiResponse = await this.geminiService.complete(systemPrompt, userPrompt, history);

                    answer = {
                        answer: geminiResponse.text || "I'm here to help! I can assist you with call center data, task management, and document searches. What would you like to know?",
                        sources: []
                    };
                    type = "general";
                    break;
            }
        }

        if (!answer) {
            answer = {
                answer: "I'm still working on that request. Could you rephrase or provide more details?",
                sources: []
            };
            type = "general";
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
        const assistantMessage = await this.chatMemoryService.addMessageWithLanguage(assistantMessageData);

        const assistantMessagePayload = {
            conversationId: conversation.id,
            message: assistantMessage,
            role: 'assistant'
        };
        this.socketGateway.broadcast('conversations.message', assistantMessagePayload);
        this.socketGateway.emitMessage({ type: 'conversations.message', ...assistantMessagePayload });

        const conversationPayload = {
            conversationId: conversation.id,
            title: conversation.title,
            conversationState: conversation.conversationState,
            latestMessage: assistantMessage,
            tool: toolExecution ? toolExecution.tool : null
        };
        this.socketGateway.broadcast('conversations.updated', conversationPayload);
        this.socketGateway.emitMessage({ type: 'conversations.updated', ...conversationPayload });

        return assistantMessage;
    }

    getAllConversations(user: User) {
        return this.chatMemoryService.getConversationsByUser(user.id, user.organizationId);
    }
    getConversationMessages(conversationId: string, user: User) {
        return this.chatMemoryService.getRecentHistoryAscForUser(conversationId, user.id, user.organizationId);
    }

    private normalizeToolAction(name?: string): ToolActionType | null {
        if (!name) return null;
        const upper = name.toUpperCase();
        switch (upper) {
            case ToolActionType.TRANSCRIBE_AUDIO:
            case ToolActionType.SUMMARIZE_CONVERSATION:
            case ToolActionType.POLICY_AUDIT:
            case ToolActionType.BROWSE_POLICIES:
            case ToolActionType.CREATE_JIRA:
                return upper as ToolActionType;
            default:
                return null;
        }
    }

    private hasAudioAttachment(attachments: any[]): boolean {
        return attachments?.some((attachment: any) => typeof attachment?.mimeType === 'string' && attachment.mimeType.startsWith('audio/'));
    }

    private inferFallbackToolSuggestion(query: string, attachments: any[]) {
        const text = (query || '').toLowerCase();
        const hasAudio = this.hasAudioAttachment(attachments);

        const containsAny = (keywords: string[]) => keywords.some(keyword => text.includes(keyword));

        if (hasAudio && containsAny(['transcribe', 'transcript', 'audio', 'listen', 'call recording'])) {
            return {
                name: ToolActionType.TRANSCRIBE_AUDIO,
                confidence: 0.62,
                reason: 'Audio attachment detected with transcription intent.'
            };
        }

        if (containsAny(['summarise', 'summarize', 'tl;dr', 'recap', 'overview', 'highlight'])) {
            return {
                name: ToolActionType.SUMMARIZE_CONVERSATION,
                confidence: 0.6,
                reason: 'User is asking for a summary.'
            };
        }

        if (containsAny(['policy', 'compliance', 'audit', 'violation', 'regulation', 'guideline'])) {
            return {
                name: ToolActionType.POLICY_AUDIT,
                confidence: 0.58,
                reason: 'Policy-oriented language detected.'
            };
        }

        if (containsAny(['where can i find', 'which policy', 'show policy', 'policy list', 'browse policy', 'find policy'])) {
            return {
                name: ToolActionType.BROWSE_POLICIES,
                confidence: 0.57,
                reason: 'User wants to browse or locate policies.'
            };
        }

        if (containsAny(['create ticket', 'create a ticket', 'open jira', 'log an issue', 'escalate', 'raise a ticket', 'create jira'])) {
            return {
                name: ToolActionType.CREATE_JIRA,
                confidence: 0.65,
                reason: 'Explicit request to create or escalate a ticket.'
            };
        }

        return null;
    }

    private async maybeExecuteSuggestedTool(
        suggestedTool: any,
        options: {
            conversationId: string;
            englishQuery: string;
            enhancedQuery: string;
            fileIds?: string[];
            attachments: any[];
            userId: string;
            organizationId: string;
            selectedTool?: string;
            toolParams?: any;
        }
    ): Promise<{ tool: ToolActionType; message: string; sources?: any[] } | null> {
        if (!suggestedTool) {
            return null;
        }
        const toolName = this.normalizeToolAction(suggestedTool.name);
        if (!toolName) {
            return null;
        }
        const confidence = typeof suggestedTool.confidence === 'number' ? suggestedTool.confidence : 0;
        // If tool is explicitly selected, always execute regardless of confidence
        if (confidence < 0.55 && !options.selectedTool) {
            return null;
        }

        try {
            switch (toolName) {
                case ToolActionType.TRANSCRIBE_AUDIO: {
                    // Use fileIds from toolParams if provided, otherwise use options.fileIds
                    const fileIds = options.toolParams?.fileIds || options.fileIds;
                    if (!fileIds?.length || !this.hasAudioAttachment(options.attachments)) {
                        return null;
                    }
                    const result = await this.toolsService.transcribeAudio(fileIds, options.conversationId, options.userId);
                    return { tool: toolName, message: result.message, sources: result.sources };
                }
                case ToolActionType.SUMMARIZE_CONVERSATION: {
                    const input = options.toolParams?.input || options.englishQuery;
                    const result = await this.toolsService.summarizeConversation(options.conversationId, input);
                    return { tool: toolName, message: result.message, sources: (result as any).sources || [] };
                }
                case ToolActionType.POLICY_AUDIT: {
                    const query = options.toolParams?.query || options.enhancedQuery || options.englishQuery;
                    const result = await this.toolsService.policyAudit(query, options.conversationId, options.userId, options.organizationId);
                    return { tool: toolName, message: result.message, sources: result.sources };
                }
                case ToolActionType.BROWSE_POLICIES: {
                    const query = options.toolParams?.query || options.enhancedQuery || options.englishQuery;
                    const result = await this.toolsService.browsePolicies(query, options.userId, options.organizationId);
                    return { tool: toolName, message: result.message, sources: result.sources };
                }
                case ToolActionType.CREATE_JIRA: {
                    const input = options.toolParams?.input || options.englishQuery;
                    const result = await this.toolsService.createJiraIssueFromPrompt(input, options.conversationId);
                    return { tool: toolName, message: result.message, sources: (result as any).sources || [] };
                }
                default:
                    return null;
            }
        } catch (error) {
            console.error(`Tool execution failed for ${toolName}`, error);
            return null;
        }
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
                await this.fileUploadService.markAsProcessed(fileUpload.id || '');
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
        console.log(fileUpload.user);
        
        try {
            // Copy file to temp location for processing
            fs.copyFileSync(fileUpload.localPath, tempPath);

            // Process with speech service
            const result = await this.speechService.callSpeech(tempPath, fileUpload.originalName, fileUpload.user, fileUpload.externalPath);
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

    private async getProcessedFileContent(fileIds: string[]): Promise<string> {
        const fileContents: string[] = [];

        for (const fileId of fileIds) {
            try {
                const fileUpload = await this.fileUploadService.getFileUpload(fileId);
                if (!fileUpload) {
                    console.warn(`File upload not found for ID: ${fileId}`);
                    continue;
                }

                let content = '';

                // Use already processed data based on file type
                if (this.speechService.isAudioFile(fileUpload.mimeType)) {
                    // For audio files, use filename summary (transcript would be in database if processed)
                    const baseName = fileUpload.originalName.replace(/\.[^/.]+$/, "");
                    const summaryInfo = baseName.replace(/[-_]/g, ' ');
                    content = `[Audio File: ${fileUpload.originalName}]\nSummary: ${summaryInfo}`;
                    console.log(`Using audio file summary: ${summaryInfo}`);
                } else if (this.speechService.isDocumentFile(fileUpload.mimeType)) {
                    // For document files, use filename as summary
                    const baseName = fileUpload.originalName.replace(/\.[^/.]+$/, "");
                    const summaryInfo = baseName.replace(/[-_]/g, ' ');
                    content = `[Document: ${fileUpload.originalName}]\nSummary: ${summaryInfo}`;
                    console.log(`Using document file summary: ${summaryInfo}`);
                } else {
                    // For other file types, just mention the file
                    content = `[File: ${fileUpload.originalName}]`;
                    console.log(`Other file type: ${fileUpload.originalName}`);
                }

                if (content) {
                    fileContents.push(content);
                }

            } catch (error) {
                console.error(`Error getting processed content from file ${fileId}:`, error);
            }
        }

        return fileContents.join('\n\n');
    }
}
