import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [FileUploadService],
    exports: [FileUploadService],
})
export class FileUploadModule {}
