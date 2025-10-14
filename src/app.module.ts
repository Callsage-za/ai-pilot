import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ElasticModule } from './logic/elastic/elastic.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GeminiModule } from './logic/gemini/gemini.module';
import { JiraTicketsModule } from './logic/jira-tickets/jira-tickets.module';
import { ChatMemoryController } from './logic/chat-memory/chat-memory.controller';
import { ChatMemoryModule } from './logic/chat-memory/chat-memory.module';
import { SpeechController } from './logic/speech/speech.controller';
import { SpeechModule } from './logic/speech/speech.module';
import { PolicyDocumentsModule } from './logic/policy-documents/policy-documents.module';
import { ChatController } from './logic/chat/chat.controller';
import { ChatModule } from './logic/chat/chat.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { resolve } from 'path';
import { FileUploadModule } from './logic/file-upload/file-upload.module';
import { CallSearchModule } from './logic/call-search/call-search.module';
import { SocketGatewayModule } from './logic/socket-gateway/socket-gateway.module';
import { AuthModule } from './logic/auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ToolsModule } from './logic/tools/tools.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: resolve(process.cwd(), 'uploads'), // path to your folder
      serveRoot: '/uploads', // optional, URL prefix
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 3306),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', ''),
        database: configService.get('DB_DATABASE', 'ai_pilot'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize:true,
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    ElasticModule,
    GeminiModule,
    JiraTicketsModule,
    ChatMemoryModule, 
    SpeechModule,
    PolicyDocumentsModule,
    ChatModule,
    FileUploadModule,
    CallSearchModule, 
    SocketGatewayModule,
    AuthModule,
    ToolsModule
  ],
  controllers: [AppController, ChatMemoryController, SpeechController, ChatController],
  providers: [AppService],
})
export class AppModule {}
