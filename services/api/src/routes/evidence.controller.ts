import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Client } from 'minio';
import * as crypto from 'crypto';
import { DbService } from '../db.service';

@Controller('evidence')
export class EvidenceController {
  constructor(private db:DbService){}
  private client(){ return new Client({endPoint:process.env.MINIO_ENDPOINT||'minio',port:Number(process.env.MINIO_PORT||9000),useSSL:false,accessKey:process.env.MINIO_ACCESS_KEY||'minioadmin',secretKey:process.env.MINIO_SECRET_KEY||'minioadmin'}); }
  @Get() async list(@Query('case_id') id?:string){ return (await this.db.query('select * from evidence_items where ($1::bigint is null or case_id=$1) order by created_at desc',[id||null])).rows; }
  @Post('upload') async upload(@Body() body:any){
    const minio=this.client(), bucket=process.env.MINIO_BUCKET_EVIDENCE||'evidence';
    const buf=Buffer.from(body.content_base64||'','base64');
    const hash=crypto.createHash('sha256').update(buf).digest('hex');
    if(body.sha256 && hash!==body.sha256) return {ok:false,error:'sha256 mismatch',computed_sha256:hash};
    if(!(await minio.bucketExists(bucket))) await minio.makeBucket(bucket);
    const key=body.object_key||`${body.case_id||'unassigned'}/${Date.now()}-${String(body.filename||'evidence').replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    await minio.putObject(bucket,key,buf,buf.length,{'Content-Type':body.mime_type||'application/octet-stream'});
    const r=await this.db.query('insert into evidence_items(case_id,object_key,filename,sha256,mime_type,size_bytes,category,provenance) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[body.case_id||null,key,body.filename||'evidence',hash,body.mime_type||'',buf.length,body.category||'general',body.provenance||{}]);
    return {ok:true,evidence:r.rows[0]};
  }
}
