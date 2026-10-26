/* ELV Project Tracker — web app (Supabase backend). All permissions are enforced in the database. */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';

const CFG = window.TRACKER_CONFIG || {};
// Accept the URL however it was pasted (e.g. with /rest/v1/ or a trailing slash) — the client needs just https://xxxx.supabase.co
const SB_URL = (()=>{try{return new URL(String(CFG.SUPABASE_URL||'').trim()).origin}catch(e){return ''}})();
const SB_KEY = String(CFG.SUPABASE_ANON_KEY||'').trim();
const sb = window.__SB__ || (SB_URL && SB_KEY && !/YOUR-PROJECT/.test(SB_URL) ? createClient(SB_URL, SB_KEY) : null);
const BUCKET = 'project-docs';

/* ---------- constants ---------- */
const SEC_COLORS=['#24425E','#0E8C8C','#7A4FC9','#C23B30','#D9731A','#5D6B7E','#2F8F5B','#8A6D1F','#B0417A','#3B7A99'];
const APPROVAL=['','Pending','Submitted','Approved','NA'];
const FIELDS=[
  {k:'section',l:'ELV system',cat:'data'},{k:'sr',l:'Sr. no.',cat:'data'},
  {k:'desc',l:'Item',cat:'data',type:'textarea',wide:1},
  {k:'make',l:'Make',cat:'data'},{k:'model',l:'Model',cat:'data'},
  {k:'qty',l:'BOQ qty',cat:'data',num:1},{k:'unit',l:'Unit',cat:'data'},{k:'woQty',l:'New WO qty',cat:'data',num:1},
  {k:'vendor',l:'PO vendor',cat:'data'},{k:'poDate',l:'PO date',cat:'data',type:'date'},{k:'contractor',l:'WO contractor',cat:'data'},
  {k:'drawing',l:'Drawing approval',cat:'status',opts:APPROVAL},{k:'drawingDate',l:'Drawing status date',cat:'status',type:'date'},
  {k:'tds',l:'TDS approval',cat:'status',opts:APPROVAL},{k:'tdsDate',l:'TDS status date',cat:'status',type:'date'},
  {k:'expStatus',l:'Delivery status',cat:'status',opts:['','Pending','Dispatched','Partial','Delivered','NA']},
  {k:'pendingReason',l:'Pending reason',cat:'status',wide:1},
  {k:'delayReason',l:'Reason for delay',cat:'status',wide:1},
  {k:'remarks',l:'Remarks',cat:'status',type:'textarea',wide:1},
  {k:'delivered',l:'Delivered',cat:'opening',num:1},{k:'deliveryDate',l:'Delivery date',cat:'opening',type:'date'},
  {k:'billMat',l:'Supply billed',cat:'opening',num:1},{k:'billMatDate',l:'Supply bill date',cat:'opening',type:'date'},
  {k:'billInst',l:'Installation billed',cat:'opening',num:1},{k:'billInstDate',l:'Installation bill date',cat:'opening',type:'date'},
  {k:'installed',l:'Installed',cat:'opening',num:1},{k:'installDate',l:'Installation date',cat:'opening',type:'date'},
  {k:'tested',l:'Tested',cat:'opening',num:1},{k:'testDate',l:'Testing date',cat:'opening',type:'date'},
  {k:'commissioned',l:'Commissioned',cat:'opening',num:1},{k:'commissionDate',l:'Commissioning date',cat:'opening',type:'date'},
  {k:'handedOver',l:'Handed over',cat:'opening',num:1},{k:'handoverDate',l:'Handing over date',cat:'opening',type:'date'},
];
const FMAP=Object.fromEntries(FIELDS.map(f=>[f.k,f]));
const CATS=[
  {k:'data',l:'Item data',hint:'Description, quantities, make, model, vendor, contractor'},
  {k:'status',l:'Status & remarks',hint:'Drawing & TDS approval, pending and delay reasons, remarks'},
  {k:'delivery',l:'Delivery',hint:'Delivered quantity lots with date and challan'},
  {k:'install',l:'Installation',hint:'Installed quantity lots with date and location'},
  {k:'testing',l:'Testing',hint:'Tested quantity lots with date'},
  {k:'commission',l:'Commissioning',hint:'Commissioned quantity lots with date'},
  {k:'handover',l:'Handing over',hint:'Quantity handed over to the client, with date'},
  {k:'billing',l:'Billing',hint:'Billed quantity lots with invoice / RA bill details'},
  {k:'docs',l:'Documents',hint:'Approved drawings, TDS, approval letters, challans and RA bills'},
];
const CATMAP=Object.fromEntries(CATS.map(c=>[c.k,c]));
const CAT_FIELDS={data:FIELDS.filter(f=>f.cat==='data').map(f=>f.k),status:FIELDS.filter(f=>f.cat==='status').map(f=>f.k)};
const KINDS=['delivery','install','testing','commission','handover','billing'];
// per lot kind: total/date keys on merged items, opening (Excel) keys, reference label
const KIND={delivery:{tot:'dTot',date:'dDate',open:'delivered',openDate:'deliveryDate',ref:'Challan / DC no.',done:'Delivered'},
  install:{tot:'iTot',date:'iDate',open:'installed',openDate:'installDate',ref:'Location / area',done:'Installed'},
  testing:{tot:'tTot',date:'tDate',open:'tested',openDate:'testDate',ref:'Test report / area',done:'Tested'},
  commission:{tot:'cTot',date:'cDate',open:'commissioned',openDate:'commissionDate',ref:'Commissioning report / area',done:'Commissioned'},
  handover:{tot:'hTot',date:'hDate',open:'handedOver',openDate:'handoverDate',ref:'Handover document / area',done:'Handed over'},
  billing:{ref:'Invoice / RA bill no.'}};
