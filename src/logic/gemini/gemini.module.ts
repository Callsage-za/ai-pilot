import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Module({
    exports: [GeminiService],
    providers: [GeminiService],
})
export class GeminiModule {}
