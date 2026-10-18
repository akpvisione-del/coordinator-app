'use strict';
// V19 Exchange v1 -> Commander candidate review, READ-ONLY.
// Never writes Supabase, Google Drive, Auth or localStorage.
const TYPE_SET=new Set(['orders','tasks','events','workers']);
const ACTION_SET=new Set(['upsert','archive']);
const MAX_OPERATIONS=10000,MAX_JSON_BYTES=4_000_000;
const safeText=(s,max=200)=>typeof s==='string'&&s.length>0&&s.length<=max&&!/[\u0000-\u001f]/.test(s);
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T12:00:00Z'));
const hasPoisonKey=(v,depth=0)=>{if(depth>25)return true;if(v&&typeof v==='object'){for(const k of Object.keys(v)){if(['__proto__','constructor','prototype'].includes(k)||hasPoisonKey(v[k],depth+1))return true;}}return false};
function prepareReview(packet){
 if(!packet||typeof packet!=='object'||Array.isArray(packet))throw Error('Paczka nie jest obiektem JSON.');
 if(hasPoisonKey(packet)||JSON.stringify(packet).length>MAX_JSON_BYTES)throw Error('Niebezpieczna lub zbyt duża paczka.');
 if(packet.format!=='AKP-Exchange'||packet.schemaVersion!==1||!Array.isArray(packet.operations)||packet.operations.length>MAX_OPERATIONS)throw Error('Nieobsługiwany format AKP Exchange.');
 const summary={format:'AKP-Unified-V19-Review-v01',mode:'dry-run',origin:'V19',writes:0,requiresApproval:true,accepted:0,review:[],blocked:[],total:packet.operations.length};
 const seen=new Set();
 for(let i=0;i<packet.operations.length;i++){
   const o=packet.operations[i],name='operation['+i+']';
   if(!o||typeof o!=='object'||!TYPE_SET.has(o.type)||!ACTION_SET.has(o.action)||!safeText(o.id,200)){
     summary.blocked.push({index:i,reason:'INVALID_OPERATION'});continue;
   }
   const key=o.type+':'+o.id;
   if(seen.has(key)){summary.blocked.push({index:i,sourceId:o.id,reason:'DUPLICATE_SOURCE_ID'});continue;}
   seen.add(key);
   if(o.action==='archive'){summary.blocked.push({index:i,type:o.type,sourceId:o.id,reason:'DESTRUCTIVE_ARCHIVE_REQUIRES_SEPARATE_APPROVAL'});continue;}
   if(!o.record||typeof o.record!=='object'||Array.isArray(o.record)){summary.blocked.push({index:i,type:o.type,sourceId:o.id,reason:'RECORD_REQUIRED'});continue;}
   if(o.type==='orders'){
      // V19 order uses focus14 + uid; never infer mapping from client name/title.
      if(!safeText(o.record.uid,200)||o.record.uid!==o.id){
         summary.blocked.push({index:i,type:o.type,sourceId:o.id,reason:'ORDER_IDENTITY_MISMATCH'});continue;
      }
      summary.review.push({index:i,type:o.type,sourceId:o.id,reason:'MAP_ID_AND_FIELD_SCHEMA_MANUALLY',targetTable:'akp_jobs',draft:null});
   }else if(o.type==='events'){
      const r=o.record;
      if(!safeText(r.title,300)||!validDate(r.date)){
        summary.blocked.push({index:i,type:o.type,sourceId:o.id,reason:'INVALID_EVENT_DATE_OR_TITLE'});continue;
      }
      summary.review.push({index:i,type:o.type,sourceId:o.id,reason:'CALENDAR_CONFLICT_AND_ASSIGNMENT_REVIEW',targetTable:null,draft:{title:r.title.slice(0,180),date:r.date,sourceId:o.id,orderLinkUnverified:!!r.orderId,workerLinkUnverified:!!r.workerId}});
   }else if(o.type==='tasks'){
      summary.review.push({index:i,type:o.type,sourceId:o.id,reason:'TASK_SCHEMA_AND_OWNER_REVIEW',targetTable:null,draft:null});
   }else{
      summary.review.push({index:i,type:o.type,sourceId:o.id,reason:'AUTH_ACCOUNT_CANNOT_BE_CREATED_FROM_V19_WORKER',targetTable:null,draft:null});
   }
 }
 return summary;
}
module.exports={prepareReview};
