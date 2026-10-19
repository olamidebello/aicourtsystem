const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.tsx']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,file);
const React=require('react');
const {create,act}=require('react-test-renderer');
global.window={location:{hash:'',pathname:'/',search:''},history:{replaceState(){}}};
const Home=require('../app/page.tsx').default;
const admin={email:'admin@example.test',role:'super_admin'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('dashboard waits for sign-in, loads with session, and clears on logout',async()=>{
 const originalFetch=global.fetch;const requests=[];let signedIn=false;let tree;
 global.fetch=async(path,options)=>{
  requests.push(path);
  if(path==='/api/admin/auth/me')return response(null,401);
  if(path==='/api/admin/auth/options')return response({registrationAvailable:true,resetAvailable:true});
  if(path==='/api/admin/auth/status')return response({setupRequired:false});
  if(path==='/api/admin/auth/login'){signedIn=true;return response(admin);}
  if(path==='/api/admin/auth/logout'){signedIn=false;return response({ok:true});}
  if(path==='/api/dashboard'){assert.equal(signedIn,true);return response({cases:7});}
  throw Error('Unexpected request '+path);
 };
 try{
  await act(async()=>{tree=create(React.createElement(Home));await flush();});
  assert.equal(requests.includes('/api/dashboard'),false);
  const inputs=tree.root.findAllByType('input');
  await act(async()=>{inputs[0].props.onChange({target:{value:admin.email}});inputs[1].props.onChange({target:{value:'example-password'}});});
  await act(async()=>{await tree.root.findByType('form').props.onSubmit({preventDefault(){}});await flush();});
  assert.equal(requests.filter(p=>p==='/api/dashboard').length,1);
  assert.match(JSON.stringify(tree.toJSON()),/7/);
  assert.doesNotMatch(JSON.stringify(tree.toJSON()),/Unauthorized/);
  await act(async()=>{await tree.root.findAllByType('button').find(b=>b.children.includes('Sign out')).props.onClick();});
  assert.equal(tree.root.findAllByType('strong').length,0);
 }finally{if(tree)act(()=>tree.unmount());global.fetch=originalFetch;}
});

test('restored administrator session loads dashboard after verification',async()=>{
 const originalFetch=global.fetch;let tree;let resolveMe;const requests=[];
 global.fetch=async path=>{
  requests.push(path);
  if(path==='/api/admin/auth/me')return new Promise(resolve=>{resolveMe=resolve;});
  if(path==='/api/admin/auth/options')return response({registrationAvailable:true,resetAvailable:true});
  if(path==='/api/admin/auth/status')return response({setupRequired:false});
  if(path==='/api/dashboard')return response({cases:3});
  throw Error('Unexpected request '+path);
 };
 try{
  await act(async()=>{tree=create(React.createElement(Home));await flush();});
  assert.equal(requests.includes('/api/dashboard'),false);
  await act(async()=>{resolveMe(response(admin));await flush();});
  assert.equal(requests.filter(p=>p==='/api/dashboard').length,1);
 }finally{if(tree)act(()=>tree.unmount());global.fetch=originalFetch;}
});

test('ordinary user cannot mount the administrator dashboard',async()=>{
 const originalFetch=global.fetch;let tree;const requests=[];
 global.fetch=async path=>{
  requests.push(path);
  if(path==='/api/admin/auth/me')return response({...admin,role:'user'});
  if(path==='/api/admin/auth/options')return response({registrationAvailable:true,resetAvailable:true});
  if(path==='/api/admin/auth/status')return response({setupRequired:false});
  if(path==='/api/ai/providers')return response([]);
  if(path==='/api/intake')return response([]);
  return response({});
 };
 try{
  await act(async()=>{tree=create(React.createElement(Home));await flush();});
  assert.equal(requests.includes('/api/dashboard'),false);
 }finally{if(tree)act(()=>tree.unmount());global.fetch=originalFetch;}
});

test('registration sends new account input and returns to sign in',async()=>{
 const originalFetch=global.fetch;let tree;let submitted;
 global.fetch=async(path,options)=>{
  if(path.endsWith('/me'))return response(null,401);
  if(path.endsWith('/status'))return response({setupRequired:false});
  if(path.endsWith('/options'))return response({registrationAvailable:true,resetAvailable:true});
  if(path.endsWith('/register')){submitted=JSON.parse(options.body);return response({message:'Check your email for verification.'});}
  throw Error('Unexpected request '+path);
 };
 try{
  await act(async()=>{tree=create(React.createElement(Home));await flush();});
  act(()=>tree.root.findAllByType('button').find(b=>b.children.includes('Create account')).props.onClick());
  act(()=>{tree.root.findAllByType('input').forEach((input,i)=>input.props.onChange({target:{value:['New User','new@example.test','a-long-unique-password','a-long-unique-password'][i]}}));});
  await act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});await flush();});
  assert.equal(submitted.name,'New User');assert.equal(submitted.email,'new@example.test');
  assert.match(JSON.stringify(tree.toJSON()),/Check your email/);
  assert.equal(tree.root.findByType('h1').children[0],'Sign In');
 }finally{if(tree)act(()=>tree.unmount());global.fetch=originalFetch;}
});

test('password reset reads token from fragment and clears it from the address',async()=>{
 const originalFetch=global.fetch;let tree;let submitted;let replaced=false;
 window.location.hash='#action=reset&token='+'a'.repeat(64);window.history.replaceState=()=>{replaced=true;};
 global.fetch=async(path,options)=>{
  if(path.endsWith('/me'))return response(null,401);
  if(path.endsWith('/status'))return response({setupRequired:false});
  if(path.endsWith('/options'))return response({registrationAvailable:true,resetAvailable:true});
  if(path.endsWith('/reset-password')){submitted=JSON.parse(options.body);return response({message:'Password updated.'});}
  throw Error('Unexpected request '+path);
 };
 try{
  await act(async()=>{tree=create(React.createElement(Home));await flush();});assert.equal(replaced,true);
  assert.equal(tree.root.findByType('h1').children[0],'Choose New Password');
  act(()=>tree.root.findAllByType('input').forEach(input=>input.props.onChange({target:{value:'a-new-long-password'}})));
  await act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});await flush();});
  assert.equal(submitted.token,'a'.repeat(64));assert.equal(submitted.password,'a-new-long-password');
  assert.equal(tree.root.findByType('h1').children[0],'Sign In');
 }finally{if(tree)act(()=>tree.unmount());global.fetch=originalFetch;window.location.hash='';}
});
