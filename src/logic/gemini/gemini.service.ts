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
    async detectLanguage(text: string): Promise<string> {
        try {
            const prompt = `Detect the language of this text and return only the ISO 639-1 language code. 

Important: Look carefully for African languages like Shona (sn), Swahili (sw), Zulu (zu), Xhosa (xh), and other Bantu languages.

Common languages include: English (en), Spanish (es), French (fr), German (de), Italian (it), Portuguese (pt), Russian (ru), Chinese (zh), Japanese (ja), Korean (ko), Arabic (ar), Hindi (hi), Shona (sn), Swahili (sw), Zulu (zu), Xhosa (xh), Afrikaans (af), Dutch (nl), Swedish (sv), Norwegian (no), Danish (da), Finnish (fi), Polish (pl), Czech (cs), Hungarian (hu), Romanian (ro), Bulgarian (bg), Greek (el), Turkish (tr), Hebrew (he), Persian (fa), Urdu (ur), Bengali (bn), Tamil (ta), Telugu (te), Malayalam (ml), Kannada (kn), Gujarati (gu), Punjabi (pa), Marathi (mr), Nepali (ne), Sinhala (si), Thai (th), Vietnamese (vi), Indonesian (id), Malay (ms), Filipino (tl), Ukrainian (uk), Belarusian (be), Croatian (hr), Serbian (sr), Slovenian (sl), Slovak (sk), Lithuanian (lt), Latvian (lv), Estonian (et), Icelandic (is), Irish (ga), Welsh (cy), Basque (eu), Catalan (ca), Galician (gl), Maltese (mt), Luxembourgish (lb), Faroese (fo), Greenlandic (kl), Sami (se), Maori (mi), Hawaiian (haw), Cherokee (chr), Navajo (nv), Cree (cr), Ojibwe (oj), Inuktitut (iu), Yiddish (yi), Esperanto (eo), Latin (la), Sanskrit (sa), Ancient Greek (grc), Old English (ang), Middle English (enm), Old French (fro), Old German (goh), Gothic (got), Old Norse (non), Old Irish (sga), Old Welsh (owl), Old Breton (obt), Old Cornish (oco), Old Manx (omx), Old Scottish Gaelic (gdg), Old Irish (sga), Old Welsh (owl), Old Breton (obt), Old Cornish (oco), Old Manx (omx), Old Scottish Gaelic (gdg).

If the text is in English, return 'en'. If you're unsure, return 'en'.

Text: "${text}"

Language code:`;

            const result = await this.generateContent(prompt);
            const languageCode = result.text?.trim().toLowerCase() || 'en';
            
            console.log(`Detected language code: "${languageCode}"`);
            
            // Validate that it's a valid language code - expanded list
            const validCodes = [
                'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi', 
                'sn', 'sw', 'zu', 'xh', 'af', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 
                'hu', 'ro', 'bg', 'el', 'tr', 'he', 'fa', 'ur', 'bn', 'ta', 'te', 'ml', 
                'kn', 'gu', 'pa', 'mr', 'ne', 'si', 'th', 'vi', 'id', 'ms', 'tl', 'uk', 
                'be', 'hr', 'sr', 'sl', 'sk', 'lt', 'lv', 'et', 'is', 'ga', 'cy', 'eu', 
                'ca', 'gl', 'mt', 'lb', 'fo', 'kl', 'se', 'mi', 'haw', 'chr', 'nv', 'cr', 
                'oj', 'iu', 'yi', 'eo', 'la', 'sa', 'grc', 'ang', 'enm', 'fro', 'goh', 
                'got', 'non', 'sga', 'owl', 'obt', 'oco', 'omx', 'gdg'
            ];
            
            const detectedCode = validCodes.includes(languageCode) ? languageCode : 'en';
            console.log(`Final language code: "${detectedCode}"`);
            return detectedCode;
        } catch (error) {
            console.error('Error detecting language:', error);
            return 'en'; // Default to English
        }
    }

    async translateText(text: string, fromLanguage: string, toLanguage: string): Promise<string> {
        try {
            if (fromLanguage === toLanguage) {
                console.log(`No translation needed: ${fromLanguage} -> ${toLanguage}`);
                return text; // No translation needed
            }

            console.log(`Translating: ${fromLanguage} -> ${toLanguage}`);
            console.log(`Original text: "${text}"`);

            const prompt = `Translate the following text from ${fromLanguage} to ${toLanguage}. 

${fromLanguage === 'sn' ? 'Note: The source language is Shona (a Bantu language from Zimbabwe).' : ''}
${toLanguage === 'sn' ? 'Note: Translate to Shona (a Bantu language from Zimbabwe).' : ''}

Return only the translated text, nothing else.

Text: "${text}"

Translation:`;

            const result = await this.generateContent(prompt);
            const translatedText = result.text?.trim() || text;
            
            console.log(`Translation result: "${translatedText}"`);
            return translatedText;
        } catch (error) {
            console.error('Error translating text:', error);
            console.log(`Falling back to original text: "${text}"`);
            return text; // Return original text if translation fails
        }
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