const LVL_LABEL={edit:'Can edit',request:'Needs approval',none:'Only see',hide:'No access'};
const DEFAULT_LEVELS={data:'none',status:'request',delivery:'request',install:'request',testing:'request',commission:'request',handover:'request',billing:'hide',docs:'none'};
const DOCSECS=[{k:'drawing',l:'Approved drawings',sys:1,no:'Drawing no.',rev:1},{k:'tds',l:'Approved TDS',sys:1,no:'TDS / datasheet ref.',rev:1},{k:'letter',l:'Approval letters',no:'Letter ref. no.'},{k:'challan',l:'Delivery challans',no:'Challan / DC no.',needs:'delivery'},{k:'rabill',l:'RA bills',no:'RA bill no.',needs:'billing'}];
const DOCMAP=Object.fromEntries(DOCSECS.map(d=>[d.k,d]));
const DOC_EXT=['dwg','dxf','pdf','xls','xlsx','xlsm','csv','doc','docx','jpg','jpeg','png'];
const KEEP_DAYS=7;

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{if(v===''||v==null)return null;const n=typeof v==='number'?v:parseFloat(String(v).replace(/,/g,''));return Number.isFinite(n)?n:null};
const fmtN=v=>{const n=num(v);return n==null?'':n.toLocaleString('en-IN',{maximumFractionDigits:2})};
const inr=v=>{v=v||0;const a=Math.abs(v);return '₹'+(a>=1e7?(v/1e7).toFixed(2)+' Cr':a>=1e5?(v/1e5).toFixed(2)+' L':Math.round(v).toLocaleString('en-IN'))};
const pct=f=>Math.round((f||0)*100)+'%';
const today=()=>{const d=new Date();return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10)};
const fmtTime=t=>t?new Date(t).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'';
const fmtDate=d=>d?new Date(String(d).slice(0,10)+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'';
const lsGet=k=>{try{return localStorage.getItem('elvt:'+k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem('elvt:'+k,v??'')}catch(e){}};
const same=(a,b)=>String(a??'')===String(b??'');
function coerce(k,v){const f=FMAP[k];if(!f)return null;if(f.num)return num(v);if(f.type==='date'){const s=String(v??'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:''}return String(v??'').trim().slice(0,5000)}
const fmtVal=(k,v)=>v==null||v===''?'':(FMAP[k]&&FMAP[k].type==='date'?fmtDate(v):FMAP[k]&&FMAP[k].num?fmtN(v):String(v));
const fmtSize=b=>!b?'':b>=1048576?(b/1048576).toFixed(1)+' MB':Math.max(1,Math.round(b/1024))+' KB';
function toast(msg,ms=3600){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),ms)}
const errMsg=e=>{const m=(e&&(e.message||e.error_description))||'Something went wrong. Check your connection and try again.';
  if(/invalid api key|no api key|unregistered api key|legacy api keys are disabled/i.test(m))return 'The database rejected the key in config.js ('+m+'). Copy the key again from Supabase → Project Settings → API Keys.';
  if(/invalid path specified|failed to fetch|networkerror|load failed/i.test(m))return 'Can’t reach the database at '+(SB_URL||'(no URL)')+' ('+m+'). Check SUPABASE_URL in config.js, and that the Supabase project isn’t paused.';
  if(/could not find the function|schema cache/i.test(m))return 'The database isn’t set up yet: run supabase/schema.sql in the Supabase SQL Editor.';
  return m};
async function rpc(fn,args={}){const {data,error}=await sb.rpc(fn,args);if(error)throw error;return data}
function askConfirm(msg,okLabel='OK',danger=false){return new Promise(res=>{let el=document.getElementById('cfm');if(!el){el=document.createElement('div');el.id='cfm';document.body.appendChild(el)}
  el.innerHTML=`<div class="cfm-box" role="alertdialog" aria-modal="true"><p></p><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-c="0">Cancel</button><button class="btn ${danger?'danger':'pri'}" data-c="1">${esc(okLabel)}</button></div></div>`;
  el.querySelector('p').textContent=msg;el.classList.add('open');
  const done=v=>{el.classList.remove('open');el.innerHTML='';document.removeEventListener('keydown',key,true);res(v)};
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();e.preventDefault();done(false)}else if(e.key==='Enter'){e.preventDefault();done(true)}};
  document.addEventListener('keydown',key,true);
  el.onclick=e=>{const b=e.target.closest('[data-c]');if(b)done(b.dataset.c==='1');else if(e.target===el)done(false)};
  setTimeout(()=>{const b=el.querySelector('[data-c="1"]');b&&b.focus()},20)})}

/* ---------- state ---------- */
const S={session:null,me:null,auth:'loading',authMsg:'',projects:[],pd:{},pid:null,M:{items:[],lots:[]},
  view:['overview','projects','project','admins'].includes(lsGet('view'))?lsGet('view'):'overview',ptab:lsGet('ptab')||'tracker',
  q:'',sec:'',st:'',flag:false,reqTab:'pending',docSec:'drawing',docQ:'',drawerId:undefined,members:null,admins:null,loadingPid:null};
const isAdmin=()=>!!(S.me&&S.me.admin);
const cur=()=>S.projects.find(p=>p.id===S.pid);
const PD=()=>S.pd[S.pid]||null;
const myLevel=c=>isAdmin()?'admin':((PD()&&PD().levels)||{})[c]||'hide';
const canView=c=>!c||myLevel(c)!=='hide';
const canWrite=c=>['admin','edit','request'].includes(myLevel(c));
const levelsFor=p=>isAdmin()?null:(p.levels||{});
const pCanView=(p,c)=>isAdmin()||((p.levels||{})[c]||'hide')!=='hide';
const isDone=p=>['Completed','Closed'].includes(p&&p.status);
const docSecOk=(sec,vf)=>{const d=DOCMAP[sec];return !!d&&(!d.needs||vf(d.needs))};

/* ---------- domain ---------- */
function target(it){const w=num(it.woQty);return w!=null&&w>0?w:num(it.qty)}
function trackable(it){const t=target(it);return !it.header&&t>0}
function merge(pd){
  const lots=(pd.lots||[]);const by={};lots.forEach(l=>(by[l.item_id]=by[l.item_id]||[]).push(l));
  const items=(pd.items||[]).map(it=>{const m={...it};const ls=by[it.id]||[];
    let d=num(it.delivered)||0,i=num(it.installed)||0,te=num(it.tested)||0,co=num(it.commissioned)||0,ho=num(it.handedOver)||0,bm=num(it.billMat)||0,bi=num(it.billInst)||0;
    let dd=it.deliveryDate||'',idt=it.installDate||'',ist=it.installDate||'',ted=it.testDate||'',cod=it.commissionDate||'',hod=it.handoverDate||'',bmd=it.billMatDate||'',bid=it.billInstDate||'';
    ls.forEach(l=>{if(l.status!=='approved'||l.deleted)return;const q=num(l.qty)||0,dt=l.date||'';
      if(l.kind==='delivery'){d+=q;if(dt>dd)dd=dt}
      else if(l.kind==='install'){i+=q;if(dt>idt)idt=dt;if(dt&&(!ist||dt<ist))ist=dt}
      else if(l.kind==='testing'){te+=q;if(dt>ted)ted=dt}
      else if(l.kind==='commission'){co+=q;if(dt>cod)cod=dt}
      else if(l.kind==='handover'){ho+=q;if(dt>hod)hod=dt}
      else if(l.bill==='installation'){bi+=q;if(dt>bid)bid=dt}
      else{bm+=q;if(dt>bmd)bmd=dt}});
    Object.assign(m,{dTot:d,iTot:i,tTot:te,cTot:co,hTot:ho,bmTot:bm,biTot:bi,dDate:dd,iDate:idt,iStart:ist,tDate:ted,cDate:cod,hDate:hod,bmDate:bmd,biDate:bid,_lots:ls});
    m.header=!!it.header||!(target(m)>0);return m});
  return{items,lots};
}
function fracs(it){const t=target(it);const f=v=>Math.min(Math.max(0,v||0)/t,1);return{d:f(it.dTot),i:f(it.iTot),t:f(it.tTot),c:f(it.cTot),h:f(it.hTot),b:f(it.bmTot)}}
function status(it){if(!trackable(it))return null;const t=target(it);
  if((it.hTot||0)>=t)return 'Handed over';if((it.cTot||0)>=t)return 'Commissioned';if((it.tTot||0)>=t)return 'Tested';if(it.iTot>=t)return 'Installed';if(it.iTot>0)return 'Part installed';if(it.dTot>=t)return 'Delivered';if(it.dTot>0)return 'Part delivered';if(it.vendor&&!/pending/i.test(it.vendor))return 'Ordered';return 'Awaiting PO'}
const ST_CLASS={'Handed over':'ok','Commissioned':'ok','Tested':'ok','Installed':'ok','Part installed':'ok','Delivered':'info','Part delivered':'warn','Ordered':'plain','Awaiting PO':'bad'};
const isOk=v=>/approved|^na$/i.test(String(v||'').trim());
function issues(it){if(!trackable(it))return [];const w=[];if(vSee('status')&&it.delayReason)w.push('Delay: '+it.delayReason);if(vSee('status')&&it.pendingReason)w.push('Pending: '+it.pendingReason);
  if(vSee('data')&&status(it)==='Awaiting PO')w.push('No PO placed');
  if(vSee('status')&&!isOk(it.drawing))w.push('Drawing '+(it.drawing?it.drawing.toLowerCase():'not submitted'));
  if(vSee('status')&&!isOk(it.tds))w.push('TDS '+(it.tds?it.tds.toLowerCase():'not submitted'));return w}
function stats(items){const tr=items.filter(trackable);let d=0,i=0,b=0,t=0,c=0,h=0;tr.forEach(it=>{const f=fracs(it);d+=f.d;i+=f.i;b+=f.b;t+=f.t;c+=f.c;h+=f.h});const n=tr.length;
  return{n,d:n?d/n:0,i:n?i/n:0,b:n?b/n:0,t:n?t/n:0,c:n?c/n:0,h:n?h/n:0,dr:n?tr.filter(x=>isOk(x.drawing)).length/n:0,ta:n?tr.filter(x=>isOk(x.tds)).length/n:0}}
function sections(items){const m=new Map();items.forEach(it=>{const k=it.section||'General';if(!m.has(k))m.set(k,[]);m.get(k).push(it)});return [...m].map(([name,list],i)=>({name,list,color:SEC_COLORS[i%SEC_COLORS.length]}))}
const secColor=name=>{const s=sections(S.M.items).find(x=>x.name===name);return s?s.color:SEC_COLORS[0]};
const twin=(d,i,cls='')=>`<div class="twin ${cls}" role="img" aria-label="Delivered ${pct(d)}, installed ${pct(i)}"><i style="--d:${(d*100).toFixed(1)}%"></i><b style="--i:${(i*100).toFixed(1)}%"></b></div>`;
const itemLabel=it=>`${it&&it.sr?it.sr+' · ':''}${String(it&&it.desc||'').replace(/\s+/g,' ').slice(0,90)}`;
const pendingAll=()=>{const pd=PD();if(!pd)return [];return [...(pd.lots||[]).filter(x=>x.status==='pending').map(x=>({...x,_t:'lot'})),...(pd.changes||[]).filter(x=>x.status==='pending').map(x=>({...x,_t:'change'})),...(pd.docs||[]).filter(x=>x.status==='pending').map(x=>({...x,_t:'doc'}))]};
const STATE_CHIP={approved:['ok','Recorded'],pending:['warn','Pending request'],rejected:['bad','Rejected'],removed:['bad','Removed']};
function stateChip(r){let [c,l]=STATE_CHIP[r.status]||['plain',r.status];if(r.status==='approved'&&!r.direct)l='Approved';return `<span class="st ${c}">${l}</span>`}

/* ---------- data loading ---------- */
async function loadProjects(){
  S.projects=(await rpc('my_projects'))||[];
  if(isAdmin()&&!S._purged){S._purged=true;purgeExpired()}
  const live=S.projects.filter(p=>!p.deleted_at);
  if(!S.pid||!live.find(p=>p.id===S.pid)){const last=lsGet('pid');const pick=live.find(p=>p.id===last)||live.find(p=>!isDone(p))||live[0];S.pid=pick?pick.id:null}
}
async function loadPD(pid,force){
  if(!pid)return null;if(!force&&S.pd[pid]&&Date.now()-S.pd[pid]._at<60000)return S.pd[pid];
  const d=await rpc('project_data',{pid});d._at=Date.now();d._merged=merge(d);S.pd[pid]=d;return d;
}
async function refresh(force=true){
  try{await loadProjects();if(S.pid&&S.view==='project')await loadPD(S.pid,force);
    if(S.view==='overview')await Promise.all(S.projects.filter(p=>!p.deleted_at&&!isDone(p)).map(p=>loadPD(p.id,force).catch(()=>null)));
    if(S.view==='projects')await Promise.all(S.projects.filter(p=>!p.deleted_at).map(p=>loadPD(p.id,false).catch(()=>null)));
    if(S.view==='project'&&S.ptab==='access'&&isAdmin())S.members=await rpc('list_members',{pid:S.pid});
    if(S.view==='admins'&&isAdmin())S.admins=await rpc('list_admins');
  }catch(e){toast(errMsg(e),6000)}
  render();
}
async function after(promise,okMsg){try{const r=await promise;if(okMsg)toast(okMsg);await refresh(true);return r}catch(e){toast(errMsg(e),6000);throw e}}
async function purgeExpired(){try{const ids=await rpc('expired_projects');for(const pid of ids||[]){const paths=await rpc('purge_project',{pid});if(paths&&paths.length)await sb.storage.from(BUCKET).remove(paths)}if((ids||[]).length)refresh()}catch(e){}}

/* ---------- auth ---------- */
async function initAuth(){
  if(!sb){S.auth='config';render();return}
  sb.auth.onAuthStateChange((ev,session)=>{
    if(ev==='PASSWORD_RECOVERY'){S.session=session;S.auth='reset';render();return}
    if(ev==='SIGNED_OUT'){S.session=null;S.me=null;S.auth='signin';S.pd={};S.projects=[];render();return}
    if(session&&S.auth!=='reset'&&(!S.session||S.session.user.id!==session.user.id)){S.session=session;startApp()}
  });
  const {data}=await sb.auth.getSession();
  if(data&&data.session){if(S.auth==='loading'){S.session=data.session;startApp()}}else if(S.auth==='loading'){S.auth='signin';render()}
}
async function startApp(){
  S.auth='loading';render();
  try{S.me=await rpc('whoami');S.auth='app';await refresh(false)}catch(e){S.auth='signin';S.authMsg=errMsg(e);render()}
}
function vAuth(){
  const brand=`<div class="authlogo"><span class="logo-chip"><img src="atronic-logo.png" alt="Atronic — Solution Re Imagined"></span><div class="t">Project Tracker</div></div>`;
  const foot=`<div class="authfoot">Atronic Systems Pvt. Ltd · <a href="https://www.atronic.co.in" target="_blank" rel="noopener">www.atronic.co.in</a></div>`;
  const msg=S.authMsg?`<div class="err" role="alert">${esc(S.authMsg)}</div>`:'';
  if(S.auth==='config')return `<div class="auth"><div class="authbox">${brand}<h1>Almost there</h1><p class="muted">Open <code>config.js</code> and fill in your Supabase project URL and anon key, then reload. See README.md for the steps.</p></div>${foot}</div>`;
  if(S.auth==='loading')return `<div class="empty"><span class="spin"></span></div>`;
  if(S.auth==='signup')return `<div class="auth"><form class="authbox" data-submit="signup">${brand}<h1>Create your account</h1><p class="muted" style="margin:0 0 14px">Use the email address your admin added to the project.</p>
    <div class="form"><label>Your name<input name="name" required autocomplete="name"></label><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" minlength="8" required autocomplete="new-password"></label></div>${msg}
    <button class="btn pri" style="margin-top:16px">Create account</button><div class="authlinks"><button type="button" class="lnk" data-act="authMode" data-m="signin">I already have an account</button></div></form>${foot}</div>`;
  if(S.auth==='forgot')return `<div class="auth"><form class="authbox" data-submit="forgot">${brand}<h1>Reset your password</h1><p class="muted" style="margin:0 0 14px">We’ll email you a link to set a new password.</p>
    <div class="form"><label>Email<input name="email" type="email" required autocomplete="email"></label></div>${msg}<button class="btn pri" style="margin-top:16px">Send reset link</button>
    <div class="authlinks"><button type="button" class="lnk" data-act="authMode" data-m="signin">Back to sign in</button></div></form>${foot}</div>`;
  if(S.auth==='reset')return `<div class="auth"><form class="authbox" data-submit="reset">${brand}<h1>Set a new password</h1>
    <div class="form"><label>New password<input name="password" type="password" minlength="8" required autocomplete="new-password"></label></div>${msg}<button class="btn pri" style="margin-top:16px">Save password</button></form>${foot}</div>`;
  if(S.auth==='checkmail')return `<div class="auth"><div class="authbox">${brand}<h1>Check your email</h1><p class="muted">${esc(S.authMsg2||'We sent you a link. Open it to continue.')}</p><div class="authlinks"><button class="lnk" data-act="authMode" data-m="signin">Back to sign in</button></div></div>${foot}</div>`;
  return `<div class="auth"><form class="authbox" data-submit="signin">${brand}<h1>Sign in</h1>
    <div class="form"><label>Email<input name="email" type="email" required autocomplete="email"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label></div>${msg}
    <button class="btn pri" style="margin-top:16px">Sign in</button>
    <div class="authlinks"><button type="button" class="lnk" data-act="authMode" data-m="signup">Create an account</button><button type="button" class="lnk" data-act="authMode" data-m="forgot">Forgot password?</button></div></form>${foot}</div>`;
}
async function authSubmit(kind,form){
  const v=Object.fromEntries(new FormData(form));const btn=form.querySelector('button.pri');btn.disabled=true;S.authMsg='';
  try{
    if(kind==='signin'){const {error}=await sb.auth.signInWithPassword({email:v.email.trim(),password:v.password});if(error)throw error}
    else if(kind==='signup'){const {data,error}=await sb.auth.signUp({email:v.email.trim(),password:v.password,options:{data:{name:v.name.trim()},emailRedirectTo:location.origin+location.pathname}});if(error)throw error;
      if(!data.session){S.auth='checkmail';S.authMsg2=`We sent a confirmation link to ${v.email.trim()}. Open it, then sign in.`;render()}}
    else if(kind==='forgot'){const {error}=await sb.auth.resetPasswordForEmail(v.email.trim(),{redirectTo:location.origin+location.pathname});if(error)throw error;S.auth='checkmail';S.authMsg2=`If ${v.email.trim()} has an account, a reset link is on its way.`;render()}
    else if(kind==='reset'){const {error}=await sb.auth.updateUser({password:v.password});if(error)throw error;toast('Password updated.');S.auth='loading';startApp()}
  }catch(e){S.authMsg=/invalid login/i.test(errMsg(e))?'Email or password is wrong.':/not confirmed/i.test(errMsg(e))?'Confirm your email first — check your inbox for the link.':errMsg(e);btn.disabled=false;render()}
}

/* ---------- render ---------- */
let rq=0;function render(){if(rq)return;rq=requestAnimationFrame(()=>{rq=0;doRender()})}
function doRender(){
  if(S.auth!=='app'){$('#app').innerHTML=vAuth();return}
  const pd=PD();S.M=pd?pd._merged:{items:[],lots:[]};
  const a=document.activeElement,inD=a&&a.closest&&a.closest('#drawer');const aid=!inD&&a&&a.id,sel=aid&&('selectionStart' in a)?[a.selectionStart,a.selectionEnd]:null;
  const sig=[S.view,S.pid,S.ptab,S.docSec].join('|');const keep={};if(S._sig===sig)document.querySelectorAll('#main input,#main select,#main textarea').forEach(el=>{const k=el.id||el.name;if(k&&el.type!=='checkbox'&&!el.dataset.change&&!el.dataset.input&&(el.type!=='file'||el.files.length))keep[k]=el.type==='file'?el:el.value});S._sig=sig;
  $('#app').innerHTML=header()+nav()+`<main id="main">${view()}</main>`;
  document.querySelectorAll('#main input,#main select,#main textarea').forEach(el=>{const k=el.id||el.name;if(k&&k in keep&&!el.dataset.change&&!el.dataset.input){if(el.type==='file')el.replaceWith(keep[k]);else el.value=keep[k]}});
  if(aid){const n=document.getElementById(aid);if(n){n.focus();if(sel)try{n.setSelectionRange(sel[0],sel[1])}catch(e){}}}
  if(S.drawerId!==undefined)refreshDrawer();
}
function header(){const n=S.me.name||S.me.email;const ini=n.replace(/@.*/,'').split(/[\s._-]+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  return `<header class="top"><div class="brand"><span class="logo-chip"><img class="logo" src="atronic-wordmark.png" alt="Atronic"></span><span class="bdiv" aria-hidden="true"></span><div><div class="b1">Project Tracker</div><div class="b2">ELV & IT installation progress</div></div></div>
  <button class="refresh" data-act="refresh" title="Reload data">↻ Refresh</button>
  <div class="umenu"><button class="who" data-act="umenu" aria-haspopup="true"><span class="ini">${esc(ini)}</span><div style="text-align:left"><div class="wn">${esc(n)}</div><div class="role ${isAdmin()?'r-admin':'r-site'}">${isAdmin()?'Admin':'Team member'}</div></div></button>
    <div class="udrop" id="udrop"><button data-act="editName">Change my name</button><button data-act="changePw">Change password</button><button data-act="signOut">Sign out</button></div></div></header>`}
function nav(){const tabs=[['overview','Overview'],['projects','Projects'],...(isAdmin()?[['admins','Admins']]:[])];
  return `<nav class="tabs" aria-label="Sections">${tabs.map(([k,l])=>`<button data-act="view" data-v="${k}" ${S.view===k||(k==='projects'&&S.view==='project')?'aria-current="page"':''}>${l}</button>`).join('')}</nav>`}
function view(){
  const live=S.projects.filter(p=>!p.deleted_at);
  if(!isAdmin()&&!live.length)return `<div class="empty"><h1>No projects yet</h1><p class="muted" style="max-width:60ch;margin:0 auto">You’re signed in as <strong>${esc(S.me.email)}</strong>. An admin needs to add this email to a project’s Access list. Once they do, click Refresh.</p></div>`;
  if(S.view==='project')return vProject();if(S.view==='projects')return vProjects();if(S.view==='admins'&&isAdmin())return vAdmins();return vOverview();
}
function vEmpty(){return `<div class="empty"><h1>No projects yet</h1>${isAdmin()?`<p class="muted">Import a BOQ, or start from a blank project.</p><div class="row" style="justify-content:center;margin-top:16px"><button class="btn pri" data-act="newProject">+ New project</button></div>`:''}</div>`}

/* overview */
const METRICS=[['dr','Drawing approval','#7A4FC9','status'],['ta','TDS approval','#0E8C8C','status'],['d','Supply','var(--accent)','delivery'],['i','Installation','var(--ok)','install'],['t','Testing','#D9731A','testing']];
const mcell=(v,c)=>v==null?'<td class="num muted">—</td>':`<td><div class="mc"><span>${pct(v)}</span><div class="mb"><i style="width:${(v*100).toFixed(1)}%;background:${c}"></i></div></div></td>`;
function vOverview(){
  const live=S.projects.filter(p=>!p.deleted_at);if(!live.length)return vEmpty();
  const list=live.filter(p=>!isDone(p));const doneN=live.length-list.length;
  const link=`<button class="lnk" data-act="view" data-v="projects">Projects</button>`;
  if(!list.length)return `<h1 style="font-size:22px">Overview</h1><div class="panel muted" style="margin-top:14px">No ongoing projects. ${doneN} completed project${doneN===1?' is':'s are'} listed under ${link}.</div>`;
  const all=[];let complete=true;
  const rows=list.map(p=>{const pd=S.pd[p.id];const items=pd?pd._merged.items:null;if(items)all.push(...items);else complete=false;const st=items?stats(items):null;
    return `<tr><td><button class="lnk" style="font-size:14px;color:var(--ink)" data-act="openProject" data-id="${esc(p.id)}">${esc(p.name)}</button><div class="muted" style="font-size:12px">${st?st.n+' items':'<span class="spin"></span>'}</div></td>
    ${METRICS.map(([k,,c,cat])=>mcell(st&&st.n&&pCanView(p,cat)?st[k]:null,c)).join('')}</tr>`}).join('');
  const tot=isAdmin()&&complete&&list.length>1?stats(all):null;
  return `<h1 style="font-size:22px">Overview</h1><p class="muted" style="margin:4px 0 14px">Progress of ongoing projects. Click a project to open its tracker.${doneN?` Completed projects (${doneN}) are under ${link}.`:''}</p>
  <div class="tbl-wrap"><table class="ovt"><thead><tr><th>Project</th>${METRICS.map(([,l,c])=>`<th><span class="key" style="background:${c}"></span> ${l}</th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody>${tot?`<tfoot><tr><td><strong>All projects</strong><div class="muted" style="font-size:12px">${tot.n} items</div></td>${METRICS.map(([k,,c])=>mcell(tot[k],c)).join('')}</tr></tfoot>`:''}</table></div>
  <p class="muted" style="font-size:12.5px">Drawing and TDS approval: share of line items marked Approved (or NA). Supply, installation and testing: quantity done against the new WO quantity, averaged across line items with each item capped at 100%.</p>`;
}

/* projects */
function vProjects(){
  const admin=isAdmin();const live=S.projects.filter(p=>!p.deleted_at).sort((a,b)=>(isDone(a)-isDone(b))||String(a.name).localeCompare(String(b.name)));
  const cards=live.map((p,ix,arr)=>{const hdr=isDone(p)&&(ix===0||!isDone(arr[ix-1]))?`<h2 class="pgh">Completed (${arr.filter(isDone).length})</h2>`:(ix===0?`<h2 class="pgh">Ongoing (${arr.filter(x=>!isDone(x)).length})</h2>`:'');
    const pd=S.pd[p.id];const s=pd?stats(pd._merged.items):null;const cv=c=>pCanView(p,c);
    return hdr+`<div class="pcard ${isDone(p)?'done':''}"><div><h3>${esc(p.name)}</h3><div class="muted" style="font-size:13px">${esc([p.client,p.location].filter(Boolean).join(', '))||'&nbsp;'}</div></div>
    ${s?`${cv('delivery')&&cv('install')?twin(s.d,s.i):''}<div class="stat-line"><span>${s.n} items</span>${cv('delivery')?`<span>${pct(s.d)} delivered</span>`:''}${cv('install')?`<span>${pct(s.i)} installed</span>`:''}</div>`:'<div class="stat-line"><span class="spin"></span></div>'}
    <div class="stat-line"><span>${p.status==='Completed'?`<span class="st ok">Completed</span>${p.completed_at?' '+fmtDate(p.completed_at):''}`:esc(p.status||'Active')}</span><span>${p.target?'Target '+fmtDate(p.target):''}</span></div>
    <div class="row"><button class="btn pri" data-act="openProject" data-id="${esc(p.id)}">Open</button>
    ${admin?`<button class="btn" data-act="editProject" data-id="${esc(p.id)}">Edit details</button>${isDone(p)?`<button class="btn" data-act="reopenProject" data-id="${esc(p.id)}">Reopen</button>`:`<button class="btn ok" data-act="completeProject" data-id="${esc(p.id)}">Mark completed</button>`}<button class="btn danger" data-act="delProject" data-id="${esc(p.id)}">Delete</button>`:''}</div></div>`}).join('');
  return `<div class="row" style="margin-bottom:14px"><div><h1 style="font-size:22px">Projects</h1><p class="muted" style="margin:4px 0 0">${live.length} project${live.length===1?'':'s'}</p></div>
  ${admin?`<div class="row" style="margin-left:auto"><button class="btn pri" data-act="newProject">+ New project</button></div>`:''}</div>
  ${live.length?`<div class="pcards">${cards}</div>`:vEmpty()}${admin?trashSection():''}`;
}
function trashSection(){
  const t=S.projects.filter(p=>p.deleted_at).sort((a,b)=>String(b.deleted_at).localeCompare(String(a.deleted_at)));if(!t.length)return '';
  const until=p=>new Date(new Date(p.deleted_at).getTime()+KEEP_DAYS*864e5).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  return `<h2 class="pgh" style="margin-top:28px">Recently deleted (${t.length})</h2><p class="muted" style="font-size:12.5px;margin:4px 0 10px">Deleted projects are kept for ${KEEP_DAYS} days, then removed permanently. Only admins see this list.</p>
  <div class="tbl-wrap"><table class="stbl"><thead><tr><th>Project</th><th>Deleted</th><th>Removed permanently on</th><th></th></tr></thead><tbody>
  ${t.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${fmtTime(p.deleted_at)}${p.deleted_by_name?' by '+esc(p.deleted_by_name):''}</td><td>${until(p)}</td>
    <td style="white-space:nowrap;text-align:right"><button class="btn" data-act="restoreProject" data-id="${esc(p.id)}">Restore</button> <button class="btn danger" data-act="purgeNow" data-id="${esc(p.id)}">Delete now</button></td></tr>`).join('')}</tbody></table></div>`;
}

/* project shell */
function projOpts(){return S.projects.filter(p=>!p.deleted_at).map(x=>`<option value="${esc(x.id)}" ${x.id===S.pid?'selected':''}>${esc(x.name)}${isDone(x)?' (completed)':''}</option>`).join('')}
function projectBar(){
  const p=cur();const pc=isAdmin()?pendingAll().length:pendingAll().filter(r=>r.mine).length;
  const tabs=[['tracker','Tracker'],...(canView('docs')?[['docs','Documents']]:[]),['approvals','Pending update requests'],['activity','Activity'],['access','Access']];
  return `<div class="pbar2"><div class="crumb"><button class="lnk" data-act="view" data-v="projects">Projects</button><span class="muted">›</span>
    <label class="sr" for="projSel">Project</label><select id="projSel" data-change="proj">${projOpts()}</select>
    <span class="muted" style="font-size:13px">${esc([p.client,p.location].filter(Boolean).join(', '))}</span>
    ${isAdmin()?`<button class="btn" style="margin-left:auto" data-act="editProject" data-id="${esc(p.id)}">Project details</button>`:''}</div>
    <div class="seg ptabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-act="ptab" data-t="${k}" aria-pressed="${S.ptab===k}">${l}${k==='approvals'&&pc?`<span class="badge">${pc}</span>`:''}</button>`).join('')}</div></div>`;
}
function vProject(){
  if(!S.pid||!cur())return vProjects();
  if(!PD())return projectBar()+`<div class="panel muted"><span class="spin"></span> Loading project…</div>`;
  const b=S.ptab==='docs'&&canView('docs')?vDocs():S.ptab==='approvals'?vRequests():S.ptab==='activity'?vActivity():S.ptab==='access'?vAccess():vTracker();
  return projectBar()+b;
}

/* tracker */
// what the table shows: your own access, or (admins) the access of the person being previewed
const previewing=()=>isAdmin()&&S.asEmail&&(S.members||[]).find(m=>m.email===S.asEmail);
const vLv=c=>{const m=previewing();return m?((m.levels||{})[c]||'hide'):myLevel(c)};
const vSee=c=>!c||vLv(c)!=='hide';
const APPR_CLS={Approved:'ok',NA:'plain',Submitted:'info',Pending:'warn'};
const appr=(v,d)=>v?`<span class="st ${APPR_CLS[v]||'plain'}">${esc(v)}</span>${d?`<div class="mk">${esc(fmtDate(d))}</div>`:''}`:'<span class="muted">—</span>';
const PCOL={delivery:'var(--accent)',install:'var(--ok)',testing:'#D9731A',commission:'#0E7490',handover:'#B0417A',billing:'#7A4FC9'};
function prog(it,done,date,kind,extra){if(!trackable(it))return '';const t=target(it);const f=Math.min(Math.max(0,done||0)/t,1);
  return `<div class="pc ${done>=t?'full':''}" title="${fmtN(done||0)} of ${fmtN(t)} ${esc(it.unit||'')}"><div class="pv"><b>${fmtN(done||0)}</b><span>/ ${fmtN(t)}</span></div><div class="pb"><i style="width:${(f*100).toFixed(1)}%;background:${PCOL[kind]}"></i></div>${date||extra?`<div class="mk">${extra||''}${date?esc(fmtDate(date)):''}</div>`:''}</div>`}
const TCOLS=[
  {k:'sr',l:'Sr.',cls:'sk1',r:it=>esc(it.sr)},
  {k:'item',l:'Item',cls:'sk2',r:it=>`<div class="desc" title="${esc(it.desc)}">${esc(it.desc)}</div>`},
  {k:'system',l:'ELV system',off:1,r:it=>esc(it.section)},
  {k:'makeModel',cat:'data',l:'Make / Model',r:it=>it.make||it.model?`<div class="mm"><b>${esc(it.make)}</b>${it.model?`<div class="mk">${esc(it.model)}</div>`:''}</div>`:''},
  {k:'qty',l:'Qty',n:1,r:it=>{const w=num(it.woQty),q=num(it.qty);if(q==null&&w==null)return '';const main=w!=null&&w>0?w:q;
    return `<b>${fmtN(main)}</b> <span class="muted">${esc(it.unit)}</span>${w!=null&&w>0&&q!=null&&w!==q?`<div class="mk">BOQ ${fmtN(q)}</div>`:''}`}},
  {k:'drawing',cat:'status',l:'Drawing',r:it=>appr(it.drawing,it.drawingDate)},
  {k:'tds',cat:'status',l:'TDS',r:it=>appr(it.tds,it.tdsDate)},
  {k:'vendor',cat:'data',l:'PO vendor',r:it=>it.vendor||it.poDate?`${esc(it.vendor)}${it.poDate?`<div class="mk">PO ${esc(fmtDate(it.poDate))}</div>`:''}`:''},
  {k:'delivery',cat:'delivery',l:'Delivered',w:1,r:it=>prog(it,it.dTot,it.dDate,'delivery')},
  {k:'balance',cat:'delivery',l:'To deliver',n:1,off:1,r:it=>{if(!trackable(it))return '';const b=target(it)-it.dTot;return `<span class="${b<0?'neg':''}">${fmtN(b)}</span>`}},
  {k:'install',cat:'install',l:'Installed',w:1,r:it=>prog(it,it.iTot,it.iDate,'install',it.iStart&&it.iStart!==it.iDate?`from ${esc(fmtDate(it.iStart))} · `:'')},
  {k:'testing',cat:'testing',l:'Tested',w:1,r:it=>prog(it,it.tTot,it.tDate,'testing')},
  {k:'commission',cat:'commission',l:'Commissioned',w:1,r:it=>prog(it,it.cTot,it.cDate,'commission')},
  {k:'handover',cat:'handover',l:'Handed over',w:1,r:it=>prog(it,it.hTot,it.hDate,'handover')},
  {k:'supplyBill',cat:'billing',l:'Supply billed',w:1,r:it=>prog(it,it.bmTot,it.bmDate,'billing')},
  {k:'instBill',cat:'billing',l:'Installation billed',w:1,off:1,r:it=>prog(it,it.biTot,it.biDate,'billing')},
  {k:'status',l:'Status',r:it=>{const st=status(it);return st?`<span class="st ${ST_CLASS[st]}">${st}</span>`:''}},
  {k:'contractor',cat:'data',l:'WO contractor',off:1,r:it=>esc(it.contractor)},
  {k:'reasons',cat:'status',l:'Pending / delay reason',off:1,r:it=>`<div class="desc">${esc([it.pendingReason,it.delayReason].filter(Boolean).join(' · '))}</div>`},
  {k:'remarks',cat:'status',l:'Remarks',off:1,r:it=>`<div class="desc">${esc(it.remarks)}</div>`},
  {k:'rateW',l:'Rate (WO)',n:1,admin:1,off:1,r:it=>{const r=(PD().rates||{})[it.id]||{};return r.w?fmtN(r.w):''}},
  {k:'woTotal',l:'WO value',n:1,admin:1,r:it=>{const r=(PD().rates||{})[it.id]||{};return r.w?inr((target(it)||0)*r.w):''}},
];
const colOk=c=>(!c.admin||(isAdmin()&&!previewing()))&&vSee(c.cat)&&(c.k!=='status'||(vSee('delivery')&&vSee('install')));
function colPrefs(){try{return JSON.parse(lsGet('cols2')||'null')}catch(e){return null}}
function visibleCols(){const p=colPrefs();return TCOLS.filter(c=>colOk(c)&&(c.k==='item'||(p&&c.k in p?p[c.k]:!c.off)))}
function colsModal(){const v=new Set(visibleCols().map(c=>c.k));
  modal(`<h2>Columns</h2><p class="muted" style="margin:0 0 12px">Choose which columns the tracker shows on this device. Areas set to “No access” are never shown.</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 14px">${TCOLS.filter(c=>colOk(c)&&c.k!=='item').map(c=>`<label class="row" style="gap:6px;flex-wrap:nowrap"><input type="checkbox" data-col="${c.k}" ${v.has(c.k)?'checked':''}> ${esc(c.l)}</label>`).join('')}</div>
  <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn" data-act="colsReset">Reset</button><button class="btn pri" data-act="colsSave">Apply</button></div>`)}
function kpis(items){const x=stats(items);if(!x.n)return '';
  const k=[['Drawing approved',x.dr,'#7A4FC9','status'],['TDS approved',x.ta,'#0E8C8C','status'],['Delivered',x.d,'var(--accent)','delivery'],['Installed',x.i,'var(--ok)','install'],['Tested',x.t,'#D9731A','testing'],['Commissioned',x.c,'#0E7490','commission'],['Handed over',x.h,'#B0417A','handover'],['Supply billed',x.b,'#7A4FC9','billing']].filter(r=>vSee(r[3]));
  return `<div class="kpis"><div class="kpi"><div class="kv">${x.n}</div><div class="kl">Line items${S.sec?' · '+esc(S.sec):''}</div></div>${k.map(([l,v,c])=>`<div class="kpi"><div class="kv">${pct(v)}</div><div class="kl">${l}</div><div class="pb"><i style="width:${(v*100).toFixed(1)}%;background:${c}"></i></div></div>`).join('')}</div>`}
function vTracker(){
  if(isAdmin()&&!S.members&&!S._memLoading){S._memLoading=true;rpc('list_members',{pid:S.pid}).then(m=>{S.members=m;S._memLoading=false;render()},()=>{S._memLoading=false})}
  if(S.asEmail&&!previewing()&&S.members)S.asEmail='';
  const pv=previewing();
  const items=S.M.items;const secs=sections(items);const q=S.q.trim().toLowerCase();const pend=new Set(pendingAll().map(r=>r.item_id));const cols=visibleCols();
  const statuses=['Awaiting PO','Ordered','Part delivered','Delivered','Part installed','Installed','Tested','Commissioned','Handed over'];
  const match=it=>(!S.sec||it.section===S.sec)&&(!S.st||status(it)===S.st)&&(!S.flag||issues(it).length)&&(!q||[it.sr,it.desc,vSee('data')?[it.make,it.model,it.vendor,it.contractor].join(' '):'',vSee('status')?it.remarks:''].join(' ').toLowerCase().includes(q));
  let rows='',shown=0;
  secs.forEach(s=>{const list=s.list.filter(match);if(!list.length)return;const x=stats(s.list);
    const bits=[x.n+' items',vSee('delivery')?pct(x.d)+' delivered':'',vSee('install')?pct(x.i)+' installed':'',vSee('testing')?pct(x.t)+' tested':'',vSee('commission')?pct(x.c)+' commissioned':'',vSee('handover')?pct(x.h)+' handed over':'',vSee('billing')?pct(x.b)+' billed':''].filter(Boolean).join(' · ');
    rows+=`<tr class="grp" style="--c:${s.color}"><td colspan="${cols.length}"><div class="gin"><span class="chip" style="--c:${s.color}">${esc(s.name)}</span><span class="gs">${bits}</span>${vSee('delivery')&&vSee('install')?twin(x.d,x.i,'gtw'):''}</div></td></tr>`;
    list.forEach(it=>{shown++;const marks=`${issues(it).length?'<span class="dot f" title="Needs attention: '+esc(issues(it).join('; '))+'"></span>':''}${pend.has(it.id)?'<span class="dot r" title="Pending update request"></span>':''}`;
      rows+=`<tr class="it ${trackable(it)?'':'hd'}" data-act="open" data-id="${esc(it.id)}" tabindex="0">${cols.map(c=>`<td class="${[c.n?'num':'',c.cls||'',c.w?'pcell':''].join(' ')}">${c.r(it)}${c.k==='sr'?marks:''}</td>`).join('')}</tr>`})});
  const mem=isAdmin()?(S.members||[]):[];
  return `${isAdmin()&&mem.length?`<div class="row pvrow"><label for="asWho" class="muted" style="font-size:13px">View as</label><select id="asWho" data-change="asWho"><option value="">Admin — everything</option>${mem.map(m=>`<option value="${esc(m.email)}" ${S.asEmail===m.email?'selected':''}>${esc(m.name||m.email)}${m.name?' ('+esc(m.email)+')':''}</option>`).join('')}</select>
    ${pv?`<span class="pvnote">Previewing what <strong>${esc(pv.name||pv.email)}</strong> sees. Columns and totals for areas set to “No access” are hidden.</span>`:''}</div>`:''}
  ${kpis(S.sec?items.filter(i=>i.section===S.sec):items)}
  <div class="toolbar"><label class="sr" for="q">Search items</label><input type="search" id="q" placeholder="Search item${vSee('data')?', make, model, vendor':''}${vSee('status')?', remarks':''}" value="${esc(S.q)}" data-input="q">
    <select id="fsec" data-change="sec" aria-label="ELV system"><option value="">All ELV systems</option>${secs.map(s=>`<option ${S.sec===s.name?'selected':''}>${esc(s.name)}</option>`).join('')}</select>
    ${vSee('delivery')&&vSee('install')?`<select id="fst" data-change="st" aria-label="Status"><option value="">Any status</option>${statuses.map(s=>`<option ${S.st===s?'selected':''}>${s}</option>`).join('')}</select>`:''}
    <label class="row" style="gap:6px"><input type="checkbox" id="fflag" data-change="flag" ${S.flag?'checked':''}> Needs attention</label>
    <span style="margin-left:auto" class="row"><button class="btn" data-act="cols">Columns</button>${isAdmin()?'<button class="btn pri" data-act="newItem">Add line item</button>':''}<button class="btn" data-act="export">Export Excel</button></span></div>
  <div class="tbl-wrap tscroll"><table class="ttbl"><thead><tr>${cols.map(c=>`<th class="${[c.n?'num':'',c.cls||''].join(' ')}">${esc(c.l)}</th>`).join('')}</tr></thead>
  <tbody>${rows||`<tr><td colspan="${cols.length}" class="muted" style="padding:24px">${items.length?'No items match these filters.':'No line items yet.'+(isAdmin()?' Use “Add line item”.':'')}</td></tr>`}</tbody></table></div>
  <p class="muted" style="font-size:12.5px">${shown} of ${items.length} rows · Qty shows the new WO quantity (BOQ below when different) · Dates show the latest lot · <span class="dot f"></span> needs attention · <span class="dot r"></span> pending update request</p>`;
}

/* documents */
function vDocs(){
  const pd=PD();const lv=myLevel('docs');const canUp=['admin','edit','request'].includes(lv);
  const secs=DOCSECS.filter(d=>docSecOk(d.k,canView));if(!secs.length)return `<div class="panel muted">You don’t have access to any documents on this project.</div>`;
  if(!secs.find(d=>d.k===S.docSec))S.docSec=secs[0].k;const d=DOCMAP[S.docSec];
  const all=(pd.docs||[]).filter(r=>r.status!=='removed');const cnt=k=>all.filter(r=>r.sec===k&&r.status==='approved').length;const q=S.docQ.trim().toLowerCase();
  const list=all.filter(r=>r.sec===S.docSec&&(!q||[r.title,r.no,r.system,r.file_name,r.note].join(' ').toLowerCase().includes(q))).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created_at).localeCompare(String(a.created_at)));
  const systems=[...new Set([...sections(S.M.items).map(x=>x.name),...list.map(r=>r.system).filter(Boolean)])];
  const row=r=>{const canDel=isAdmin()||(r.mine&&(r.status==='pending'||r.direct)&&canUp);
    return `<tr><td><strong>${esc(r.title||r.file_name)}</strong>${r.note?`<div class="muted" style="font-size:12px">${esc(r.note)}</div>`:''}</td><td>${esc(r.no)}</td>${d.rev?`<td>${esc(r.rev)}</td>`:''}${!d.sys?`<td>${esc(r.system)}</td>`:''}<td>${esc(fmtDate(r.date))}</td>
    <td><span class="st plain">${esc(String(r.ext||'').toUpperCase())}</span> <span class="muted" style="font-size:12px">${fmtSize(r.size)}</span><div class="muted" style="font-size:12px;word-break:break-all">${esc(r.file_name)}</div></td>
    <td>${esc(r.created_by_name||'')}<div class="muted" style="font-size:12px">${fmtTime(r.created_at)}</div>${r.status==='approved'&&r.direct?'':stateChip(r)}</td>
    <td style="white-space:nowrap"><button class="btn" style="padding:4px 10px;font-size:12.5px" data-act="dlDoc" data-r="${esc(r.id)}">Download</button>${canDel?` <button class="lnk bad" data-act="delDoc" data-r="${esc(r.id)}">Delete</button>`:''}</td></tr>`};
  const head=`<tr><th>Title</th><th>${esc(d.no)}</th>${d.rev?'<th>Rev.</th>':''}${!d.sys?'<th>ELV system</th>':''}<th>Date</th><th>File</th><th>Uploaded by</th><th></th></tr>`;
  let body='';
  if(d.sys){systems.forEach((sy,i)=>{const g=list.filter(r=>r.system===sy);if(!g.length)return;body+=`<tr class="grp" style="--c:${SEC_COLORS[i%SEC_COLORS.length]}"><td colspan="8"><span class="chip" style="--c:${SEC_COLORS[i%SEC_COLORS.length]}">${esc(sy)}</span><span class="gs">${g.length} file${g.length===1?'':'s'}</span></td></tr>`+g.map(row).join('')});
    const other=list.filter(r=>!systems.includes(r.system));if(other.length)body+=other.map(row).join('')}else body=list.map(row).join('');
  const sysCount=d.sys?`<div class="row" style="gap:6px;margin:0 0 12px">${systems.map(sy=>{const n=list.filter(r=>r.system===sy&&r.status==='approved').length;return `<span class="st ${n?'ok':'plain'}">${esc(sy)} · ${n}</span>`}).join('')}</div>`:'';
  const form=canUp?`<div class="panel" style="margin-bottom:14px"><h2 style="margin-bottom:10px">Upload ${esc(d.l.replace(/s$/,'').toLowerCase())}</h2><div class="lotadd" style="background:none;padding:0">
    <label>ELV system${d.sys?' *':''}<select id="du_sys">${d.sys?'<option value="">Choose…</option>':'<option value="">— Not system-specific —</option>'}${systems.map(sy=>`<option>${esc(sy)}</option>`).join('')}</select></label>
    <label>Title<input id="du_title" placeholder="${d.sys?'e.g. CCTV layout – Ground floor':'Optional'}"></label><label>${esc(d.no)}<input id="du_no"></label>
    ${d.rev?'<label>Revision<input id="du_rev" placeholder="e.g. R2"></label>':''}<label>${d.sys?'Approval date':'Date'}<input id="du_date" type="date" value="${today()}"></label><label>Note<input id="du_note"></label>
    <label style="grid-column:1/-1">File (DWG, DXF, PDF, Excel, Word, CSV, JPG, PNG · max 50 MB)<input id="du_file" type="file" accept=".${DOC_EXT.join(',.')}"></label>
    <button class="btn pri" data-act="uploadDoc">${lv==='request'?'Upload for approval':'Upload'}</button></div></div>`:'';
  return `<div class="row" style="margin-bottom:12px"><div class="seg">${secs.map(x=>`<button data-act="docSec" data-k="${x.k}" aria-pressed="${S.docSec===x.k}">${esc(x.l)} (${cnt(x.k)})</button>`).join('')}</div>
    <input type="search" id="docq" data-input="docq" placeholder="Search title, number, file" value="${esc(S.docQ)}" style="margin-left:auto;min-width:220px;padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel)"></div>
  ${form}${sysCount}<div class="tbl-wrap"><table class="ttbl" style="min-width:860px"><thead>${head}</thead><tbody>${body||`<tr><td colspan="8" class="muted" style="padding:22px">No ${esc(d.l.toLowerCase())} uploaded yet.</td></tr>`}</tbody></table></div>`;
}
async function uploadDoc(btn){
  const sec=S.docSec;const d=DOCMAP[sec];const f=($('#du_file')||{}).files?.[0];if(!f){toast('Choose a file first.');return}
  const ext=(f.name.split('.').pop()||'').toLowerCase();if(!DOC_EXT.includes(ext)){toast('Allowed: DWG, DXF, PDF, Excel, Word, CSV, JPG, PNG.');return}
  if(f.size>50*1048576){toast('Files must be under 50 MB.');return}
  const system=($('#du_sys')||{}).value||'';if(d.sys&&!system){toast('Choose the ELV system.');return}
  const v=k=>(($('#'+k)||{}).value||'').trim();
  btn.disabled=true;btn.textContent='Uploading…';
  const path=`${S.pid}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]+/g,'_').slice(-80)}`;
  try{const up=await sb.storage.from(BUCKET).upload(path,f,{contentType:f.type||'application/octet-stream',upsert:false});if(up.error)throw up.error;
    try{const r=await rpc('add_document',{pid:S.pid,sec,system,title:v('du_title')||f.name,no:v('du_no'),rev:v('du_rev'),d:coerce('deliveryDate',v('du_date'))||today(),note:v('du_note'),file_path:path,file_name:f.name,size:f.size,ext});
      toast(r.status==='pending'?'Uploaded and sent for approval.':'Uploaded.');document.querySelectorAll('#main [id^=du_]').forEach(el=>{if(el.id!=='du_date'&&el.id!=='du_sys')el.value=''})}catch(e){await sb.storage.from(BUCKET).remove([path]);throw e}
    await refresh(true);
  }catch(e){toast(errMsg(e),6000);btn.disabled=false;btn.textContent='Upload'}
}
async function downloadDoc(r){try{const {data,error}=await sb.storage.from(BUCKET).download(r.file_path);if(error)throw error;saveBlob(data,r.file_name)}catch(e){toast(errMsg(e),6000)}}
function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},3000)}

