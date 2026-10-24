import {platformFeatures} from './feature-controls';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Client } from 'minio';
import { DbService } from './db.service';
@Injectable()
export class NewsService {
 constructor(private db:DbService){}
 private storage(){return new Client({endPoint:process.env.MINIO_ENDPOINT||'minio',port:Number(process.env.MINIO_PORT||9000),useSSL:process.env.MINIO_USE_SSL==='true',accessKey:process.env.MINIO_ACCESS_KEY||'',secretKey:process.env.MINIO_SECRET_KEY||''});}
 async render(id:string){
  const features=await platformFeatures(this.db);if(features.news===false||features.ai===false)throw new Error('News AI generation is disabled.');
  const post=(await this.db.query('SELECT * FROM news_posts WHERE id=$1',[id])).rows[0];if(!post?.body||!post.narration)return {status:'unavailable'};
  const claim=await this.db.query("UPDATE news_posts SET media_status='rendering',updated_at=now() WHERE id=$1 AND media_status<>'rendering' RETURNING id",[id]);if(!claim.rows.length)return {status:'busy'};
  try{const d=(await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+'/news/media',{title:post.title,narration:post.narration},{timeout:560000,maxContentLength:45000000})).data;
   const storage=this.storage(),bucket=process.env.MINIO_BUCKET_EVIDENCE||'evidence';if(!await storage.bucketExists(bucket))await storage.makeBucket(bucket);
   const audio='news/'+id+'/audio.mp3',video='news/'+id+'/video.mp4';
   for(const [key,b64,mime] of [[audio,d.audio_base64,'audio/mpeg'],[video,d.video_base64,'video/mp4']]){const buf=Buffer.from(b64,'base64');if(buf.length>15000000)throw Error('Media too large');await storage.putObject(bucket,key,buf,buf.length,{'Content-Type':mime});}
   await this.db.query("UPDATE news_posts SET audio_key=$2,video_key=$3,media_status='ready',updated_at=now() WHERE id=$1 AND title=$4 AND body=$5",[id,audio,video,post.title,post.body]);return {status:'ready'};
  }catch{await this.db.query("UPDATE news_posts SET media_status='failed',updated_at=now() WHERE id=$1",[id]);return {status:'failed'};}
 }
 async mediaStream(id:string,kind:string){
  const row=(await this.db.query("SELECT audio_key,video_key FROM news_posts WHERE id=$1 AND status='published' AND media_status='ready'",[id])).rows[0];const key=kind==='audio'?row?.audio_key:row?.video_key;if(!key)return null;return this.storage().getObject(process.env.MINIO_BUCKET_EVIDENCE||'evidence',key);
 }
 async tick(campaignId?:string){
  const features=await platformFeatures(this.db);if(features.news===false||features.ai===false)return {paused:true};
  const client=await this.db.pool.connect();let locked=false;
  try{
   locked=(await client.query('SELECT pg_try_advisory_lock(736193) locked')).rows[0].locked;if(!locked)return {status:'busy'};
   await client.query("UPDATE news_posts SET media_status='failed' WHERE media_status='rendering' AND updated_at<now()-interval '2 hours'");
   await client.query("UPDATE automation_runs SET status='failed',message='Worker interrupted or exceeded two hours',finished_at=now() WHERE status='running' AND started_at<now()-interval '2 hours'");
   const paused=(await client.query("SELECT value FROM platform_settings WHERE key='news_paused'")).rows[0]?.value;if(paused)return {status:'paused'};
   const campaigns=(await client.query('SELECT * FROM news_campaigns WHERE enabled=true AND ($1::bigint IS NULL AND next_run_at<=now() OR id=$1) ORDER BY next_run_at LIMIT 3',[campaignId||null])).rows;
   for(const campaign of campaigns){
    const run=(await client.query('INSERT INTO automation_runs(campaign_id) VALUES($1) RETURNING id',[campaign.id])).rows[0].id;let made=0;
    try{
     await client.query("UPDATE news_campaigns SET last_run_at=now(),next_run_at=now()+interval '1 minute'*interval_minutes WHERE id=$1",[campaign.id]);
     const base=process.env.AI_BASE_URL||'http://ai:8000';const discovered=(await axios.post(base+'/news/discover',{source:campaign.source,keywords:campaign.keywords},{timeout:40000})).data;
     for(const item of discovered.items){
      // Apply pause immediately between requests/items; never publish after a pause or campaign disable.
      const state=await client.query("SELECT c.enabled,(SELECT value FROM platform_settings WHERE key='news_paused') paused FROM news_campaigns c WHERE c.id=$1",[campaign.id]);if(!state.rows[0]?.enabled||state.rows[0].paused)break;
      if(made>=campaign.max_items)break;
      const claim=await client.query("INSERT INTO news_posts(campaign_id,source_url,source_title,title,provider,status) VALUES($1,$2,$3,$3,$4,'draft') ON CONFLICT(source_url) DO NOTHING RETURNING id",[campaign.id,item.url,item.title,campaign.provider]);if(!claim.rows[0])continue;made++;
      const postId=claim.rows[0].id;
      try{
       const d=(await axios.post(base+'/news/opinion',{url:item.url,provider:campaign.provider,allow_external:campaign.allow_external},{timeout:240000})).data;
       const active=(await client.query("SELECT c.enabled,c.auto_publish,(SELECT value FROM platform_settings WHERE key='news_paused') paused FROM news_campaigns c WHERE c.id=$1",[campaign.id])).rows[0];
       const publish=d.publishable===true&&active.enabled&&active.auto_publish&&!active.paused;
       await client.query("UPDATE news_posts SET title=$2,body=$3,source_excerpt=$4,status=$5,failure=$6,published_at=CASE WHEN $5='published' THEN now() ELSE NULL END,updated_at=now() WHERE id=$1",[postId,d.title,d.body,d.source_excerpt,publish?'published':'draft',d.reason||'']);
       await client.query('UPDATE news_posts SET narration=$2 WHERE id=$1',[postId,d.narration||d.body.slice(0,2500)]);
       if(campaign.generate_media){const media=await this.render(String(postId));await client.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES('news-worker','media_generated','news',$1,$2)",[String(postId),media]);}
       await client.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES('news-worker',$1,'news',$2,$3)",[publish?'auto_published':'draft_generated',String(postId),{campaign:campaign.id,source:item.url,provider:campaign.provider}]);
      }catch{await client.query("UPDATE news_posts SET status='failed',failure='Source retrieval or AI generation failed; no publication.',updated_at=now() WHERE id=$1",[postId]);}
     }
     await client.query("UPDATE automation_runs SET status='completed',items_created=$2,message='Campaign run completed; review post statuses for held/failed items.',finished_at=now() WHERE id=$1",[run,made]);
    }catch{await client.query("UPDATE automation_runs SET status='failed',message='Feed or service unavailable; inspect configuration.',finished_at=now() WHERE id=$1",[run]);}
   }return {status:'completed',campaigns:campaigns.length};
  }finally{if(locked)await client.query('SELECT pg_advisory_unlock(736193)');client.release();}
 }
}
