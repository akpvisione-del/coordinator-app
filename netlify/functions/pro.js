'use strict';
const model=require('../../public/pro-model');
function bad(message,status=422){throw Object.assign(new Error(message),{status});}
async function rpc(cfg,a,name,data,h){
 try{return await h.sbFetch(cfg,'/rest/v1/rpc/'+name,{method:'POST',token:a.token,data});}
 catch(e){
  if(e.providerCode==='P0002')bad('Nie znaleziono wersji.',404);
  if(e.providerCode==='40001'||e.providerCode==='23505')bad('Dane zostały zmienione. Zachowano szkic; wczytaj najnowszą wersję.',409);
  if(e.status===403||e.providerCode==='42501')bad('Brak uprawnień.',403);
  if(e.providerCode==='22023'||e.providerCode==='23514')bad('Nieprawidłowe dane.',422);
  bad('Moduł wymaga zatwierdzenia konfiguracji SUPERSPRINT 03. Nie zapisano danych.',503);
 }
}
module.exports=async function proRoute(event,cfg,a,path,h){
 const parts=path.split('/').filter(Boolean),method=event.httpMethod||'GET';
 const job=parts[1];if(!h.UUID.test(job||''))bad('Nieprawidłowe zlecenie.');
 if(a.role!=='coordinator')return h.reply(403,{message:'Wyceny są dostępne wyłącznie koordynatorowi.'});
 const q=event.queryStringParameters||Object.fromEntries(new URL(event.path,'https://local.invalid').searchParams);
 const version=q.version?Number(q.version):null;
 if(version!==null&&(!Number.isSafeInteger(version)||version<1))bad('Nieprawidłowa wersja.');
 if(parts.length===3&&method==='GET')return h.reply(200,await rpc(cfg,a,'akp_pro_quote_read',{p_job:job,p_version:version},h),a.fresh);
 if(parts.length===3&&method==='POST'){
  const b=h.bodyJson(event);
  if(Object.keys(b).some(k=>!['expected_version','client_id','document'].includes(k))||!Number.isSafeInteger(b.expected_version)||b.expected_version<0||!h.UUID.test(b.client_id||''))bad('Nieprawidłowy zapis wyceny.');
  model.validate(b.document);
  const result=await rpc(cfg,a,'akp_pro_quote_save',{p_job:job,p_expected:b.expected_version,p_client:b.client_id,p_document:b.document},h);
  return h.reply(201,result,a.fresh);
 }
 if(parts.length===4&&parts[3]==='pdf'&&method==='GET'){
  const result=await rpc(cfg,a,'akp_pro_quote_read',{p_job:job,p_version:version},h);
  if(!result.document)bad('Najpierw zapisz wycenę.',404);model.validate(result.document);
  const variant=result.document.variants.find(v=>v.id===q.variant)||(!q.variant?result.document.variants[0]:null);
  if(!variant)bad('Nieprawidłowy wariant.');
  const data=await require('./quote-pdf')(result,variant,job);
  const r=h.reply(200,{},a.fresh,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="AKP-wycena-v'+result.version+'.pdf"'});
  return {...r,isBase64Encoded:true,body:data.toString('base64')};
 }
 return h.reply(404,{message:'Nie znaleziono zasobu.'});
};
module.exports.rpc=rpc;
