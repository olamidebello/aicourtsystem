// Read-only production probes. Run through inspect-feature.yml inside the API container.
const {Pool}=require('pg');
const {randomBytes,createHash}=require('crypto');
const feature=process.argv[2];
const routes={dashboard:'/dashboard',cases:'/cases',dockets:'/dockets',documents:'/documents',evidence:'/evidence',transcripts:'/transcripts',research:'/research',tasks:'/tasks',deadlines:'/deadlines',alerts:'/alerts',audit:'/audit',search:'/search?q=inspection',intake:'/intake',administration:'/admin/overview',accounts:'/admin/accounts',organizations:'/admin/organizations',campaigns:'/admin/campaigns',news:'/news',pacer:'/pacer/info',providers:'/ai/providers','court-automation':'/admin/court-automations',resources:'/admin/resources','policy-queue':'/admin/requests'};
const arrayFeatures=new Set(['cases','dockets','documents','evidence','transcripts','research','tasks','deadlines','alerts','audit','search','intake','accounts','organizations','news','providers','resources','policy-queue']);
const hash=x=>createHash('sha256').update(x).digest('hex');
async function main(){
 const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});let token;
 const get=(path,auth=true)=>fetch('http://127.0.0.1:4000/api'+path,{headers:auth&&token?{cookie:'justisolve_session='+token}:{},signal:AbortSignal.timeout(20000),redirect:'error'});
 try{
  if(feature==='authorization'){
   for(const path of ['/dashboard','/cases','/admin/accounts','/intake']){if((await get(path,false)).status!==401)throw Error('Unauthenticated route did not return 401');}
   console.log(JSON.stringify({feature,status:'passed',scope:'Unauthenticated access denied'}));return;
  }
  if(['ai-drafting','ai-analysis','multi-model-motions'].includes(feature)){
   const path={'ai-drafting':'/ai/draft','ai-analysis':'/ai/analyze','multi-model-motions':'/ai/ensemble'}[feature];
   const r=await fetch('http://127.0.0.1:4000/api'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(10000)});
   if(r.status!==401)throw Error('Unauthenticated AI operation did not return 401');
   console.log(JSON.stringify({feature,status:'passed',scope:'Unauthenticated operation denied; live model generation requires manual validation'}));return;
  }
  if(feature==='account-email'){
   const r=await get('/admin/auth/options',false);if(!r.ok)throw Error('Account options unavailable');const o=await r.json();
   console.log(JSON.stringify({feature,status:o.resetAvailable&&o.registrationAvailable?'passed':'attention',scope:'Configuration only; SMTP delivery and mailbox verification require an operator test'}));return;
  }
  if(!routes[feature])throw Error('Unknown inspection feature');
  const a=(await pool.query("SELECT id FROM platform_accounts WHERE role='super_admin' AND active=true AND email_verified=true ORDER BY id LIMIT 1")).rows[0];
  if(!a){console.log(JSON.stringify({feature,status:'attention',scope:'Provision an administrator before authenticated inspections'}));return;}
  token=randomBytes(32).toString('hex');
  await pool.query("INSERT INTO platform_sessions(token_hash,account_id,expires_at) VALUES($1,$2,now()+interval '2 minutes')",[hash(token),a.id]);
  const r=await get(routes[feature]);if(!r.ok)throw Error('HTTP '+r.status);
  const d=await r.json();
  if(arrayFeatures.has(feature)&&!Array.isArray(d))throw Error('Expected list response');
  if(feature==='campaigns'&&!Array.isArray(d.campaigns))throw Error('Expected list response');
  if(feature==='dashboard'&&!['cases','documents','evidence','tasks','deadlines','alerts'].every(k=>typeof d[k]==='number'))throw Error('Dashboard counts missing');
  if(feature==='resources'&&d.some(x=>x.status!=='available'))throw Error('A resource reports unavailable');
  if(feature==='court-automation'&&!['jobs','runs','drafts'].every(k=>Array.isArray(d[k])))throw Error('Automation response incomplete');
  console.log(JSON.stringify({feature,status:'passed',scope:'Authenticated read and response shape; mutations and external operations not exercised'}));
 }catch(e){console.log(JSON.stringify({feature,status:'failed',reason:/^(HTTP |Unknown inspection|Provision |Expected list|Dashboard |A resource|Automation |Unauthenticated |Account options)/.test(e.message)?e.message:'Service or database probe failed; inspect restricted server logs'}));process.exitCode=1;}
 finally{if(token)await pool.query('DELETE FROM platform_sessions WHERE token_hash=$1',[hash(token)]).catch(()=>{process.exitCode=1;});await pool.end();}
}
main().catch(()=>{console.log(JSON.stringify({feature,status:'failed',reason:'Inspection could not complete'}));process.exitCode=1;});
