import { Body, Controller, Get, Post, Patch, Param, Req, Res, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { DbService } from '../db.service';
import { digest, passwordHash, passwordMatches, secretMatches } from '../auth';

function accountInput(b:any){if(typeof b.email!=='string'||!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>254||typeof b.name!=='string'||!b.name.trim()||b.name.length>200||typeof b.password!=='string'||b.password.length<14||b.password.length>200)throw new BadRequestException('Name, valid email and password of 14–200 characters required.');}
@Controller('admin')
export class AdminController {
 constructor(private db:DbService){}
 private async audit(actor:string,action:string,id:any,meta:any={}){await this.db.query('INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,$2,$3,$4,$5)',[actor,action,'administration',String(id),meta]);}
 @Get('auth/status') async status(){return {setupRequired:Number((await this.db.query('SELECT count(*) n FROM platform_accounts')).rows[0].n)===0};}
 @Post('auth/bootstrap') async bootstrap(@Body() b:any){
  if(!secretMatches(b.setupToken||'',process.env.ADMIN_SETUP_TOKEN||''))throw new UnauthorizedException('Invalid setup token.');accountInput(b);
  const hash=await passwordHash(b.password);const c=await this.db.pool.connect();
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736192)');if(Number((await c.query('SELECT count(*) n FROM platform_accounts')).rows[0].n))throw new ConflictException('Setup already completed.');
   const r=await c.query('INSERT INTO platform_accounts(email,name,password_hash) VALUES($1,$2,$3) RETURNING id,email,name,role',[b.email.toLowerCase().trim(),b.name.trim(),hash]);await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES($1,'bootstrap','administration',$2)",[b.email,String(r.rows[0].id)]);for(const source of ['courtlistener','scotus','ca5'])await c.query("INSERT INTO news_campaigns(name,source,provider,max_items) VALUES($1,$2,$3,1)",['Public opinions — '+source,source,'ollama:'+(process.env.OLLAMA_MODEL||'llama3.2:3b')]);await c.query('COMMIT');return r.rows[0];
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 @Post('auth/login') async login(@Body() b:any,@Res({passthrough:true}) res:any){
  if(typeof b.password!=='string'||b.password.length>200||typeof b.email!=='string')throw new UnauthorizedException('Invalid credentials.');
  const a=(await this.db.query('SELECT * FROM platform_accounts WHERE email=$1 AND active=true',[b.email.toLowerCase().trim()])).rows[0];
  const valid=await passwordMatches(b.password,a?.password_hash||'dummy:'+('00'.repeat(64)));if(!a||!valid)throw new UnauthorizedException('Invalid credentials.');
  const token=randomBytes(32).toString('hex');await this.db.query("DELETE FROM platform_sessions WHERE expires_at<now()");await this.db.query("INSERT INTO platform_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[digest(token),a.id]);
  res.cookie('justisolve_session',token,{httpOnly:true,secure:process.env.COOKIE_SECURE!=='false',sameSite:'strict',maxAge:8*3600000,path:'/api'});res.setHeader('Cache-Control','no-store');await this.audit(a.email,'login',a.id);return {id:a.id,email:a.email,name:a.name,role:a.role};
 }
 @Get('auth/me') me(@Req() req:any){return req.admin;}
 @Post('auth/logout') async logout(@Req() req:any,@Res({passthrough:true}) res:any){const token=String(req.headers.cookie||'').match(/(?:^|;\s*)justisolve_session=([a-f0-9]{64})/)?.[1];if(token)await this.db.query('DELETE FROM platform_sessions WHERE token_hash=$1',[digest(token)]);res.clearCookie('justisolve_session',{path:'/api',httpOnly:true,secure:process.env.COOKIE_SECURE!=='false',sameSite:'strict'});return {ok:true};}
 @Get('accounts') async accounts(){return (await this.db.query('SELECT id,email,name,role,active,created_at FROM platform_accounts ORDER BY id')).rows;}
 @Post('accounts') async add(@Body() b:any,@Req() req:any){accountInput(b);if(!['user','super_admin'].includes(b.role))throw new BadRequestException('Valid role required.');try{const r=await this.db.query('INSERT INTO platform_accounts(email,name,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,email,name,role,active',[b.email.toLowerCase().trim(),b.name.trim(),await passwordHash(b.password),b.role]);await this.audit(req.admin.email,'account_created',r.rows[0].id);return r.rows[0];}catch(e){if(e.code==='23505')throw new ConflictException('Account exists.');throw e;}}
 @Patch('accounts/:id') async account(@Param('id') id:string,@Body() b:any,@Req() req:any){
  if(id===String(req.admin.id)&&b.active===false)throw new BadRequestException('You cannot disable your current account.');if(typeof b.active!=='boolean')throw new BadRequestException('Active state required.');
  const c=await this.db.pool.connect();let row;
  try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(736194)');
   const target=(await c.query('SELECT role,active FROM platform_accounts WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!target)throw new BadRequestException('Account not found.');
   if(!b.active&&target.role==='super_admin'&&target.active&&Number((await c.query("SELECT count(*) n FROM platform_accounts WHERE active=true AND role='super_admin'")).rows[0].n)<=1)throw new BadRequestException('At least one administrator must remain active.');
   row=(await c.query('UPDATE platform_accounts SET active=$2 WHERE id=$1 RETURNING id,email,name,role,active',[id,b.active])).rows[0];if(!row)throw new BadRequestException('Account not found.');if(!b.active)await c.query('DELETE FROM platform_sessions WHERE account_id=$1',[id]);await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  await this.audit(req.admin.email,'account_status',id,{active:b.active});return row;
 }
 @Get('organizations') async organizations(){return (await this.db.query('SELECT * FROM tenants ORDER BY tenant_id')).rows;}
 @Post('organizations') async org(@Body() b:any,@Req() req:any){if(typeof b.name!=='string'||!b.name.trim()||b.name.length>200||!/^[-a-z0-9]{2,60}$/.test(b.slug))throw new BadRequestException('Name and lowercase slug required.');const r=await this.db.query('INSERT INTO tenants(name,slug) VALUES($1,$2) RETURNING *',[b.name.trim(),b.slug]);await this.audit(req.admin.email,'organization_created',r.rows[0].tenant_id);return r.rows[0];}
 @Patch('organizations/:id') async orgState(@Param('id') id:string,@Body() b:any,@Req() req:any){if(!['active','suspended'].includes(b.status))throw new BadRequestException('Invalid status');const r=await this.db.query('UPDATE tenants SET status=$2 WHERE tenant_id=$1 RETURNING *',[id,b.status]);await this.audit(req.admin.email,'organization_status',id,{status:b.status});return r.rows[0];}
 @Get('overview') async overview(){return (await this.db.query("SELECT (SELECT count(*) FROM platform_accounts) accounts,(SELECT count(*) FROM tenants) organizations,(SELECT count(*) FROM news_campaigns) campaigns,(SELECT count(*) FROM news_posts WHERE status='published') published_posts,(SELECT count(*) FROM policy_requests WHERE status='open') open_requests")).rows[0];}
 @Get('resources') async resources(){const checks=await Promise.all([['AI',()=>axios.get((process.env.AI_BASE_URL||'http://ai:8000')+'/health',{timeout:5000})],['Database',()=>this.db.query('SELECT 1')]].map(async([name,fn]:any)=>{try{await fn();return {name,status:'available'};}catch{return {name,status:'unavailable'};}}));return checks;}
 @Get('audit') async auditList(){return (await this.db.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200')).rows;}
 @Get('requests') async requests(){return (await this.db.query('SELECT * FROM policy_requests ORDER BY created_at DESC LIMIT 200')).rows;}
 @Patch('requests/:id') async closeRequest(@Param('id') id:string,@Body() b:any,@Req() req:any){if(!['open','resolved'].includes(b.status))throw new BadRequestException();const r=await this.db.query('UPDATE policy_requests SET status=$2 WHERE id=$1 RETURNING *',[id,b.status]);await this.audit(req.admin.email,'policy_request_status',id,{status:b.status});return r.rows[0];}
}
