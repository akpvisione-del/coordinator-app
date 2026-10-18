/** AKP Commander v10 — Netlify Functions / Supabase authenticated REST bridge.
 * SECURITY: user data uses authenticated REST + RLS. Worker provisioning is isolated
 * in server-only worker-admin.js and requires a separate privileged environment key.
 * Data operations are additionally enforced by Postgres Row Level Security.
 */
'use strict';

const BASE = '/.netlify/functions/api';
const googleImport = require('./google-import');
const workerAdmin = require('./worker-admin');
const chatRoute = require('./chat');
const proRoute = require('./pro');
const materialsRoute = require('./materials');
const mediaRoute = require('./media');
const drawingRoute = require('./drawing');
const FIELDS = 'id,reference,title,location,due_date,status,priority,instructions,akp_id,lm_number,iproc_number,client_name,client_phone,client_email,client_address,created_at,updated_at';
const CHECKS = [
  'Sprawdź zakres i dokumentację', 'Zabezpiecz stanowisko',
  'Potwierdź wymiary i kolizje', 'Zweryfikuj materiały',
  'Wykonaj prace', 'Skontroluj jakość',
  'Udokumentuj rezultat', 'Zgłoś zakończenie lub przeszkody'
];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE_BASE = 'Path=/; HttpOnly; Secure; SameSite=Strict';

