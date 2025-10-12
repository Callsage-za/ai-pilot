import { SpeechClient } from '@google-cloud/speech';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseFile } from 'music-metadata';
import fs from 'node:fs';
import path from 'path';
import { GeminiService } from '../gemini/gemini.service';
import { ElasticService } from '../elastic/elastic.service';
import { v4 as uuidv4 } from 'uuid';
import { clipTranscript, splitIntoChunks } from 'src/utils/textNormalizer';
import { JiraTicketsService } from '../jira-tickets/jira-tickets.service';
import { AudioSeverity, Call } from 'src/utils/types';
import { CallMemoryService } from '../chat-memory/call-memory.service';
import { Interval } from '@nestjs/schedule';
import { SocketGateway } from '../socket-gateway/socket.gateway';
@Injectable()
export class SpeechService {

    private client: any;
    private baseLink: string;
    constructor(private readonly configService: ConfigService,
        private readonly geminiService: GeminiService,
        private readonly elasticService: ElasticService,
        private readonly jiraTicketsService: JiraTicketsService,
        private readonly callMemoryService: CallMemoryService,
        private readonly socketService:SocketGateway
    ) {
        this.baseLink = this.configService.get('ENVIRONMENT') == "production" ? "https://api-pilot.balanceapp.co.za" : "http://localhost:8787";
        this.client = new SpeechClient({
            keyFilename: this.configService.get('AUTH_PATH'),
        });
    }
    async getAllAudioFiles() {
        return this.callMemoryService.getAllAudioFiles()
    }

    async runTest() {

        const calls = await this.getAllAudioFiles()
        this.socketService.emitMessage(calls)

    }
    async getAudioConfig(filePath: string) {
        const metadata = await parseFile(filePath);
        const format = metadata.format;
        const encodingMap = {
            'MPEG': 'MP3',
            'WAVE': 'LINEAR16',
            'FLAC': 'FLAC',
            'OGG': 'OGG_OPUS',
            'OPUS': 'OGG_OPUS',
        };
        let containerFormat = format.container?.toUpperCase();
        if (!containerFormat) {
            const codec = Object.keys(encodingMap).find(key => format.codec?.includes(key));
            if (!codec) {
                containerFormat = 'MPEG';
            } else {
                containerFormat = codec;
            }
        }
        const encoding = encodingMap[containerFormat] || 'MP3';
        return {
            encoding: 'MP3',
            sampleRateHertz: 8000,
            languageCode: 'en-US',
            enableSpeakerDiarization: true,
            minSpeakerCount: 2,
            maxSpeakerCount: 2,
            model: 'phone_call',
        };
    }

