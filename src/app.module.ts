import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticModule } from './logic/elastic/elastic.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GeminiModule } from './logic/gemini/gemini.module';
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
import { PolicyDocumentsModule } from './logic/policy-documents/policy-documents.module';
import { ChatController } from './logic/chat/chat.controller';
import { ChatService } from './logic/chat/chat.service';
import { ChatModule } from './logic/chat/chat.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { resolve } from 'path';
import { FileUploadModule } from './logic/file-upload/file-upload.module';
import { CallSearchModule } from './logic/call-search/call-search.module';
import { SocketGatewayModule } from './logic/socket-gateway/socket-gateway.module';
import { CallSearchService } from './logic/call-search/call-search.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: resolve(process.cwd(), 'uploads'), // path to your folder
      serveRoot: '/uploads', // optional, URL prefix
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ElasticModule,
    GeminiModule,
    JiraTicketsModule,
    ChatMemoryModule, 
    PrismaModule,
    SpeechModule,
    PolicyDocumentsModule,
    ChatModule,
    FileUploadModule,
    CallSearchModule, 
    SocketGatewayModule
  ],
  controllers: [AppController, ChatMemoryController, PrismaController, SpeechController, ChatController],
  providers: [AppService, ChatMemoryService, SpeechService, ChatService,CallSearchService],
})
export class AppModule {}
