'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const route=require('../netlify/functions/materials'),M=require('../public/pro-model');
const id='90000000-0000-4000-8000-000000000020',job='44444444-4444-4444-8444-444444444444';
const manual=()=>({id,client_id:crypto.randomUUID(),expected_revision:0,status:'TO_BUY',name:'Fikcyjne wkręty',quantity:'2.125',unit:'szt.',supplier:'Sklep testowy',notes:'Bez kwot',quote_version:null,quote_variant:null,quote_line:null});
test('materials validates operational inputs and prevents duplicated quote data',()=>{
 route.validate(manual(),false,M.UUID);
 const b={...manual(),quote_version:1,quote_variant:crypto.randomUUID(),quote_line:crypto.randomUUID()};assert.throws(()=>route.validate(b,false,M.UUID));
 b.name=null;b.quantity=null;b.unit=null;route.validate(b,false,M.UUID);
 assert.throws(()=>route.validate({...manual(),quantity:'-1'},false,M.UUID));
 assert.throws(()=>route.validate({...manual(),rate:'100'},false,M.UUID));
});
test('worker can submit only existing row status, never supplier, quote or pricing fields',()=>{
 const b={id,client_id:crypto.randomUUID(),expected_revision:1,status:'PURCHASED'};route.validate(b,true,M.UUID);
 for(const [key,value] of [['rate',10],['supplier','forged'],['name','forged'],['quote_version',1]])assert.throws(()=>route.validate({...b,[key]:value},true,M.UUID));
 assert.throws(()=>route.validate({...b,expected_revision:0},true,M.UUID));
});
test('worker materials API uses narrow status RPC with caller token',async()=>{
 const body={id,client_id:crypto.randomUUID(),expected_revision:1,status:'ORDERED'};let call;
 const h={UUID:M.UUID,bodyJson:()=>body,reply:(status,payload)=>({status,payload}),sbFetch:async(c,path,o)=>{call={path,o};return {revision:2};}};
 const r=await route({path:'/api/jobs/'+job+'/materials',httpMethod:'POST'},{},{role:'worker',token:'worker-only'},'/jobs/'+job+'/materials',h);
 assert.equal(r.status,200);assert.equal(call.path,'/rest/v1/rpc/akp_pro_material_status');assert.equal(call.o.token,'worker-only');assert.deepEqual(Object.keys(call.o.data).sort(),['p_job','p_id','p_expected','p_client','p_status'].sort());
});
