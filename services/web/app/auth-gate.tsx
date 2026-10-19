'use client';
import Intake from './intake';
import {useEffect,useState} from 'react';
async function readAuthResponse(r:Response){
 const raw=await r.text();let data:any;
 try{data=JSON.parse(raw);}catch{throw Error(r.status===429?'Too many sign-in attempts. Please wait 15 minutes before trying again.':'Sign-in service is temporarily unavailable. Please try again.');}
 if(!r.ok)throw Error(typeof data.message==='string'?data.message:'Sign-in failed. Please try again.');
 return data;
}
export default function AuthGate({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<any>(null),[loading,setLoading]=useState(true),[setup,setSetup]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[form,setForm]=useState({email:'',password:'',name:'',setupToken:''});
 useEffect(()=>{Promise.all([fetch('/api/admin/auth/me').then(r=>r.ok?r.json():null),fetch('/api/admin/auth/status').then(readAuthResponse)]).then(([u,s])=>{setUser(u);setSetup(s.setupRequired);}).catch(()=>setError('Service unavailable.')).finally(()=>setLoading(false));},[]);
 async function submit(){if(busy)return;setBusy(true);setError('');try{const r=await fetch('/api/admin/auth/'+(setup?'bootstrap':'login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});const d=await readAuthResponse(r);if(setup){setSetup(false);setError('Administrator created. Sign in with your new credentials.');}else setUser(d);}catch(e:any){setError(e.message);}finally{setForm(f=>({...f,password:'',setupToken:''}));setBusy(false);}}
 async function logout(){try{await fetch('/api/admin/auth/logout',{method:'POST'});}finally{setUser(null);}}
 if(loading)return <main>Loading…</main>;
 if(!user)return <main style={{maxWidth:650,margin:'40px auto'}}><img src="/justisolve-logo.png" alt="JustiSolve" style={{width:260,borderRadius:12}}/><section className="panel"><h1>{setup?'Provision Super Admin':'Sign In'}</h1><p>Super admins provision accounts. User accounts have a private narrative and document analysis workspace; administrative records require a super-admin role.</p>{(setup?['name','email','password','setupToken']:['email','password']).map(k=><label key={k} style={{display:'block',margin:12}}>{k==='setupToken'?'One-time server setup token':k}<input style={{display:'block',width:'100%'}} type={['password','setupToken'].includes(k)?'password':k==='email'?'email':'text'} autoComplete={k==='password'?(setup?'new-password':'current-password'):k==='email'?'username':'off'} value={(form as any)[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}<button className="primary" onClick={submit} disabled={busy}>{busy?'Working…':setup?'Create Super Admin':'Sign In'}</button>{error&&<p role="alert">{error}</p>}<p><a href="/news">Public News</a> · <a href="/policies">Terms & Privacy</a></p></section></main>;
 return <><div style={{padding:'8px 20px',background:'#0d1a30',textAlign:'right'}}>{user.email} <button className="primary" onClick={logout}>Sign out</button></div>{user.role==='super_admin'?children:<main style={{maxWidth:1100,margin:'auto'}}><Intake/><p><a href="/news">News</a> · <a href="/policies">Terms & Privacy</a></p></main>}</>;
}
