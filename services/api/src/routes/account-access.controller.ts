import { Body, Controller, Get, Post, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DbService } from '../db.service';
import { AccountMailer } from '../account-mailer';
import { digest, passwordHash } from '../auth';
const registrationMessage={message:'Registration request received. If a new account was created, verify your email before signing in. If no verification email arrives, ask the site administrator to approve your account. Existing users can sign in or request password recovery.'};
const generic={message:'If the account is eligible, an email will arrive shortly. Check your inbox and spam folder.'};
function emailInput(value:any){if(typeof value!=='string')throw new BadRequestException('Enter a valid email address.');const email=value.trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n]/.test(value))throw new BadRequestException('Enter a valid email address.');return email;}

function passwordInput(value:any){if(typeof value!=='string'||value.length<14||value.length>200)throw new BadRequestException('Use a password of 14–200 characters.');}
@Controller('admin/auth')
export class AccountAccessController {
 constructor(private db:DbService,private mail:AccountMailer){}
 @Get('options') options(){return {registrationAvailable:process.env.ALLOW_REGISTRATION!=='false',verificationMethod:this.mail.configured()?'email':'admin',resetAvailable:this.mail.configured()};}
 private available(){if(!this.mail.configured())throw new ServiceUnavailableException('Account email is unavailable. Contact the site administrator.');}
 @Post('register') async register(@Body() b:any){
  if(process.env.ALLOW_REGISTRATION==='false')throw new ServiceUnavailableException('Registration is currently closed.');
  const email=emailInput(b.email);passwordInput(b.password);
  if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200)throw new BadRequestException('Enter your name (up to 200 characters).');
  // Public registration cannot claim the initial administrator or request an elevated role.
  if(!Number((await this.db.query("SELECT count(*) n FROM platform_accounts WHERE role='super_admin'")).rows[0].n))throw new ServiceUnavailableException('The administrator must finish initial setup first.');
  const hash=await passwordHash(b.password);
  const a=(await this.db.query("INSERT INTO platform_accounts(email,name,password_hash,role,email_verified) VALUES($1,$2,$3,'user',false) ON CONFLICT(email) DO NOTHING RETURNING id,email",[email,b.name.trim(),hash])).rows[0];
  const pending=a||(await this.db.query("SELECT id,email FROM platform_accounts WHERE email=$1 AND active=true AND role='user' AND email_verified=false AND admin_approved=false",[email])).rows[0];
  if(pending&&this.mail.configured())await this.issue(pending,'verify');
  return registrationMessage;
 }
 private async issue(account:any,purpose:'verify'|'reset'){
  const token=randomBytes(32).toString('hex'),hash=digest(token);
  // A database-backed cooldown applies across processes and limits mailbox flooding.
  const c=await this.db.pool.connect();let created=false;
  try{await c.query('BEGIN');await c.query('SELECT id FROM platform_accounts WHERE id=$1 FOR UPDATE',[account.id]);
   const recent=await c.query("SELECT 1 FROM platform_account_tokens WHERE account_id=$1 AND created_at>now()-interval '2 minutes'",[account.id]);
   if(!recent.rows.length){
    await c.query('DELETE FROM platform_account_tokens WHERE account_id=$1',[account.id]);
    await c.query("INSERT INTO platform_account_tokens(token_hash,account_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[hash,account.id,purpose]);created=true;
   }
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  if(!created)return;
  try{await this.mail.send(account.email,token,purpose);}catch{
   await this.db.query('DELETE FROM platform_account_tokens WHERE token_hash=$1',[hash]);
   // Never log the token, email, SMTP credentials or provider response.
   console.warn('Account email delivery failed; check SMTP configuration.');
  }
 }
 @Post('forgot-password') async forgot(@Body() b:any){
  this.available();const email=emailInput(b.email);
  const a=(await this.db.query('SELECT id,email,email_verified FROM platform_accounts WHERE email=$1 AND active=true',[email])).rows[0];
  if(a)await this.issue(a,a.email_verified?'reset':'verify');
  return generic;
 }
 @Post('reset-password') async reset(@Body() b:any){passwordInput(b.password);return this.consume(b.token,'reset',await passwordHash(b.password));}
 @Post('verify-email') async verify(@Body() b:any){return this.consume(b.token,'verify');}
 private async consume(token:any,purpose:'verify'|'reset',password?:string){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new BadRequestException('Invalid or expired link. Request a new email.');
  const c=await this.db.pool.connect();
  try{await c.query('BEGIN');
   // Lock the account before the token so concurrent requests using different links serialize.
   const a=(await c.query("SELECT a.id FROM platform_accounts a JOIN platform_account_tokens t ON t.account_id=a.id WHERE t.token_hash=$1 AND t.purpose=$2 AND t.expires_at>now() AND a.active=true FOR UPDATE OF a",[digest(token),purpose])).rows[0];
   if(!a)throw new BadRequestException('Invalid or expired link. Request a new email.');
   const used=await c.query('DELETE FROM platform_account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING account_id',[digest(token),purpose]);
   if(!used.rows.length)throw new BadRequestException('Invalid or expired link. Request a new email.');
   if(purpose==='reset'){
    await c.query('UPDATE platform_accounts SET password_hash=$2 WHERE id=$1 AND email_verified=true',[a.id,password]);
    await c.query('DELETE FROM platform_sessions WHERE account_id=$1',[a.id]);
   }else await c.query('UPDATE platform_accounts SET email_verified=true WHERE id=$1',[a.id]);
   await c.query('DELETE FROM platform_account_tokens WHERE account_id=$1',[a.id]);
   await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES('account-recovery',$1,'account',$2)",[purpose==='reset'?'password_reset':'email_verified',String(a.id)]);
   await c.query('COMMIT');return {message:purpose==='reset'?'Password updated. Sign in with your new password.':'Email verified. You can now sign in.'};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
}