/* pending update requests */
function reqText(r){const pd=PD();const it=(pd._merged.items||[]).find(x=>x.id===r.item_id);
  if(r._t==='doc')return `<strong>${esc(DOCMAP[r.sec].l.replace(/s$/,''))}</strong>${r.system?' · '+esc(r.system):''}: “${esc(r.title||r.file_name)}”${r.no?' ('+esc(r.no)+')':''} · ${esc(r.file_name)} (${fmtSize(r.size)}) <button class="lnk" data-act="dlDoc" data-r="${esc(r.id)}">Download</button>`;
  if(r._t==='lot'){const k=r.kind==='billing'?(r.bill==='installation'?'Installation billing':'Supply billing'):CATMAP[r.kind].l;
    return `<strong>${k}</strong> of ${fmtN(r.qty)} ${esc(it?it.unit||'':'')}${r.date?' on '+fmtDate(r.date):''}${r.ref?' ('+esc(r.ref)+')':''}`}
  return `<table class="chg"><tbody>${Object.entries(r.changes||{}).map(([k,v])=>`<tr><td class="muted">${esc(FMAP[k]?FMAP[k].l:k)}</td><td><span class="from">${esc(fmtVal(k,(r.before||{})[k]))||'—'}</span></td><td><strong>${esc(fmtVal(k,v))||'(cleared)'}</strong></td></tr>`).join('')}</tbody></table>`}
