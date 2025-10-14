import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { InjectRepository } from '@nestjs/typeorm';
import { FileUpload } from 'src/entities/file-upload.entity';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

@Injectable()
export class FileUploadService {
    private baseLink: string;

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(FileUpload)
        private readonly fileUploadRepository: Repository<FileUpload>,
    ) {
        this.baseLink = this.configService.get('ENVIRONMENT') == "production" 
            ? "https://api-pilot.balanceapp.co.za" 
            : "http://localhost:8787";
    }

    async saveFileUpload(file: Express.Multer.File, conversationId?: string, messageId?: string, user?: User): Promise<{ id: string; externalPath: string }> {
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const fileExtension = path.extname(file.originalname);
        const uniqueFilename = `${uuidv4()}${fileExtension}`;
        const localPath = path.join(uploadsDir, uniqueFilename);

        // Save file to uploads directory
        fs.writeFileSync(localPath, file.buffer);

        // Generate external path
        const externalPath = `${this.baseLink}/uploads/${uniqueFilename}`;

        // Save to database
        const fileUploadItem: Partial<FileUpload> = {
            localPath,
            externalPath,
            originalName: file.originalname,
            fileSize: file.size,
            mimeType: file.mimetype, 
            isProcessed: false,
            conversationId: conversationId || undefined,
            messageId: messageId || undefined,
            user: user || undefined,
            organizationId: user?.organizationId || '',
            createdAt: new Date(),
            updatedAt: new Date()
        }
        const fileUpload = await this.fileUploadRepository.save(fileUploadItem);

        return {
            id: fileUpload.id || '',
            externalPath: fileUpload.externalPath || ''
        };
    }

    async getFileUpload(id: string) {
        return this.fileUploadRepository.findOne({
            where: { id }
        });
    }

    async getFileUploadByName(originalName: string) {
        return this.fileUploadRepository.findOne({
            where: { originalName }
        });
    }

    async markAsProcessed(id: string) {
        return this.fileUploadRepository.update(id, {
            isProcessed: true
        });
    }

    async updateFileMessageId(id: string, messageId: string) {
        return this.fileUploadRepository.update(id, {
            messageId
        });
    }
}
