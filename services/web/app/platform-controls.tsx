'use client';
import {useEffect,useState} from 'react';
import Justice from './justice';
export default function PlatformControls(){
 const [data,setData]=useState<any>({features:{},organizations:[],license_summary:[]}),[features,setFeatures]=useState<any>({}),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function call(path='',body?:any){const r=await fetch('/api/justice/control'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.message||'Control request failed');return d;}
 async function load(){const d=await call();setData(d);setFeatures(d.features||{});}
 async function run(fn:()=>Promise<any>){setBusy(true);setError('');setNotice('');try{await fn();setNotice('Saved and audited.');}catch(e:any){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{run(load);},[]);
 return <section><h2>Firms, credentials & feature controls</h2><p>Feature switches apply to their server endpoints. Existing gateway settings, AI provisioning, API keys, account controls and audit logs remain in their dedicated administration tabs. Suspending a workspace blocks its case access, including its owner; it does not change independent personal accounts.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<button disabled={busy} onClick={()=>run(load)}>Refresh controls</button><label>Audit reason<input maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></label><h3>Platform features</h3>{Object.keys(features).map(f=><label key={f} style={{display:'block'}}><input type="checkbox" checked={features[f]!==false} onChange={e=>setFeatures({...features,[f]:e.target.checked})}/>{f.replaceAll('_',' ')}</label>)}<button disabled={busy||reason.trim().length<5} onClick={()=>run(async()=>{await call('',{features,reason});await load();})}>Save platform feature switches</button>
 <h3>Operational workspaces</h3>{(Array.isArray(data.organizations)?data.organizations:[]).map((o:any)=><article className="panel" key={o.id}><h4>{o.name}</h4><p>#{o.id} · {o.kind} · Owner {o.owner_email} · {o.members} active members · {o.active?'Active':'Suspended'}</p><button disabled={busy||reason.trim().length<5} onClick={()=>run(async()=>{await call('/organizations/'+o.id,{active:!o.active,reason});await load();})}>{o.active?'Suspend workspace':'Restore workspace'}</button></article>)}
 <h3>Credential verification status</h3>{(Array.isArray(data.license_summary)?data.license_summary:[]).map((r:any)=><p key={r.status}>{r.status}: {r.count}</p>)}<details><summary>Professional role and license reviews</summary><Justice admin/></details>
 </section>;
}