    async callSpeech(path: string, name: string, audioPath?: string) {
        if (!audioPath) {
            audioPath = this.baseLink + "/uploads/audio/" + name;
        }
        const audio = {
            content: fs.readFileSync(path).toString('base64'),
        };


        const audioConfig = await this.getAudioConfig(path);
        const request = {
            config: audioConfig,
            audio: audio,
        };

        // const [response] = await this.client.recognize(request);
        // const transcription = response.results
        //     .map(result => result.alternatives[0].transcript)
        //     .join('\n');
        const transcription = `[Phone rings — Company Representative answers]

Rep (Sarah): Good afternoon! Thank you for calling BrightTech Solutions, this is Sarah speaking. How can I help you today?

Customer (Mr. Daniels): Hi Sarah! I just wanted to give some feedback — I recently had my laptop repaired by your team, and I have to say, I’m really impressed.

Sarah: That’s wonderful to hear, Mr. Daniels! We always appreciate feedback. May I ask which branch or technician helped you?

Mr. Daniels: It was the Rosebank branch — a technician named Kevin. He was super friendly, explained everything clearly, and my laptop’s working perfectly now.

Sarah: I’m so glad to hear that! Kevin will be thrilled to know his work made such a positive impression. I’ll be sure to pass along your feedback.

Mr. Daniels: Please do. I’ll definitely recommend BrightTech to my colleagues. It’s rare to find such good customer service these days.

Sarah: Thank you so much for saying that — we really value your support. Is there anything else we can assist you with today?

Mr. Daniels: No, that’s all. Just wanted to share my thanks.

Sarah: We appreciate you taking the time to call, Mr. Daniels. Have a wonderful day!

Mr. Daniels: You too, goodbye.

Sarah: Goodbye!`

        const systemPrompt = `System: You are an analyst. Produce a concise, factual summary of the call.`
        const userPrompt = `User:
                    - Goal: Summarize for search and analytics.
                    - Include: reason for contact, key actions/promises, outcomes, issues (billing/delivery/tech), and potential policy risks.
                    - Limit: 200–300 words. No fluff. No PII beyond first names if present.
                    Transcript:
                    <<< ${transcription} >>>
                    `

        const transcriptChunk = splitIntoChunks(transcription, { chunkSize: 1000 });

        const transcriptEmbedding = await this.geminiService.embedTexts(transcriptChunk.map(c => c.text));

        const answer = await this.geminiService.generateContent(systemPrompt, userPrompt);
        const classification = await this.classifyCallHybrid({
            callId: uuidv4(),
            summary200w: answer.text,
            transcript: transcription,
            minConfidence: 0.6
        });

        const callDoc: Call = {
            classification: classification.classification,
            sentiment: classification.sentiment,
            severity: classification.severity,
            audioEntity: {
                accountId: classification?.entities?.accountId?.toString() || "",
                orderId: classification?.entities?.orderId?.toString() || "",
                product: classification?.entities?.product || "",
            },
            audioEvidence: classification?.evidence || [],
            resolved: false,
            path: audioPath || "",
            transcript: transcription,
            summary: answer.text,
        }
        const call = await this.callMemoryService.saveCall(callDoc);
        const embeddingText = answer.summary + "\n" + callDoc.transcript + "\n" + classification.classification;
        const [summaryEmbedding] = await this.geminiService.embedTexts([embeddingText]);

        await this.elasticService.elasticPost(`/calls/_update/${callDoc.id}`, {
            doc: {
                id: call.id,
                timestamp: new Date().toISOString(),
                customerId: callDoc?.audioEntity?.accountId || "",
                audioPath: audioPath,
                transcript: transcription,
                summary: callDoc.summary,
                embedding: summaryEmbedding,   // see #2 about mapping & dims
                intent: callDoc.classification,
                department: "customer_service",
                severity: callDoc.severity
            },
            doc_as_upsert: true               // ✅ keep here only
        });
        for (let i = 0; i < transcriptChunk.length; i++) {
            const chunk = transcriptChunk[i];
            const elasticChunkResponse = await this.elasticService.elasticPost(`/call_chunks/_update/${callDoc.id}--${i}`, {
                doc: {
                    call_id: call.id,
                    chunk_id: i,
                    text: chunk.text,
                    speaker: "speaker_0",
                    embedding: transcriptEmbedding[i]
                },
                doc_as_upsert: true
            })
        }

        const jiraPayload = await this.maybeCreateJira(classification);
        if (jiraPayload) {
            const ticket = await this.jiraTicketsService.createJiraIssue({
                title: jiraPayload?.fields.summary || "",
                description: await this.buildDescription({
                    callId: uuidv4(),
                    summary: classification.summary,
                    classification: classification.classification,
                    sentiment: classification.sentiment,
                    severity: classification.severity,
                    intents: classification.intents,
                    entities: classification.entities,
                    evidence: classification.evidence,
                }),
                priority: classification.severity,

            });
            const updated = await this.jiraTicketsService.addAttachment(ticket.key as string, path);
            return classification;

            // const result = response.results[response.results.length - 1];
            // const wordsInfo = result.alternatives[0].words;
            // Note: The transcript within each result is separate and sequential per result.
            // However, the words list within an alternative includes all the words
            // from all the results thus far. Thus, to get all the words with speaker
            // tags, you only have to take the words list from the last result:
            // wordsInfo.forEach(a =>
            //     console.log(` word: ${a.word}, speakerTag: ${a.speakerTag}`)
            // );
            // return response.results;

        }
    }

    async classifyCallHybrid({
        callId,
        summary200w,         // your analyst summary
        transcript,          // full transcript (raw diarized text OK)
        minConfidence = 0.6, // tune as you like
    }: {
        callId: string;
        summary200w: string;
        transcript: string;
        minConfidence?: number;
    }) {

        const transcriptBlock = clipTranscript(transcript);

        const prompt = `
          Return JSON ONLY:
          {
           "call_id":"${callId}",
           "classification":"complaint|compliment|other",
           "sentiment":"negative|neutral|positive",
           "intents":["billing_inquiry","refund_request","tech_support","cancellation","general_feedback"],
           "severity":"low|medium|high",
           "entities":{"accountId":null,"orderId":null,"product":null},
           "evidence":[{"speaker":"customer","text":"<short verbatim>","startMs":null,"endMs":null}],
           "summary":"<<=2 sentences>",
           "confidence":0.0
          }
          
          Rules:
          - Use the ANALYST SUMMARY for context.
          - Use the TRANSCRIPT ONLY for verbatim evidence and final judgement.
          - "complaint" = dissatisfaction + asks for remedy/action. "compliment" = praise.
          - If uncertain, lower "confidence".
          - Evidence MUST be a short, verbatim customer quote from the TRANSCRIPT.
          
          ANALYST SUMMARY (context only):
          <<<SUMMARY>>>
          ${summary200w}
          <<<END SUMMARY>>>
          
          TRANSCRIPT (source of truth for quotes/evidence):
          <<<TRANSCRIPT>>>
          ${transcriptBlock}
          <<<END TRANSCRIPT>>>`;

        const res = await this.geminiService.generateContent(prompt);
        const raw = res.text.replace(/^```json\s*|\s*```$/g, "") ?? "{}";
        let out: any;
        try { out = JSON.parse(raw); } catch { throw new Error("Non-JSON from model: " + raw); }

        // Fallback: if weak result, rerun with full transcript (no clipping)
        if ((out.confidence ?? 0) < minConfidence || out.classification === "other") {
            const prompt2 = prompt.replace(transcriptBlock, transcript); // full text
            const res2 = await this.geminiService.generateContent(prompt2);
            const raw2 = res2.text.replace(/^```json\s*|\s*```$/g, "") ?? "{}";
            try { out = JSON.parse(raw2); } catch { /* keep first */ }
        }

        return out;
    }


