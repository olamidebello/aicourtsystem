import {platformFeatures} from './feature-controls';
import { Injectable } from '@nestjs/common';
import { DbService } from './db.service';
import axios from 'axios';
import { digest } from './auth';
@Injectable()
export class CourtAutomationService {
 constructor(private db:DbService){}
 async tick(){
  const features=await platformFeatures(this.db);if(features.automation===false||features.ai===false||features.cases===false)return {paused:true};
  const c=await this.db.pool.connect();let locked=false;
  try{
   locked=(await c.query('SELECT pg_try_advisory_lock(736195) locked')).rows[0].locked;if(!locked)return {status:'busy'};
   // Only recorded deadlines are used: no inferred jurisdictional date calculations.
   await c.query("INSERT INTO alerts(tenant_id,severity,title,message,entity_type,entity_id) SELECT ca.tenant_id,'warning','Recorded court deadline approaching',d.title||' — recorded due date: '||d.due_at::text,'deadline',d.deadline_id::text FROM deadlines d JOIN cases ca ON ca.case_id=d.case_id WHERE d.due_at<=now()+interval '7 days' AND d.status='open' AND NOT EXISTS(SELECT 1 FROM alerts a WHERE a.entity_type='deadline' AND a.entity_id=d.deadline_id::text)");
   const jobs=(await c.query('SELECT * FROM court_automations WHERE enabled=true AND next_run_at<=now() ORDER BY next_run_at LIMIT 2')).rows;
   for(const job of jobs){
    await c.query("UPDATE court_automations SET next_run_at=now()+interval '1 minute'*interval_minutes WHERE id=$1",[job.id]);
    const input={request:job.request,source:job.source,court:job.court,case_number:job.case_number,parties:job.parties,court_rules:job.court_rules,providers:job.providers,synthesis_provider:job.synthesis_provider,allow_external:job.allow_external,target_score:job.target_score};const hash=digest(JSON.stringify(input));
    if(hash===job.last_input_hash)continue;
    try{
     const result=(await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/ensemble',input,{timeout:930000})).data;
     if(!result.final_draft)throw Error('No final draft');
     await c.query('BEGIN');
     const draft=(await c.query("INSERT INTO drafts(case_id,title,filing_type,body_markdown,status) VALUES($1,$2,'motion',$3,'draft') RETURNING draft_id",[job.case_id,job.name,result.final_draft])).rows[0].draft_id;
     await c.query("INSERT INTO court_automation_runs(automation_id,status,result,draft_id) VALUES($1,'draft_created',$2,$3)",[job.id,result,draft]);
     await c.query('UPDATE court_automations SET last_input_hash=$2 WHERE id=$1',[job.id,hash]);
     await c.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES('court-worker','draft_prepared','court_automation',$1,$2)",[String(job.id),{draft_id:draft,target_met:result.target_met}]);await c.query('COMMIT');
    }catch{await c.query('ROLLBACK');await c.query("INSERT INTO court_automation_runs(automation_id,status,result) VALUES($1,'failed',$2)",[job.id,{message:'Draft generation failed or no final draft produced. Check model configuration and source limits.'}]);}
   }return {status:'completed',jobs:jobs.length};
  }finally{if(locked)await c.query('SELECT pg_advisory_unlock(736195)');c.release();}
 }
}
