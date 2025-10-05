import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticModule } from './logic/elastic/elastic.module';
import { ConfigModule } from '@nestjs/config';
import { GeminiModule } from './logic/gemini/gemini.module';
import { DocsModule } from './logic/docs/docs.module';
import { JiraTicketsModule } from './logic/jira-tickets/jira-tickets.module';
import { ChatMemoryController } from './logic/chat-memory/chat-memory.controller';
import { ChatMemoryService } from './logic/chat-memory/chat-memory.service';
import { ChatMemoryModule } from './logic/chat-memory/chat-memory.module';
import { PrismaController } from './logic/prisma/prisma.controller';
import { PrismaService } from './logic/prisma/prisma.service';
import { PrismaModule } from './logic/prisma/prisma.module';
import { SpeechController } from './logic/speech/speech.controller';
import { SpeechService } from './logic/speech/speech.service';
import { SpeechModule } from './logic/speech/speech.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ElasticModule,
    GeminiModule,
    DocsModule,
    JiraTicketsModule,
    ChatMemoryModule,
    PrismaModule,
    SpeechModule,
  ],
  controllers: [AppController, ChatMemoryController, PrismaController, SpeechController],
  providers: [AppService, ChatMemoryService, SpeechService],
})
export class AppModule {}
