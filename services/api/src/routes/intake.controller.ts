import { Body,Controller,Get,Post,Req,Res,Param,UploadedFiles,UseInterceptors,BadRequestException,NotFoundException } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Client } from 'minio';
import axios from 'axios';
import { DbService } from '../db.service';
@Controller('intake')
export class IntakeController {
 constructor(private db:DbService){}
 private storage(){return new Client({endPoint:process.env.MINIO_ENDPOINT||'minio',port:Number(process.env.MINIO_PORT||9000),useSSL:process.env.MINIO_USE_SSL==='true',accessKey:process.env.MINIO_ACCESS_KEY||'',secretKey:process.env.MINIO_SECRET_KEY||''});}
 @Get() async list(@Req() req:any){return (await this.db.query('SELECT * FROM case_intakes WHERE account_id=$1 ORDER BY created_at DESC LIMIT 50',[req.admin.id])).rows;}
 @Get(':id/files/:index') async download(@Param('id') id:string,@Param('index') index:string,@Req() req:any,@Res() res:any){
  if(!/^\d+$/.test(id)||!/^\d+$/.test(index))throw new NotFoundException();const row=(await this.db.query('SELECT files FROM case_intakes WHERE id=$1 AND account_id=$2',[id,req.admin.id])).rows[0];const file=row?.files?.[Number(index)];if(!file)throw new NotFoundException();const stream=await this.storage().getObject(process.env.MINIO_BUCKET_EVIDENCE||'evidence',file.key);res.setHeader('Content-Type','application/octet-stream');res.setHeader('Content-Disposition','attachment; filename="'+file.filename.replace(/[^a-zA-Z0-9._-]/g,'_')+'"');stream.on('error',()=>res.destroy());stream.pipe(res);
 }
 @Post() @UseInterceptors(FilesInterceptor('files',5,{limits:{fileSize:10000000,fields:5,fieldSize:15000}}))
 async submit(@Body() b:any,@UploadedFiles() files:any[],@Req() req:any){
  files=files||[];if(typeof b.narrative!=='string'||b.narrative.trim().length<20||b.narrative.length>12000||typeof b.provider!=='string'||b.provider.length>220||(b.jurisdiction||'').length>300||files.reduce((n,f)=>n+f.size,0)>20000000||files.some(f=>!/^.+\.(pdf|docx|txt)$/i.test(f.originalname)))throw new BadRequestException('Narrative of 20–12000 characters and up to five PDF/DOCX/TXT files (10 MB each, 20 MB total) required.');
  const allow=b.allow_external==='true';if(['openai','claude'].includes(b.provider.split(':')[0])&&!allow)throw new BadRequestException('Authorize external processing.');
  const id=(await this.db.query('INSERT INTO case_intakes(account_id,narrative,jurisdiction,provider) VALUES($1,$2,$3,$4) RETURNING id',[req.admin.id,b.narrative,b.jurisdiction||'',b.provider])).rows[0].id;const stored=[];
  try{
   const storage=this.storage(),bucket=process.env.MINIO_BUCKET_EVIDENCE||'evidence';if(files.length&&!await storage.bucketExists(bucket))await storage.makeBucket(bucket);
   for(const [i,f] of files.entries()){const filename=f.originalname.slice(0,200),key=`intake/${req.admin.id}/${id}/${i}`;await storage.putObject(bucket,key,f.buffer,f.size,{'Content-Type':'application/octet-stream'});stored.push({filename,key,size:f.size});}
   await this.db.query('UPDATE case_intakes SET files=$2 WHERE id=$1',[id,JSON.stringify(stored)]);
   const result=(await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/intake/analyze',{narrative:b.narrative,jurisdiction:b.jurisdiction||'',provider:b.provider,allow_external:allow,documents:files.map(f=>({filename:f.originalname.slice(0,200),content_base64:f.buffer.toString('base64')}))},{timeout:360000,maxBodyLength:30000000})).data;
   await this.db.query("UPDATE case_intakes SET status='complete',result=$2 WHERE id=$1",[id,result]);return {id,status:'complete',result};
  }catch{await this.db.query("UPDATE case_intakes SET status='failed',files=$2,result=$3 WHERE id=$1",[id,JSON.stringify(stored),{message:'Analysis did not complete. Check provider availability and readable file types before submitting again; provider charges may already have occurred.'}]);return {id,status:'failed',result:{message:'Analysis did not complete; review submission history.'}};}
 }
}
