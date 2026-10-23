import {Controller,Get,Put,Post,Delete,Body,Req,Param,BadRequestException,BadGatewayException,ServiceUnavailableException} from '@nestjs/common';
import axios from 'axios';
import {CommerceService} from '../commerce.service';
const ids=['openai','claude','ollama'];
@Controller()
export class AiProvisioningController {
 constructor(private c:CommerceService){}
 private provider(id:string){if(!ids.includes(id))throw new BadRequestException('Unsupported AI provider.');}
 private ready(){if(!process.env.AI_CONFIG_TOKEN)throw new ServiceUnavailableException('Run the latest deployment to enable AI provisioning.');}
 private async audit(actor:any,action:string,id:string){await this.c.audit(actor,action,'ai:'+id);}
 private async proxy(path:string,body?:any){this.ready();try{const options={headers:{'X-AI-Config-Token':process.env.AI_CONFIG_TOKEN},timeout:body?900000:20000,maxRedirects:0};return (body?await axios.post((process.env.AI_BASE_URL||'http://ai:8000')+path,body,options):await axios.get((process.env.AI_BASE_URL||'http://ai:8000')+path,options)).data;}catch{throw new BadGatewayException('AI provider check failed. Check the key, model, provider access and network. No generation was requested.');}}
 @Get('internal/ai/config') async internal(){const out:any={};for(const id of ids){const r=(await this.c.db.query('SELECT value FROM platform_settings WHERE key=$1',['ai_provider:'+id])).rows[0];if(r)out[id]={...r.value,api_key:id==='ollama'?'':await this.c.secret('ai_'+id)};}return out;}
 @Get('admin/ai-provisioning') async overview(){const configured:any[]=[];for(const id of ids){const r=(await this.c.db.query('SELECT value,updated_at FROM platform_settings WHERE key=$1',['ai_provider:'+id])).rows[0];const hasKey=!!(await this.c.db.query('SELECT name FROM commerce_secrets WHERE name=$1',['ai_'+id])).rows.length;configured.push({id,config:r?.value||null,updated_at:r?.updated_at||null,key_saved:hasKey});}let runtime:any=[];try{runtime=(await axios.get((process.env.AI_BASE_URL||'http://ai:8000')+'/providers',{timeout:10000})).data;}catch{}return {provisioning_ready:!!process.env.AI_CONFIG_TOKEN,providers:configured,runtime};}
 @Put('admin/ai-provisioning/:id') async save(@Param('id') id:string,@Body() b:any,@Req() req:any){
  this.provider(id);this.ready();if(typeof b.enabled!=='boolean'||typeof b.use_server_key!=='boolean')throw new BadRequestException('Enabled and server-key choices required.');
  const valid=(m:any)=>typeof m==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(m);
  const config:any={enabled:b.enabled,use_server_key:b.use_server_key};
  if(id==='ollama'){if(!Array.isArray(b.models)||b.models.length<1||b.models.length>4||b.models.some(m=>!valid(m)))throw new BadRequestException('Specify 1–4 local model names.');config.models=[...new Set(b.models)];}
  else{if(!valid(b.model)&&!(b.model===''&&!b.enabled))throw new BadRequestException('Select or enter a model ID.');config.model=b.model;if(b.api_key!==undefined&&(typeof b.api_key!=='string'||b.api_key.length>2000||/[\r\n]/.test(b.api_key)))throw new BadRequestException('Invalid key.');}
  await this.c.transaction(async db=>{
   if(id!=='ollama'&&b.api_key?.trim())await this.c.saveSecret('ai_'+id,b.api_key.trim(),db);
   await db.query('INSERT INTO platform_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()',['ai_provider:'+id,config]);
   await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES($1,'ai_provider_configured','commerce',$2)",[String(req.admin.id),'ai:'+id]);
  });return {ok:true};
 }
 @Delete('admin/ai-provisioning/:id/key') async remove(@Param('id') id:string,@Req() req:any){this.provider(id);this.ready();await this.c.transaction(async db=>{const r=(await db.query('SELECT value FROM platform_settings WHERE key=$1 FOR UPDATE',['ai_provider:'+id])).rows[0];const config={...(r?.value||{}),enabled:false,use_server_key:false};await db.query('DELETE FROM commerce_secrets WHERE name=$1',['ai_'+id]);await db.query('INSERT INTO platform_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=now()',['ai_provider:'+id,config]);await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES($1,'ai_key_removed','commerce',$2)",[String(req.admin.id),'ai:'+id]);});return {ok:true};}
 @Post('admin/ai-provisioning/:id/test') async test(@Param('id') id:string,@Req() req:any){this.provider(id);const r=await this.proxy('/admin/models/'+id);await this.audit(req.admin.id,'ai_provider_tested',id);return r;}
 @Post('admin/ai-provisioning/ollama/pull') async pull(@Body() b:any,@Req() req:any){if(typeof b.model!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,199}$/.test(b.model))throw new BadRequestException('Valid model name required.');const r=await this.proxy('/admin/local-models/pull',{model:b.model});await this.audit(req.admin.id,'ai_local_model_pulled',b.model);return r;}
}
