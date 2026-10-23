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
  if(['/health','/admin/auth/status','/admin/auth/bootstrap','/admin/auth/login','/admin/auth/options','/admin/auth/register','/admin/auth/forgot-password','/admin/auth/reset-password','/admin/auth/verify-email','/news','/policy/requests'].includes(route))return true;
  if(req.method==='GET'&&/^\/news\/\d+\/media\/(audio|video)$/.test(route))return true;
  if(route==='/internal/news/tick'){
   if(!secretMatches(req.headers['x-worker-token']||'',process.env.NEWS_WORKER_TOKEN||''))throw new UnauthorizedException();return true;
  }
  const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('justisolve_session='));const token=cookie?.slice('justisolve_session='.length)||'';
  if(!/^[a-f0-9]{64}$/.test(token))throw new UnauthorizedException('Administrator sign-in required.');
  const r=await this.db.query('SELECT a.id,a.email,a.name,a.role FROM platform_sessions s JOIN platform_accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.active=true AND a.email_verified=true',[digest(token)]);
  if(!r.rows[0])throw new UnauthorizedException('Session expired. Sign in again.');
  if(r.rows[0].role!=='super_admin'&&!['/admin/auth/me','/admin/auth/logout','/intake','/ai/providers'].includes(route)&&!/^\/(?:marketplace(?:\/orders\/[a-f0-9-]{36}\/verify|\/checkout)?|pacer\/(?:info|connect|disconnect|search))$/.test(route)&&!/^\/intake\/\d+\/files\/\d+$/.test(route))throw new ForbiddenException('Super administrator access required.');req.admin=r.rows[0];return true;
 }
}
