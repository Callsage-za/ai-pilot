import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Override Apache CORS headers
  app.use((req, res, next) => {
    // Remove conflicting headers
    res.removeHeader('Access-Control-Allow-Origin');
    res.removeHeader('Access-Control-Allow-Credentials');
    
    // Set correct CORS headers
    res.header('Access-Control-Allow-Origin', 'https://callsage.balanceapp.co.za');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    
    next();
  });

  await app.listen(process.env.PORT ?? 8787);
}
bootstrap(); 
