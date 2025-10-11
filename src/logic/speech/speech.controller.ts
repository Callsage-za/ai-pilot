import { Controller, Post, Body, UseInterceptors, UploadedFile, UploadedFiles, Get } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { SpeechService } from './speech.service';
import { FileUploadService } from '../file-upload/file-upload.service';

@Controller('speech')
export class SpeechController {
    constructor(
        private readonly speechService: SpeechService,
        private readonly fileUploadService: FileUploadService
    ) {}

    @Post('callSpeech')
    async callSpeech(@Body() body: {path: string,name: string, audioPath: string}) {
        return this.speechService.callSpeech(body.path,body.name, body.audioPath);
    }
    @Get('all')
    async getAllAudioFiles(){
        return this. speechService.getAllAudioFiles()
    }

    @Post("uploadFile")
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: Express.Multer.File, @Body() body: { conversationId?: string; messageId?: string }) {
        // Save file and get ID
        const { id, externalPath } = await this.fileUploadService.saveFileUpload(file, body.conversationId, body.messageId);
        return {
            message: 'File uploaded successfully',
            id,
            externalPath
        };
    }

    @Post('transcribe')
    @UseInterceptors(FileInterceptor('file'))
    async transcribe(@UploadedFile() file: Express.Multer.File) {
        // Process the uploaded file
        const result = await this.speechService.processUploadedFile(file);

        return {
            message: 'File uploaded and processed successfully',
            filename: file.originalname,
            size: file.size,
            path: file.path,
            result: result
        };
    }

    @Post('uploadFiles')
    @UseInterceptors(FilesInterceptor('files', 10)) // Allow up to 10 files
    async uploadFiles(@UploadedFiles() files: Express.Multer.File[]) {
        // Process all uploaded files
        const results = await Promise.all(
            files.map(file => this.speechService.processUploadedFile(file))
        );

        return {
            message: 'Files uploaded and processed successfully',
            count: files.length,
            results: results
        };
    }
}
