import {enforceFeature} from './feature-controls';
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { DbService } from './db.service';
import { createHash, scrypt as scryptCallback, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
const scrypt=promisify(scryptCallback);
export const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return salt+':'+(await scrypt(password,salt,64) as Buffer).toString('hex');}
export async function passwordMatches(password:string,stored:string){try{const [salt,hash]=stored.split(':');const expected=Buffer.from(hash,'hex');const actual=await scrypt(password,salt,64) as Buffer;return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}}
export function secretMatches(a:string,b:string){return !!a&&!!b&&timingSafeEqual(Buffer.from(digest(a)),Buffer.from(digest(b)));}
@Injectable()
export class AccessGuard implements CanActivate {
 constructor(private db:DbService){}
 async canActivate(context:ExecutionContext){
  const req=context.switchToHttp().getRequest();const route=req.path.replace(/^\/api/,'').replace(/\/$/,'');
  if(['/admin/auth/register','/news'].includes(route)||req.method==='GET'&&/^\/news\/\d+\/media\/(audio|video)$/.test(route))await enforceFeature(this.db,route);
  if(['/health','/justice/catalog','/admin/auth/status','/admin/auth/bootstrap','/admin/auth/login','/admin/auth/options','/admin/auth/register','/admin/auth/forgot-password','/admin/auth/reset-password','/admin/auth/verify-email','/news','/policy/requests'].includes(route))return true;
  if(req.method==='GET'&&/^\/news\/\d+\/media\/(audio|video)$/.test(route))return true;
  if(route==='/internal/ai/config'){if(!secretMatches(req.headers['x-ai-config-token']||'',process.env.AI_CONFIG_TOKEN||''))throw new UnauthorizedException();return true;}
  if(route==='/internal/news/tick'){
   if(!secretMatches(req.headers['x-worker-token']||'',process.env.NEWS_WORKER_TOKEN||''))throw new UnauthorizedException();return true;
  }
  const apiKey=req.headers['x-api-key'];
  if(apiKey!==undefined){
   if(typeof apiKey!=='string'||!/^js_[a-f0-9]{64}$/.test(apiKey))throw new UnauthorizedException('Invalid API key.');
   const row=(await this.db.query('SELECT k.id key_id,k.scopes,a.id,a.email,a.name,a.role FROM platform_api_keys k JOIN platform_accounts a ON a.id=k.account_id WHERE k.token_hash=$1 AND k.revoked_at IS NULL AND k.expires_at>now() AND a.active=true AND (a.email_verified=true OR a.admin_approved=true)',[digest(apiKey)])).rows[0];
   if(!row)throw new UnauthorizedException('API key revoked, expired or invalid.');
   const scope=/^\/pacer\/(?:info|connect|disconnect|search)$/.test(route)?'pacer':/^\/marketplace(?:\/checkout|\/orders\/[a-f0-9-]{36}\/verify)?$/.test(route)?'wallet':null;
   if(!scope||!Array.isArray(row.scopes)||!row.scopes.includes(scope))throw new ForbiddenException('API key scope does not permit this endpoint.');
   await this.db.query('UPDATE platform_api_keys SET last_used_at=now() WHERE id=$1',[row.key_id]);req.admin={id:row.id,email:row.email,name:row.name,role:row.role};await enforceFeature(this.db,route);return true;
  }
  const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('justisolve_session='));const token=cookie?.slice('justisolve_session='.length)||'';
  if(!/^[a-f0-9]{64}$/.test(token))throw new UnauthorizedException('Administrator sign-in required.');
  const r=await this.db.query('SELECT a.id,a.email,a.name,a.role FROM platform_sessions s JOIN platform_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.active=true AND (a.email_verified=true OR a.admin_approved=true)',[digest(token)]);
  if(!r.rows[0])throw new UnauthorizedException('Session expired. Sign in again.');
  if(r.rows[0].role!=='super_admin'&&!['/admin/auth/me','/admin/auth/logout','/intake','/ai/providers'].includes(route)&&!/^\/(?:marketplace(?:\/orders\/[a-f0-9-]{36}\/verify|\/checkout)?|pacer\/(?:info|connect|disconnect|search))$/.test(route)&&!/^\/intake\/\d+\/files\/\d+$/.test(route)&&!/^\/justice(?:\/|$)/.test(route))throw new ForbiddenException('Super administrator access required.');req.admin=r.rows[0];await enforceFeature(this.db,route);return true;
 }
}
