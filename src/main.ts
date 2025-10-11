import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with high priority to override Apache
  app.enableCors({
    origin: 'https://callsage.balanceapp.co.za',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
  });

  // Additional middleware to ensure headers are set correctly
  app.use((req, res, next) => {
    // Force remove any existing CORS headers
    res.removeHeader('Access-Control-Allow-Origin');
    res.removeHeader('Access-Control-Allow-Methods');
    res.removeHeader('Access-Control-Allow-Headers');
    res.removeHeader('Access-Control-Allow-Credentials');
    res.removeHeader('Access-Control-Max-Age');
    res.removeHeader('Vary');
    
    // Set our CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://callsage.balanceapp.co.za');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    next();
  });

  await app.listen(process.env.PORT ?? 8787);
}
bootstrap(); 