    async maybeCreateJira(result: any) {
        if (result.classification !== "complaint") return null;
        if (result.severity === "low" && (result.confidence ?? 0) < 0.6) return null; // gate weak signals

        // pseudo: replace with your Jira client
        const payload = {
            fields: {
                project: { key: "SCRUM" },
                summary: `[Complaint] ${result.intents?.[0] ?? "general"} — ${result.summary.slice(0, 120)}`,
                description: `Detected complaint.\n\nSummary:\n${result.summary}\n\nEvidence:\n${(result.evidence || []).map((e: any) => `- ${e.text}`).join("\n")}`
            }
        };
        // await jira.createIssue(payload);
        return payload;
    }

    async buildDescription({
        callId, summary, classification, sentiment, severity, intents = [],
        entities, evidence = [], audit
    }: any) {
        const evLines = (evidence || []).slice(0, 5).map((e: any) =>
            `- ${e.speaker ?? "customer"}: "${e.text}"` + (e.start_ms != null ? ` [${e.start_ms}–${e.end_ms}ms]` : "")
        ).join("\n");

        const findings = (audit?.findings || []).slice(0, 5).map((f: any) =>
            `- §${f.section_id}: ${f.violation?.toUpperCase()} — ${f.rule_summary}\n  Evidence: "${f.call_evidence}"\n  Remediation: ${f.remediation}`
        ).join("\n");

        return [
            `Call ID: ${callId}`,
            ``,
            `Summary:`,
            summary || "(none)",
            ``,
            `Classification: ${classification ?? "-"} | Sentiment: ${sentiment ?? "-"} | Severity: ${severity ?? "-"}`,
            `Intents: ${intents.join(", ") || "-"}`,
            entities ? `Entities: ${JSON.stringify(entities)}` : "",
            ``,
            evLines ? `Evidence:\n${evLines}` : "",
        ].filter(Boolean).join("\n");
    }
    async processUploadedFile(file: Express.Multer.File) {
        try {
            // Create uploads directory if it doesn't exist
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Generate unique filename
            const fileExtension = path.extname(file.originalname);
            const uniqueFilename = `${uuidv4()}${fileExtension}`;
            const filePath = path.join(uploadsDir, uniqueFilename);

            // Save file to uploads directory
            fs.writeFileSync(filePath, file.buffer);

            // Process the file based on its type
            let result;
            if (this.isAudioFile(file.mimetype)) {
            } else if (this.isDocumentFile(file.mimetype)) {
                // result = await this.processDocument(filePath);
            } else {
                result = { message: 'File uploaded but not processed (unsupported type)', success: false };
            }

            return {
                filePath,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
                processingResult: result
            };

        } catch (error) {
            console.error('Error processing uploaded file:', error);
            throw new Error(`Failed to process file: ${error.message}`);
        }
    }
    async transcribe(file: Express.Multer.File) {
        try {
            // Create uploads directory if it doesn't exist
            const uploadsDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Generate unique filename
            const fileExtension = path.extname(file.originalname);
            const uniqueFilename = `${uuidv4()}${fileExtension}`;
            const filePath = path.join(uploadsDir, uniqueFilename);

            // Save file to uploads directory
            fs.writeFileSync(filePath, file.buffer);

            // Process the file based on its type
            let result;
            if (this.isAudioFile(file.mimetype)) {
                result = await this.callSpeech(filePath, uniqueFilename, filePath);
            } else if (this.isDocumentFile(file.mimetype)) {
                // result = await this.processDocument(filePath);
            } else {
                result = { message: 'File uploaded but not processed (unsupported type)' };
            }

            return {
                filePath,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
                processingResult: result
            };

        } catch (error) {
            console.error('Error processing uploaded file:', error);
            throw new Error(`Failed to process file: ${error.message}`);
        }
    }

    isAudioFile(mimeType: string): boolean {
        return mimeType.startsWith('audio/');
    }

    isDocumentFile(mimeType: string): boolean {
        return mimeType.includes('pdf') ||
            mimeType.includes('text/') ||
            mimeType.includes('application/msword') ||
            mimeType.includes('application/vnd.openxmlformats-officedocument');
    }

    async processAudioFile(fileId: string, file: Express.Multer.File) {
        // Create a temporary file path for processing
        const tempPath = `/tmp/${fileId}_${file.originalname}`;
        fs.writeFileSync(tempPath, file.buffer);

        try {
            // Process the audio file using the existing callSpeech method
            const result = await this.callSpeech(tempPath, file.originalname);

            return {
                success: true,
                result: result
            };
        } finally {
            // Clean up temporary file
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }
    }

    private async processDocument(filePath: string) {
        // Add document processing logic here
        // This could include text extraction, indexing, etc.
        return { message: 'Document processing not yet implemented' };
    }

}
