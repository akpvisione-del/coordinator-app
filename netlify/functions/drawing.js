'use strict';
const M=require('../../public/drawing-model');
const {rpc}=require('./pro');
module.exports=async(event,cfg,a,path,h)=>{
 const p=path.split('/').filter(Boolean),job=p[1],photo=p[3],method=event.httpMethod||'GET';
 const bad=()=>{throw Object.assign(new Error('Nieprawidłowy zapis rysunku.'),{status:422});};
 if(!h.UUID.test(job||'')||!h.UUID.test(photo||''))bad();
 if(p.length!==4)return h.reply(404,{message:'Nie znaleziono zasobu.'});
 if(method==='GET'){
  const q=event.queryStringParameters||Object.fromEntries(new URL(event.path,'https://local.invalid').searchParams),version=q.version?Number(q.version):null;
  if(version!==null&&(!Number.isSafeInteger(version)||version<1))bad();
  return h.reply(200,await rpc(cfg,a,'akp_pro_drawing_read',{p_job:job,p_photo:photo,p_version:version},h),a.fresh);
 }
 if(method==='POST'){
  const b=h.bodyJson(event);
  if(Object.keys(b).some(k=>!['client_id','expected_version','document'].includes(k))||!h.UUID.test(b.client_id||'')||!Number.isSafeInteger(b.expected_version)||b.expected_version<0)bad();M.validate(b.document);
  return h.reply(201,await rpc(cfg,a,'akp_pro_drawing_save',{p_job:job,p_photo:photo,p_expected:b.expected_version,p_client:b.client_id,p_document:b.document},h),a.fresh);
 }
 return h.reply(404,{message:'Nie znaleziono zasobu.'});
};
