import { Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import {DbService} from './db.service';
import {CommerceService} from './commerce.service';
@Injectable()
export class AccountMailer {
 private runtime:any=null;
 constructor(@Optional() private db?:DbService){}
 private config(){return this.runtime||{enabled:true,host:process.env.SMTP_HOST,from:process.env.SMTP_FROM,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',user:process.env.SMTP_USER,password:process.env.SMTP_PASSWORD};}
 async refresh(){if(!this.db)return;try{const flags=(await this.db.query("SELECT value FROM platform_settings WHERE key='platform_features'")).rows[0]?.value;if(flags?.email===false){this.runtime={enabled:false};return;}const row=(await this.db.query("SELECT value FROM platform_settings WHERE key='system_email'")).rows[0];this.runtime=row?{...row.value,password:await new CommerceService(this.db).secret('system_smtp_password')||process.env.SMTP_PASSWORD||''}:null;}catch{this.runtime={enabled:false};}}
 configured(){try{const url=new URL(process.env.PUBLIC_APP_URL||'https://justisolve.com'),c=this.config();return c.enabled!==false&&!!c.host&&!!c.from&&!/[\r\n]/.test(c.from)&&url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
 private transport(){const c=this.config();if(!this.configured())throw new ServiceUnavailableException('Account email is unavailable. Contact the site administrator.');return nodemailer.createTransport({host:c.host,port:c.port,secure:c.secure,requireTLS:!c.secure,auth:c.user?{user:c.user,pass:c.password}:undefined,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});}
 async test(recipient?:string){await this.refresh();const t=this.transport();try{await t.verify();if(recipient)await t.sendMail({from:this.config().from,to:recipient,subject:'JustiSolve system email test',text:'This is the system email test you requested in JustiSolve administration.'});return {connected:true,test_sent:!!recipient};}finally{t.close();}}
 async send(email:string,token:string,purpose:'verify'|'reset'){
  await this.refresh();const origin=new URL(process.env.PUBLIC_APP_URL||'https://justisolve.com').origin,link=origin+'/#'+new URLSearchParams({action:purpose,token}).toString(),transport=this.transport();let status='failed';
  try{await transport.sendMail({from:this.config().from,to:email,subject:purpose==='verify'?'Verify your JustiSolve account':'Reset your JustiSolve password',text:`${purpose==='verify'?'Confirm your requested JustiSolve account':'Choose a new JustiSolve password'}:\n\n${link}\n\nThis single-use link expires in 30 minutes. If you did not request this, ignore this email. Never share this link.`});status='accepted_by_smtp';}
  finally{transport.close();if(this.db)try{await this.db.query('INSERT INTO communication_deliveries(recipient,kind,status) VALUES($1,$2,$3)',[email,purpose,status]);}catch{/* Never log message bodies, reset tokens or SMTP responses. */}}
 }
}
