'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../public/drawing-model'),route=require('../netlify/functions/drawing');
function doc(){return {schema:1,width:640,height:480,source_sha256:'a'.repeat(64),shapes:[{id:crypto.randomUUID(),type:'dimension',x1:1000,y1:2000,x2:8000,y2:6000,text:'1250 mm',color:'blue'}]};}
test('drawing normalized coordinates are stable across responsive viewports',()=>{
 assert.deepEqual(M.point({left:10,top:20,width:200,height:100},110,70),{x:5000,y:5000});
 assert.deepEqual(M.point({left:0,top:0,width:1000,height:500},500,250),{x:5000,y:5000});
 assert.deepEqual(M.point({left:0,top:0,width:100,height:100},-10,120),{x:0,y:10000});
});
test('drawing validates physical labels and rejects malformed vectors or oversized images',()=>{
 M.validate(doc());
 for(const update of [{x1:-1},{x2:10001},{y1:NaN},{type:'script'},{text:''},{color:'url(javascript:1)'},{x2:1000,y2:2000}]){const d=doc();Object.assign(d.shapes[0],update);assert.throws(()=>M.validate(d));}
 for(const update of [{width:50000},{width:12000,height:12000},{source_sha256:'not-a-hash'},{schema:2}])assert.throws(()=>M.validate({...doc(),...update}));
 const d=doc();d.shapes.push({...d.shapes[0]});assert.throws(()=>M.validate(d));
});
test('drawing API uses caller JWT, expected version and immutable source document',async()=>{
 const document=doc(),job=crypto.randomUUID(),photo=crypto.randomUUID(),body={client_id:crypto.randomUUID(),expected_version:2,document};let call;
 const h={UUID:M.UUID,bodyJson:()=>body,reply:(status,payload)=>({status,payload}),sbFetch:async(c,path,o)=>{call={path,o};return {version:3};}};
 const r=await route({httpMethod:'POST'}, {},{role:'worker',token:'worker'},'/jobs/'+job+'/drawings/'+photo,h);assert.equal(r.status,201);assert.equal(call.o.token,'worker');assert.equal(call.path,'/rest/v1/rpc/akp_pro_drawing_save');assert.equal(call.o.data.p_expected,2);assert.deepEqual(call.o.data.p_document,document);
});