function vRequests(){
  const pd=PD();const admin=isAdmin();
  let list=[...(pd.lots||[]).map(x=>({...x,_t:'lot'})),...(pd.changes||[]).filter(x=>!x.direct).map(x=>({...x,_t:'change'})),...(pd.docs||[]).map(x=>({...x,_t:'doc'}))].filter(x=>!x.direct||x.status!=='approved');
  if(!admin)list=list.filter(r=>r.mine);
  const pend=list.filter(r=>r.status==='pending').sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
  const done=list.filter(r=>r.status!=='pending').sort((a,b)=>String(b.decided_at||'').localeCompare(String(a.decided_at||'')));
  const show=S.reqTab==='pending'?pend:done.slice(0,150);
  const card=r=>{const it=(pd._merged.items||[]).find(x=>x.id===r.item_id);
    return `<div class="req"><div class="h">${r._t==='doc'?'<span class="it">Document upload</span>':`<span class="it" data-act="open" data-id="${esc(r.item_id)}" style="cursor:pointer">${esc(it?itemLabel(it):'Deleted item')}</span>`}</div>
    <div class="muted" style="font-size:12.5px">${esc(r.created_by_name||'')} · ${fmtTime(r.created_at)}</div><div style="margin:10px 0">${reqText(r)}</div>
    ${r.note?`<p style="margin:0 0 10px"><span class="muted">Note:</span> ${esc(r.note)}</p>`:''}
    ${r.status!=='pending'?`<div>${stateChip(r)} <span class="muted" style="font-size:12.5px">${r.decided_by_name?'by '+esc(r.decided_by_name)+', ':''}${fmtTime(r.decided_at)}${r.decision_note?' — '+esc(r.decision_note):''}</span></div>`
      :admin?`<div class="row"><input id="rn_${esc(r.id)}" placeholder="Reason (optional)" style="flex:1;min-width:160px;padding:7px 9px;border:1px solid var(--line);border-radius:6px;background:var(--panel)"><button class="btn danger" data-act="decide" data-k="${r._t}" data-r="${esc(r.id)}" data-s="rejected">Reject</button><button class="btn ok" data-act="decide" data-k="${r._t}" data-r="${esc(r.id)}" data-s="approved">Approve</button></div>`:stateChip(r)}</div>`};
  return `<div class="row" style="margin-bottom:14px"><div><h2 style="margin:0">Pending update requests</h2><p class="muted" style="margin:4px 0 0">${admin?'Entries from people whose permission is “Needs approval”. Approving counts the lot or applies the change.':'Entries you sent that need an admin’s approval.'}</p></div>
  <div class="seg" style="margin-left:auto"><button data-act="reqTab" data-t="pending" aria-pressed="${S.reqTab==='pending'}">Pending (${pend.length})</button><button data-act="reqTab" data-t="done" aria-pressed="${S.reqTab!=='pending'}">Decided</button></div></div>
  ${admin&&pend.length>1&&S.reqTab==='pending'?`<div class="row" style="margin-bottom:10px"><button class="btn ok" data-act="approveAll">Approve all ${pend.length}</button></div>`:''}
  ${show.length?show.map(card).join(''):`<div class="panel muted">${S.reqTab==='pending'?'No pending update requests.':'Nothing decided yet.'}</div>`}`;
}

