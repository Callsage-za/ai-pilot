import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend communication
  app.enableCors({
    origin: ['http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:5173',
      'https://callsage.balanceapp.co.za'], // Add your frontend URLs
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 8787);
}
bootstrap(); 
