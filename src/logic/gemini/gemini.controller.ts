import { Controller, Post, Body } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Controller('gemini')
export class GeminiController {
    constructor(private readonly geminiService: GeminiService) {}

    @Post('generateEmbed')
    async generateEmbed(@Body() body: { prompt: string }) {
        return this.geminiService.embedTexts([body.prompt]);
    }
    @Post('generateContent')
    async generateContent(@Body() body: { prompt: string }) {
        return this.geminiService.generateContent(body.prompt);
    }
}
