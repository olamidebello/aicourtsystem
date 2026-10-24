import axios from 'axios';
import {BadGatewayException,BadRequestException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {DbService} from './db.service';
import {CommerceService} from './commerce.service';
import {TenantService} from './tenant.service';
import {platformFeatures} from './feature-controls';
export const SIP_ORIGIN='https://sip.dobhrap.com';
export class PhoneService{
 constructor(private db:DbService){}
 async settings(){return (await this.db.query("SELECT value FROM platform_settings WHERE key='sip_integration'")).rows[0]?.value||{enabled:false};}
 private async request(action:string,body:any){const token=await new CommerceService(this.db).secret('sip_bridge_token')||process.env.JUSTISOLVE_SIP_BRIDGE_TOKEN||'';if(!/^[a-f0-9]{64}$/.test(token))throw new BadRequestException('SIP bridge token is not configured.');try{return (await axios.post(SIP_ORIGIN+'/api/integrations/justisolve/'+action,body,{headers:{Authorization:'Bearer '+token},timeout:25000,maxRedirects:0,maxContentLength:100000})).data;}catch(e:any){if(action==='authorize'&&e.response?.status===403)return {allowed:false,error:typeof e.response.data?.error==='string'?e.response.data.error.slice(0,300):'The phone service did not authorize this call.'};throw new BadGatewayException('SIP bridge unavailable or not authorized. Check both server configurations.');}}
 async test(){return this.request('health',{});}
 async context(account:any,orgId?:any){
  if(orgId){const o=await new TenantService(this.db).access(orgId,account);if(o.features?.phone===false)throw new ForbiddenException('Phone services disabled for this workspace.');if(o.kind!=='pro_se'&&['owner','admin','counsel','staff'].includes(o.member_role))return {context:'organization',contextId:String(o.id),accountId:String(account),org_id:o.id};}
  return {context:'personal',contextId:String(account),accountId:String(account),org_id:null};
 }
 async ensure(account:any,orgId?:any){const context=await this.context(account,orgId);const row=(await this.db.query('INSERT INTO phone_accounts(account_id,org_id,context_key) VALUES($1,$2,$3) ON CONFLICT(account_id,context_key) DO UPDATE SET next_attempt=now() RETURNING id',[account,context.org_id,context.context+':'+context.contextId])).rows[0];await this.process(row.id);return this.status(account,orgId);}
 async status(account:any,orgId?:any){const c=await this.context(account,orgId);const rows=(await this.db.query('SELECT id,status,provider_info,attempts,last_checked_at,last_error FROM phone_accounts WHERE account_id=$1 AND context_key=$2',[account,c.context+':'+c.contextId])).rows;return {origin:SIP_ORIGIN,context:c.context,enabled:(await this.settings()).enabled===true,account:rows[0]||null};}
 async process(jobId:any){
  const row=(await this.db.query("UPDATE phone_accounts SET lease_until=now()+interval '2 minutes' WHERE id=$1 AND (lease_until IS NULL OR lease_until<now()) RETURNING *",[jobId])).rows[0];if(!row)return;
  let status='configuration_required',error='',info=row.provider_info||{};
  try{
   const settings=await this.settings(),features=await platformFeatures(this.db),account=(await this.db.query('SELECT id,name,active,email_verified,admin_approved FROM platform_accounts WHERE id=$1',[row.account_id])).rows[0];
   let org:any=null,member:any=null;if(row.org_id){org=(await this.db.query('SELECT * FROM justice_orgs WHERE id=$1',[row.org_id])).rows[0];member=(await this.db.query('SELECT role,active FROM justice_org_members WHERE org_id=$1 AND account_id=$2',[row.org_id,row.account_id])).rows[0];}
   const active=settings.enabled===true&&features.phone!==false&&!!account?.active&&(account.email_verified||account.admin_approved)&&(!row.org_id||org?.active&&member?.active&&['owner','admin','counsel','staff'].includes(member.role)&&org.features?.phone!==false);
   if(settings.enabled===true||info.userId){
    const result=await this.request('provision',{context:row.org_id?'organization':'personal',contextId:String(row.org_id||row.account_id),accountId:String(row.account_id),pbxAdmin:!!member&&['owner','admin'].includes(member.role),name:account?.name||'Unavailable source account',workspaceName:org?.name||account?.name||'JustiSolve',userActive:!!active,tenantActive:row.org_id?!!org?.active:true});
    if(typeof result?.userId!=='string'||typeof result?.tenantId!=='string'||typeof result?.status!=='string')throw new BadGatewayException('Invalid SIP provisioning acknowledgement.');
    info={userId:result.userId,tenantId:result.tenantId,username:result.username,domain:result.domain,pbx:result.pbx===true,pbx_admin:!!member&&['owner','admin'].includes(member.role),extension:result.extension||null};status=active?result.status:'pending_source_approval';
   }
  }catch{status='retry_pending';error='Provisioning not acknowledged. Configuration or provider service needs review.';}
  await this.db.query("UPDATE phone_accounts SET status=$2,provider_info=$3,attempts=attempts+1,last_error=$4,last_checked_at=now(),next_attempt=now()+interval '1 minute',lease_until=NULL WHERE id=$1",[jobId,status,info,error]);
 }
 async refreshDue(limit=100){const rows=(await this.db.query('SELECT id FROM phone_accounts WHERE next_attempt<=now() AND (lease_until IS NULL OR lease_until<now()) ORDER BY next_attempt LIMIT $1',[Math.min(100,Math.max(1,limit))])).rows;for(let i=0;i<rows.length;i+=5)await Promise.all(rows.slice(i,i+5).map(row=>this.process(row.id)));return {processed:rows.length};}
 async session(account:any,orgId?:any){if(!(await this.settings()).enabled)throw new ForbiddenException('Phone integration is paused.');const c=await this.context(account,orgId);await this.ensure(account,orgId);return this.request('session',c);}
 async authorize(account:any,orgId:any,target:any){if(!(await this.settings()).enabled)throw new ForbiddenException('Phone integration is paused.');if(typeof target!=='string'||target.length>320)throw new BadRequestException('Invalid call target.');const c=await this.context(account,orgId);await this.ensure(account,orgId);return this.request('authorize',{...c,target});}
 async portal(account:any,orgId:any){if(!(await this.settings()).enabled)throw new ForbiddenException('Phone integration is paused.');const c=await this.context(account,orgId);await this.ensure(account,orgId);const result=await this.request('portal',c);let url:URL;try{url=new URL(result.url);if(url.origin!==SIP_ORIGIN||url.pathname!=='/justisolve-connect.html'||!/^#ticket=[a-f0-9]{64}$/.test(url.hash))throw Error();}catch{throw new BadGatewayException('Invalid phone portal handoff.');}return {url:url.href};}
 async pbx(account:any,orgId:any,b:any){
  if(orgId)await new TenantService(this.db).access(orgId,account,true);if(!(await this.settings()).enabled)throw new ForbiddenException('Phone integration is paused.');const c=await this.context(account,orgId);if(c.context!=='organization')throw new ForbiddenException('An organizational PBX is required.');if(!['overview','extensions','queues','create_extension','create_queue'].includes(b.action))throw new BadRequestException('Select a supported PBX action.');await this.ensure(account,orgId);return this.request('pbx',{...c,action:b.action,payload:b.payload||{}});}
}
