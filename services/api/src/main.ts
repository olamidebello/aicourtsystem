import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use('/api/admin/auth',rateLimit({windowMs:900000,limit:20}));
  app.use('/api/policy/requests',rateLimit({windowMs:3600000,limit:5}));
  app.use('/api',(_req:any,res:any,next:any)=>{res.setHeader('Cache-Control','no-store');next();});
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60000, limit: 300 }));
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap();
