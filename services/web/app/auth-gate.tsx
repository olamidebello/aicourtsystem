'use client';
import {RegistrationLicense} from './license';
import TenantHub from './tenant-hub';
import RolePicker from './role-picker';
import Marketplace from './marketplace';
import Pacer from './pacer';
import Intake from './intake';
import {useEffect,useState} from 'react';
async function readAuthResponse(r:Response){
 const raw=await r.text();let data:any;
 try{data=JSON.parse(raw);}catch{throw Error(r.status===429?'Too many account requests. Please wait 15 minutes.':'Sign-in service is temporarily unavailable. Please try again.');}
 if(!r.ok)throw Error(typeof data.message==='string'?data.message:'Unable to complete the request. Please try again.');
 return data;
}
type Mode='login'|'register'|'forgot'|'reset'|'verify';
export default function AuthGate({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<any>(null),[loading,setLoading]=useState(true),[setup,setSetup]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [mode,setMode]=useState<Mode>('login'),[token,setToken]=useState(''),[options,setOptions]=useState({registrationAvailable:false,resetAvailable:false,verificationMethod:'email'});
 const [step,setStep]=useState(0);
 const steps=['Your account','Your workspace','Your roles','Credentials','Review'];
 const [workspaceType,setWorkspaceType]=useState('personal'),[workspaceName,setWorkspaceName]=useState('');
 const [license,setLicense]=useState<any>(null);
 const [roles,setRoles]=useState<string[]>([]),[jurisdiction,setJurisdiction]=useState(''),[organization,setOrganization]=useState('');
 const [form,setForm]=useState({email:'',password:'',confirm:'',name:'',setupToken:''});
 useEffect(()=>{
  const link=new URLSearchParams(window.location.hash.slice(1));const action=link.get('action');
  if(action==='verify'||action==='reset'){setMode(action);setToken(link.get('token')||'');window.history.replaceState(null,'',window.location.pathname+window.location.search);}
  Promise.all([fetch('/api/admin/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null),fetch('/api/admin/auth/status',{cache:'no-store'}).then(readAuthResponse),fetch('/api/admin/auth/options',{cache:'no-store'}).then(readAuthResponse).catch(()=>({registrationAvailable:false,resetAvailable:false,verificationMethod:'email'}))]).then(([u,s,o])=>{setUser(u);setSetup(s.setupRequired);setOptions(o);}).catch(()=>setError('Service unavailable. Reload to try again.')).finally(()=>setLoading(false));
 },[]);
 function changeMode(next:Mode){setMode(next);setStep(0);setError('');setNotice('');setForm(f=>({...f,password:'',confirm:'',setupToken:''}));setToken('');}
 function advance(){
  setError('');
  if(step===0&&(!form.name.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())||form.password.length<14||form.password.length>200||form.password!==form.confirm)){setError('Enter your name, a valid email, and matching passwords of 14–200 characters.');return;}
  if(step===1&&workspaceType!=='personal'&&!workspaceName.trim()){setError('Enter a workspace name.');return;}
  if(step===2&&roles.length&&!jurisdiction.trim()){setError('Enter the jurisdiction for your requested roles.');return;}
  if(step===3&&license&&(!roles.includes(license.role_id)||!license.consent||['country','region','profession','first_name','last_name','number'].some(k=>!license[k]?.trim()))){setError('Complete the license fields and consent, or turn off the optional license section.');return;}
  setStep(x=>Math.min(4,x+1));
 }
 async function submit(){
  if(mode==='register'&&!setup&&step<4){advance();return;}

  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   if((mode==='register'||mode==='reset')&&form.password!==form.confirm)throw Error('Passwords do not match.');
   const endpoint=setup?'bootstrap':({login:'login',register:'register',forgot:'forgot-password',reset:'reset-password',verify:'verify-email'}[mode]);
   const body=setup?form:mode==='reset'?{token,password:form.password}:mode==='verify'?{token}:mode==='forgot'?{email:form.email}:mode==='register'?{...form,roles,jurisdiction,organization,license,workspace_type:workspaceType,workspace_name:workspaceName}:form;
   const d=await readAuthResponse(await fetch('/api/admin/auth/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
   if(setup){setSetup(false);setMode('login');setNotice('Administrator created. Sign in with your new credentials.');}
   else if(mode==='login')setUser(d);
   else{setNotice(d.message);if(mode==='reset'||mode==='verify'){setToken('');setMode('login');setUser(null);}else if(mode==='register')setMode('login');}
  }catch(e:any){setError(e.message);if(mode==='register')setStep(0);}finally{setForm(f=>({...f,password:'',confirm:'',setupToken:''}));setBusy(false);}
 }
 async function logout(){setBusy(true);setError('');try{await readAuthResponse(await fetch('/api/admin/auth/logout',{method:'POST'}));setUser(null);}catch{setError('Sign out failed. Please try again.');}finally{setBusy(false);}}
 if(loading)return <main role="status" className="auth-shell">Loading your secure workspace…</main>;
 if(!user||mode==='reset'||mode==='verify'){
  const title=setup?'Provision Super Admin':({login:'Sign In',register:'Create Account',forgot:'Reset Password',reset:'Choose New Password',verify:'Verify Email'}[mode]);
  const fields=setup?['name','email','password','setupToken']:mode==='register'?(step===0?['name','email','password','confirm']:[]):mode==='reset'?['password','confirm']:mode==='forgot'?['email']:mode==='verify'?[]:['email','password'];
  return <main className="auth-shell"><img src="/justisolve-logo.png" alt="JustiSolve" style={{width:260,maxWidth:'100%',borderRadius:12}}/><section className="panel auth-card"><h1>{title}</h1>
   <p>{mode==='register'?(options.verificationMethod==='admin'?'Create your private case intake account. Email delivery is not configured; an administrator must approve your account before you can sign in.':'Create your private case intake account. Verify your email before signing in. If no email arrives, contact the administrator for approval.'):mode==='forgot'?(options.resetAvailable?'Enter your account email. Eligible accounts receive recovery email; unverified accounts receive a verification link first. If nothing arrives, ask the administrator for a reset link.':'Email recovery is unavailable. Ask your JustiSolve administrator to open Accounts and generate a password-reset link for you. The link lets you choose your own new password.'):mode==='verify'?'Confirm the account you requested. This link expires after 30 minutes.':mode==='reset'?'Use a unique password of 14–200 characters. Updating it will sign out all existing sessions.':'Sign in to your private workspace. Administrative records require a super-admin role.'}</p>
   {mode==='register'&&!setup&&<><nav className="signup-progress" aria-label="Registration progress">{steps.map((label,index)=><button type="button" key={label} disabled={busy||index>step} aria-current={index===step?'step':undefined} onClick={()=>{setStep(index);setError('');}}><span>{index<step?'✓':index+1}</span><small>{label}</small></button>)}</nav><div className="signup-meter" role="progressbar" aria-label="Registration completion" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step+1}><span style={{width:((step+1)*20)+'%'}}/></div><h2 className="signup-heading">Step {step+1} of 5 · {steps[step]}</h2></>}
   <form className={mode==='register'?'signup-slide':''} key={mode==='register'?step:mode} onSubmit={e=>{e.preventDefault();submit();}}>
    {fields.map(k=><label key={k} style={{display:'block',margin:'12px 0'}}>{({name:'Name',email:'Email',password:'Password',confirm:'Confirm password',setupToken:'One-time server setup token'} as any)[k]}<input style={{display:'block',width:'100%'}} required maxLength={k==='email'?254:200} minLength={['password','confirm'].includes(k)&&(setup||mode!=='login')?14:undefined} type={['password','confirm','setupToken'].includes(k)?'password':k==='email'?'email':'text'} autoComplete={k==='password'?(setup||mode!=='login'?'new-password':'current-password'):k==='confirm'?'new-password':k==='email'?'username':'off'} value={(form as any)[k]} onChange={e=>{const value=e.target.value;setForm(f=>({...f,[k]:value}));}}/></label>)}
    {mode==='register'&&step===1&&<><label>Workspace type<select value={workspaceType} onChange={e=>setWorkspaceType(e.target.value)}>{[['personal','Personal account'],['law_firm','Law firm'],['counsel','Independent counsel'],['pro_se','Pro se / self represented'],['business','Business'],['court','Court'],['organization','Other organization']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>{workspaceType!=='personal'&&<label>Workspace name<input required maxLength={200} value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)}/></label>}<div className="setup-note">An individual SIP phone identity is queued with your account. Non-individual workspaces also receive a separate PBX account. Calling requires activation and applicable phone-service credit.</div></>}
    {mode==='register'&&step===2&&<><RolePicker selected={roles} onChange={setRoles}/><label>Organization<input maxLength={300} value={organization} onChange={e=>setOrganization(e.target.value)}/></label><label>Country / jurisdiction<input required={roles.length>0} maxLength={300} value={jurisdiction} onChange={e=>setJurisdiction(e.target.value)}/></label><p className="muted">You can add roles later. Selecting a role does not grant professional authority or access to another person’s case.</p></>}
    {mode==='register'&&step===3&&<><RegistrationLicense roles={roles} value={license} onChange={setLicense}/><p className="muted">You can submit credentials later. Required professional roles remain unavailable until verified and approved.</p></>}
    {mode==='register'&&step===4&&<><div className="registration-review"><h3>Ready to create your account</h3><dl><dt>Name</dt><dd>{form.name}</dd><dt>Email</dt><dd>{form.email}</dd><dt>Workspace</dt><dd>{workspaceName||'Personal workspace'} · {workspaceType.replaceAll('_',' ')}</dd><dt>Requested roles</dt><dd>{roles.length}</dd><dt>License lookup</dt><dd>{license?'Requested with your consent':'Not requested'}</dd></dl></div><p>Verify your email or obtain administrator approval before signing in. Professional role approval, phone activation and case assignments are separate steps.</p><p><a href="/policies" target="_blank" rel="noreferrer">Review terms and privacy policies</a></p></>}
    {((mode==='register'&&step===0)||mode==='reset')&&<p>Use a password of 14–200 characters. Both password fields must match.</p>}
    <div className="signup-actions">{mode==='register'&&step>0&&<button type="button" disabled={busy} onClick={()=>{setStep(x=>x-1);setError('');}}>Previous</button>}<button type="submit" className="primary" disabled={busy||(mode==='forgot'&&!options.resetAvailable)||((mode==='verify'||mode==='reset')&&!token)}>{busy?'Working…':setup?'Create Super Admin':({login:'Sign In',register:step<4?'Continue':'Create my account',forgot:'Send Recovery Email',reset:'Update Password',verify:'Verify Email'}[mode])}</button></div>
   </form>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {!setup&&<div className="actions" style={{marginTop:16}}>{mode!=='login'&&<button disabled={busy} onClick={()=>changeMode('login')}>Back to sign in</button>}{mode==='login'&&<><button disabled={busy||!options.registrationAvailable} onClick={()=>changeMode('register')}>Create account</button><button disabled={busy} onClick={()=>changeMode('forgot')}>Forgot password?</button></>}</div>}
   {!setup&&mode==='login'&&(!options.registrationAvailable||!options.resetAvailable)&&<p className="muted">{!options.registrationAvailable?'Registration is currently unavailable. ':''}{!options.resetAvailable?'Password recovery is currently unavailable. Contact the administrator for account assistance.':''}</p>}
   <p><a href="/news">Public News</a> · <a href="/policies">Terms & Privacy</a></p>
  </section></main>;
 }
 return <><div style={{padding:'8px 20px',background:'#0d1a30',textAlign:'right'}}>{user.email} <button className="primary" disabled={busy} onClick={logout}>Sign out</button>{error&&<p role="alert">{error}</p>}</div>{user.role==='super_admin'?children:<main style={{maxWidth:1100,margin:'auto'}}><TenantHub/><p><a href="/news">News</a> · <a href="/policies">Terms & Privacy</a></p></main>}</>;
}
