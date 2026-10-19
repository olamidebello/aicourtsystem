import { Body, Controller, Get, Headers, Header, Post, BadRequestException, UnauthorizedException, BadGatewayException } from '@nestjs/common';
import axios from 'axios';
import { randomBytes } from 'crypto';

type Session={token:string;expires:number;qa:boolean;clientCode:string};
@Controller('pacer')
export class PacerController {
 private sessions=new Map<string,Session>();
 private async request(url:string,body:any,headers:any={}){
  try{return await axios.post(url,body,{headers:{Accept:'application/json','Content-Type':'application/json',...headers},timeout:30000,maxRedirects:0,maxContentLength:5*1024*1024});}
  catch(e:any){if(e.response?.status===401)throw new UnauthorizedException('PACER session expired. Sign in again.');throw new BadGatewayException('PACER request failed. Check your credentials, MFA code, account access, and search criteria. A timed-out search may still be billed; check PACER before retrying.');}
 }
 private session(auth:string){const id=auth?.replace(/^Bearer /,'');const s=this.sessions.get(id);if(!s||s.expires<Date.now()){this.sessions.delete(id);throw new UnauthorizedException('Connect to PACER again.');}return s;}
 @Get('info') info(){return {enabled:true,scope:'Case Locator case details; docket reports and PDFs open at the court.',productionSearchesBillable:true};}
 @Post('connect') @Header('Cache-Control','no-store') async connect(@Body() b:any){
  if(typeof b.loginId!=='string'||!b.loginId.trim()||typeof b.password!=='string'||!b.password||b.loginId.length>200||b.password.length>500)throw new BadRequestException('PACER username and password required.');
  for(const [id,s] of this.sessions)if(s.expires<Date.now())this.sessions.delete(id);
  if(this.sessions.size>=1000)throw new BadGatewayException('Connection limit reached. Try later.');
  const qa=b.environment==='qa';const clientCode=String(b.clientCode||'').slice(0,128);
  const r=await this.request(`https://${qa?'qa-login':'pacer.login'}.uscourts.gov/services/cso-auth`,{loginId:b.loginId,password:b.password,otpCode:String(b.otpCode||'').slice(0,20),clientCode,redactFlag:'1'});
  if(String(r.data.loginResult)!=='0'||!r.data.nextGenCSO)throw new UnauthorizedException('PACER sign-in failed. Check username, password, MFA and required client code.');
  const id=randomBytes(32).toString('hex');this.sessions.set(id,{token:r.data.nextGenCSO,expires:Date.now()+20*60*1000,qa,clientCode});
  setTimeout(()=>this.sessions.delete(id),20*60*1000).unref();
  return {session:id,expiresIn:1200,environment:qa?'qa':'production'};
 }
 @Post('disconnect') @Header('Cache-Control','no-store') async disconnect(@Headers('authorization') auth:string){
  const id=auth?.replace(/^Bearer /,'');const s=this.sessions.get(id);this.sessions.delete(id);
  if(s){try{await this.request(`https://${s.qa?'qa-login':'pacer.login'}.uscourts.gov/services/cso-logout`,{nextGenCSO:s.token});}catch{return {disconnected:true,remoteLogoutConfirmed:false};}}
  return {disconnected:true,remoteLogoutConfirmed:true};
 }
 @Post('search') @Header('Cache-Control','no-store') async search(@Headers('authorization') auth:string,@Body() b:any){
  const s=this.session(auth);
  if(!s.qa&&b.acceptCharges!==true)throw new BadRequestException('Confirm PACER charges before each search page.');
  const criteria:any={};
  for(const k of ['caseNumberFull','caseTitle'])if(typeof b[k]==='string'&&b[k].trim())criteria[k]=b[k].trim().slice(0,200);
  if(!Object.keys(criteria).length)throw new BadRequestException('Enter case number or case title.');
  if(b.courtId){if(!/^[a-z0-9]{2,12}$/.test(b.courtId))throw new BadRequestException('Invalid court ID.');criteria.courtId=[b.courtId];}
  const page=Number(b.page||0);if(!Number.isInteger(page)||page<0||page>99)throw new BadRequestException('Invalid result page.');
  const r=await this.request(`https://${s.qa?'qa-pcl':'pcl'}.uscourts.gov/pcl-public-api/rest/cases/find?page=${page}`,criteria,{'X-NEXT-GEN-CSO':s.token,...(s.clientCode?{'X-CLIENT-CODE':s.clientCode}:{})});
  if(r.headers['x-next-gen-cso'])s.token=r.headers['x-next-gen-cso'];
  const rows=Array.isArray(r.data.content)?r.data.content:[];
  return {content:rows.map((row:any)=>{const c=row.courtCase||row;let caseLink='';try{const u=new URL(c.caseLink);if(u.protocol==='https:'&&u.hostname.endsWith('.uscourts.gov')&&!u.username&&!u.password)caseLink=u.href;}catch{}return {courtId:c.courtId,caseId:c.caseId,caseNumberFull:c.caseNumberFull,caseTitle:c.caseTitle,dateFiled:c.dateFiled,effectiveDateClosed:c.effectiveDateClosed,jurisdictionType:c.jurisdictionType,caseLink};}),receipt:r.data.receipt,pageInfo:r.data.pageInfo,environment:s.qa?'qa':'production'};
 }
}
