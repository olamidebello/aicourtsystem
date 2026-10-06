import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DbService } from '../db.service';

@Controller()
export class PlatformController {
  constructor(private db:DbService){}

  @Get('dashboard')
  async dashboard(){
    const q=async(sql:string)=>Number((await this.db.query(sql)).rows[0].n);
    return {cases:await q('select count(*) n from cases'),documents:await q('select count(*) n from documents'),evidence:await q('select count(*) n from evidence_items'),tasks:await q("select count(*) n from tasks where status <> 'done'"),deadlines:await q("select count(*) n from deadlines where due_at >= now()"),alerts:await q("select count(*) n from alerts where read_at is null")};
  }

  @Get('cases') async cases(@Query('q') q=''){
    const r=await this.db.query('select * from cases where $1 = \'\' or case_number ilike $2 or title ilike $2 order by updated_at desc limit 200',[q,'%'+q+'%']); return r.rows;
  }
  @Post('cases') async createCase(@Body() b:any){
    const r=await this.db.query('insert into cases(case_number,court_name,court_level,title,status,stage,tenant_id,metadata) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[b.case_number,b.court_name||'',b.court_level||'federal',b.title,b.status||'open',b.stage||'',b.tenant_id||1,b.metadata||{}]); return r.rows[0];
  }
  @Get('cases/:id') async case(@Param('id') id:string){ return (await this.db.query('select * from cases where case_id=$1',[id])).rows[0]||{}; }
  @Patch('cases/:id') async updateCase(@Param('id') id:string,@Body() b:any){
    const r=await this.db.query('update cases set title=coalesce($2,title),status=coalesce($3,status),stage=coalesce($4,stage),updated_at=now() where case_id=$1 returning *',[id,b.title,b.status,b.stage]); return r.rows[0];
  }

  @Get('dockets') async dockets(@Query('case_id') id?:string){ const r=await this.db.query('select * from docket_entries where ($1::bigint is null or case_id=$1) order by filed_at desc nulls last,docket_id desc',[id||null]); return r.rows; }
  @Post('dockets') async docket(@Body() b:any){ const r=await this.db.query('insert into docket_entries(case_id,docket_number,title,entry_type,filed_at,status,notes) values($1,$2,$3,$4,$5,$6,$7) returning *',[b.case_id,b.docket_number,b.title,b.entry_type||'filing',b.filed_at||null,b.status||'filed',b.notes||'']); return r.rows[0]; }

  @Get('documents') async documents(@Query('case_id') id?:string){ return (await this.db.query('select * from documents where ($1::bigint is null or case_id=$1) order by created_at desc',[id||null])).rows; }
  @Post('documents') async document(@Body() b:any){ const r=await this.db.query('insert into documents(case_id,title,document_type,object_key,sha256,mime_type,size_bytes,metadata) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[b.case_id||null,b.title,b.document_type||'document',b.object_key||'',b.sha256||'',b.mime_type||'',b.size_bytes||0,b.metadata||{}]); return r.rows[0]; }

  @Get('tasks') async tasks(@Query('case_id') id?:string){ return (await this.db.query('select * from tasks where ($1::bigint is null or case_id=$1) order by due_at nulls last,created_at desc',[id||null])).rows; }
  @Post('tasks') async task(@Body() b:any){ const r=await this.db.query('insert into tasks(case_id,title,description,status,priority,due_at,assignee) values($1,$2,$3,$4,$5,$6,$7) returning *',[b.case_id||null,b.title,b.description||'',b.status||'open',b.priority||'normal',b.due_at||null,b.assignee||'']); return r.rows[0]; }
  @Patch('tasks/:id') async taskPatch(@Param('id') id:string,@Body() b:any){ return (await this.db.query('update tasks set status=coalesce($2,status),priority=coalesce($3,priority),updated_at=now() where task_id=$1 returning *',[id,b.status,b.priority])).rows[0]; }

  @Get('deadlines') async deadlines(@Query('case_id') id?:string){ return (await this.db.query('select * from deadlines where ($1::bigint is null or case_id=$1) order by due_at',[id||null])).rows; }
  @Post('deadlines') async deadline(@Body() b:any){ return (await this.db.query('insert into deadlines(case_id,title,due_at,deadline_type,status,notes) values($1,$2,$3,$4,$5,$6) returning *',[b.case_id||null,b.title,b.due_at,b.deadline_type||'filing',b.status||'open',b.notes||''])).rows[0]; }

  @Get('research') async research(@Query('case_id') id?:string){ return (await this.db.query('select * from research_items where ($1::bigint is null or case_id=$1) order by created_at desc',[id||null])).rows; }
  @Post('research') async addResearch(@Body() b:any){ return (await this.db.query('insert into research_items(case_id,citation,title,court,authority_type,treatment,notes,url) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[b.case_id||null,b.citation||'',b.title,b.court||'',b.authority_type||'case',b.treatment||'background',b.notes||'',b.url||''])).rows[0]; }

  @Get('transcripts') async transcripts(@Query('case_id') id?:string){ return (await this.db.query('select * from transcripts where ($1::bigint is null or case_id=$1) order by hearing_date desc nulls last',[id||null])).rows; }
  @Post('transcripts') async transcript(@Body() b:any){ return (await this.db.query('insert into transcripts(case_id,title,hearing_date,transcript_type,object_key,missing_segments,notes) values($1,$2,$3,$4,$5,$6,$7) returning *',[b.case_id,b.title,b.hearing_date||null,b.transcript_type||'hearing',b.object_key||'',b.missing_segments||[],b.notes||''])).rows[0]; }

  @Get('alerts') async alerts(){ return (await this.db.query('select * from alerts order by created_at desc limit 100')).rows; }
  @Post('alerts') async alert(@Body() b:any){ return (await this.db.query('insert into alerts(tenant_id,severity,title,message,entity_type,entity_id) values($1,$2,$3,$4,$5,$6) returning *',[b.tenant_id||1,b.severity||'info',b.title,b.message||'',b.entity_type||'',b.entity_id||''])).rows[0]; }

  @Get('audit') async audit(){ return (await this.db.query('select * from audit_log order by created_at desc limit 250')).rows; }
  @Get('search') async search(@Query('q') q=''){ const p='%'+q+'%'; const [c,d,r]=await Promise.all([this.db.query('select case_id id,\'case\' type,title,case_number ref from cases where title ilike $1 or case_number ilike $1 limit 25',[p]),this.db.query('select document_id id,\'document\' type,title,document_type ref from documents where title ilike $1 limit 25',[p]),this.db.query('select research_id id,\'research\' type,title,citation ref from research_items where title ilike $1 or citation ilike $1 limit 25',[p])]); return [...c.rows,...d.rows,...r.rows]; }
}
