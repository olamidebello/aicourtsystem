'use client';
import Marketplace from './marketplace';
import Intake from './intake';
import Admin from './admin';
import AuthGate from './auth-gate';
import NewsFeed from './news-feed';
import Ensemble from './ensemble';
import Pacer from './pacer';
import {useEffect,useMemo,useState} from 'react';

const modules=[
 ['marketplace','Marketplace & Wallet'],['dashboard','Dashboard'],['intake','Case Intake'],['news','News'],['pacer','PACER Records'],['cases','Cases'],['dockets','Dockets'],['documents','Documents'],['evidence','Evidence'],
 ['transcripts','Transcripts'],['research','Legal Research'],['draft','AI Drafting'],['ensemble','Multi-model Motions'],['analyze','AI Analysis'],
 ['tasks','Tasks'],['deadlines','Deadlines'],['alerts','Alerts'],['audit','Audit & Compliance'],['admin','Administration']
];

export default function Home(){
 return <AuthGate><Workspace/></AuthGate>;
}

function Workspace(){
 const API=useMemo(()=>process.env.NEXT_PUBLIC_API_BASE_URL||'/api',[]);
 const [tab,setTab]=useState('dashboard'),[data,setData]=useState<any>(null),[busy,setBusy]=useState(false),[q,setQ]=useState('');
 const [form,setForm]=useState<any>({case_number:'',court_name:'',court_level:'federal',title:'',status:'open',stage:''});
 const [error,setError]=useState('');
 const [aiModels,setAiModels]=useState<any[]>([]),[aiProvider,setAiProvider]=useState(''),[aiConsent,setAiConsent]=useState(false);
 useEffect(()=>{fetch(API+'/ai/providers').then(r=>r.ok?r.json():[]).then(rows=>{setAiModels(rows);setAiProvider(rows.find((p:any)=>p.enabled&&p.is_default)?.id||rows.find((p:any)=>p.enabled)?.id||'');}).catch(()=>{});},[API]);
 const aiExternal=!!aiModels.find(p=>p.id===aiProvider)?.external;
 const [aiText,setAiText]=useState(''),[aiResult,setAiResult]=useState('');
 async function get(path:string){const r=await fetch(API+path);return readResponse(r)}
 async function post(path:string,body:any){const r=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return readResponse(r)}
 async function load(){if(tab==='search')return;setBusy(true);setError('');try{if(tab==='dashboard')setData(await get('/dashboard'));else if(['cases','dockets','documents','evidence','transcripts','research','tasks','deadlines','alerts','audit'].includes(tab))setData(await get('/'+tab));else setData(null)}catch(e:any){setError(e.message||'Unable to load records.')}finally{setBusy(false)}}
 useEffect(()=>{load()},[tab]);
 async function addCase(){if(!form.case_number.trim()||!form.title.trim()){setError('Enter a case number and title.');return}setBusy(true);setError('');try{await post('/cases',form);setForm({case_number:'',court_name:'',court_level:'federal',title:'',status:'open',stage:''});await load()}catch(e:any){setError(e.message||'Unable to create case.')}finally{setBusy(false)}}
 async function analyze(){setBusy(true);setError('');setAiResult('');try{const r=await post('/ai/analyze',{text:aiText,task:'legal record analysis',provider:aiProvider,allow_external:aiConsent});setAiResult(r.analysis)}catch(e:any){setError(e.message||'AI analysis failed.')}finally{setBusy(false)}}
 async function draft(){setBusy(true);setError('');setAiResult('');try{const r=await post('/ai/draft',{filing_type:'legal memorandum',inputs:{source:aiText},tone:'formal',provider:aiProvider,allow_external:aiConsent});setAiResult(r.draft_markdown)}catch(e:any){setError(e.message||'Draft generation failed.')}finally{setBusy(false)}}
 async function search(){if(!q.trim())return;setBusy(true);setError('');try{setData(await get('/search?q='+encodeURIComponent(q)));setTab('search')}catch(e:any){setError(e.message||'Search failed.')}finally{setBusy(false)}}
 return <div className="shell">
  <aside><div className="brand"><img className="brandLogo" src="/justisolve-logo.png" alt="JustiSolve — Intelligent Solutions. Fairer Justice." width={1536} height={1024}/><span className="brandSlogan">Intelligent Solutions. Fairer Justice.</span></div>
   <nav>{modules.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
   <div className="asideFoot"><span>Service status unverified</span><small>Development workspace</small></div>
  </aside>
  <main>
   <header><div><h1>{modules.find(x=>x[0]===tab)?.[1]||'Search Results'}</h1><p>Cases, records, evidence, research, deadlines and AI in one workspace.</p></div>
    <div className="search"><input placeholder="Global search…" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()}/><button onClick={search}>Search</button></div>
   </header>
   {error&&<div className="panel error" role="alert">{error}</div>}
   {busy&&<div className="notice">Working…</div>}
   {tab==='intake'&&<Intake/>}
   {tab==='news'&&<NewsFeed/>}
   {tab==='marketplace'&&<Marketplace api={API}/>}
   {tab==='pacer'&&<Pacer api={API}/>}
   {tab==='ensemble'&&<Ensemble api={API}/>}
   {tab==='dashboard'&&<section className="cards">{['cases','documents','evidence','tasks','deadlines','alerts'].map(k=><article key={k}><small>{k.toUpperCase()}</small><strong>{data?.[k]??'—'}</strong><span>Current workspace</span></article>)}</section>}
   {tab==='dashboard'&&<section className="panel"><h2>Quick Actions</h2><div className="actions"><button onClick={()=>setTab('cases')}>New case</button><button onClick={()=>setTab('evidence')}>Evidence</button><button onClick={()=>setTab('analyze')}>Analyze record</button><button onClick={()=>setTab('draft')}>Draft filing</button><button onClick={()=>setTab('deadlines')}>Deadlines</button><button onClick={()=>setTab('research')}>Research</button></div></section>}
   {tab==='cases'&&<><section className="panel"><h2>Create Case</h2><div className="formGrid">{Object.keys(form).map(k=><input key={k} placeholder={k.replaceAll('_',' ')} value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>)}</div><button className="primary" disabled={busy} onClick={addCase}>Create Case</button></section><Table data={data}/></>}
   {['dockets','documents','evidence','transcripts','research','tasks','deadlines','alerts','audit','search'].includes(tab)&&<Table data={data}/>}
   {(tab==='analyze'||tab==='draft')&&<section className="aiGrid"><div className="panel"><h2>{tab==='draft'?'Draft Workspace':'AI Record Analysis'}</h2><p className="muted">Paste authorized source material. AI output must be verified against the record and controlling law.</p><label>AI model<select value={aiProvider} onChange={e=>{setAiProvider(e.target.value);setAiConsent(false);}}>{aiModels.filter(p=>p.enabled).map(p=><option key={p.id} value={p.id}>{p.label}{p.is_default?' (latest default)':''}</option>)}</select></label>{aiExternal&&<label><input type="checkbox" checked={aiConsent} onChange={e=>setAiConsent(e.target.checked)}/>I authorize sending these sources to the selected hosted AI model. Provider charges may apply.</label>}<textarea value={aiText} onChange={e=>setAiText(e.target.value)} placeholder="Paste source text, facts, transcript excerpt, order, or drafting instructions…"/><button className="primary" disabled={!aiText||busy||!aiProvider||(aiExternal&&!aiConsent)} onClick={tab==='draft'?draft:analyze}>{tab==='draft'?'Generate Draft':'Analyze'}</button></div><div className="panel"><h2>Output</h2><pre>{aiResult||'No output yet.'}</pre></div></section>}
   {tab==='admin'&&<Admin api={API}/>}
   <footer><a href="/news">News</a> · <a href="/policies">Terms, Privacy & AI Policies</a></footer>
  </main>
 </div>
}
async function readResponse(r:Response){
 if(!r.ok){
  if(r.status===401)throw new Error('Your session has expired. Reload the page and sign in again.');
  let message='Unable to complete the request. Please try again.';
  try{const data=await r.json();if(typeof data.message==='string')message=data.message;}catch{}
  throw new Error(message);
 }
 return r.json();
}
function Table({data}:{data:any}){if(data?.error)return <section className="panel error">{data.error}</section>;if(!Array.isArray(data))return null;if(!data.length)return <section className="panel muted">No records yet.</section>;const keys=Object.keys(data[0]).slice(0,7);return <section className="panel tableWrap"><table><thead><tr>{keys.map(k=><th key={k}>{k.replaceAll('_',' ')}</th>)}</tr></thead><tbody>{data.map((r:any,i:number)=><tr key={i}>{keys.map(k=><td key={k}>{typeof r[k]==='object'?JSON.stringify(r[k]):String(r[k]??'')}</td>)}</tr>)}</tbody></table></section>}
