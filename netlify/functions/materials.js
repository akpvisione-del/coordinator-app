'use strict';
const M=require('../../public/pro-model');
const {rpc}=require('./pro');
const statuses=['TO_BUY','ORDERED','PURCHASED'];
function invalid(){throw Object.assign(new Error('Sprawdź pozycję zakupów.'),{status:422});}
function validate(b,worker,UUID){
 const allowed=worker?['id','expected_revision','client_id','status']:['id','expected_revision','client_id','status','name','quantity','unit','supplier','notes','quote_version','quote_variant','quote_line'];
 if(Object.keys(b).some(k=>!allowed.includes(k))||!UUID.test(b.id||'')||!UUID.test(b.client_id||'')||!Number.isSafeInteger(b.expected_revision)||b.expected_revision<(worker?1:0)||!statuses.includes(b.status))invalid();
 if(worker)return;
 if(typeof b.supplier!=='string'||b.supplier.length>160||typeof b.notes!=='string'||b.notes.length>1000)invalid();
 if(b.quote_version!==null){if(!Number.isSafeInteger(b.quote_version)||b.quote_version<1||!UUID.test(b.quote_variant||'')||!UUID.test(b.quote_line||'')||b.name!==null||b.quantity!==null||b.unit!==null)invalid();}
 else {if(b.quote_variant!==null||b.quote_line!==null||typeof b.name!=='string'||!b.name.trim()||b.name.length>200||!M.units.includes(b.unit))invalid();M.decimal(b.quantity,3,1000000000);}
}
module.exports=async(event,cfg,a,path,h)=>{
 const parts=path.split('/').filter(Boolean),job=parts[1],method=event.httpMethod||'GET';
 if(!h.UUID.test(job||''))invalid();
 if(!['worker','coordinator'].includes(a.role))return h.reply(403,{message:'Brak uprawnień.'});
 if(parts.length===3&&method==='GET')return h.reply(200,await rpc(cfg,a,'akp_pro_material_read',{p_job:job},h),a.fresh);
 if(parts.length===3&&method==='POST'){
  const b=h.bodyJson(event);validate(b,a.role==='worker',h.UUID);
  const data=a.role==='worker'?{p_job:job,p_id:b.id,p_expected:b.expected_revision,p_client:b.client_id,p_status:b.status}:{p_job:job,p_id:b.id,p_expected:b.expected_revision,p_client:b.client_id,p_data:Object.fromEntries(Object.entries(b).filter(([key])=>!['id','expected_revision','client_id'].includes(key)))};
  return h.reply(200,await rpc(cfg,a,a.role==='worker'?'akp_pro_material_status':'akp_pro_material_save',data,h),a.fresh);
 }
 return h.reply(404,{message:'Nie znaleziono zasobu.'});
};
module.exports.validate=validate;
