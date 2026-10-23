import {randomBytes,randomUUID} from 'crypto';
import {digest} from '../auth';
import {Controller,Get,Post,Put,Body,Req,Param,Delete,BadRequestException} from '@nestjs/common';
import {CommerceService} from '../commerce.service';
const credentialNames=['stripe_secret','paypal_client_id','paypal_secret','pacer_login','pacer_password','pacer_client_code'];
function integer(v:any,min=0,max=1000000){if(!Number.isSafeInteger(v)||v<min||v>max)throw new BadRequestException('Valid whole cents required.');return v;}
@Controller('marketplace')
export class MarketplaceController {
 constructor(private commerce:CommerceService){}
 @Get() async catalog(@Req() req:any){const c=this.commerce,s=await c.settings();return {products:(await c.db.query('SELECT * FROM commerce_products WHERE active=true ORDER BY id')).rows,gateways:['stripe','paypal'].filter(k=>s[k+'_enabled']),balance_cents:(await c.db.query('SELECT balance_cents FROM commerce_wallets WHERE account_id=$1',[req.admin.id])).rows[0]?.balance_cents||0,orders:(await c.db.query('SELECT id,product_name,amount_cents,credit_cents,gateway,status,created_at FROM commerce_orders WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100',[req.admin.id])).rows,usage:(await c.db.query('SELECT * FROM pacer_usage WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100',[req.admin.id])).rows,access:(await c.db.query('SELECT * FROM pacer_access WHERE account_id=$1',[req.admin.id])).rows[0]||{enabled:false},pacer_enabled:s.pacer_enabled,search_reserve_cents:s.search_reserve_cents,markup_percent:30};}
 @Post('checkout') checkout(@Body() b:any,@Req() req:any){if(!/^\d+$/.test(String(b.product_id)))throw new BadRequestException('Product required.');return this.commerce.checkout(req.admin.id,b.product_id,b.gateway);}
 @Post('orders/:id/verify') verify(@Param('id') id:string,@Req() req:any){if(!/^[a-f0-9-]{36}$/.test(id))throw new BadRequestException('Invalid order.');return this.commerce.verify(req.admin.id,id);}
}
@Controller('admin/commerce')
export class CommerceAdminController {
 constructor(private c:CommerceService){}
 @Get() async overview(){return {settings:await this.c.settings(),credentials:(await this.c.db.query('SELECT name FROM commerce_secrets')).rows.map(x=>x.name),products:(await this.c.db.query('SELECT * FROM commerce_products ORDER BY id')).rows,accounts:(await this.c.db.query('SELECT a.id,a.name,a.email,coalesce(p.enabled,false) pacer_enabled,coalesce(p.limit_cents,1000) limit_cents,coalesce(w.balance_cents,0) balance_cents FROM platform_accounts a LEFT JOIN pacer_access p ON p.account_id=a.id LEFT JOIN commerce_wallets w ON w.account_id=a.id ORDER BY a.id')).rows,usage:(await this.c.db.query('SELECT * FROM pacer_usage ORDER BY created_at DESC LIMIT 200')).rows,orders:(await this.c.db.query('SELECT id,account_id,product_name,amount_cents,credit_cents,gateway,status,created_at FROM commerce_orders ORDER BY created_at DESC LIMIT 200')).rows};}
 @Put('settings') async settings(@Body() b:any,@Req() req:any){const old=await this.c.settings();const next={...old,markup_percent:30};for(const k of ['stripe_enabled','paypal_enabled','paypal_sandbox','pacer_enabled']){if(typeof b[k]!=='boolean')throw new BadRequestException('Boolean settings required.');next[k]=b[k];}next.search_reserve_cents=integer(b.search_reserve_cents,1,100000);await this.c.db.query("UPDATE platform_settings SET value=$1,updated_at=now() WHERE key='commerce'",[next]);await this.c.audit(req.admin.id,'settings_updated','commerce');return {ok:true};}
 @Delete('credentials/:name') async removeCredential(@Param('name') name:string,@Req() req:any){
  if(!credentialNames.includes(name))throw new BadRequestException('Unknown credential.');
  await this.c.transaction(async db=>{
   const settings=(await db.query("SELECT value FROM platform_settings WHERE key='commerce' FOR UPDATE")).rows[0].value;
   settings[name.startsWith('pacer_')?'pacer_enabled':name.startsWith('paypal_')?'paypal_enabled':'stripe_enabled']=false;
   await db.query('DELETE FROM commerce_secrets WHERE name=$1',[name]);
   await db.query("UPDATE platform_settings SET value=$1,updated_at=now() WHERE key='commerce'",[settings]);
   await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'credential_removed','commerce',$2,$3)",[String(req.admin.id),name,{service_disabled:true}]);
  });return {ok:true};
 }
 @Post('credits/:id') async credit(@Param('id') account:string,@Body() b:any,@Req() req:any){
  const amount=integer(b.amount_cents,1);if(!/^\d+$/.test(account)||typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>1000||!/^[-a-f0-9]{36}$/.test(b.request_id||''))throw new BadRequestException('Account, positive credit, reason (5–1000 characters), and request ID required.');
  return this.c.transaction(async db=>{
   const existing=(await db.query('SELECT id FROM platform_accounts WHERE id=$1 FOR UPDATE',[account])).rows[0];if(!existing)throw new BadRequestException('Account not found.');
   const inserted=await db.query('INSERT INTO commerce_adjustments(id,account_id,actor_id,amount_cents,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING RETURNING id',[b.request_id,account,req.admin.id,amount,b.reason.trim()]);
   if(!inserted.rows.length){const prior=(await db.query('SELECT * FROM commerce_adjustments WHERE id=$1',[b.request_id])).rows[0];if(String(prior.account_id)!==String(account)||String(prior.actor_id)!==String(req.admin.id)||prior.amount_cents!==amount||prior.reason!==b.reason.trim())throw new BadRequestException('Request ID already used for another credit.');}
   else{
    await db.query('INSERT INTO commerce_wallets(account_id,balance_cents) VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET balance_cents=commerce_wallets.balance_cents+excluded.balance_cents',[account,amount]);
    await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'manual_credit','account',$2,$3)",[String(req.admin.id),String(account),{request_id:b.request_id,amount_cents:amount,reason:b.reason.trim()}]);
   }
   return {ok:true,credited:!!inserted.rows.length,balance_cents:(await db.query('SELECT balance_cents FROM commerce_wallets WHERE account_id=$1',[account])).rows[0].balance_cents};
  });
 }
 @Get('credits') async credits(){return (await this.c.db.query('SELECT c.*,a.email FROM commerce_adjustments c JOIN platform_accounts a ON a.id=c.account_id ORDER BY c.created_at DESC LIMIT 200')).rows;}
 @Get('api-keys') async apiKeys(){return (await this.c.db.query('SELECT k.id,k.account_id,a.email,k.name,k.scopes,k.expires_at,k.revoked_at,k.created_at,k.last_used_at FROM platform_api_keys k JOIN platform_accounts a ON a.id=k.account_id ORDER BY k.created_at DESC LIMIT 200')).rows;}
 @Post('api-keys') async issueKey(@Body() b:any,@Req() req:any){
  if(!/^\d+$/.test(String(b.account_id))||typeof b.name!=='string'||!b.name.trim()||b.name.length>100||!Array.isArray(b.scopes)||!b.scopes.length||b.scopes.some(x=>!['pacer','wallet'].includes(x)))throw new BadRequestException('Account, name and supported API scopes required.');
  const days=integer(b.expires_days,1,365),id=randomUUID(),token='js_'+randomBytes(32).toString('hex');
  await this.c.transaction(async db=>{
   if(!(await db.query('SELECT id FROM platform_accounts WHERE id=$1 AND active=true AND (email_verified=true OR admin_approved=true) FOR UPDATE',[b.account_id])).rows.length)throw new BadRequestException('An active email-verified or administrator-approved account is required.');
   await db.query("INSERT INTO platform_api_keys(id,account_id,name,token_hash,scopes,expires_at) VALUES($1,$2,$3,$4,$5,now()+$6*interval '1 day')",[id,b.account_id,b.name.trim(),digest(token),JSON.stringify([...new Set(b.scopes)]),days]);
   await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id,meta) VALUES($1,'api_key_created','api_key',$2,$3)",[String(req.admin.id),id,{account_id:b.account_id,scopes:b.scopes}]);
  });return {id,token,message:'Copy this key now. It will not be shown again.'};
 }
 @Delete('api-keys/:id') async revokeKey(@Param('id') id:string,@Req() req:any){
  if(!/^[-a-f0-9]{36}$/.test(id))throw new BadRequestException('Invalid key ID.');
  await this.c.transaction(async db=>{const r=await db.query('UPDATE platform_api_keys SET revoked_at=coalesce(revoked_at,now()) WHERE id=$1 RETURNING id',[id]);if(!r.rows.length)throw new BadRequestException('API key not found.');await db.query("INSERT INTO audit_log(actor,action,entity_type,entity_id) VALUES($1,'api_key_revoked','api_key',$2)",[String(req.admin.id),id]);});return {ok:true};
 }
 @Put('credentials') async credentials(@Body() b:any,@Req() req:any){for(const k of ['stripe_secret','paypal_client_id','paypal_secret','pacer_login','pacer_password','pacer_client_code'])if(typeof b[k]==='string'&&b[k])await this.c.saveSecret(k,b[k]);await this.c.audit(req.admin.id,'credentials_updated','commerce');return {ok:true};}
 @Post('products') async product(@Body() b:any,@Req() req:any){if(typeof b.name!=='string'||!b.name.trim()||b.name.length>150||typeof b.description!=='string'||b.description.length>1000||typeof b.active!=='boolean')throw new BadRequestException('Valid product details required.');const args=[b.name.trim(),b.description,integer(b.price_cents,1),integer(b.credit_cents,1),b.active];const r=b.id?await this.c.db.query('UPDATE commerce_products SET name=$1,description=$2,price_cents=$3,credit_cents=$4,active=$5 WHERE id=$6 RETURNING *',[...args,b.id]):await this.c.db.query('INSERT INTO commerce_products(name,description,price_cents,credit_cents,active) VALUES($1,$2,$3,$4,$5) RETURNING *',args);await this.c.audit(req.admin.id,'product_saved',r.rows[0]?.id);return r.rows[0];}
 @Put('access/:id') async access(@Param('id') id:string,@Body() b:any,@Req() req:any){if(!/^\d+$/.test(id)||typeof b.enabled!=='boolean')throw new BadRequestException('Account and enabled state required.');await this.c.db.query('INSERT INTO pacer_access(account_id,enabled,limit_cents) VALUES($1,$2,$3) ON CONFLICT(account_id) DO UPDATE SET enabled=excluded.enabled,limit_cents=excluded.limit_cents',[id,b.enabled,integer(b.limit_cents)]);await this.c.audit(req.admin.id,'pacer_access_changed',id);return {ok:true};}
 @Post('usage/:id/reconcile') async reconcile(@Param('id') id:string,@Body() b:any,@Req() req:any){if(typeof b.reason!=='string'||b.reason.trim().length<10)throw new BadRequestException('Receipt reference and reconciliation reason required.');const r=await this.c.settle(id,integer(b.base_cents),{reconciled_by:req.admin.id,reason:b.reason},true);await this.c.audit(req.admin.id,'pacer_reconciled',id);return r;}
}
