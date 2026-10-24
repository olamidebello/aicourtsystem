import {platformFeatures} from './feature-controls';
import axios from 'axios';
import {randomBytes} from 'crypto';
import {BadRequestException,ConflictException,ForbiddenException,NotFoundException} from '@nestjs/common';
import {DbService} from './db.service';
import {licenseProfession} from './license-policy';
export const NY_SOURCE='https://data.ny.gov/Transparency/NYS-Attorney-Registrations/eqw2-r5nb';
const normalize=(v:string)=>v.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
export function validateLicense(b:any){
 if(!b||b.consent!==true)throw new BadRequestException('Consent to registry lookup is required.');
 const claim:any={consent:true};for(const k of ['country','region','profession','first_name','last_name','number']){if(typeof b[k]!=='string'||!b[k].trim()||b[k].length>(k==='number'?80:100))throw new BadRequestException('Provide country, region, profession, legal first/last name and license number.');claim[k]=b[k].trim();}
 claim.country=claim.country.toUpperCase();claim.region=claim.region.toUpperCase();
 if(!['attorney','physician','mental_health','other'].includes(claim.profession))throw new BadRequestException('Invalid profession.');
 if(claim.country==='US'&&claim.region==='NY'&&claim.profession==='attorney'&&!/^\d{7}$/.test(claim.number))throw new BadRequestException('New York attorney registration numbers contain seven digits.');return claim;
}
export class LicenseVerificationService{
 constructor(private db:DbService){}
 async submit(account:any,role:string,b:any){
  const claim=validateLicense(b);const expected=licenseProfession(role);if(expected&&expected!==claim.profession)throw new BadRequestException('License profession does not match the requested role.');
  const token=randomBytes(16).toString('hex');
  const r=await this.db.query("UPDATE justice_roles SET license_claim=$3,license_version=$4,license_result='{}',license_checked_at=NULL,license_check_lease=NULL,license_next_check=now(),license_valid_until=NULL,license_manual_until=NULL,license_manual_source='',status=CASE WHEN status='approved' THEN 'pending' ELSE status END WHERE account_id=$1 AND role_id=$2 RETURNING account_id",[account,role,claim,token]);if(!r.rows.length)throw new NotFoundException('Request the role first.');
  return this.check(account,role,true);
 }
 async check(account:any,role:string,force=false){
  if((await platformFeatures(this.db)).license_checks===false)throw new ForbiddenException('Automatic license checks are disabled by the platform administrator.');
  // Claim a short database lease before outbound calls; only one checker wins.
  const r=await this.db.query("UPDATE justice_roles SET license_check_lease=now()+interval '2 minutes' WHERE account_id=$1 AND role_id=$2 AND license_claim<>'{}'::jsonb AND (license_check_lease IS NULL OR license_check_lease<now()) AND ($3=false OR license_checked_at IS NULL OR license_checked_at<now()-interval '2 minutes') RETURNING *",[account,role,force]);
  if(!r.rows.length)throw new ConflictException('No license submitted, a check is running, or a check was made recently.');const row=r.rows[0],c=row.license_claim;
  let result:any={status:'manual_required',message:'No automatic individual-license adapter for this profession and jurisdiction. Verify with the issuing authority.',source_url:'',registry_status:'',name_match:false};
  if(c.country==='US'&&c.region==='NY'&&c.profession==='attorney'){
   result.source_url=NY_SOURCE;
   try{
    const meta=(await axios.get('https://data.ny.gov/api/views/eqw2-r5nb.json',{timeout:10000,maxRedirects:0,maxContentLength:1000000})).data;
    const updated=Number(meta?.rowsUpdatedAt)*1000;
    if(!Number.isFinite(updated)||updated>Date.now()+3600000||Date.now()-updated>7*86400000)throw Error('Source freshness unavailable');
    const response=await axios.get('https://data.ny.gov/resource/eqw2-r5nb.json',{params:{registration_number:c.number,$select:'registration_number,first_name,last_name,status',$limit:2},timeout:10000,maxRedirects:0,maxContentLength:100000});
    if(!Array.isArray(response.data)||response.data.length>1)throw Error('Malformed registry response');
    result.source_updated_at=new Date(updated).toISOString();
    if(response.data.length===0)result={...result,status:'not_found',message:'No registry entry matched this number. Manual review required.'};
    else{
     const item=response.data[0];if(String(item.registration_number)!==c.number||typeof item.first_name!=='string'||typeof item.last_name!=='string'||typeof item.status!=='string')throw Error('Incomplete registry response');
     const match=normalize(item.first_name)===normalize(c.first_name)&&normalize(item.last_name)===normalize(c.last_name);
     const status=item.status.trim();result={...result,name_match:match,registry_status:status.slice(0,200),registered_name:item.first_name+' '+item.last_name};
     if(!match)result={...result,status:'mismatch',message:'Registry name differs from the submitted legal name. Manual identity review required.'};
     else if(status==='Currently registered')result={...result,status:'registry_current',message:'Exact number and legal-name match; registry reports Currently registered. Not identity verification, a certificate of good standing, or court admission.'};
     else result={...result,status:'adverse',message:'Registry does not report Currently registered. Review the exact status with the issuing authority; no automatic approval.'};
    }
   }catch{result={...result,status:'unavailable',message:'Registry unavailable, stale, rate-limited or returned an unsupported response. No positive verification made.'};}
  }
  const db=await this.db.pool.connect();try{await db.query('BEGIN');
   const changed=await db.query("UPDATE justice_roles SET license_result=$4,license_checked_at=now(),license_check_lease=NULL,license_next_check=CASE WHEN $5='manual_required' THEN NULL ELSE now()+interval '1 day' END,license_valid_until=CASE WHEN $5='registry_current' AND license_manual_until>now() THEN least(license_manual_until,now()+interval '2 days') WHEN $5='unavailable' THEN license_valid_until ELSE NULL END,status=CASE WHEN $5 IN ('adverse','mismatch','not_found') AND status='approved' THEN 'pending' ELSE status END WHERE account_id=$1 AND role_id=$2 AND license_version=$3 RETURNING account_id",[account,role,row.license_version,result,result.status]);
   if(!changed.rows.length)throw new ConflictException('License claim changed; stale verification discarded.');
   await db.query('INSERT INTO justice_license_checks(account_id,role_id,result) VALUES($1,$2,$3)',[account,role,result]);
   await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES('license-verifier','license_check','account',$1,$2)",[String(account),{role,status:result.status,source:result.source_url}]);await db.query('COMMIT');return result;
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async attest(account:any,role:string,b:any,actor:any){
  if(actor.role!=='super_admin')throw new ForbiddenException();
  if(b.identity_confirmed!==true||b.authority_confirmed!==true||typeof b.note!=='string'||b.note.trim().length<10||b.note.length>2000)throw new BadRequestException('Confirm identity and current professional authority and provide a detailed review note.');
  let source:URL;try{source=new URL(b.source_url);if(source.protocol!=='https:'||source.username||source.password)throw Error();}catch{throw new BadRequestException('Provide an HTTPS issuing-authority evidence URL.');}
  const expiry=Date.parse(b.valid_until);if(!Number.isFinite(expiry)||expiry<=Date.now()||expiry>Date.now()+31*86400000)throw new BadRequestException('Manual review expiry must be within the next 31 days.');
  const db=await this.db.pool.connect();try{await db.query('BEGIN');const row=(await db.query('SELECT * FROM justice_roles WHERE account_id=$1 AND role_id=$2 FOR UPDATE',[account,role])).rows[0];if(!row||!row.license_claim?.number)throw new BadRequestException('A license claim is required before attestation.');
   // Do not let manual attestation erase a registry warning. Correct the claim or recheck first.
   if(['adverse','mismatch','not_found'].includes(row.license_result?.status))throw new BadRequestException('Resolve the registry warning before approval.');
   const automatic=row.license_result?.status==='registry_current'&&new Date(row.license_checked_at).getTime()>Date.now()-2*86400000;
   const result=automatic?row.license_result:{status:'manually_verified',message:'Issuing-authority evidence and identity checked by administrator.',source_url:source.href};
   await db.query('UPDATE justice_roles SET license_result=$3,license_manual_until=$4,license_valid_until=$5,license_manual_source=$6,license_review_note=$7 WHERE account_id=$1 AND role_id=$2',[account,role,result,new Date(expiry),new Date(automatic?Math.min(expiry,Date.now()+2*86400000):expiry),source.href,b.note.trim()]);
   await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'license_attested','account',$2,$3)",[actor.email,String(account),{role,source:source.href,note:b.note.trim(),valid_until:new Date(expiry).toISOString(),method:automatic?'registry_plus_human':'manual'}]);await db.query('COMMIT');return {saved:true};
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
 }
 async requireValid(account:any,role:string,db:any=this.db){if(licenseProfession(role)&&!(await db.query('SELECT 1 FROM justice_roles WHERE account_id=$1 AND role_id=$2 AND license_valid_until>now()',[account,role])).rows.length)throw new ForbiddenException('Current professional credential verification and identity review required.');}
 async refreshDue(limit=30){
  if((await platformFeatures(this.db)).license_checks===false)return {checked:0,disabled:true};
  const due=(await this.db.query("SELECT account_id,role_id FROM justice_roles WHERE license_next_check<=now() AND license_claim<>'{}'::jsonb AND (license_check_lease IS NULL OR license_check_lease<now()) ORDER BY license_next_check LIMIT $1",[Math.max(1,Math.min(limit,100))])).rows;let checked=0;
  for(const r of due)try{await this.check(r.account_id,r.role_id);checked++;}catch{/* Retried by next timer run; never log credentials. */}return {checked};
 }
}
