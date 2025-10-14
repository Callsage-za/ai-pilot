import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileUpload } from 'src/entities/file-upload.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [TypeOrmModule.forFeature([FileUpload]),ConfigModule],
    providers: [FileUploadService],
    exports: [FileUploadService],
})
export class FileUploadModule {}
