import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbedContentResponse, GoogleGenerativeAI } from '@google/generative-ai';
import { getAccessToken } from 'src/utils/gcpAuth';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../chat-memory/types';

@Injectable()
export class GeminiService {
    private genAI: GoogleGenAI;
    private embedModel: any;
    private chatModel: any;
    private EMBED_MODEL: string;
    private CHAT_MODEL: string;
    constructor(private readonly configService: ConfigService) {

        this.initGemini(configService);
    }

    async initGemini(configService: ConfigService) {
        const EMBED_MODEL = configService.get('GEMINI_EMBED_MODEL') || 'text-embedding-004';
        const CHAT_MODEL = configService.get('GEMINI_CHAT_MODEL') || 'gemini-2.5-flash-lite';

        this.genAI = new GoogleGenAI({ apiKey: "AIzaSyApEEpuvgOhrVSVFLSglOT_3Ks2X2X29fA" });
        this.EMBED_MODEL = EMBED_MODEL;
        this.CHAT_MODEL = CHAT_MODEL;
    }
    async embedTexts(texts: string[]): Promise<number[][]> {
        try {
            // Process all texts in a single batch call
            const result = await this.genAI.models.embedContent({ contents: texts, model: this.EMBED_MODEL });
            // Ensure we only return arrays of numbers, filter out undefined
            if (!result.embeddings) {
                return [[]];
            }
            const embeddings = result.embeddings
                .map(item => item?.values)
                .filter((values): values is number[] => Array.isArray(values));
            return embeddings.length > 0 ? embeddings : [[]];
        } catch (error) {
            console.error('Error generating embeddings:', error);
            throw new Error(`Failed to generate embeddings: ${error.message}`);
        }
    }

    async generateContent(prompt: string | any[], systemPrompt?: string): Promise<any> {
        try {
            let contents;

            if (Array.isArray(prompt)) {
                // If prompt is already an array of messages, use it directly
                contents = prompt;
            } else {
                // If prompt is a string, create a simple user message
                contents = [{ role: "user", content: prompt }];
            }

            // Handle system prompt by prepending it to the user message
            if (systemPrompt) {
                // Find the first user message and prepend system prompt
                contents = [{ role: "model", content: systemPrompt }, ...contents];
            }

            // Convert to the format expected by Google GenAI
            const formattedContents = contents.map(msg => ({
                role: msg.role === "system" ? "user" : msg.role, // Convert system to user
                parts: [{ text: msg.content }]
            }));

            // return formattedContents;

            const result = await this.genAI.models.generateContent({
                contents: formattedContents,
                model: this.CHAT_MODEL,
                config: { temperature: 0.3 }
            });
            return result;
        } catch (error) {
            console.error('Error generating content:', error);
            throw new Error(`Failed to generate content: ${error.message}`);
        }
    }

    async complete(system: string, user: string|any, history: ChatMessage[], temperature = 0.2): Promise<any> {
        // Gemini doesn’t have a true 'system' role. Put it in a preamble (first user turn).

        
        const preamble = system?.trim() ? `${system.trim()}\n\n` : '';

        // Map your history roles to Gemini roles: assistant -> 'model'
        const hist = history.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        try {
            const result = await this.genAI.models.generateContent({
                model: this.CHAT_MODEL,
                config: { temperature },
                contents: [
                    // system-as-preamble in first turn (user role)
                    ...(preamble ? [{ role: 'user', parts: [{ text: preamble }] }] : []),
                    ...hist,
                    { role: 'user', parts: [{ text: user }] }
                ]
            });

            return result;
        } catch (err: any) {
            console.error('complete error:', err?.message || err);
            throw new Error(`Failed to generate content: ${err?.message || err}`);
        }
    }
}
