'use strict';
// Real Netlify and Edge handlers; synthetic in-memory Auth/PostgREST transport only.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {handler}=require('../../netlify/functions/api');
const ID={coord:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',worker:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',job:'11111111-1111-4111-8111-111111111111'};
const tokens={coord:'coord.test.jwt',worker:'worker.test.jwt'};
const json=(status,data)=>new Response(status===204?null:JSON.stringify(data),{status});
function fixture(){
 const profiles=[{user_id:ID.coord,role:'coordinator',is_active:true,display_name:'Test Coordinator'}];
 const users=new Map([[tokens.coord,{id:ID.coord,email:'coordinator@example.test',app_metadata:{akp_role:'coordinator'}}]]);
 const assignments=[],calls=[];
 let edge;
 const fetcher=async(url,options={})=>{
  const u=new URL(url),method=options.method||'GET',headers=new Headers(options.headers),token=(headers.get('authorization')||'').replace('Bearer ','');
  if(u.origin!=='https://mock.supabase.co')throw Error('External requests forbidden');
  const privileged=headers.get('apikey')==='sb_secret_SYNTHETIC';
  const user=users.get(token),profile=profiles.find(p=>p.user_id===user?.id);
  const coordinator=profile?.is_active===true&&profile.role==='coordinator';
  const worker=profile?.is_active===true&&profile.role==='worker';
  calls.push({path:u.pathname,method,privileged});
  if(u.pathname==='/functions/v1/akp-provision-worker')return edge(new Request(url,options));
  if(u.pathname==='/auth/v1/user')return json(user?200:401,user||{});
  if(u.pathname==='/auth/v1/admin/users'&&method==='POST'){
   if(!privileged)return json(403,{});
   const data=JSON.parse(options.body);
   if(users.has(tokens.worker))return json(422,{});
   users.set(tokens.worker,{id:ID.worker,email:data.email,app_metadata:data.app_metadata});
   return json(201,{id:ID.worker});
  }
  if(u.pathname==='/auth/v1/admin/users/'+ID.worker&&method==='PUT'){
   if(!privileged)return json(403,{});
   Object.assign(users.get(tokens.worker),JSON.parse(options.body));return json(200,{id:ID.worker});
  }
  if(!u.pathname.startsWith('/rest/v1/'))throw Error('Unexpected endpoint '+u.pathname);
  if(!privileged&&!user)return json(401,{});
  const name=u.pathname.split('/').pop();
  let rows;
  if(name==='akp_profiles')rows=profiles.filter(p=>privileged||coordinator||p.user_id===user.id);
  else if(name==='akp_assignments')rows=assignments.filter(a=>coordinator||(worker&&a.active&&a.worker_id===user.id));
  else if(name==='akp_jobs')rows=coordinator||(worker&&assignments.some(a=>a.active&&a.worker_id===user.id))?[{id:ID.job,title:'Synthetic job',status:'NOWE',priority:'NORMALNY'}]:[];
  else if(name==='akp_job_financials'){
   if(!coordinator)return json(403,{});
   rows=[{job_id:ID.job,revenue_net:9200,crew_cost:800}];
  }else if(['akp_job_sources','akp_audit','akp_reports','akp_checks','akp_photos'].includes(name))rows=[];
  else throw Error('Unexpected table '+name);
  rows=rows.filter(row=>[...u.searchParams].every(([k,v])=>!v.startsWith('eq.')||String(row[k])===v.slice(3)));
  if(method==='GET')return json(200,rows);
  const data=JSON.parse(options.body);
  if(name==='akp_profiles'&&method==='POST'&&privileged){profiles.push(data);return json(201,[data]);}
  if(name==='akp_profiles'&&method==='PATCH'&&privileged){
   if(Object.keys(data).some(k=>!['display_name','preferred_lang','is_active'].includes(k)))return json(403,{});
   rows.forEach(row=>Object.assign(row,data));return json(200,rows);
  }
  if(name==='akp_assignments'&&coordinator){
   if(method==='POST'){
    const row=assignments.find(a=>a.job_id===data.job_id&&a.worker_id===data.worker_id);
    if(row)Object.assign(row,data);else assignments.push(data);
    return json(201,[]);
   }
   if(method==='PATCH'){rows.forEach(row=>Object.assign(row,data));return json(200,rows);}
  }
  return json(403,{});
 };
 const env={SUPABASE_URL:'https://mock.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC'};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../supabase/functions/akp-provision-worker/index.ts'),'utf8'),{
  Deno:{env:{get:k=>env[k]},serve:h=>edge=h},fetch:fetcher,Response,AbortSignal,JSON,URL,Error
 });
 async function call(route,{role='coord',method='GET',body,origin='https://sprint.example.test',proof=true}={}){
  const result=await handler({path:'/api'+route,httpMethod:method,headers:{cookie:'akp_access='+tokens[role],origin,...(proof?{'x-akp-request':'commander-v10'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:result.statusCode,data:JSON.parse(result.body)};
 }
 return {call,fetcher,profiles,users,assignments,calls};
}
module.exports={fixture,ID,tokens};
