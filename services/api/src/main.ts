import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(['/api/admin/auth/login','/api/admin/auth/bootstrap'],rateLimit({windowMs:900000,limit:20,skip:(req)=>req.method!=='POST',skipSuccessfulRequests:true,message:{message:'Too many sign-in attempts. Please wait 15 minutes before trying again.'}}));
  app.use('/api/policy/requests',rateLimit({windowMs:3600000,limit:5,message:{message:'Too many requests. Please try again later.'}}));
  app.use('/api',(_req:any,res:any,next:any)=>{res.setHeader('Cache-Control','no-store');next();});
  app.use(helmet());
  app.use(rateLimit({ windowMs: 60000, limit: 300, message:{message:'Too many requests. Please try again in a minute.'} }));
  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
}
bootstrap();
