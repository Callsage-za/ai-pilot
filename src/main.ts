import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS handled by Apache reverse proxy

  await app.listen(process.env.PORT ?? 8787);
}
bootstrap(); 