/* activity */
function vActivity(){const a=PD().activity||[];
  return `<h2 style="margin:0">Activity</h2><p class="muted" style="margin:4px 0 14px">Everything recorded on this project (latest 300).</p>
  <div class="panel">${a.length?`<ul class="log">${a.map(e=>`<li><div><strong>${esc(e.by_name||'')}</strong> ${esc(e.text)}</div><div class="row" style="gap:12px;margin-top:3px"><span class="when">${fmtTime(e.at)}</span>${e.item_id&&S.M.items.find(x=>x.id===e.item_id)?`<button class="lnk" data-act="open" data-id="${esc(e.item_id)}">Open item</button>`:''}</div></li>`).join('')}</ul>`:'<p class="muted">No changes recorded yet.</p>'}</div>`}

/* access */
function lvlSel(email,c,val){return `<select data-change="perm" data-e="${esc(email)}" data-c="${c}" aria-label="${esc(CATMAP[c].l)}">${['edit','request','none','hide'].map(o=>`<option value="${o}" ${o===val?'selected':''}>${LVL_LABEL[o]}</option>`).join('')}</select>`}
function vAccess(){
  if(!isAdmin()){return `<h2 style="margin:0">Your access on ${esc(cur().name)}</h2><p class="muted" style="margin:4px 0 16px">An admin decides what each person can change. “Needs approval” means your entries wait for an admin before they count.</p>
    <div class="panel"><table class="stbl"><tbody>${CATS.map(c=>{const l=myLevel(c.k);return `<tr><td><strong>${esc(c.l)}</strong><div class="muted" style="font-size:12.5px">${esc(c.hint)}</div></td><td><span class="lvl ${l}">${LVL_LABEL[l]}</span></td></tr>`}).join('')}</tbody></table></div>
    <p class="muted" style="font-size:12.5px">Rates and values are visible to admins only.</p>`}
  const m=S.members;if(!m)return `<div class="panel muted"><span class="spin"></span> Loading people…</div>`;
  const others=S.projects.filter(p=>p.id!==S.pid&&!p.deleted_at);
  return `<div class="row"><h2 style="margin:0">Access for ${esc(cur().name)}</h2>${others.length?`<span class="row" style="margin-left:auto"><label class="sr" for="cpfrom">Copy access from</label><select id="cpfrom" style="padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel)">${others.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><button class="btn" data-act="copyPerms">Copy access</button></span>`:''}</div>
  <p class="muted" style="margin:6px 0;max-width:85ch">Only people listed here can see this project — staff and outside people alike. Add someone by email; they create an account with that email and the project appears for them. Per area: <strong>Can edit</strong> saves straight away, <strong>Needs approval</strong> goes to Pending update requests, <strong>Only see</strong> is view-only, <strong>No access</strong> hides that area completely. Admins (see the Admins tab) see and change everything.</p>
  <div class="row" style="margin:12px 0"><button class="btn pri" data-act="addPerson">+ Add person</button></div>
  <div class="tbl-wrap"><table class="perm"><thead><tr><th>Person</th>${CATS.map(c=>`<th title="${esc(c.hint)}">${esc(c.l)}</th>`).join('')}</tr></thead><tbody>
  ${m.map(x=>`<tr><td><strong>${esc(x.name||x.email)}</strong>${x.name?`<div class="muted" style="font-size:12px">${esc(x.email)}</div>`:''}<div style="font-size:12px;margin-top:2px">${x.signedUp?'<span class="lvl edit">Account active</span>':'<span class="lvl request">Waiting for sign-up</span>'}</div><button class="lnk bad" style="margin-top:4px" data-act="removePerson" data-e="${esc(x.email)}">Remove</button></td>${CATS.map(c=>`<td>${lvlSel(x.email,c.k,(x.levels||{})[c.k]||'hide')}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div>${m.length?'':'<p class="muted">No one is listed yet, so only admins can see this project.</p>'}`;
}
function addPersonModal(){
  modal(`<h2>Add person to ${esc(cur().name)}</h2><p class="muted" style="margin:0 0 12px">Works for colleagues and outside people (vendors, consultants, clients). Send them the app link; they create an account with this email.</p>
  <form class="form" id="apform" onsubmit="return false"><label class="wide">Email<input name="email" type="email" required placeholder="name@company.com"></label>
  <label class="wide">Start with<select name="preset"><option value="site">Site team — records delivery to handing over (needs approval)</option><option value="view">View only — sees progress, no billing</option><option value="billing">Billing — records RA bills</option><option value="vendor">Vendor — sends deliveries for approval, sees drawings & TDS</option></select></label></form>
  <p class="muted" style="font-size:12.5px">You can fine-tune each area in the table afterwards.</p>
  <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closeModal">Cancel</button><button class="btn pri" data-act="doAddPerson">Add person</button></div>`)}
const PRESETS={site:{data:'none',status:'request',delivery:'request',install:'request',testing:'request',commission:'request',handover:'request',billing:'hide',docs:'request'},
  view:{data:'none',status:'none',delivery:'none',install:'none',testing:'none',commission:'none',handover:'none',billing:'hide',docs:'none'},
  billing:{data:'none',status:'hide',delivery:'none',install:'hide',testing:'hide',commission:'hide',handover:'hide',billing:'edit',docs:'request'},
  vendor:{data:'none',status:'none',delivery:'request',install:'none',testing:'none',commission:'none',handover:'none',billing:'hide',docs:'none'}};

/* admins */
function vAdmins(){const a=S.admins;
  return `<h1 style="font-size:22px">Admins</h1><p class="muted" style="margin:4px 0 14px;max-width:80ch">Admins see every project including rates, create and delete projects, decide who has access, and approve pending update requests. Everyone else only sees the projects they’re added to.</p>
  <div class="panel">${a?`<table class="stbl"><tbody>${a.map(e=>`<tr><td><strong>${esc(e)}</strong>${e===S.me.email?' <span class="muted">(you)</span>':''}</td><td style="text-align:right">${e!==S.me.email?`<button class="btn danger" data-act="removeAdmin" data-e="${esc(e)}">Remove</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<span class="spin"></span>'}
  <form class="row" style="margin-top:14px" data-submit="addAdmin"><input id="newAdmin" name="email" type="email" required placeholder="Email of new admin" style="flex:1;min-width:200px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel)"><button class="btn pri">Add admin</button></form></div>`}

/* ---------- item drawer ---------- */
function openItem(id){if(id!=null&&!S.M.items.find(x=>x.id===id)){toast('That item no longer exists.');return}
  S.drawerId=id==null?null:id;$('#drawer').innerHTML=drawerHTML();$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false');$('#scrim').classList.add('open');setTimeout(()=>{const f=$('#drawer .xbtn');f&&f.focus()},50)}
function refreshDrawer(){const dr=$('#drawer');if(!dr.classList.contains('open'))return;if(S.drawerId&&!S.M.items.find(x=>x.id===S.drawerId)){closeDrawer();return}
  const vals={};dr.querySelectorAll('input,select,textarea').forEach(el=>{const k=el.id||el.name;if(k&&el.type!=='file')vals[k]=el.value});const sc=$('.db',dr)?$('.db',dr).scrollTop:0;
  dr.innerHTML=drawerHTML();dr.querySelectorAll('input,select,textarea').forEach(el=>{const k=el.id||el.name;if(k&&k in vals)el.value=vals[k]});if($('.db',dr))$('.db',dr).scrollTop=sc}
function closeDrawer(){$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');if(!$('#modal').classList.contains('open'))$('#scrim').classList.remove('open');S.drawerId=undefined}
function lvlBadge(c){const l=myLevel(c);if(l==='admin')return '';return `<span class="lvl ${l}">${l==='edit'?'You can edit':l==='request'?'Needs approval':'Only see'}</span>`}
function drawerHTML(){
  const id=S.drawerId,isNew=id==null,admin=isAdmin();const it=isNew?{section:S.sec||(sections(S.M.items)[0]||{}).name||'General'}:S.M.items.find(x=>x.id===id);
  const canField=f=>admin||(f.cat!=='opening'&&['edit','request'].includes(myLevel(f.cat)));
  const showField=f=>admin||(f.cat!=='opening'&&(canView(f.cat)||['section','sr','desc','qty','unit','woQty'].includes(f.k)));
  const field=f=>{const v=it[f.k]??'';const cls=f.wide?'wide':'';
    if(!canField(f))return `<label class="${cls}">${esc(f.l)}<div class="ro">${esc(fmtVal(f.k,v))||'—'}</div></label>`;let inp;
    if(f.opts){const o=[...f.opts];if(v&&!o.includes(v))o.push(v);inp=`<select name="${f.k}">${o.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(x||'—')}</option>`).join('')}</select>`}
    else if(f.type==='textarea')inp=`<textarea name="${f.k}">${esc(v)}</textarea>`;else if(f.type==='date')inp=`<input type="date" name="${f.k}" value="${esc(v)}">`;
    else if(f.num)inp=`<input type="number" step="any" inputmode="decimal" name="${f.k}" value="${esc(v)}">`;else inp=`<input name="${f.k}" value="${esc(v)}" ${f.k==='section'?'list="secl"':''}>`;
    return `<label class="${cls}">${esc(f.l)}${inp}</label>`};
  const group=c=>!admin&&!canView(c)&&c!=='data'?'':`<div class="sech wide" style="grid-column:1/-1"><h3>${esc(c==='opening'?'Opening quantities (from Excel)':CATMAP[c].l)}</h3>${c==='opening'?'':lvlBadge(c)}</div>${FIELDS.filter(f=>f.cat===c&&showField(f)).map(field).join('')}`;
  const r=(PD().rates||{})[id]||{};const anyField=admin||['data','status'].some(c=>['edit','request'].includes(myLevel(c)));
  const t=isNew?null:target(it);const st=isNew?null:status(it);const unit=esc(it.unit||'');
  const pendCh=isNew?[]:(PD().changes||[]).filter(c=>c.item_id===id&&c.status==='pending');
  return `<div class="dh"><div><h2>${isNew?'New line item':esc(it.sr?'Item '+it.sr:'Line item')}</h2><div class="muted" style="font-size:12.5px">${isNew?'':`<span class="chip" style="--c:${secColor(it.section)}">${esc(it.section)}</span>`}${st?` · <span class="st ${ST_CLASS[st]}">${st}</span>`:''}</div>${isNew?'':`<div style="margin-top:6px;font-size:13.5px">${esc(String(it.desc||'').slice(0,160))}${String(it.desc||'').length>160?'…':''}</div>`}</div><button class="xbtn" data-act="closeDrawer" aria-label="Close">×</button></div>
  <div class="db">
    ${isNew?'':`<div class="sumstrip"><div><div class="v">${fmtN(t)||'—'}</div><div class="l">Target ${unit}</div></div>
      ${canView('delivery')?`<div><div class="v">${fmtN(it.dTot)}</div><div class="l">Delivered${it.dDate?' · '+fmtDate(it.dDate):''}</div></div><div><div class="v ${t&&t-it.dTot<0?'neg':''}">${t?fmtN(t-it.dTot):'—'}</div><div class="l">To deliver</div></div>`:''}
      ${canView('install')?`<div><div class="v">${fmtN(it.iTot)}</div><div class="l">Installed qty${it.iDate?' · '+fmtDate(it.iDate):''}</div></div><div><div class="v" style="font-size:14px">${it.iStart?fmtDate(it.iStart):'—'}</div><div class="l">Installation date</div></div>`:''}
      ${['testing','commission','handover'].filter(canView).map(k=>{const K=KIND[k];return `<div><div class="v">${fmtN(it[K.tot])}</div><div class="l">${K.done}${it[K.date]?' · '+fmtDate(it[K.date]):''}</div></div>`}).join('')}
      ${canView('billing')?`<div><div class="v">${fmtN(it.bmTot)}</div><div class="l">Supply billed${it.bmDate?' · '+fmtDate(it.bmDate):''}</div></div><div><div class="v">${fmtN(it.biTot)}</div><div class="l">Installation billed${it.biDate?' · '+fmtDate(it.biDate):''}</div></div>`:''}</div>`}
    ${isNew?'':KINDS.filter(canView).map(k=>lotSection(it,k)).join('')}
    <form id="dform" class="form" onsubmit="return false" style="margin-top:${isNew?0:8}px">${group('data')}${group('status')}
      ${admin?`${group('opening')}<div class="sech" style="grid-column:1/-1"><h3>Rates</h3><span class="muted" style="font-size:12px">Admins only</span></div><label>Unit rate (WO)<input type="number" step="any" name="rateW" value="${esc(r.w??'')}"></label><label>Unit rate (purchase)<input type="number" step="any" name="rateP" value="${esc(r.p??'')}"></label>`:''}
      ${!admin&&anyField?`<label class="wide">Note for the admin (sent with changes that need approval)<textarea name="_note"></textarea></label>`:''}
      <datalist id="secl">${sections(S.M.items).map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist></form>
    ${pendCh.length?`<div class="sub"><h3>Pending update requests</h3>${pendCh.map(x=>`<div class="muted" style="font-size:13px;margin-bottom:6px">${esc(x.created_by_name||'')}, ${fmtTime(x.created_at)}: ${Object.entries(x.changes).map(([k,v])=>`${esc(FMAP[k]?FMAP[k].l:k)} → ${esc(fmtVal(k,v))||'(cleared)'}`).join('; ')}</div>`).join('')}</div>`:''}
    ${!isNew&&it.updatedBy?`<p class="muted" style="font-size:12px;margin-top:16px">Item last changed ${fmtTime(it.updatedAt)} by ${esc(it.updatedBy)}</p>`:''}
  </div>
  <div class="df">${admin?`${isNew?'':'<button class="btn danger" data-act="delItem" style="margin-right:auto">Delete item</button>'}<button class="btn" data-act="closeDrawer">Close</button><button class="btn pri" data-act="saveItem">${isNew?'Add item':'Save changes'}</button>`
    :anyField?`<button class="btn" data-act="closeDrawer">Close</button><button class="btn pri" data-act="saveFields">Save changes</button>`:`<button class="btn" data-act="closeDrawer">Close</button>`}</div>`;
}
function lotSection(it,kind){
  const lv=myLevel(kind);const unit=esc(it.unit||'');
  const recs=(it._lots||[]).filter(l=>l.kind===kind).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.created_at).localeCompare(String(a.created_at)));
  const K=KIND[kind];const opening=K.open?num(it[K.open]):null;const refL=K.ref;
  const rows=[];
  if(opening)rows.push(`<tr><td>${esc(fmtDate(it[K.openDate]))||'—'}</td><td class="num">${fmtN(opening)}</td><td colspan="2" class="muted">Opening quantity from Excel</td><td></td></tr>`);
  if(kind==='billing'){if(num(it.billMat))rows.push(`<tr><td>${esc(fmtDate(it.billMatDate))||'—'}</td><td class="num">${fmtN(it.billMat)}<div class="muted" style="font-size:11.5px">Supply</div></td><td colspan="2" class="muted">Opening quantity from Excel</td><td></td></tr>`);
    if(num(it.billInst))rows.push(`<tr><td>${esc(fmtDate(it.billInstDate))||'—'}</td><td class="num">${fmtN(it.billInst)}<div class="muted" style="font-size:11.5px">Installation</div></td><td colspan="2" class="muted">Opening quantity from Excel</td><td></td></tr>`)}
  recs.forEach(r=>{const off=['rejected','removed'].includes(r.status);const canDel=(isAdmin()&&r.status!=='removed')||(r.mine&&(r.status==='pending'||(r.status==='approved'&&r.direct))&&['edit','request'].includes(lv));
    rows.push(`<tr class="${off?'off':''}"><td>${esc(fmtDate(r.date))||'—'}</td><td class="num">${fmtN(r.qty)}${kind==='billing'?`<div class="muted" style="font-size:11.5px">${r.bill==='installation'?'Installation':'Supply'}</div>`:''}</td><td>${esc(r.ref)}${r.note?`<div class="muted" style="font-size:12px">${esc(r.note)}</div>`:''}</td><td>${esc(r.created_by_name||'')}<div>${stateChip(r)}</div></td><td>${canDel?`<button class="lnk bad" data-act="delLot" data-r="${esc(r.id)}">${isAdmin()&&!r.mine&&!r.direct?'Remove':'Delete'}</button>`:''}</td></tr>`)});
  const tot=K.tot?fmtN(it[K.tot]):`${fmtN(it.bmTot)} / ${fmtN(it.biTot)}`;
  return `<div class="sech"><h3>${esc(CATMAP[kind].l)} lots</h3><span class="muted" style="font-size:12.5px">Total ${tot} ${unit}</span>${lvlBadge(kind)}</div>
  ${rows.length?`<div style="overflow-x:auto"><table class="lots"><thead><tr><th>Date</th><th class="num">Qty</th><th>${esc(refL)}</th><th>By</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<p class="muted" style="font-size:13px;margin:0">No ${esc(CATMAP[kind].l.toLowerCase())} recorded yet.</p>`}
  ${['admin','edit','request'].includes(lv)?`<div class="lotadd">${kind==='billing'?`<label>Bill type<select id="lb_${kind}"><option value="material">Supply</option><option value="installation">Installation</option></select></label>`:''}
    <label>Qty (${unit||'units'})<input id="lq_${kind}" type="number" step="any" min="0" inputmode="decimal"></label><label>Date<input id="ld_${kind}" type="date" value="${today()}"></label>
    <label>${esc(refL)}<input id="lr_${kind}"></label><label>Note<input id="ln_${kind}"></label>
    <button class="btn ${lv==='request'?'':'pri'}" data-act="addLot" data-k="${kind}">${lv==='request'?'Send for approval':'Add lot'}</button></div>`:''}`;
}
function readForm(){const o={};const f=$('#dform');if(f)new FormData(f).forEach((v,k)=>o[k]=v);return o}
async function addLot(kind,btn){
  const it=S.M.items.find(x=>x.id===S.drawerId);if(!it)return;const qty=num($('#lq_'+kind).value);if(!(qty>0)){toast('Enter a quantity above zero.');$('#lq_'+kind).focus();return}
  const bill=kind==='billing'?$('#lb_'+kind).value:'material';const t=target(it);const tot=KIND[kind].tot?it[KIND[kind].tot]:(bill==='installation'?it.biTot:it.bmTot);
  if(t&&tot+qty>t&&!await askConfirm(`This takes the total to ${fmtN(tot+qty)}, above the target of ${fmtN(t)}. Record it anyway?`))return;
  btn.disabled=true;
  try{const r=await rpc('add_lot',{pid:S.pid,iid:it.id,kind,qty,d:coerce('deliveryDate',$('#ld_'+kind).value)||today(),ref:$('#lr_'+kind).value.trim(),note:$('#ln_'+kind).value.trim(),bill});
    ['lq_','lr_','ln_'].forEach(p=>{const e=$('#'+p+kind);if(e)e.value=''});toast(r.status==='pending'?'Sent for approval.':'Lot recorded.');await refresh(true)}catch(e){toast(errMsg(e),6000)}finally{btn.disabled=false}
}
async function saveFields(btn){
  const it=S.M.items.find(x=>x.id===S.drawerId);if(!it)return;const v=readForm();let sent=0,saved=0;btn.disabled=true;
  try{for(const c of ['data','status']){if(!['edit','request'].includes(myLevel(c)))continue;const ch={};
      CAT_FIELDS[c].forEach(k=>{if(!(k in v))return;const nv=coerce(k,v[k]);if(!same(it[k],nv))ch[k]=nv});if(!Object.keys(ch).length)continue;
      const r=await rpc('submit_changes',{pid:S.pid,iid:it.id,cat:c,ch,note:String(v._note||'').trim()});r.status==='pending'?sent++:saved++}
    if(!sent&&!saved){toast('Nothing has changed yet.');btn.disabled=false;return}
    closeDrawer();toast(sent&&saved?'Saved, and some changes sent for approval.':sent?'Sent for approval.':'Changes saved.');await refresh(true)}catch(e){btn.disabled=false;toast(errMsg(e),6000)}
}
async function saveItem(btn){
  const v=readForm();const id=S.drawerId;const old=id?(PD().items||[]).find(x=>x.id===id)||{}:{};
  const d={...old};delete d.id;delete d.ord;delete d.updatedAt;delete d.updatedBy;FIELDS.forEach(f=>d[f.k]=coerce(f.k,v[f.k]));
  if(!d.desc){toast('Add an item description first.');return}d.section=d.section||'General';d.header=!(target(d)>0);
  btn.disabled=true;try{await rpc('save_item',{pid:S.pid,iid:id||null,d,w:num(v.rateW),p:num(v.rateP)});closeDrawer();toast(id?'Changes saved.':'Item added.');await refresh(true)}catch(e){btn.disabled=false;toast(errMsg(e),6000)}
}

/* ---------- modals ---------- */
function modal(html){$('#modal').innerHTML=`<div class="mbox">${html}</div>`;$('#modal').classList.add('open');$('#scrim').classList.add('open');setTimeout(()=>{const f=$('#modal input,#modal select,#modal button');f&&f.focus()},30)}
function closeModal(){$('#modal').classList.remove('open');$('#modal').innerHTML='';if(!$('#drawer').classList.contains('open'))$('#scrim').classList.remove('open')}
function projectForm(p={},title,btnLabel,act,extra=''){
  modal(`<h2>${title}</h2>${extra}<form class="form" id="pform" onsubmit="return false" style="margin-top:12px">
   <label class="wide">Project name<input name="name" value="${esc(p.name||'')}" required></label><label>Client<input name="client" value="${esc(p.client||'')}"></label><label>Location<input name="location" value="${esc(p.location||'')}"></label>
   <label>Start date<input type="date" name="start" value="${esc(p.start_date||p.start||'')}"></label><label>Target completion<input type="date" name="target" value="${esc(p.target||'')}"></label>
   <label>Status<select name="status">${['Active','On hold','Completed'].map(s=>`<option ${s===(p.status||'Active')?'selected':''}>${s}</option>`).join('')}</select></label>
  </form><div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn" data-act="closeModal">Cancel</button><button class="btn pri" data-act="${act}" ${p.id?`data-id="${esc(p.id)}"`:''}>${btnLabel}</button></div>`)}
const readP=()=>{const o={};new FormData($('#pform')).forEach((v,k)=>o[k]=String(v).trim());return o};
function newProjectChooser(){const others=S.projects.filter(p=>!p.deleted_at);
  modal(`<h2>New project</h2><p class="muted" style="margin:0 0 14px">How do you want to start?</p><div class="npc">
    <button class="npo" data-act="import"><strong>1. Import BOQ</strong><span>Pick an Excel BOQ or tracker file. Line items, ELV systems, quantities, units, makes and rates are read in.</span></button>
    <div class="npo ${others.length?'':'dis'}"><strong>2. Use another project as template</strong><span>Copies its line items, makes, vendors and rates. Progress, dates and approvals start empty.</span>
      ${others.length?`<div class="row" style="margin-top:8px;flex-wrap:nowrap"><label class="sr" for="tplSrc">Project to copy</label><select id="tplSrc" style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--line);border-radius:6px;background:var(--panel)">${others.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><button class="btn" data-act="fromTemplate">Continue</button></div>`:'<em class="muted" style="font-size:12.5px">No projects yet to copy from.</em>'}</div>
    <button class="npo" data-act="blankProject"><strong>3. Blank project</strong><span>Start empty and add line items one by one.</span></button></div>
  <div class="row" style="justify-content:space-between;margin-top:16px"><button class="lnk" data-act="template">Download blank BOQ template</button><button class="btn" data-act="closeModal">Cancel</button></div>`)}

/* ---------- Excel ---------- */
const normApproval=v=>{const t=String(v??'').trim();if(!t)return '';if(/approv/i.test(t))return 'Approved';if(/submit/i.test(t))return 'Submitted';if(/pend/i.test(t))return 'Pending';if(/^n\.?a\.?$/i.test(t))return 'NA';return t};
function splitMake(v){const t=String(v||'').trim();const m=t.match(/^([^-–:/]{2,30}?)\s*[-–:/]\s*(.+)$/);return m?[m[1].trim(),m[2].trim()]:[t,'']}
const xdate=v=>{if(typeof v==='number'&&v>20000&&v<80000)return new Date(Date.UTC(1899,11,30)+v*864e5).toISOString().slice(0,10);const t=String(v??'').trim();
  if(/^\d{4}-\d{2}-\d{2}/.test(t))return t.slice(0,10);const m=t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);if(m){const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`}return ''};
