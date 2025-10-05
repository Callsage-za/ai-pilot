import { Controller, Post, Body, UseInterceptors, UploadedFile, UploadedFiles } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { SpeechService } from './speech.service';

@Controller('speech')
export class SpeechController {
    constructor(private readonly speechService: SpeechService) {}

    @Post('callSpeech')
    async callSpeech(@Body() body: {path: string}) {
        return this.speechService.callSpeech(body.path);
    }

    @Post('uploadFile')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
        console.log('Received file:', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            filename: file.filename,
            path: file.path
        });

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
        console.log('Received files:', files.map(f => ({
            originalname: f.originalname,
            mimetype: f.mimetype,
            size: f.size,
            filename: f.filename,
            path: f.path
        })));

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