function config(){
  const url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  const origin = (process.env.APP_ORIGIN || '').replace(/\/$/, '');
  const ready = /^https:\/\/[^/]+\.supabase\.co$/.test(url) && !!key && !!origin;
  return {url, key, origin, ready};
}
function reply(status, payload, cookies = [], headers = {}){
  return {
    statusCode:status,
    headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff',...headers},
    ...(cookies.length?{multiValueHeaders:{'Set-Cookie':cookies}}:{}),
    body:JSON.stringify(payload)
  };
}
function cookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; ${COOKIE_BASE}; Max-Age=${maxAge}`;}
function expireCookies(){return [cookie('akp_access','',0),cookie('akp_refresh','',0)];}
function cookiesFrom(headers){
  const result={};
  const raw=headers.cookie||headers.Cookie||'';
  for(const kv of raw.split(';')){
    const at=kv.indexOf('=');if(at<0)continue;
    const k=kv.slice(0,at).trim();
    try{result[k]=decodeURIComponent(kv.slice(at+1).trim())}catch{}
  }
  return result;
}
function bodyJson(event){
  const raw=event.body||'';
  if(raw.length>24000)throw Object.assign(new Error('Zbyt duże żądanie.'),{status:413});
  let value;
  try{value=raw?JSON.parse(raw):{}}catch{throw Object.assign(new Error('Nieprawidłowy JSON.'),{status:400})}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('Nieprawidłowy formularz.'),{status:422});
  return value;
}
function pickText(value,max=250){return typeof value==='string'?value.trim().slice(0,max):''}
function validDate(value){
  return typeof value==='string'&&/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)&&
    Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
}
function notFound(){return reply(404,{message:'Nie znaleziono zasobu.'});}
function deny(){return reply(403,{message:'Brak uprawnień.'});}
function pathFrom(event){
  const p=(event.path||'').split('?')[0];
  if(p.startsWith('/api/'))return p.slice(4);
  const i=p.indexOf('/.netlify/functions/api');
  if(i>=0)return p.slice(i+BASE.length)||'/';
  return '/';
}
function mustUuid(value){if(!UUID.test(value||''))throw Object.assign(new Error('Nieprawidłowy identyfikator.'),{status:400});return value}
function safeError(e){
  const allowed=[400,401,403,404,409,413,422,503];
  return reply(allowed.includes(e.status)?e.status:502,{message: e.publicMessage || (allowed.includes(e.status)?e.message:'Usługa danych jest chwilowo niedostępna.')});
}
// Brak bazy DEMO w runtime: testy korzystaja z izolowanych atrap HTTP.
async function sbFetch(cfg, path, {method='GET',data,token,prefer}={}){
  if (!cfg.ready) {
    throw Object.assign(new Error('Supabase nie jest skonfigurowany.'),{status:503});
  }
  const headers={apikey:cfg.key,Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(data!==undefined)headers['Content-Type']='application/json';
  if(prefer)headers.Prefer=prefer;
  const response=await fetch(cfg.url+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(12000)});
  let json=null;const t=await response.text();try{json=t?JSON.parse(t):null}catch{json={message:'Błąd formatu usługi danych.'}}
  if(!response.ok){
    const err=new Error('Błąd połączenia z bazą.');err.status=response.status===401?401:response.status===403?403:response.status===409?409:502;
    err.providerCode=json?.code;throw err;
  }
  return json;
}
async function auth(cfg,event){
  const c=cookiesFrom(event.headers||{});
  if(!c.akp_access&&!c.akp_refresh)return null;
  let access=c.akp_access;let fresh=[];
  const getUser=async(jwt)=>{
    try{return await sbFetch(cfg,'/auth/v1/user',{token:jwt})}catch(e){if(e.status===401)return null;throw e}
  };
  let user=access?await getUser(access):null;
  if(!user&&c.akp_refresh){
    try{
      const tokens=await sbFetch(cfg,'/auth/v1/token?grant_type=refresh_token',{method:'POST',data:{refresh_token:c.akp_refresh}});
      access=tokens.access_token;
      user=await getUser(access);
      if(user)fresh=[cookie('akp_access',access,Math.min(tokens.expires_in||3600,3600)),cookie('akp_refresh',tokens.refresh_token,60*60*24*14)];
    }catch(e){if(e.status!==401)throw e}
  }
  if(!user)return null;
  const role=user.app_metadata?.akp_role;
  if(role!=='coordinator'&&role!=='worker')return null;
  // Fail closed if account has no provisioned profile or its role does not match signed Auth metadata.
  const rows=await table(cfg,{token:access},'akp_profiles',{select:'role,display_name,is_active',user_id:'eq.'+user.id,limit:'1'});
  if(rows.length!==1||rows[0].role!==role||rows[0].is_active!==true)return null;
  return {user,role,token:access,fresh,display:rows[0].display_name};
}
async function table(cfg,auth,tableName,query={},opts={}){
  const u=new URLSearchParams(query);
  return sbFetch(cfg,`/rest/v1/${tableName}${u.size?'?'+u.toString():''}`,{token:auth.token,...opts});
}
async function one(cfg,a,name,query,notFoundStatus=404){
  const rows=await table(cfg,a,name,{...query,limit:'1'});
  if(!rows||!rows.length)throw Object.assign(new Error('Nie znaleziono zasobu.'),{status:notFoundStatus});
  return rows[0];
}
async function loadJobs(cfg,a){
  const jobs=await table(cfg,a,'akp_jobs',{select:FIELDS,order:'due_date.asc.nullslast',limit:'500'});
  if(!jobs.length)return [];
  const assignments=await table(cfg,a,'akp_assignments',{select:'job_id,worker_id,active',active:'eq.true',limit:'500'});
  const assignmentsByJob=new Map();
  for(const row of assignments){
    if(!assignmentsByJob.has(row.job_id))assignmentsByJob.set(row.job_id,[]);
    assignmentsByJob.get(row.job_id).push(row.worker_id);
  }
  let finances=new Map();
  if(a.role==='coordinator'){
    const f=await table(cfg,a,'akp_job_financials',{select:'job_id,revenue_net,crew_cost',limit:'500'});
    finances=new Map(f.map(x=>[x.job_id,x]));
  }
  return jobs.map(j=>{
    const f=finances.get(j.id)||{};
    const workerList=assignmentsByJob.get(j.id)||[];
    const out={
      id:j.id,reference:j.reference||'',title:j.title,location:j.location||'',due:j.due_date,
      status:j.status,priority:j.priority,instructions:j.instructions||'',
      // These columns are already selected by FIELDS. The client filters and on-site actions
      // need them in the list response, not just the detail response.
      akp_id:j.akp_id||null,lm_number:j.lm_number||null,iproc_number:j.iproc_number||null,
      client_name:j.client_name||null,client_phone:j.client_phone||null,
      client_address:j.client_address||null,
      assignee:workerList[0]||null,assignees:workerList,updated_at:j.updated_at
    };
    if(a.role==='coordinator'){
      out.revenue_net=f.revenue_net??null;out.crew_cost=f.crew_cost??null;
      out.margin_net=(f.revenue_net!=null&&f.crew_cost!=null)?Number(f.revenue_net)-Number(f.crew_cost):null;
    }
    return out;
  });
}
async function isAssigned(cfg,a,job){
  if(a.role!=='worker')return false;
  const rows=await table(cfg,a,'akp_assignments',{select:'job_id',job_id:'eq.'+job,worker_id:'eq.'+a.user.id,active:'eq.true',limit:'1'});
  return rows.length===1;
}
// Historia mutacji jest zapisywana przez PostgreSQL akp_internal.log_change()
// (jobs, assignments, checks, reports, financials; photos po migracji 004).
// Nie wysyłamy bezskutecznych INSERT do tabeli akp_audit przez JWT.
function checkOrigin(event,cfg,method){
  if(['GET','HEAD','OPTIONS'].includes(method))return true;
  const h=event.headers||{};
  const origin=h.origin||h.Origin;
  if(cfg.origin){
    const allowed = cfg.origin.split(',').map(x=>x.trim().replace(/\/$/,''));
    if(!origin || !allowed.includes(origin.replace(/\/$/,'')))return false;
  }
  const proof=h['x-akp-request']||h['X-Akp-Request'];
  return proof==='commander-v10';
}
async function route(event,cfg,a,path){
  const method=(event.httpMethod||'GET').toUpperCase();
  const parts=path.split('/').filter(Boolean);
  if(parts[0]==='jobs'&&parts[2]==='drawings')return drawingRoute(event,cfg,a,path,{reply,bodyJson,UUID,sbFetch});
  if(parts[0]==='jobs'&&parts[2]==='media')return mediaRoute(event,cfg,a,path,{reply,bodyJson,UUID,sbFetch});
  if(parts[0]==='jobs'&&parts[2]==='materials')return materialsRoute(event,cfg,a,path,{reply,bodyJson,UUID,sbFetch});
  if(parts[0]==='jobs'&&parts[2]==='quote')return proRoute(event,cfg,a,path,{reply,bodyJson,UUID,sbFetch});
  if(parts[0]==='chat')return chatRoute(event,cfg,a,path,{reply,bodyJson,UUID,sbFetch});
  if(method==='GET'&&parts.length===3&&((parts[0]==='team'&&parts[2]==='history')||(parts[0]==='jobs'&&parts[2]==='assignment-history'))){
    if(a.role!=='coordinator')return deny();
    if(!UUID.test(parts[1]))return reply(422,{message:'Nieprawidłowy identyfikator.'});
    const q=event.queryStringParameters||Object.fromEntries(new URL(event.path,'https://local.invalid').searchParams);
    if(q.before&&(!/^[1-9]\d{0,18}$/.test(q.before)||BigInt(q.before)>9223372036854775807n))return reply(422,{message:'Nieprawidłowa strona historii.'});
    try{
      const result=await sbFetch(cfg,'/rest/v1/rpc/akp_team_history',{method:'POST',token:a.token,data:{p_worker:parts[0]==='team'?parts[1]:null,p_job:parts[0]==='jobs'?parts[1]:null,p_before:q.before||null,p_limit:50}});
      return reply(200,result,a.fresh);
    }catch{return reply(503,{message:'Historia wymaga zatwierdzonej konfiguracji audytu. Nie odtwarzamy brakujących zdarzeń.'});}
  }
  if(path==='/team/invite'&&method==='POST'){
    if(a.role!=='coordinator')return deny();
    const b=bodyJson(event);
    if(Object.keys(b).some(k=>!['name','email','language','confirm_access'].includes(k)))return reply(422,{message:'Nieprawidłowy formularz zaproszenia.'});
    if(typeof b.name!=='string'||b.name.trim().length<2||b.name.length>100||typeof b.email!=='string'||!/^\S+@\S+\.\S+$/.test(b.email)||b.email.length>250||!['pl','uk','ru','en'].includes(b.language)||b.confirm_access!==true)return reply(422,{message:'Sprawdź imię, e-mail, język i zgodę.'});
    const result=await sbFetch(cfg,'/functions/v1/akp-provision-worker',{method:'POST',token:a.token,data:{...b,action:'invite_worker'}});
    if(!result?.worker||!UUID.test(result.worker.id)||result.worker.role!=='worker')return reply(503,{message:'Nie potwierdzono zaproszenia. Sprawdź listę kont przed ponowieniem.'});
    return reply(201,{worker:result.worker,invited:true},a.fresh);
  }
  if(path==='/me'&&method==='GET'){
    const prof=await table(cfg,a,'akp_profiles',{select:'preferred_lang,phone,is_active',user_id:'eq.'+a.user.id,limit:'1'});
    const p=prof[0]||{};
    return reply(200,{id:a.user.id,display:a.display,role:a.role,email:a.user.email,preferred_lang:p.preferred_lang||'pl',phone:p.phone||null},a.fresh);
  }
  if((path==='/profile'||path==='/me')&&method==='PATCH'){
    const b=bodyJson(event);
    if(b.role!==undefined||b.is_active!==undefined||b.user_id!==undefined||b.email!==undefined){
      if(a.role!=='coordinator')return reply(403,{message:'Pracownik nie może zmieniać roli, statusu konta ani adresu e-mail.'});
    }
    const updateData={};
    if(b.preferred_lang!==undefined){
      const lang=String(b.preferred_lang).toLowerCase().trim();
      if(!['pl','uk','ru','en'].includes(lang))return reply(422,{message:'Niedozwolony kod języka. Dozwolone: pl, uk, ru, en.'});
      updateData.preferred_lang=lang;
    }
    if(b.phone!==undefined){
      updateData.phone=pickText(b.phone,30);
    }
    if(a.role==='coordinator'){
      if(b.display_name!==undefined)updateData.display_name=pickText(b.display_name,100);
      if(b.is_active!==undefined&&typeof b.is_active==='boolean')updateData.is_active=b.is_active;
    }
    if(Object.keys(updateData).length===0)return reply(422,{message:'Brak danych do aktualizacji.'});
    const updated=await table(cfg,a,'akp_profiles',{user_id:'eq.'+a.user.id},{method:'PATCH',data:updateData,prefer:'return=representation'});
    return reply(200,{ok:true,profile:updated[0]||updateData},a.fresh);
  }
  if(path==='/logout'&&method==='POST'){
    try{await sbFetch(cfg,'/auth/v1/logout',{method:'POST',token:a.token})}catch{}
    return reply(200,{ok:true},expireCookies());
  }
  if(path==='/jobs'&&method==='GET'){
    const jobs=await loadJobs(cfg,a);
    if(a.role==='coordinator'){
      const sources=await table(cfg,a,'akp_job_sources',{select:'job_id,source_record,synced_at',limit:'500'});
      const byJob=new Map(sources.map(x=>[x.job_id,x]));
      for(const j of jobs){const src=byJob.get(j.id);if(src)j.source={record:src.source_record,synced_at:src.synced_at};}
    }
    return reply(200,{items:jobs,total:jobs.length},a.fresh);
  }
  if(path==='/jobs'&&method==='POST'){
    if(a.role!=='coordinator')return deny();
    const b=bodyJson(event);
    const title=pickText(b.title,180);
    if(title.length<3)return reply(422,{message:'Nazwa zlecenia musi mieć co najmniej 3 znaki.'});
    if(b.due_date!==undefined&&b.due_date!==null&&b.due_date!==''&&!validDate(b.due_date))return reply(422,{message:'Nieprawidłowa data.'});
    const fields={title,reference:pickText(b.reference,80)||null,location:pickText(b.location,200)||null,due_date:b.due_date||null,status:'NOWE',priority:['NORMALNY','WYSOKI','KRYTYCZNY'].includes(b.priority)?b.priority:'NORMALNY',instructions:pickText(b.instructions,2500)};
    const created=await table(cfg,a,'akp_jobs',{}, {method:'POST',data:fields,prefer:'return=representation'});

    return reply(201,{job:created[0]},a.fresh);
  }
  if(parts[0]==='jobs'&&parts.length>=2&&UUID.test(parts[1])){
    const jobId=parts[1];
    if(parts.length===2&&method==='GET'){
      const job=await one(cfg,a,'akp_jobs',{select:FIELDS,id:'eq.'+jobId});
      if(a.role==='worker'&&!(await isAssigned(cfg,a,jobId)))return notFound();
      const steps=await table(cfg,a,'akp_checks',{select:'step_index,done',job_id:'eq.'+jobId,worker_id:'eq.'+a.user.id,limit:'50'});
      const photos=await table(cfg,a,'akp_photos',{select:'id,job_id,report_id,stage,storage_path,caption,created_at,uploaded_by',job_id:'eq.'+jobId,order:'created_at.desc',limit:'50'});
      let extra={};
      if(a.role==='coordinator'){
        const [fin, src, ass, aud, reps] = await Promise.all([
          table(cfg,a,'akp_job_financials',{select:'revenue_net,crew_cost',job_id:'eq.'+jobId,limit:'1'}),
          table(cfg,a,'akp_job_sources',{select:'source_record,synced_at',job_id:'eq.'+jobId,limit:'1'}),
          table(cfg,a,'akp_assignments',{select:'worker_id,active',job_id:'eq.'+jobId,active:'eq.true',limit:'50'}),
          table(cfg,a,'akp_audit',{select:'id,action,detail,created_at,actor_id',entity_id:'eq.'+jobId,order:'created_at.desc',limit:'20'}),
          table(cfg,a,'akp_reports',{select:'id,worker_id,note,issue,status,created_at,review_note',job_id:'eq.'+jobId,order:'created_at.desc',limit:'10'})
        ]);
        const f=fin[0]||{};
        extra.revenue_net=f.revenue_net??null;
        extra.crew_cost=f.crew_cost??null;
        extra.margin_net=(f.revenue_net!=null&&f.crew_cost!=null)?Number(f.revenue_net)-Number(f.crew_cost):null;
        extra.source=src[0]||null;
        extra.assignees=(ass||[]).map(x=>x.worker_id);
        extra.assignee=extra.assignees[0]||null;
        extra.audit=aud||[];
        extra.reports=reps||[];
      }
      return reply(200,{job:{id:job.id,reference:job.reference||'',title:job.title,location:job.location,due:job.due_date,status:job.status,priority:job.priority,instructions:job.instructions,akp_id:job.akp_id||null,lm_number:job.lm_number||null,iproc_number:job.iproc_number||null,client_name:job.client_name||null,client_phone:job.client_phone||null,client_email:job.client_email||null,client_address:job.client_address||null,updated_at:job.updated_at,created_at:job.created_at,...extra,photos,checklist:CHECKS.map((title,index)=>({index,title,done:steps.some(s=>s.step_index===index&&s.done)}))}},a.fresh);
    }
    if(parts.length===2&&method==='PATCH'){
      if(a.role!=='coordinator')return deny();
      const current=await one(cfg,a,'akp_jobs',{select:'id,reference,title,status,priority,updated_at',id:'eq.'+jobId});
      const b=bodyJson(event);
      if(typeof b.expected_updated_at!=='string'||!Number.isFinite(Date.parse(b.expected_updated_at))||Date.parse(b.expected_updated_at)!==Date.parse(current.updated_at))return reply(409,{message:'Zlecenie zmieniło się od ostatniego odczytu. Odśwież szczegóły przed zapisem.'});
      const title=b.title!==undefined?pickText(b.title,180):undefined;
      if(title!==undefined&&title.length<3)return reply(422,{message:'Nazwa zlecenia musi mieć co najmniej 3 znaki.'});
      if(b.due_date!==undefined&&b.due_date!==null&&b.due_date!==''&&!validDate(b.due_date))return reply(422,{message:'Nieprawidłowa data.'});
      
      const newRef=b.reference!==undefined?pickText(b.reference,80)||null:undefined;
      if(newRef&&newRef!==current.reference){
        const dupes=await table(cfg,a,'akp_jobs',{select:'id,reference',reference:'eq.'+newRef,limit:'1'});
        if(dupes.length>0&&dupes[0].id!==jobId){
          return reply(409,{message:'Istnieje już zlecenie o referencji '+newRef+' (duplikat).'});
        }
      }

      const ALLOWED_STATUS=['NOWE','DO_KONTAKTU','DO_UMOWIENIA','UMOWIONE','POMIAR','DO_WYCENY','WYCENA_W_TOKU','OCZEKUJE_NA_KLIENTA','OCZEKUJE_NA_MATERIAL','OCZEKUJE_NA_DOSTAWE','DO_REALIZACJI','W_REALIZACJI','WSTRZYMANE','DO_ODBIORU','DO_ROZLICZENIA','ZAKONCZONE','REKLAMACJA','SERWIS','ANULOWANE'];
      const status=b.status!==undefined?(ALLOWED_STATUS.includes(b.status)?b.status:current.status):undefined;
      const priority=b.priority!==undefined?(['NORMALNY','WYSOKI','KRYTYCZNY'].includes(b.priority)?b.priority:current.priority):undefined;

      const fields={};
      if(title!==undefined)fields.title=title;
      if(newRef!==undefined)fields.reference=newRef;
      if(b.location!==undefined)fields.location=pickText(b.location,200)||null;
      if(b.due_date!==undefined)fields.due_date=b.due_date||null;
      if(status!==undefined)fields.status=status;
      if(priority!==undefined)fields.priority=priority;
      if(b.instructions!==undefined)fields.instructions=pickText(b.instructions,2500);
      if(b.akp_id!==undefined)fields.akp_id=pickText(b.akp_id,50)||null;
      if(b.lm_number!==undefined)fields.lm_number=pickText(b.lm_number,50)||null;
      if(b.iproc_number!==undefined)fields.iproc_number=pickText(b.iproc_number,50)||null;
      if(b.client_name!==undefined)fields.client_name=pickText(b.client_name,120)||null;
      if(b.client_phone!==undefined)fields.client_phone=pickText(b.client_phone,50)||null;
      if(b.client_email!==undefined)fields.client_email=pickText(b.client_email,120)||null;
      if(b.client_address!==undefined)fields.client_address=pickText(b.client_address,200)||null;
      fields.updated_at=new Date().toISOString();

      const updated=await table(cfg,a,'akp_jobs',{id:'eq.'+jobId,updated_at:'eq.'+current.updated_at},{method:'PATCH',data:fields,prefer:'return=representation'});
      if(!updated.length)return reply(409,{message:'Zlecenie zmieniło się podczas zapisu. Odśwież szczegóły.'});

      return reply(200,{ok:true,job:updated[0]||fields},a.fresh);
    }
    if(parts[2]==='finance'&&parts.length===3&&method==='PATCH'){
      if(a.role!=='coordinator')return deny();
      await one(cfg,a,'akp_jobs',{select:'id',id:'eq.'+jobId});
      const b=bodyJson(event);
      const amount=x=>(x===null||x==='')?null:Number(x);
      const revenue=amount(b.revenue_net),cost=amount(b.crew_cost);
      if([revenue,cost].some(x=>x!==null&&(!Number.isFinite(x)||x<0||x>1000000000)))return reply(422,{message:'Kwoty muszą być dodatnie i w dozwolonym zakresie.'});
      await table(cfg,a,'akp_job_financials',{on_conflict:'job_id'}, {method:'POST',data:{job_id:jobId,revenue_net:revenue,crew_cost:cost},prefer:'resolution=merge-duplicates,return=minimal'});
      return reply(200,{ok:true},a.fresh);
    }
    if(parts[2]==='assign'&&parts.length===3&&(method==='POST'||method==='DELETE')){
      if(a.role!=='coordinator')return deny();
      await one(cfg,a,'akp_jobs',{select:'id',id:'eq.'+jobId});
      const b=bodyJson(event);
      const worker=typeof b.worker==='string'?b.worker.trim():'';
      const fields=new Set(['worker','action','unassign','active']);
      if(Object.keys(b).some(k=>!fields.has(k))||
        (b.action!==undefined&&!['assign','unassign'].includes(b.action))||
        (b.unassign!==undefined&&typeof b.unassign!=='boolean')||
        (b.active!==undefined&&typeof b.active!=='boolean'))return reply(422,{message:'Nieprawidłowa operacja przydziału. Nie zmieniono przydziałów.'});
      const signals=[method==='DELETE'?false:undefined,b.action===undefined?undefined:b.action==='unassign'?false:true,b.unassign===undefined?undefined:!b.unassign,b.active].filter(x=>x!==undefined);
      if(signals.some(x=>x!==signals[0]))return reply(422,{message:'Sprzeczne polecenia przydziału. Nie zmieniono przydziałów.'});
      // Never allow a missing worker to silently deactivate the entire team.
      // Legacy worker:null and DELETE /assign requests must fail closed.
      if(!UUID.test(worker))return reply(422,{message:'Wskaż konkretnego montera (poprawne UUID). Nie zmieniono przydziałów.'},a.fresh);
      const isUnassign=signals[0]===false;
      if(isUnassign){
        await table(cfg,a,'akp_assignments',{job_id:'eq.'+jobId,worker_id:'eq.'+worker},{method:'PATCH',data:{active:false},prefer:'return=minimal'});
        return reply(200,{ok:true,unassigned:worker},a.fresh);
      }
      const profile=await one(cfg,a,'akp_profiles',{select:'role,is_active',user_id:'eq.'+worker});
      if(profile.role!=='worker'||profile.is_active!==true)return reply(422,{message:'Wybrana osoba nie ma aktywnego konta montera.'});
      await table(cfg,a,'akp_assignments',{on_conflict:'job_id,worker_id'}, {method:'POST',data:{job_id:jobId,worker_id:worker,active:true},prefer:'resolution=merge-duplicates,return=minimal'});
      return reply(200,{ok:true,assigned:worker},a.fresh);
    }
    if(parts[2]==='checklist'&&parts.length===3&&method==='PATCH'){
      if(!(await isAssigned(cfg,a,jobId)))return notFound();
      const b=bodyJson(event);if(!Number.isInteger(b.index)||b.index<0||b.index>=CHECKS.length||typeof b.checked!=='boolean')return reply(422,{message:'Nieprawidłowy punkt checklisty.'});
      await table(cfg,a,'akp_checks',{on_conflict:'job_id,worker_id,step_index'},{method:'POST',data:{job_id:jobId,worker_id:a.user.id,step_index:b.index,done:b.checked},prefer:'resolution=merge-duplicates,return=minimal'});
      return reply(200,{ok:true},a.fresh);
    }
    if(parts[2]==='reports'&&parts.length===3&&method==='POST'){
      if(!(await isAssigned(cfg,a,jobId)))return notFound();
      const b=bodyJson(event);const key=pickText(b.idempotencyKey,100);
      if(!/^[A-Za-z0-9_-]{12,100}$/.test(key))return reply(422,{message:'Błędny identyfikator operacji.'});
      const payload={job_id:jobId,worker_id:a.user.id,idempotency_key:key,note:pickText(b.note,2000),issue:pickText(b.issue,1200),status:'SUBMITTED'};
      const check=await table(cfg,a,'akp_reports',{select:'id,status',worker_id:'eq.'+a.user.id,idempotency_key:'eq.'+key,limit:'1'});
      if(check.length)return reply(200,{report:check[0],duplicate:true},a.fresh);
      const rows=await table(cfg,a,'akp_reports',{}, {method:'POST',data:payload,prefer:'return=representation'});

      return reply(201,{report:rows[0]},a.fresh);
    }
    if(parts[2]==='photos'&&parts.length===3&&method==='POST'){
      if(a.role==='worker'&&!(await isAssigned(cfg,a,jobId)))return notFound();
      const b=bodyJson(event);
      const stage=['BEFORE','DURING','AFTER','DEFECT','PROTOCOL'].includes(b.stage)?b.stage:'DURING';
      const storagePath=pickText(b.storage_path||b.storagePath,300);
      if(!storagePath||!storagePath.startsWith(jobId+'/'))return reply(422,{message:'Ścieżka zdjęcia musi zaczynać się od identyfikatora zlecenia ('+jobId+'/)'});
      const segments=storagePath.split('/');
      if(segments.length!==2||!segments[1]||!/^[A-Za-z0-9._-]+$/.test(segments[1]))
        return reply(422,{message:'Nieprawidłowa ścieżka pliku zdjęcia.'});
      if(a.role==='worker'&&!segments[1].startsWith(a.user.id+'_'))
        return reply(422,{message:'Nazwa zdjęcia musi zaczynać się od pełnego ID zalogowanego montera.'});
      const reportId=b.report_id&&UUID.test(b.report_id)?b.report_id:null;
      const caption=pickText(b.caption,500)||null;
      const payload={
        job_id:jobId,
        report_id:reportId,
        stage,
        storage_path:storagePath,
        caption,
        uploaded_by:a.user.id
      };
      const created=await table(cfg,a,'akp_photos',{}, {method:'POST',data:payload,prefer:'return=representation'});

      return reply(201,{photo:created[0]},a.fresh);
    }
  }
  if(path==='/reports'&&method==='GET'){
    const rows=await table(cfg,a,'akp_reports',{select:'id,job_id,worker_id,note,issue,status,created_at,review_note',order:'created_at.desc',limit:'300'});
    const jobs=await loadJobs(cfg,a);const titles=new Map(jobs.map(x=>[x.id,x.title]));
    return reply(200,{items:rows.map(r=>({...r,job_title:titles.get(r.job_id)||'Zlecenie'}))},a.fresh);
  }
  if(parts[0]==='reports'&&parts.length===3&&parts[2]==='review'&&method==='POST'){
    if(a.role!=='coordinator')return deny();const id=mustUuid(parts[1]);const b=bodyJson(event);
    if(!['ACCEPTED','CHANGES_REQUESTED'].includes(b.decision))return reply(422,{message:'Nieprawidłowa decyzja.'});
    const rows=await table(cfg,a,'akp_reports',{id:'eq.'+id,status:'eq.SUBMITTED'}, {method:'PATCH',data:{status:b.decision,review_note:pickText(b.note,1200),reviewer_id:a.user.id,reviewed_at:new Date().toISOString()},prefer:'return=representation'});
    if(!rows.length)return reply(409,{message:'Raport zmieniono lub został już rozpatrzony.'});

    return reply(200,{report:rows[0]},a.fresh);
  }
  if(path==='/team'&&method==='POST'){
    if(a.role!=='coordinator')return deny();
    const worker=await workerAdmin.createWorker(cfg,a,bodyJson(event));
    return reply(201,{ok:true,worker},a.fresh);
  }
  if(parts[0]==='team'&&parts.length===2&&method==='PATCH'){
    if(a.role!=='coordinator')return deny();
    const id=parts[1];
    if(!UUID.test(id))return reply(422,{message:'Nieprawidłowy identyfikator montera.'});
    const b=bodyJson(event);
    if(!b||typeof b!=='object'||Array.isArray(b))return reply(422,{message:'Nieprawidłowy formularz.'});
    const allowed=new Set(['name','language','is_active']);
    if(Object.keys(b).some(k=>!allowed.has(k)))return reply(422,{message:'Nie można zmieniać roli, e-maila ani hasła w tym formularzu.'});
    const patch={action:'update_worker',worker_id:id};
    if(b.name!==undefined){
      if(typeof b.name!=='string'||b.name.trim().length<2||b.name.trim().length>100)return reply(422,{message:'Nazwa montera powinna mieć 2–100 znaków.'});
      patch.name=b.name.trim();
    }
    if(b.language!==undefined){
      if(!['pl','ru','uk','en'].includes(b.language))return reply(422,{message:'Nieprawidłowy język.'});
      patch.language=b.language;
    }
    if(b.is_active!==undefined){
      if(typeof b.is_active!=='boolean')return reply(422,{message:'Nieprawidłowy status konta.'});
      patch.is_active=b.is_active;
    }
    if(Object.keys(patch).length===2)return reply(422,{message:'Brak zmian do zapisania.'});
    const result=await sbFetch(cfg,'/functions/v1/akp-provision-worker',{method:'POST',token:a.token,data:patch});
    if(!result?.worker||result.worker.id!==id||result.worker.role!=='worker')return reply(503,{message:'Serwer nie potwierdził zmiany montera.'});
    return reply(200,{ok:true,worker:result.worker},a.fresh);
  }
  if(path==='/team'&&method==='GET'){
    if(a.role!=='coordinator')return deny();
    const x=await table(cfg,a,'akp_profiles',{select:'user_id,display_name,role,is_active,preferred_lang',role:'eq.worker',order:'display_name.asc'});
    return reply(200,{can_create:workerAdmin.available(),items:x.map(y=>({id:y.user_id,display:y.display_name,role:y.role,is_active:y.is_active===true,preferred_lang:y.preferred_lang||'pl'}))},a.fresh);
  }
  if(path==='/dashboard'&&method==='GET'){
    if(a.role!=='coordinator')return deny();
    const [jobs,reports]=await Promise.all([loadJobs(cfg,a),table(cfg,a,'akp_reports',{select:'id,status,issue',limit:'500'})]);
    return reply(200,{jobs:jobs.length,unassigned:jobs.filter(j=>!j.assignee).length,pending_reports:reports.filter(r=>r.status==='SUBMITTED').length,issues:reports.filter(r=>r.issue&&r.status==='SUBMITTED').length,mode:'AUTH+RLS'},a.fresh);
  }
  if(path==='/audit'&&method==='GET'){
    if(a.role!=='coordinator')return deny();
    const items=await table(cfg,a,'akp_audit',{select:'id,actor_id,action,entity_id,detail,created_at',order:'created_at.desc',limit:'100'});
    return reply(200,{items},a.fresh);
  }
  if(path==='/sources'&&method==='GET'){
    if(a.role!=='coordinator')return deny();
    const sources=await table(cfg,a,'akp_job_sources',{select:'synced_at',order:'synced_at.desc',limit:'500'});
    return reply(200,{status:sources.length?'IMPORTED':'EMPTY',count:sources.length,last_sync:sources[0]?.synced_at||null,sheet_id:googleImport.SHEET_ID,client_id:process.env.GOOGLE_CLIENT_ID||'',mode:'ON_DEMAND_READ_ONLY'},a.fresh);
  }
  if(path==='/google/sync'&&method==='POST'){
    if(a.role!=='coordinator')return deny();
    let rows;try{rows=await googleImport.readSheet(bodyJson(event).accessToken);}catch(e){return reply(422,{message:e.message},a.fresh);}
    const result=await sbFetch(cfg,'/rest/v1/rpc/akp_import_google',{method:'POST',token:a.token,data:{rows}});

    return reply(200,result,a.fresh);
  }
  return notFound();
}
exports.handler=async function handler(event){
  const cfg=config(),method=(event.httpMethod||'GET').toUpperCase(),path=pathFrom(event);
  if(path==='/health'){
    if(cfg.ready){
      return reply(200,{version:'v10-rc1',configured:true,mode:cfg.url.includes('ttectcuirgdakjhpkkll')?'SUPABASE_STAGING':'SUPABASE_CONFIGURED',data:'NO_EMBEDDED_DATA'});
    } else {
      return reply(503,{version:'v10-rc1',configured:false,mode:'UNCONFIGURED',data:'NO_EMBEDDED_DATA',message:'Brak konfiguracji Supabase lub APP_ORIGIN. Dostęp zablokowany.'});
    }
  }
  if(!cfg.ready)return reply(503,{message:'Instalacja oczekuje na konfigurację Supabase oraz APP_ORIGIN.'});
  if(!checkOrigin(event,cfg,method))return reply(403,{message:'Niedozwolone źródło żądania.'});
  try{
    // Password recovery: existing account only; provider validates the bearer.
    if(path==='/recovery/request'&&method==='POST'){
      const b=bodyJson(event),email=pickText(b.email,250);
      if(!/^\S+@\S+\.\S+$/.test(email))return reply(422,{message:'Podaj prawidłowy adres e-mail.'});
      const origin=(event.headers.origin||event.headers.Origin||'').replace(/\/$/,'');
      try{
        await sbFetch(cfg,'/auth/v1/recover?redirect_to='+encodeURIComponent(origin+'/'),{method:'POST',data:{email}});
      }catch{
        return reply(503,{message:'Nie udało się wysłać linku. Odczekaj kilka minut i spróbuj ponownie.'});
      }
      return reply(200,{ok:true,message:'Jeśli konto istnieje, otrzymasz wiadomość z linkiem do ustawienia hasła.'});
    }
    if(path==='/recovery/complete'&&method==='POST'){
      const b=bodyJson(event);
      const token=typeof b.access_token==='string'?b.access_token:'';
      const password=typeof b.password==='string'?b.password:'';
      if(!token||token.length>12000)return reply(401,{message:'Link wygasł lub jest nieprawidłowy. Poproś o nowy.'});
      if(password.length<12||password.length>256)return reply(422,{message:'Hasło musi mieć od 12 do 256 znaków.'});
      const account=await auth(cfg,{headers:{cookie:'akp_access='+encodeURIComponent(token)}});
      if(!account)return reply(401,{message:'Link wygasł lub konto nie ma aktywnego dostępu do AKP.'});
      try{
        await sbFetch(cfg,'/auth/v1/user',{method:'PUT',token:account.token,data:{password}});
      }catch{
        return reply(422,{message:'Nie udało się ustawić hasła. Wybierz inne hasło lub poproś o nowy link.'});
      }
      // Best effort revoke the recovery session; no token or password is returned.
      try{await sbFetch(cfg,'/auth/v1/logout?scope=global',{method:'POST',token:account.token})}catch{}
      return reply(200,{ok:true,message:'Hasło zmienione. Zaloguj się nowym hasłem.'},expireCookies());
    }
    if(path==='/login'&&method==='POST'){
      const b=bodyJson(event),email=pickText(b.email,250),password=typeof b.password==='string'?b.password:'';
      if(!/^\S+@\S+\.\S+$/.test(email)||password.length<6||password.length>256)return reply(401,{message:'Nieprawidłowy adres e-mail lub hasło.'});
      let tokens;
      try{tokens=await sbFetch(cfg,'/auth/v1/token?grant_type=password',{method:'POST',data:{email,password}})}catch{return reply(401,{message:'Nieprawidłowy adres e-mail lub hasło.'});}
      const au=await auth(cfg,{headers:{cookie:`akp_access=${encodeURIComponent(tokens.access_token)}`}});
      if(!au)return reply(403,{message:'Konto nie ma aktywnej roli w AKP.'});
      const c=[cookie('akp_access',tokens.access_token,Math.min(tokens.expires_in||3600,3600)),cookie('akp_refresh',tokens.refresh_token,60*60*24*14)];
      return reply(200,{id:au.user.id,display:au.display,role:au.role,email:au.user.email},c);
    }
    const a=await auth(cfg,event);
    if(!a)return reply(401,{message:'Sesja jest nieaktywna. Zaloguj się ponownie.'},expireCookies());
    return await route(event,cfg,a,path);
  }catch(e){return safeError(e)}
};
exports._test={pathFrom,checkOrigin,config,loadJobs,UUID};

