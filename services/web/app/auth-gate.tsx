'use client';
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
 const [form,setForm]=useState({email:'',password:'',confirm:'',name:'',setupToken:''});
 useEffect(()=>{
  const link=new URLSearchParams(window.location.hash.slice(1));const action=link.get('action');
  if(action==='verify'||action==='reset'){setMode(action);setToken(link.get('token')||'');window.history.replaceState(null,'',window.location.pathname+window.location.search);}
  Promise.all([fetch('/api/admin/auth/me',{cache:'no-store'}).then(r=>r.ok?r.json():null),fetch('/api/admin/auth/status',{cache:'no-store'}).then(readAuthResponse),fetch('/api/admin/auth/options',{cache:'no-store'}).then(readAuthResponse).catch(()=>({registrationAvailable:false,resetAvailable:false,verificationMethod:'email'}))]).then(([u,s,o])=>{setUser(u);setSetup(s.setupRequired);setOptions(o);}).catch(()=>setError('Service unavailable. Reload to try again.')).finally(()=>setLoading(false));
 },[]);
 function changeMode(next:Mode){setMode(next);setError('');setNotice('');setForm(f=>({...f,password:'',confirm:'',setupToken:''}));setToken('');}
 async function submit(){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   if((mode==='register'||mode==='reset')&&form.password!==form.confirm)throw Error('Passwords do not match.');
   const endpoint=setup?'bootstrap':({login:'login',register:'register',forgot:'forgot-password',reset:'reset-password',verify:'verify-email'}[mode]);
   const body=setup?form:mode==='reset'?{token,password:form.password}:mode==='verify'?{token}:mode==='forgot'?{email:form.email}:form;
   const d=await readAuthResponse(await fetch('/api/admin/auth/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
   if(setup){setSetup(false);setMode('login');setNotice('Administrator created. Sign in with your new credentials.');}
   else if(mode==='login')setUser(d);
   else{setNotice(d.message);if(mode==='reset'||mode==='verify'){setToken('');setMode('login');setUser(null);}else if(mode==='register')setMode('login');}
  }catch(e:any){setError(e.message);}finally{setForm(f=>({...f,password:'',confirm:'',setupToken:''}));setBusy(false);}
 }
 async function logout(){setBusy(true);setError('');try{await readAuthResponse(await fetch('/api/admin/auth/logout',{method:'POST'}));setUser(null);}catch{setError('Sign out failed. Please try again.');}finally{setBusy(false);}}
 if(loading)return <main>Loading…</main>;
 if(!user||mode==='reset'||mode==='verify'){
  const title=setup?'Provision Super Admin':({login:'Sign In',register:'Create Account',forgot:'Reset Password',reset:'Choose New Password',verify:'Verify Email'}[mode]);
  const fields=setup?['name','email','password','setupToken']:mode==='register'?['name','email','password','confirm']:mode==='reset'?['password','confirm']:mode==='forgot'?['email']:mode==='verify'?[]:['email','password'];
  return <main style={{maxWidth:650,margin:'40px auto',padding:16}}><img src="/justisolve-logo.png" alt="JustiSolve" style={{width:260,maxWidth:'100%',borderRadius:12}}/><section className="panel"><h1>{title}</h1>
   <p>{mode==='register'?(options.verificationMethod==='admin'?'Create your private case intake account. Email delivery is not configured; an administrator must approve your account before you can sign in.':'Create your private case intake account. Verify your email before signing in. If no email arrives, contact the administrator for approval.'):mode==='forgot'?(options.resetAvailable?'Enter your account email. Eligible accounts receive recovery email; unverified accounts receive a verification link first. If nothing arrives, ask the administrator for a reset link.':'Email recovery is unavailable. Ask your JustiSolve administrator to open Accounts and generate a password-reset link for you. The link lets you choose your own new password.'):mode==='verify'?'Confirm the account you requested. This link expires after 30 minutes.':mode==='reset'?'Use a unique password of 14–200 characters. Updating it will sign out all existing sessions.':'Sign in to your private workspace. Administrative records require a super-admin role.'}</p>
   <form onSubmit={e=>{e.preventDefault();submit();}}>
    {fields.map(k=><label key={k} style={{display:'block',margin:'12px 0'}}>{({name:'Name',email:'Email',password:'Password',confirm:'Confirm password',setupToken:'One-time server setup token'} as any)[k]}<input style={{display:'block',width:'100%'}} required maxLength={k==='email'?254:200} minLength={['password','confirm'].includes(k)&&(setup||mode!=='login')?14:undefined} type={['password','confirm','setupToken'].includes(k)?'password':k==='email'?'email':'text'} autoComplete={k==='password'?(setup||mode!=='login'?'new-password':'current-password'):k==='confirm'?'new-password':k==='email'?'username':'off'} value={(form as any)[k]} onChange={e=>{const value=e.target.value;setForm(f=>({...f,[k]:value}));}}/></label>)}
    {(mode==='register'||mode==='reset')&&<p>Use a password of 14–200 characters. Both password fields must match.</p>}
    <button type="submit" className="primary" disabled={busy||(mode==='forgot'&&!options.resetAvailable)||((mode==='verify'||mode==='reset')&&!token)}>{busy?'Working…':setup?'Create Super Admin':({login:'Sign In',register:'Register',forgot:'Send Recovery Email',reset:'Update Password',verify:'Verify Email'}[mode])}</button>
   </form>
   {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
   {!setup&&<div className="actions" style={{marginTop:16}}>{mode!=='login'&&<button disabled={busy} onClick={()=>changeMode('login')}>Back to sign in</button>}{mode==='login'&&<><button disabled={busy||!options.registrationAvailable} onClick={()=>changeMode('register')}>Create account</button><button disabled={busy} onClick={()=>changeMode('forgot')}>Forgot password?</button></>}</div>}
   {!setup&&mode==='login'&&(!options.registrationAvailable||!options.resetAvailable)&&<p className="muted">{!options.registrationAvailable?'Registration is currently unavailable. ':''}{!options.resetAvailable?'Password recovery is currently unavailable. Contact the administrator for account assistance.':''}</p>}
   <p><a href="/news">Public News</a> · <a href="/policies">Terms & Privacy</a></p>
  </section></main>;
 }
 return <><div style={{padding:'8px 20px',background:'#0d1a30',textAlign:'right'}}>{user.email} <button className="primary" disabled={busy} onClick={logout}>Sign out</button>{error&&<p role="alert">{error}</p>}</div>{user.role==='super_admin'?children:<main style={{maxWidth:1100,margin:'auto'}}><Intake/><Marketplace api="/api"/><Pacer api="/api"/><p><a href="/news">News</a> · <a href="/policies">Terms & Privacy</a></p></main>}</>;
}
