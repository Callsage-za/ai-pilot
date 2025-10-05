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
import { CallsService } from '../chat-memory/calls.service';
import { JiraTicketsService } from '../jira-tickets/jira-tickets.service';
@Injectable()
export class SpeechService {
    private client: any;
    constructor(private readonly configService: ConfigService,
        private readonly geminiService: GeminiService,
        private readonly elasticService: ElasticService,
        private readonly callsService: CallsService,
        private readonly jiraTicketsService: JiraTicketsService
    ) {
        this.client = new SpeechClient({
            keyFilename: this.configService.get('AUTH_PATH'),
        }); 
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

    async callSpeech(path: string) {
        const audio = {
            content: fs.readFileSync(path).toString('base64'),
        };

        const audioConfig = await this.getAudioConfig(path);
        const request = {
            config: audioConfig,
            audio: audio,
        };

        const [response] = await this.client.recognize(request);
        const transcription = response.results
            .map(result => result.alternatives[0].transcript)
            .join('\n');
            console.log("transcription", transcription);
        // const transcription = `
        //                         good afternoon thank you for calling Horizon Telecom this is Melissa speaking
        //                         help you today yeah hi I'm calling because I've just checked my bank statement
        //                         once on the 1st and again on the 3rd what's going on I'm really sorry to hear that sir let me pull up your account so I
        //                         can take a look may I have your name and the account number please
        //                         it's Mark Simmons account number 453921
        //                         thank you Mr Simmons give me just a moment while I check your billing history okay I see 2 identical payments here
        //                         that's definitely not supposed to happen yeah I figured that out already
        //                         I'm just frustrated because this isn't the first time you guys have messed up my bill I completely understand your
        //                         frustration and I'm really sorry this happened again
        //                         it looks like the second charge was triggered when our system didn't detect the first payment immediately so it
        //                         processed another 1 automatic
        //                         so basically your system messed up and I'm out 800 Rand until you fix it I know that's not acceptable
        //                         I'll submit a refund request right now for the duplicate charge it should be back in your account within 3 to 5 business
        //                         days 3 to 5 days you took it instantly but I have to wait a week to get it back
        //                         that's ridiculous I understand completely if I could speed that up I would I'll mark this as urgent so our finance team
        //                         prioritizes it and I'll email you confirmation before the end of the day
        //                         fine I'll be watching for that email and for the record if this happens again I'm canceling my service I really hope you
        //                         don't have to Mr Simmons I'll make sure this issue is escalated so it doesn't happen again you'd better thanks thank you
        //                         for your patience and again I apologize for the inconvenience have a good day   `
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

        const [summaryEmbedding] = await this.geminiService.embedTexts([answer.text]);
        const callId = uuidv4();
        const elasticResponse = await this.elasticService.elasticPost(`/calls/_update/${callId}`, {
            doc: {
                call_id: callId,
                timestamp: new Date().toISOString(),
                agent_id: "agent_001",
                customer_id: "customer_789",
                audio_gcs_uri: path,
                transcript: transcription,
                summary: answer.text,
                embedding: summaryEmbedding,   // see #2 about mapping & dims
                intent: "billing_inquiry",
                department: "customer_service",
                severity: "low"
            },
            doc_as_upsert: true               // ✅ keep here only
        });
        console.log("elasticResponse", elasticResponse);
        for (let i = 0; i < transcriptChunk.length; i++) {
            const chunk = transcriptChunk[i];
            const elasticChunkResponse = await this.elasticService.elasticPost(`/call_chunks/_update/${callId}`, {
                doc: {
                    call_id: callId,
                    chunk_id: i,
                    text: chunk.text,
                    speaker: "speaker_0",
                    embedding: transcriptEmbedding[i]
                },
                doc_as_upsert: true
            })
        }
        const classification = await this.classifyCallHybrid({
            callId: uuidv4(),
            summary200w: answer.text,
            transcript: transcription,
            minConfidence: 0.6
        });
        console.log("classification", classification);

        this.callsService.saveCallLocallyAndIndex({
            callId: uuidv4(),
            startedAt: new Date(),
            endedAt: new Date(),
            summary: answer.text,
            transcriptText: transcription,
            classification: classification.classification,
            sentiment: classification.sentiment,
            severity: classification.severity,
            intents: classification.intents,
            entities: classification.entities,
            evidence: classification.evidence,
            classifierConf: classification.confidence
        });
        const jiraPayload = await this.maybeCreateJira(classification);
        if (jiraPayload) {
            await this.jiraTicketsService.createJiraIssue({
                title: jiraPayload.fields.summary,
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
        }
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
           "entities":{"account_id":null,"order_id":null,"product":null},
           "evidence":[{"speaker":"customer","text":"<short verbatim>","start_ms":null,"end_ms":null}],
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
            console.log('Processing uploaded file:', file.originalname);
            
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
            
            console.log('File saved to:', filePath);
            
            // Process the file based on its type
            let result;
            if (this.isAudioFile(file.mimetype)) {
                console.log('Processing as audio file...');
                result = await this.callSpeech(filePath);
            } else if (this.isDocumentFile(file.mimetype)) {
                console.log('Processing as document file...');
                // result = await this.processDocument(filePath);
            } else {
                console.log('File type not supported for processing');
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
    
    private isAudioFile(mimeType: string): boolean {
        return mimeType.startsWith('audio/');
    }
    
    private isDocumentFile(mimeType: string): boolean {
        return mimeType.includes('pdf') || 
               mimeType.includes('text/') || 
               mimeType.includes('application/msword') ||
               mimeType.includes('application/vnd.openxmlformats-officedocument');
    }
    
    private async processDocument(filePath: string) {
        // Add document processing logic here
        // This could include text extraction, indexing, etc.
        return { message: 'Document processing not yet implemented' };
    }

}
