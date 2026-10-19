const {test}=require('node:test');const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const {ADMIN_SCHEMA}=require('../dist/admin-schema');
const {AccountAccessController}=require('../dist/routes/account-access.controller');
const {AdminController}=require('../dist/routes/admin.controller');
const {passwordMatches,digest}=require('../dist/auth');
async function fixture(){
 const sql=new PGlite();
 await sql.exec('CREATE TABLE tenants(tenant_id BIGSERIAL PRIMARY KEY); INSERT INTO tenants DEFAULT VALUES; CREATE TABLE cases(case_id BIGSERIAL PRIMARY KEY); CREATE TABLE drafts(draft_id BIGSERIAL PRIMARY KEY); CREATE TABLE audit_log(actor TEXT,action TEXT,entity_type TEXT,entity_id TEXT,meta JSONB);');
 await sql.exec(ADMIN_SCHEMA);await sql.exec(ADMIN_SCHEMA);
 const db={query:(q,p=[])=>sql.query(q,p),pool:{connect:async()=>({query:(q,p=[])=>sql.query(q,p),release(){}})}};
 await db.query("INSERT INTO platform_accounts(email,name,password_hash) VALUES('admin@example.test','Admin','unused')");
 const messages=[];const mail={configured:()=>true,send:async(email,token,purpose)=>messages.push({email,token,purpose})};
 return {sql,db,messages,mail,controller:new AccountAccessController(db,mail)};
}
test('registration fixes role to user, hashes tokens and requires email verification',async()=>{
 const f=await fixture();try{
  await f.controller.register({name:'New User',email:'new@example.test',password:'a-unique-long-password',role:'super_admin'});
  const a=(await f.db.query("SELECT * FROM platform_accounts WHERE email='new@example.test'")).rows[0];
  assert.equal(a.role,'user');assert.equal(a.email_verified,false);assert.equal(await passwordMatches('a-unique-long-password',a.password_hash),true);
  const login=new AdminController(f.db);await assert.rejects(login.login({email:a.email,password:'a-unique-long-password'},{}),/credentials/);
  assert.equal(f.messages[0].purpose,'verify');
  const stored=(await f.db.query('SELECT token_hash FROM platform_account_tokens')).rows[0];assert.equal(stored.token_hash,digest(f.messages[0].token));assert.notEqual(stored.token_hash,f.messages[0].token);
  await f.controller.verify({token:f.messages[0].token});
  assert.equal((await f.db.query('SELECT email_verified FROM platform_accounts WHERE id=$1',[a.id])).rows[0].email_verified,true);
  await assert.rejects(f.controller.verify({token:f.messages[0].token}),/expired/);
  const cookies=[];await login.login({email:a.email,password:'a-unique-long-password'},{cookie:(...args)=>cookies.push(args),setHeader(){}});assert.equal(cookies.length,1);
 }finally{await f.sql.close();}
});
test('reset tokens expire, are single-use, and revoke every existing session',async()=>{
 const f=await fixture();try{
  await f.db.query("INSERT INTO platform_sessions(token_hash,account_id,expires_at) VALUES('old-session',1,now()+interval '1 hour')");
  await f.controller.forgot({email:'admin@example.test'});const token=f.messages[0].token;
  assert.equal(f.messages[0].purpose,'reset');await f.controller.reset({token,password:'a-new-unique-password'});
  assert.equal(await passwordMatches('a-new-unique-password',(await f.db.query('SELECT password_hash FROM platform_accounts WHERE id=1')).rows[0].password_hash),true);
  assert.equal((await f.db.query('SELECT * FROM platform_sessions')).rows.length,0);
  await assert.rejects(f.controller.reset({token,password:'a-second-long-password'}),/expired/);
  await f.controller.forgot({email:'admin@example.test'});const expired=f.messages[1].token;
  await f.db.query("UPDATE platform_account_tokens SET expires_at=now()-interval '1 second'");
  await assert.rejects(f.controller.reset({token:expired,password:'a-third-long-password'}),/expired/);
 }finally{await f.sql.close();}
});
test('recovery returns generic responses, enforces cooldown and blocks disabled accounts',async()=>{
 const f=await fixture();try{
  const missing=await f.controller.forgot({email:'missing@example.test'});assert.equal(f.messages.length,0);
  assert.deepEqual(await f.controller.forgot({email:'admin@example.test'}),missing);
  await f.controller.forgot({email:'admin@example.test'});assert.equal(f.messages.length,1);
  await f.db.query('UPDATE platform_accounts SET active=false WHERE id=1');
  await assert.rejects(f.controller.reset({token:f.messages[0].token,password:'a-new-unique-password'}),/expired/);
  assert.deepEqual(await f.controller.forgot({email:'admin@example.test'}),missing);
 }finally{await f.sql.close();}
});
test('tokens cannot be used for the wrong purpose',async()=>{
 const f=await fixture();try{
  await f.controller.forgot({email:'admin@example.test'});await assert.rejects(f.controller.verify({token:f.messages[0].token}),/expired/);
  await f.controller.register({name:'New',email:'new@example.test',password:'a-long-unique-password'});
  await assert.rejects(f.controller.reset({token:f.messages[1].token,password:'a-new-long-password'}),/expired/);
 }finally{await f.sql.close();}
});
test('mail configuration and input validation gate public account flows',async()=>{
 const f=await fixture();try{
  await assert.rejects(f.controller.register({name:'New',email:'invalid',password:'short'}));f.mail.configured=()=>false;
  assert.equal(f.controller.options().registrationAvailable,false);
  await assert.rejects(f.controller.forgot({email:'admin@example.test'}),/unavailable/);
  await assert.rejects(f.controller.register({name:'New',email:'new@example.test',password:'a-long-unique-password'}),/unavailable/);
 }finally{await f.sql.close();}
});
test('SMTP links use configured HTTPS origin, with TLS and no request-host input',async()=>{
 const nodemailer=require('nodemailer');const {AccountMailer}=require('../dist/account-mailer');
 const keys=['SMTP_HOST','SMTP_FROM','SMTP_PORT','SMTP_SECURE','PUBLIC_APP_URL'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));const original=nodemailer.createTransport;let configuration,message,closed=false;
 try{
  Object.assign(process.env,{SMTP_HOST:'smtp.example.test',SMTP_FROM:'accounts@example.test',SMTP_PORT:'587',SMTP_SECURE:'false',PUBLIC_APP_URL:'https://justisolve.example.test'});
  nodemailer.createTransport=options=>{configuration=options;return {sendMail:async m=>{message=m;},close(){closed=true;}};};
  const mail=new AccountMailer();assert.equal(mail.configured(),true);await mail.send('user@example.test','a'.repeat(64),'reset');
  assert.equal(configuration.requireTLS,true);assert.equal(configuration.secure,false);assert.equal(closed,true);
  assert.match(message.text,/https:\/\/justisolve.example.test\/#action=reset&token=/);
  process.env.PUBLIC_APP_URL='http://evil.example';assert.equal(mail.configured(),false);
 }finally{nodemailer.createTransport=original;for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}}
});
