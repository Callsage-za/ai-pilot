import { Module } from '@nestjs/common';
import { CallSearchService } from './call-search.service';
import { ElasticModule } from '../elastic/elastic.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
    imports: [ElasticModule, PrismaModule, GeminiModule],
    providers: [CallSearchService],
    exports: [CallSearchService],
})
export class CallSearchModule {}
