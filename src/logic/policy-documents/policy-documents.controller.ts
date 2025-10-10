import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import { PolicyDocumentsService } from './policy-documents.service';
import { PolicyDocumentType, PolicyDocumentParentId, PolicyDocumentUploadData, PolicyDocument } from 'src/utils/types';
import { ConfigService } from '@nestjs/config';

@Controller('policy-documents')
export class PolicyDocumentsController {
  private baseLink:string;
  constructor(
    private readonly policyDocumentsService: PolicyDocumentsService,
    private readonly configService: ConfigService,
  ) {
    this.baseLink = this.configService.get('ENVIRONMENT')=="production"?"https://api-pilot.balanceapp.co.za":"http://localhost:8787";
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPolicyDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      title: string;
      description?: string;
      type: PolicyDocumentType;
      uploadedBy?: string;
      headers?: string; // JSON string
      version?: string;
      effectiveDate?: string;
      parentId?: PolicyDocumentParentId; 
    },
  ) {
    try {
      if (!file) {
        throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
      }

      // Validate required fields
      if (!body.title || !body.type) {
        throw new HttpException(
          'Title and type are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate PolicyDocumentType
      if (!Object.values(PolicyDocumentType).includes(body.type)) {
        throw new HttpException(
          'Invalid policy document type',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'policy-documents');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const uniqueFileName = `${body.type}-${Date.now()}-${Math.random().toString(36).substring(7)}${fileExtension}`;
      const filePath = path.join(uploadsDir, uniqueFileName);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Parse headers if provided
      let headers = null;
      if (body.headers) {
        try {
          headers = JSON.parse(body.headers);
        } catch (error) {
          console.warn('Invalid headers JSON:', error);
        }
      }

      // Parse effective date if provided
      let effectiveDate: Date | undefined = undefined;
      if (body.effectiveDate) {
        try {
          effectiveDate = new Date(body.effectiveDate);
        } catch (error) {
          console.warn('Invalid effective date:', error);
        }
      }
      const uploadLink = this.baseLink+"/uploads/policy-documents/"+uniqueFileName;
      // Create policy document record
      const documentData: PolicyDocumentUploadData = {
        title: body.title,
        description: body.description,
        type: body.type,
        fileName: file.originalname,
        filePath: uploadLink,
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedBy: body.uploadedBy,
        headers: headers,
        parentId: body.parentId,
        version: body.version,
        effectiveDate: effectiveDate,
      };
      const document = await this.policyDocumentsService.createPolicyDocument(documentData,filePath);

      return {
        success: true,
        document: {
          id: document.id,
          title: document.title,
          description: document.description,
          type: document.type,
          fileName: document.fileName,
          fileSize: document.fileSize,
          mimeType: document.mimeType,
          headers: document.headers,
          version: document.version,
          effectiveDate: document.effectiveDate,
          createdAt: document.createdAt,
          parentId: document.parentId,
        },
        filePath: filePath,
      };
    } catch (error) {
      console.error('Policy document upload error:', error);
      throw new HttpException(
        error.message || 'Upload failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('documents')
  async getAllPolicyDocuments(): Promise<PolicyDocument[]> {
    return this.policyDocumentsService.getAllPolicyDocuments();
  }

  @Get('documents/type/:type')
  async getPolicyDocumentsByType(@Param('type') type: PolicyDocumentType): Promise<PolicyDocument[]> {
    return this.policyDocumentsService.getPolicyDocumentsByType(type);
  }

  @Get('documents/section/:section')
  async getPolicyDocumentsBySection(@Param('section') section: string): Promise<PolicyDocument[]> {
    return this.policyDocumentsService.getPolicyDocumentsBySection(section);
  }

  @Get('documents/search')
  async searchPolicyDocuments(@Query('q') query: string): Promise<PolicyDocument[]> {
    if (!query) {
      throw new HttpException('Query parameter is required', HttpStatus.BAD_REQUEST);
    }
    return this.policyDocumentsService.searchPolicyDocuments(query);
  }

  @Get('documents/:id')
  async getPolicyDocumentById(@Param('id') id: string): Promise<PolicyDocument> {
    const document = await this.policyDocumentsService.getPolicyDocumentById(id);
    if (!document) {
      throw new HttpException('Policy document not found', HttpStatus.NOT_FOUND);
    }
    return document;
  }

  @Get('types')
  async getPolicyDocumentTypes(): Promise<PolicyDocumentType[]> {
    return this.policyDocumentsService.getPolicyDocumentTypes();
  }

  @Put('documents/:id/headers')
  async updatePolicyDocumentHeaders(
    @Param('id') id: string,
    @Body() body: { headers: any },
  ): Promise<PolicyDocument> {
    return this.policyDocumentsService.updatePolicyDocumentHeaders(id, body.headers);
  }

  @Put('documents/:id/processed')
  async markPolicyDocumentAsProcessed(@Param('id') id: string): Promise<PolicyDocument> {
    return this.policyDocumentsService.markPolicyDocumentAsProcessed(id);
  }

  @Delete('documents/:id')
  async deletePolicyDocument(@Param('id') id: string): Promise<PolicyDocument> {
    const document = await this.policyDocumentsService.getPolicyDocumentById(id);
    if (!document) {
      throw new HttpException('Policy document not found', HttpStatus.NOT_FOUND);
    }

    // Delete file from disk
    if (fs.existsSync(document.filePath)) {
      fs.unlinkSync(document.filePath);
    }

    return this.policyDocumentsService.deletePolicyDocument(id);
  }
}
