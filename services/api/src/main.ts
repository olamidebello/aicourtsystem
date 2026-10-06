import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true, credentials: true });
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60000, limit: 300 }));
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap();