const NEWCOLS={sr:/^sr/i,section:/^elv system$/i,desc:/^item$/i,make:/^make$/i,model:/^model$/i,qty:/^qty\.?$/i,unit:/^unit$/i,woQty:/^new wo/i,
  drawing:/^drawing (status|approval)$/i,drawingDate:/^drawing (status )?date$/i,tds:/^tds (status|approval)$/i,tdsDate:/^tds (status )?date$/i,
  vendor:/^po vendor$/i,poDate:/^po date$/i,expStatus:/^delivery status$/i,delivered:/^delivered qty$/i,deliveryDate:/^delivery date$/i,
  billMat:/^supply billed qty$/i,billMatDate:/^supply bill date$/i,billInst:/^installation billed qty$/i,billInstDate:/^installation bill date$/i,
  installed:/^installed qty$/i,tested:/^tested qty$/i,testDate:/^(tested qty|testing) date$/i,commissioned:/^commissioned qty$/i,commissionDate:/^(commissioned qty|commissioning) date$/i,handedOver:/^handed over qty$/i,handoverDate:/^(handed over qty|handing over|handover) date$/i,installDate:/^installation (start )?date$/i,contractor:/^wo \(?contractor/i,pendingReason:/^pending reason$/i,delayReason:/^reason for delay/i,remarks:/^remarks$/i,
  rateW:/^unit rate wo$/i,rateP:/^unit rate purchase$/i};
const blankItem=()=>{const it={};FIELDS.forEach(f=>it[f.k]=f.num?null:'');return it};
function parseBOQ(rows){
  const s=v=>String(v??'').trim();const lc=r=>(r||[]).map(c=>s(c).toLowerCase().replace(/\s+/g,' '));
  const h=rows.findIndex(r=>{const t=lc(r);return t.some(c=>/descr|particular|item name|^item$/.test(c))&&t.some(c=>/^qty|quantity|qnty/.test(c))});
  if(h<0)throw new Error('Couldn’t find a header row with Description and Qty columns. Check the BOQ, or use the blank template.');
  const hdr=lc(rows[h]);const f=p=>hdr.findIndex(p);
  const col={sr:f(c=>/^(s\.? ?no\.?|sr\.? ?no\.?|sl\.? ?no\.?|s\.?n\.?|item no\.?|sr\.?)$/.test(c)),desc:f(c=>/descr|particular|item name/.test(c)),unit:f(c=>/^(unit|units|uom|u\.o\.m\.?)$/.test(c)),qty:f(c=>/^qty|quantity|qnty/.test(c)),
    make:f(c=>/^(make|brand|manufacturer|oem)/.test(c)),model:f(c=>/model|part ?no|part code/.test(c)),rate:f(c=>/rate|unit price|unit cost/.test(c)&&!/amount|total/.test(c))};
  if(col.desc<0)col.desc=f(c=>/^item$/.test(c));const g=(r,k)=>col[k]<0?'':r[col[k]];
  let section='General';const items=[],rates=[];
  for(let i=h+1;i<rows.length;i++){const r=rows[i]||[];const desc=s(g(r,'desc'));if(!desc)continue;if(/^(sub[ -]?total|grand total|total\b|carried|brought)/i.test(desc))continue;
    const qty=num(g(r,'qty'));const unit=s(g(r,'unit'));let sr=g(r,'sr');sr=typeof sr==='number'?String(+sr.toFixed(2)):s(sr);
    if(qty==null&&!unit&&desc.length<80&&(!sr||/^([A-Z]{1,2}|[IVX]{1,5})[.)]?$/i.test(sr))){section=desc.replace(/^[A-Z0-9.\-)\s]{0,6}[.)-]\s*/,'').trim()||desc;continue}
    let make=s(g(r,'make')),model=s(g(r,'model'));if(make&&!model&&col.model<0)[make,model]=splitMake(make);
    const it=blankItem();Object.assign(it,{section,sr,desc,qty,unit,make,model});it.header=!(target(it)>0);items.push(it);rates.push({w:num(g(r,'rate'))||0,p:0})}
  return{items,rates};
}
function parseTracker(rows){
  const s=v=>String(v??'').trim();const nh=rows.findIndex(r=>r.some(c=>/^drawing (status|approval)$/i.test(s(c))));
  if(nh>=0){const hdr=rows[nh].map(s);const col={};Object.entries(NEWCOLS).forEach(([k,re])=>{const i=hdr.findIndex(h=>re.test(h));if(i>=0)col[k]=i});const items=[],rates=[];let section='General';
    for(let i=nh+1;i<rows.length;i++){const r=rows[i]||[];const g=k=>col[k]==null?'':r[col[k]];if(!s(g('desc'))&&!s(g('sr'))){if(s(r[1]))section=s(r[1]);continue}
      const it={};FIELDS.forEach(f=>{if(col[f.k]==null){it[f.k]=f.num?null:'';return}const v=g(f.k);it[f.k]=f.num?num(v):f.type==='date'?xdate(v):(f.opts===APPROVAL?normApproval(v):s(v))});
      if(typeof g('sr')==='number')it.sr=String(+g('sr').toFixed(2));it.section=it.section||section;it.header=!(target(it)>0);items.push(it);rates.push({w:num(g('rateW'))||0,p:num(g('rateP'))||0})}
    return{items,rates}}
  const h=rows.findIndex(r=>r.some(c=>/item description/i.test(String(c))));if(h<0)return parseBOQ(rows);
  let start=h+1;if(rows[start]&&rows[start].some(c=>/deliver|quantity|qunatity|balance/i.test(String(c))))start++;let section='General';const items=[],rates=[];
  for(let i=start;i<rows.length;i++){const r=rows[i]||[];const c=j=>r[j];let sr=c(0);sr=typeof sr==='number'?String(+sr.toFixed(2)):s(sr);const desc=s(c(1));const rest=r.slice(2,23).some(v=>s(v)!=='');
    if(!sr&&!desc)continue;if(!sr&&desc&&!rest&&desc.length<60){section=desc;continue}if(/^total\b/i.test(desc))continue;
    const extra=[];[19,20,21,22].forEach(j=>{if(typeof c(j)==='string'&&s(c(j))&&num(c(j))==null&&!/^#/.test(s(c(j))))extra.push(s(c(j)))});const[mk,md]=splitMake(c(8));
    const it={...blankItem(),section,sr,desc,qty:num(c(2)),unit:s(c(3)),woQty:num(c(4)),drawing:normApproval(c(5)),tds:normApproval(c(6)),pendingReason:s(c(7)),make:mk,model:md,vendor:s(c(9)),
      expStatus:s(c(10)),delayReason:s(c(11)),delivered:num(c(12)),deliveryDate:xdate(c(14)),contractor:s(c(15)),billMat:num(c(16)),billInst:num(c(17)),installed:num(c(18)),remarks:[...extra,s(c(23))].filter(Boolean).join(' · ')};
    it.header=!(target(it)>0);items.push(it);rates.push({w:num(c(19))||0,p:num(c(21))||0})}
  return{items,rates};
}
async function importFile(file){
  if(!window.XLSX){toast('The Excel reader didn’t load. Check your connection and reload.');return}
  try{const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:true});
    const{items,rates}=parseTracker(rows);if(!items.length)throw new Error('No line items found under the header row.');
    const base=file.name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ');const guess=(base.match(/tracker[\s-]+([A-Za-z][A-Za-z ]+?)[\s-]*\d/i)||[])[1]||base;const secs=[...new Set(items.map(i=>i.section))];
    S._import={items,rates};projectForm({name:guess.trim(),location:''},'Import BOQ','Create project','doImport',`<p class="muted" style="margin:0">Found ${items.length} line items in ${secs.length} ELV systems: ${esc(secs.join(', '))}. Rates are visible to admins only.</p>`);
  }catch(e){toast(e.message||'Couldn’t read that file.',6000)}
}
const XH=['SR. No.','ELV System','Item','Make','Model','Qty.','Unit','New WO Qty','Drawing Status','Drawing Date','TDS Status','TDS Date','PO Vendor','PO Date','Delivery Status','Delivered Qty','Delivery Date','Balance','Supply Billed Qty','Supply Bill Date','Installation Billed Qty','Installation Bill Date','Installation Date','Installed Qty','Installed Qty Date','Tested Qty','Tested Qty Date','Commissioned Qty','Commissioning Date','Handed Over Qty','Handing Over Date','WO (Contractor)','Pending Reason','Reason for Delay','Remarks'];
const XCAT=['','','','data','data','','','','status','status','status','status','data','data','status','delivery','delivery','delivery','billing','billing','billing','billing','install','install','install','testing','testing','commission','commission','handover','handover','data','status','status','status'];
const xcols=h=>h.map(t=>({wch:t==='Item'?60:t==='Remarks'?30:Math.max(11,t.length+2)}));
function saveBook(sheets,filename){if(!window.XLSX){toast('Excel export isn’t available.');return}const wb=XLSX.utils.book_new();
  sheets.forEach(([name,aoa,cols])=>{const ws=XLSX.utils.aoa_to_sheet(aoa);if(cols)ws['!cols']=cols;XLSX.utils.book_append_sheet(wb,ws,name)});XLSX.writeFile(wb,filename)}
function exportXlsx(){
  const p=cur();const admin=isAdmin();const H0=admin?[...XH,'Unit rate WO','WO Total','Unit rate Purchase','Purchase Total']:XH;const keep=H0.map((_,i)=>admin||canView(XCAT[i]));const H=H0.filter((_,i)=>keep[i]);const rows=[H];
  const lots=[['ELV System','Sr. No.','Item','Lot type','Bill type','Qty','Unit','Date','Reference','Note','Entered by','State']];const rates=PD().rates||{};
  sections(S.M.items).forEach(s=>s.list.forEach(it=>{const t=target(it);const r=rates[it.id]||{};const q=num(it.qty)||0;
    const row=[it.sr,it.section,it.desc,it.make,it.model,it.qty??'',it.unit,it.woQty??'',it.drawing,it.drawingDate||'',it.tds,it.tdsDate||'',it.vendor,it.poDate||'',it.expStatus,it.dTot||'',it.dDate||'',trackable(it)?t-it.dTot:'',it.bmTot||'',it.bmDate||'',it.biTot||'',it.biDate||'',it.iStart||'',it.iTot||'',it.iDate||'',it.tTot||'',it.tDate||'',it.cTot||'',it.cDate||'',it.hTot||'',it.hDate||'',it.contractor,it.pendingReason,it.delayReason,it.remarks];
    if(admin)row.push(r.w||'',r.w?q*r.w:'',r.p||'',r.p?q*r.p:'');rows.push(row.filter((_,i)=>keep[i]));
    (it._lots||[]).filter(l=>canView(l.kind)).forEach(l=>lots.push([it.section,it.sr,String(it.desc||'').slice(0,120),CATMAP[l.kind].l,l.kind==='billing'?(l.bill==='installation'?'Installation':'Supply'):'',l.qty,it.unit,l.date,l.ref,l.note,l.created_by_name,(STATE_CHIP[l.status]||['',l.status])[1]]))}));
  saveBook([['Tracker',rows,xcols(H)],['Lots',lots,[{wch:14},{wch:8},{wch:60},{wch:12},{wch:12},{wch:8},{wch:8},{wch:12},{wch:20},{wch:30},{wch:20},{wch:16}]]],`Project_Tracker_${String(p.name).replace(/[^\w-]+/g,'_')}_${today()}.xlsx`);
}
function downloadTemplate(){const H=[...XH,'Unit rate WO','Unit rate Purchase'];const ex=['1','CCTV','IP dome camera 2MP','Honeywell','I-HIPD2PI-MV',100,'Nos.',100,'Submitted','2026-01-10','Approved','2026-01-20','Vendor name','2026-02-01','Pending','','','','','','','','','','','','','','','','','Contractor name','','','',1000,800];
  saveBook([['Tracker',[H,ex],xcols(H)]],'Project_Tracker_Template.xlsx')}

/* ---------- navigation ---------- */
async function goProject(pid,tab){if(pid!==S.pid)S.asEmail='';S.pid=pid;lsSet('pid',pid);S.view='project';S.ptab=tab||S.ptab;S.members=null;lsSet('view','project');lsSet('ptab',S.ptab);render();window.scrollTo(0,0);
  try{await loadPD(pid,true);if(S.ptab==='access'&&isAdmin())S.members=await rpc('list_members',{pid})}catch(e){toast(errMsg(e),6000)}render()}

/* ---------- actions ---------- */
const ACT={
  authMode:t=>{S.auth=t.dataset.m;S.authMsg='';render()},
  refresh:()=>{toast('Refreshing…',1500);refresh(true)},
  umenu:()=>$('#udrop').classList.toggle('open'),
  signOut:async()=>{await sb.auth.signOut()},
  editName:()=>{modal(`<h2>Your name</h2><form class="form" id="nform" onsubmit="return false"><label class="wide">Name shown to others<input name="n" value="${esc(S.me.name||'')}"></label></form><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closeModal">Cancel</button><button class="btn pri" data-act="doName">Save</button></div>`)},
  doName:async()=>{const n=new FormData($('#nform')).get('n');try{await rpc('set_my_name',{n});S.me.name=String(n).trim();closeModal();toast('Name saved.');render()}catch(e){toast(errMsg(e))}},
  changePw:()=>{modal(`<h2>Change password</h2><form class="form" id="pwform" onsubmit="return false"><label class="wide">New password (at least 8 characters)<input name="pw" type="password" minlength="8" autocomplete="new-password"></label></form><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn" data-act="closeModal">Cancel</button><button class="btn pri" data-act="doPw">Save</button></div>`)},
  doPw:async()=>{const pw=String(new FormData($('#pwform')).get('pw')||'');if(pw.length<8){toast('Use at least 8 characters.');return}const {error}=await sb.auth.updateUser({password:pw});if(error)toast(errMsg(error));else{closeModal();toast('Password changed.')}},
  view:t=>{S.view=t.dataset.v;lsSet('view',S.view);render();window.scrollTo(0,0);refresh(false)},
  ptab:async t=>{S.ptab=t.dataset.t;lsSet('ptab',S.ptab);render();if(S.ptab==='access'&&isAdmin()){S.members=await rpc('list_members',{pid:S.pid}).catch(e=>{toast(errMsg(e));return []});render()}},
  openProject:t=>goProject(t.dataset.id,'tracker'),
  open:t=>openItem(t.dataset.id),newItem:()=>openItem(null),
  closeDrawer:()=>{if($('#modal').classList.contains('open'))closeModal();else closeDrawer()},closeModal:()=>closeModal(),
  saveItem:t=>saveItem(t),saveFields:t=>saveFields(t),
  delItem:async()=>{const it=S.M.items.find(x=>x.id===S.drawerId);if(!it||!await askConfirm('Delete this line item and all its lots? This cannot be undone.','Delete item',true))return;closeDrawer();await after(rpc('delete_item',{iid:it.id}),'Item deleted.')},
  addLot:t=>addLot(t.dataset.k,t),
  delLot:async t=>{if(!await askConfirm('Delete this lot? It stops counting toward the totals.','Delete lot',true))return;await after(rpc('delete_lot',{lid:t.dataset.r}),'Lot removed.')},
  decide:async t=>{t.disabled=true;const note=(($('#rn_'+CSS.escape(t.dataset.r))||{}).value||'').trim();
    try{const fp=await rpc('decide',{kind:t.dataset.k,rid:t.dataset.r,st:t.dataset.s,p_note:note});if(fp)await sb.storage.from(BUCKET).remove([fp]);toast(t.dataset.s==='approved'?'Approved.':'Rejected.');await refresh(true)}catch(e){t.disabled=false;toast(errMsg(e))}},
  approveAll:async t=>{const n=pendingAll().length;if(!await askConfirm(`Approve all ${n} pending update requests?`,'Approve all'))return;t.disabled=true;await after(rpc('approve_all',{pid:S.pid}),'All approved.').catch(()=>{})},
  reqTab:t=>{S.reqTab=t.dataset.t;render()},
  docSec:t=>{S.docSec=t.dataset.k;render()},uploadDoc:t=>uploadDoc(t),
  dlDoc:t=>{const r=(PD().docs||[]).find(x=>x.id===t.dataset.r);if(r)downloadDoc(r)},
  delDoc:async t=>{const r=(PD().docs||[]).find(x=>x.id===t.dataset.r);if(!r||!await askConfirm(`Delete “${r.title||r.file_name}”? The file is removed for everyone.`,'Delete document',true))return;
    try{const fp=await rpc('delete_document',{did:r.id});if(fp)await sb.storage.from(BUCKET).remove([fp]);toast('Document deleted.');await refresh(true)}catch(e){toast(errMsg(e))}},
  cols:()=>colsModal(),
  colsSave:()=>{const p={};document.querySelectorAll('#modal [data-col]').forEach(c=>p[c.dataset.col]=c.checked);lsSet('cols2',JSON.stringify(p));closeModal();render()},
  colsReset:()=>{lsSet('cols2','');closeModal();render()},
  addPerson:()=>addPersonModal(),
  doAddPerson:async t=>{const f=new FormData($('#apform'));const em=String(f.get('email')||'').trim();if(!em){toast('Enter an email address.');return}t.disabled=true;
    try{await rpc('set_member',{pid:S.pid,em,lv:PRESETS[f.get('preset')]||DEFAULT_LEVELS});closeModal();S.members=await rpc('list_members',{pid:S.pid});render();
      toast(`Added. Send ${em} the app link — they create an account with this email.`,6000)}catch(e){t.disabled=false;toast(errMsg(e),6000)}},
  removePerson:async t=>{if(!await askConfirm(`Remove ${t.dataset.e} from this project? They’ll no longer see it. Entries they already made keep counting.`,'Remove',true))return;
    try{await rpc('remove_member',{pid:S.pid,em:t.dataset.e});S.members=await rpc('list_members',{pid:S.pid});toast('Removed.');render()}catch(e){toast(errMsg(e))}},
  copyPerms:async t=>{const src=$('#cpfrom').value;const nm=(S.projects.find(p=>p.id===src)||{}).name;if(!await askConfirm(`Copy everyone’s access from ${nm} to this project? People already here are updated to match.`,'Copy access'))return;
    try{await rpc('copy_members',{dst:S.pid,src});S.members=await rpc('list_members',{pid:S.pid});toast('Access copied.');render()}catch(e){toast(errMsg(e))}},
  removeAdmin:async t=>{if(!await askConfirm(`Remove ${t.dataset.e} as admin?`,'Remove admin',true))return;try{await rpc('remove_admin',{em:t.dataset.e});S.admins=await rpc('list_admins');render();toast('Admin removed.')}catch(e){toast(errMsg(e))}},
  newProject:()=>newProjectChooser(),
  blankProject:()=>projectForm({},'New blank project','Create project','doNewProject'),
  fromTemplate:()=>{const v=($('#tplSrc')||{}).value;if(!v)return;const src=S.projects.find(p=>p.id===v);S._dupFrom=v;projectForm({name:src.name+' (copy)',client:src.client},'Start from “'+esc(src.name)+'”','Create project','doDup',`<p class="muted" style="margin:0">Copies every line item with its ELV system, make, model, vendor and rates. Progress, dates and approvals start empty.</p>`)},
  import:()=>{$('#fileIn').value='';$('#fileIn').click()},template:()=>downloadTemplate(),export:()=>exportXlsx(),
  doImport:async t=>{const m=readP();if(!m.name){toast('Give the project a name.');return}t.disabled=true;t.textContent='Creating…';
    try{const pid=await rpc('create_project',{meta:m,its:S._import.items,rates:S._import.rates});S._import=null;closeModal();toast('Project created.');await loadProjects();goProject(pid,'tracker')}catch(e){t.disabled=false;t.textContent='Create project';toast(errMsg(e),6000)}},
  doNewProject:async t=>{const m=readP();if(!m.name){toast('Give the project a name.');return}t.disabled=true;try{const pid=await rpc('create_project',{meta:m,its:[],rates:[]});closeModal();await loadProjects();goProject(pid,'tracker')}catch(e){t.disabled=false;toast(errMsg(e))}},
  doDup:async t=>{const m=readP();if(!m.name){toast('Give the project a name.');return}t.disabled=true;try{const pid=await rpc('copy_project',{src:S._dupFrom,meta:m});closeModal();toast('Project created.');await loadProjects();goProject(pid,'tracker')}catch(e){t.disabled=false;toast(errMsg(e))}},
  editProject:t=>projectForm(S.projects.find(p=>p.id===t.dataset.id),'Project details','Save changes','doEditProject'),
  doEditProject:async t=>{const m=readP();if(!m.name){toast('Give the project a name.');return}closeModal();await after(rpc('update_project',{pid:t.dataset.id,meta:m}),'Project details saved.').catch(()=>{})},
  completeProject:async t=>{const p=S.projects.find(x=>x.id===t.dataset.id);if(!await askConfirm(`Mark “${p.name}” as completed? It moves to the Completed section. You can reopen it any time.`,'Mark completed'))return;await after(rpc('set_project_status',{pid:p.id,st:'Completed'}),'Project marked completed.').catch(()=>{})},
  reopenProject:async t=>{await after(rpc('set_project_status',{pid:t.dataset.id,st:'Active'}),'Project reopened.').catch(()=>{})},
  delProject:async t=>{const p=S.projects.find(x=>x.id===t.dataset.id);const until=new Date(Date.now()+KEEP_DAYS*864e5).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    if(!await askConfirm(`Are you sure you want to delete “${p.name}”? It moves to Recently deleted, where an admin can restore it until ${until}. After that it is removed permanently with all its line items, lots, rates, documents and activity.`,'Yes, delete project',true))return;
    await after(rpc('delete_project',{pid:p.id}),`Project deleted. You can restore it until ${until}.`).catch(()=>{})},
  restoreProject:async t=>{await after(rpc('restore_project',{pid:t.dataset.id}),'Project restored.').catch(()=>{})},
  purgeNow:async t=>{const p=S.projects.find(x=>x.id===t.dataset.id);if(!await askConfirm(`Permanently delete “${p.name}” now? This cannot be undone.`,'Delete permanently',true))return;
    try{const paths=await rpc('purge_project',{pid:p.id});if(paths&&paths.length)await sb.storage.from(BUCKET).remove(paths);toast('Project permanently deleted.');await refresh(true)}catch(e){toast(errMsg(e))}},
};
document.addEventListener('click',e=>{if(!e.target.closest('.umenu')){const d=$('#udrop');d&&d.classList.remove('open')}
  const t=e.target.closest('[data-act]');if(!t)return;const f=ACT[t.dataset.act];if(f){e.preventDefault();f(t,e)}});
document.addEventListener('submit',e=>{const k=e.target.dataset.submit;if(!k)return;e.preventDefault();
  if(k==='addAdmin'){const em=String(new FormData(e.target).get('email')||'').trim();rpc('add_admin',{em}).then(async()=>{e.target.reset();S.admins=await rpc('list_admins');toast('Admin added.');render()}).catch(err=>toast(errMsg(err)));return}
  authSubmit(k,e.target)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#cfm.open'))return;if($('#modal').classList.contains('open'))closeModal();else if($('#drawer').classList.contains('open'))closeDrawer();return}
  if(e.key==='Enter'&&e.target.matches('tr[data-act],li[data-act]')){e.preventDefault();ACT[e.target.dataset.act](e.target)}});
document.addEventListener('change',async e=>{const k=e.target.dataset&&e.target.dataset.change;if(!k)return;
  if(k==='proj')goProject(e.target.value);else if(k==='asWho'){S.asEmail=e.target.value;render()}else if(k==='sec'){S.sec=e.target.value;render()}else if(k==='st'){S.st=e.target.value;render()}else if(k==='flag'){S.flag=e.target.checked;render()}
  else if(k==='perm'){const m=(S.members||[]).find(x=>x.email===e.target.dataset.e);if(!m)return;const lv={...(m.levels||{}),[e.target.dataset.c]:e.target.value};e.target.disabled=true;
    try{await rpc('set_member',{pid:S.pid,em:m.email,lv});m.levels=lv;toast('Access updated.')}catch(err){toast(errMsg(err))}e.target.disabled=false}
  else if(k==='importFile'&&e.target.files[0])importFile(e.target.files[0])});
document.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.input;if(k==='docq'){S.docQ=e.target.value;render()}else if(k==='q'){S.q=e.target.value;render()}});
window.addEventListener('focus',()=>{if(S.auth==='app'&&Date.now()-(S._lastFocus||0)>60000){S._lastFocus=Date.now();refresh(true)}});
setInterval(()=>{if(S.auth==='app'&&document.visibilityState==='visible'&&!$('#drawer').classList.contains('open')&&!$('#modal').classList.contains('open'))refresh(true)},120000);

initAuth();
