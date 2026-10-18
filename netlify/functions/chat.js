'use strict';
// JWT + current active profile are verified by api.js before this router runs.
// All durable operations use restricted, transaction-safe Supabase RPCs + RLS.
module.exports=async function chatRoute(event,cfg,actor,path,helpers){
 const {reply,bodyJson,UUID,sbFetch}=helpers,method=(event.httpMethod||'GET').toUpperCase();
 const url=new URL(event.path,'https://internal.invalid'),parts=path.split('/').filter(Boolean);
 const fail=(status,message)=>Object.assign(new Error(message),{status,publicMessage:message});
 // Netlify separates queryStringParameters from path; local Express uses originalUrl.
 for(const [name,value] of Object.entries(event.queryStringParameters||{})){if(typeof value!=='string')throw fail(422,'Nieprawidłowy filtr.');url.searchParams.set(name,value);}
 const uuid=value=>{if(typeof value!=='string'||!UUID.test(value))throw fail(422,'Nieprawidłowy identyfikator.');return value;};
 const optionalUuid=value=>value===undefined||value===null?null:uuid(value);
 const form=allowed=>{const b=bodyJson(event);if(Object.keys(b).some(k=>!allowed.includes(k)))throw fail(422,'Niedozwolone pole formularza.');return b;};
 const integer=(name,fallback,min,max)=>{const raw=url.searchParams.get(name);if(raw===null)return fallback;if(!/^\d+$/.test(raw)||Number(raw)<min||Number(raw)>max)throw fail(422,'Nieprawidłowa strona wyników.');return Number(raw);};
 const rpc=async(name,data={})=>{
  try{return await sbFetch(cfg,'/rest/v1/rpc/akp_chat_'+name,{method:'POST',token:actor.token,data})}
  catch(e){
   if(e.providerCode==='23505')throw fail(409,'Ten identyfikator wysyłki dotyczy innej wiadomości.');
   if(e.providerCode==='22023')throw fail(422,'Sprawdź wiadomość, odbiorcę i powiązane zlecenie.');
   if(e.status===403||e.providerCode==='42501')throw fail(403,'Rozmowa lub zlecenie nie są dostępne.');
   throw fail(503,'Komunikator jest niedostępny. Wymaga zatwierdzonej konfiguracji bazy. Nie zapisano potwierdzonej wiadomości.');
  }
 };
 if(path==='/chat/recipients'&&method==='GET')return reply(200,{items:await rpc('recipients')},actor.fresh);
 if(path==='/chat/threads'&&method==='GET')return reply(200,await rpc('threads_list',{p_offset:integer('offset',0,0,100000),p_limit:integer('limit',50,1,100)}),actor.fresh);
 if(path==='/chat/notifications'&&method==='GET'){
  const result=await rpc('threads_list',{p_offset:0,p_limit:1});return reply(200,{unread_total:result.unread_total},actor.fresh);
 }
 if(path==='/chat/threads'&&method==='POST'){
  const b=form(['other_user_id','job_id']);
  return reply(201,{thread:await rpc('create_thread',{p_other:uuid(b.other_user_id),p_job:optionalUuid(b.job_id)})},actor.fresh);
 }
 if(parts[1]==='threads'&&parts.length===4){
  const thread=uuid(parts[2]);
  if(parts[3]==='messages'&&method==='GET'){
   const before=url.searchParams.get('before'),search=url.searchParams.get('q')||'';
   if(search.length>100||before!==null&&(!/^[1-9]\d{0,18}$/.test(before)||BigInt(before)>9223372036854775807n))throw fail(422,'Nieprawidłowy filtr wiadomości.');
   return reply(200,await rpc('messages_list',{p_thread:thread,p_before:before,p_search:search,p_limit:integer('limit',50,1,100)}),actor.fresh);
  }
  if(parts[3]==='messages'&&method==='POST'){
   const b=form(['body','client_id','language','job_id']);
   if(typeof b.body!=='string'||!b.body.trim()||b.body.trim().length>4000||b.language!==undefined&&!['pl','uk','ru','en'].includes(b.language))throw fail(422,'Wiadomość: 1–4000 znaków i obsługiwany język.');
   return reply(201,{message:await rpc('send',{p_thread:thread,p_client_id:uuid(b.client_id),p_body:b.body.trim(),p_language:b.language||'pl',p_job:optionalUuid(b.job_id)})},actor.fresh);
  }
  if(parts[3]==='read'&&method==='POST'){
   const b=form(['message_id']);return reply(200,await rpc('mark_read',{p_thread:thread,p_message:uuid(b.message_id)}),actor.fresh);
  }
 }
 return reply(404,{message:'Nie znaleziono zasobu.'});
};
