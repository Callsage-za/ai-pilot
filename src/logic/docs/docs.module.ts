import { Module } from '@nestjs/common';
import { DocsService } from './docs.service';
import { DocsController } from './docs.controller';
import { ElasticModule } from '../elastic/elastic.module';
import { GeminiModule } from '../gemini/gemini.module';
import { ChatMemoryModule } from '../chat-memory/chat-memory.module';

@Module({
    imports: [ElasticModule, GeminiModule, ChatMemoryModule],
    controllers: [DocsController],
    providers: [DocsService],
    exports: [DocsService]
})
export class DocsModule {}
