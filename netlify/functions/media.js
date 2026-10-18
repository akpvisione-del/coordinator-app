'use strict';
const {createHash}=require('node:crypto');
const {rpc}=require('./pro');
const MAX=3*1024*1024;
const MIME={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
function bad(message,status=422){throw Object.assign(new Error(message),{status});}
function validImage(data,type){return type==='image/jpeg'?data.length>=4&&data[0]===255&&data[1]===216&&data[2]===255:type==='image/png'?data.length>=24&&data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/webp'?data.length>=16&&data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP':false;}
function meta(b){
 if(!['BEFORE','DURING','AFTER','DEFECT','PROTOCOL'].includes(b.stage)||!['GENERAL','MEASUREMENT','PROGRESS','ISSUE','ACCEPTANCE'].includes(b.category)||typeof b.caption!=='string'||b.caption.length>500)bad('Sprawdź opis, kategorię i etap zdjęcia.');
}
function safePath(path,job){return typeof path==='string'&&path.split('/').length===2&&path.startsWith(job+'/')&&/^[A-Za-z0-9_.-]+$/.test(path.split('/')[1])&&!path.split('/')[1].startsWith('.');}
async function storage(cfg,a,path,options={}){
 const response=await fetch(cfg.url+'/storage/v1/'+path,{...options,headers:{apikey:cfg.key,Authorization:'Bearer '+a.token,...options.headers},signal:AbortSignal.timeout(20000)});
 return response;
}
async function bytes(response,max=4*1024*1024){
 if(Number(response.headers.get('content-length'))>max)bad('Plik jest za duży do podglądu przez API.',413);
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)bad('Plik jest za duży do podglądu przez API.',413);chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>{});}
 return Buffer.concat(chunks);
}
module.exports=async(event,cfg,a,path,h)=>{
 const p=path.split('/').filter(Boolean),job=p[1],method=event.httpMethod||'GET';
 if(!h.UUID.test(job||''))bad('Nieprawidłowe zlecenie.');
 const call=(name,data)=>rpc(cfg,a,name,{p_job:job,...data},h);
 if(p.length===3&&method==='GET'){
  const q=event.queryStringParameters||Object.fromEntries(new URL(event.path,'https://local.invalid').searchParams);
  if(q.before&&!h.UUID.test(q.before))bad('Nieprawidłowa strona zdjęć.');
  return h.reply(200,await call('akp_pro_photo_list',{p_before:q.before||null}),a.fresh);
 }
 if(p.length===4&&p[3]==='uploads'&&method==='POST'){
  const b=h.bodyJson(event);
  if(Object.keys(b).some(k=>!['id','mime_type','size','sha256','caption','stage','category'].includes(k))||!h.UUID.test(b.id||'')||!MIME[b.mime_type]||!Number.isSafeInteger(b.size)||b.size<1||b.size>MAX||typeof b.sha256!=='string'||!/^[0-9a-f]{64}$/.test(b.sha256))bad('Zdjęcie: JPEG, PNG lub WebP, maksymalnie 3 MB.');
  meta(b);return h.reply(201,await call('akp_pro_photo_prepare',{p_id:b.id,p_data:b}),a.fresh);
 }
 if(p[3]==='uploads'&&p.length===6&&h.UUID.test(p[4])&&p[5]==='file'&&method==='PUT'){
  if(!event.isBase64Encoded||typeof event.body!=='string'||event.body.length>Math.ceil(MAX/3)*4+4)bad('Nieprawidłowy plik.',413);
  const data=Buffer.from(event.body,'base64');
  const slot=await call('akp_pro_photo_slot',{p_id:p[4]});
  if(!safePath(slot.storage_path,job)||!MIME[slot.mime_type])bad('Nieprawidłowa rezerwacja pliku.',409);
  if(data.length!==slot.size||data.length>MAX||createHash('sha256').update(data).digest('hex')!==slot.sha256||!validImage(data,slot.mime_type))bad('Plik nie odpowiada rezerwacji. Wybierz ponownie oryginał.');
  const object='akp-job-media/'+slot.storage_path.split('/').map(encodeURIComponent).join('/');
  const response=await storage(cfg,a,'object/'+object,{method:'POST',headers:{'Content-Type':slot.mime_type,'x-upsert':'false'},body:data});
  if(!response.ok){
   const error=await response.json().catch(()=>({}));
   if(response.status!==409&&error.statusCode!=='409'&&error.error!=='Duplicate')bad('Nie potwierdzono przesłania pliku. Rezerwacja jest zachowana.',503);
   // An immutable retry is complete only when the stored bytes really match.
   const prior=await storage(cfg,a,'object/authenticated/'+object);
   if(!prior.ok)bad('Nie potwierdzono istniejącego pliku.',503);
   if(createHash('sha256').update(await bytes(prior,MAX)).digest('hex')!==slot.sha256)bad('Istniejący plik ma inną zawartość. Nie nadpisano go.',409);
  }
  return h.reply(201,await call('akp_pro_photo_complete',{p_id:p[4]}),a.fresh);
 }
 if(p[3]==='photos'&&h.UUID.test(p[4]||'')){
  if(p.length===5&&method==='POST'){
   const b=h.bodyJson(event);meta(b);
   if(Object.keys(b).some(k=>!['client_id','expected_revision','caption','stage','category'].includes(k))||!h.UUID.test(b.client_id||'')||!Number.isSafeInteger(b.expected_revision)||b.expected_revision<0)bad('Nieprawidłowa wersja metadanych.');
   return h.reply(200,await call('akp_pro_photo_meta_save',{p_id:p[4],p_expected:b.expected_revision,p_client:b.client_id,p_data:{caption:b.caption,stage:b.stage,category:b.category}}),a.fresh);
  }
  if(p.length===6&&p[5]==='file'&&method==='GET'){
   const item=await call('akp_pro_photo_file',{p_id:p[4]});
   if(!safePath(item.storage_path,job)||!['akp-job-media','job-photos'].includes(item.bucket))bad('Dla tego historycznego zdjęcia brak bezpiecznej ścieżki Storage.',404);
   const response=await storage(cfg,a,'object/authenticated/'+item.bucket+'/'+item.storage_path.split('/').map(encodeURIComponent).join('/'));
   if(!response.ok)bad('Plik nie jest dostępny. Zachowano jego metadane.',response.status===403?403:404);
   const data=await bytes(response),type=(response.headers.get('content-type')||'').split(';')[0];
   if(!validImage(data,type))bad('Nieobsługiwany format oryginału. Zachowano plik i metadane.',422);
   const r=h.reply(200,{},a.fresh,{'Content-Type':type,'Content-Disposition':'inline; filename="AKP-photo-'+p[4]+'.'+MIME[type]+'"'});
   return {...r,isBase64Encoded:true,body:data.toString('base64')};
  }
 }
 return h.reply(404,{message:'Nie znaleziono zasobu.'});
};
module.exports._test={MAX,MIME,validImage,safePath,meta,bytes};
