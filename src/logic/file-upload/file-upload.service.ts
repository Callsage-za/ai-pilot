import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import fs from 'node:fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileUploadService {
    private baseLink: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService
    ) {
        this.baseLink = this.configService.get('ENVIRONMENT') == "production" 
            ? "https://api-pilot.balanceapp.co.za" 
            : "http://localhost:8787";
    }

    async saveFileUpload(file: Express.Multer.File, conversationId?: string, messageId?: string): Promise<{ id: string; externalPath: string }> {
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
        const fileUpload = await this.prisma.fileUpload.create({
            data: {
                localPath,
                externalPath,
                originalName: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                isProcessed: false,
                conversationId: conversationId || null,
                messageId: messageId || null
            }
        });

        return {
            id: fileUpload.id,
            externalPath: fileUpload.externalPath || ''
        };
    }

    async getFileUpload(id: string) {
        return this.prisma.fileUpload.findUnique({
            where: { id }
        });
    }

    async getFileUploadByName(originalName: string) {
        return this.prisma.fileUpload.findFirst({
            where: { originalName }
        });
    }

    async markAsProcessed(id: string) {
        return this.prisma.fileUpload.update({
            where: { id },
            data: { isProcessed: true }
        });
    }

    async updateFileMessageId(id: string, messageId: string) {
        return this.prisma.fileUpload.update({
            where: { id },
            data: { messageId }
        });
    }
}
