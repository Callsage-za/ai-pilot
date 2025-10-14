import { Controller, Post, Body, UseInterceptors, UploadedFile, UploadedFiles, Get, UseGuards, Request, Put, Param } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { SpeechService } from './speech.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@Controller('speech')
@UseGuards(JwtAuthGuard)
export class SpeechController {
    constructor(
        private readonly speechService: SpeechService,
        private readonly fileUploadService: FileUploadService
    ) {}

    @Post('callSpeech')
    async callSpeech(@Request() req: { user: User }, @Body() body: {path: string,name: string, audioPath: string}) {
        return this.speechService.callSpeech(body.path,body.name, req.user, body.audioPath);
    }
    @Get('all')
    async getAllAudioFiles(@Request() req: { user: User }){
        return this.speechService.getAllAudioFiles(req.user)
    }

    @Post("uploadFile")
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@Request() req: { user: User }, @UploadedFile() file: Express.Multer.File, @Body() body: { conversationId?: string; messageId?: string }) {
        // Save file and get ID
        const { id, externalPath } = await this.fileUploadService.saveFileUpload(file, body.conversationId, body.messageId, req.user);
        return {
            message: 'File uploaded successfully',
            id,
            externalPath
        };
    }

    @Post('transcribe')
    @UseInterceptors(FileInterceptor('file'))
    async transcribe(@Request() req: { user: User }, @UploadedFile() file: Express.Multer.File) {
        // Process the uploaded file
        const result = await this.speechService.transcribe(file, req.user);

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
    async uploadFiles(@Request() req: { user: User }, @UploadedFiles() files: Express.Multer.File[]) {
        // Process all uploaded files
        const results = await Promise.all(
            files.map(file => this.speechService.processUploadedFile(file, req.user))
        );

        return {
            message: 'Files uploaded and processed successfully',
            count: files.length,
            results: results
        };
    }

    @Put('audio/:id/classification')
    async updateClassification(@Request() req: { user: User }, @Param('id') id: string, @Body() body: { classification: string }) {
        return this.speechService.updateClassification(id, body.classification, req.user);
    }
}
