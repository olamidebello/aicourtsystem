import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AccountMailer {
 configured(){
  try{const url=new URL(process.env.PUBLIC_APP_URL||'https://justisolve.com');
   return !!process.env.SMTP_HOST&&!!process.env.SMTP_FROM&&!/[\r\n]/.test(process.env.SMTP_FROM)&&url.protocol==='https:'&&!url.username&&!url.password;
  }catch{return false;}
 }
 async send(email:string,token:string,purpose:'verify'|'reset'){
  if(!this.configured())throw new ServiceUnavailableException('Account email is unavailable. Contact the site administrator.');
  const origin=new URL(process.env.PUBLIC_APP_URL||'https://justisolve.com').origin;
  const link=origin+'/#'+new URLSearchParams({action:purpose,token}).toString();
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',requireTLS:process.env.SMTP_SECURE!=='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
  try{await transport.sendMail({from:process.env.SMTP_FROM,to:email,subject:purpose==='verify'?'Verify your JustiSolve account':'Reset your JustiSolve password',text:`${purpose==='verify'?'Confirm your requested JustiSolve account':'Choose a new JustiSolve password'}:\n\n${link}\n\nThis single-use link expires in 30 minutes. If you did not request this, ignore this email. Never share this link.`});}
  finally{transport.close();}
 }
}
