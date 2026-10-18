'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../public/pro-model');
const route=require('../netlify/functions/pro');
const job='44444444-4444-4444-8444-444444444444';
function doc(){const d=M.blank('Zażółć gęślą jaźń');d.company.name='Firma fikcyjna';d.variants[0].lines.push({id:crypto.randomUUID(),name:'Montaż testowy',unit:'m²',quantity:'1.255',rate:'12.34',discount:'10',vat:'23'});return d;}
test('quote decimal calculations: round base, discount, VAT; no float drift',()=>{
 const d=doc();M.validate(d);assert.deepEqual(M.lineTotals(d.variants[0].lines[0]),{base:1549,discount:155,net:1394,tax:321,gross:1715});
 const l={...d.variants[0].lines[0],quantity:'0.1',rate:'0.1',discount:'0',vat:'23'};assert.equal(M.lineTotals(l).net,1);assert.equal(M.totals({lines:Array(100).fill(l)}).gross,100);
 assert.equal(M.lineTotals({...l,discount:'100'}).gross,0);
});
test('quote rejects invalid decimals, excessive values, duplicate identities and unknown data',()=>{
 for(const value of ['-1','1e3','NaN','Infinity','1.001','1000001',' 2','01']){const d=doc();d.variants[0].lines[0].rate=value;assert.throws(()=>M.validate(d));}
 const d=doc();d.variants.push(structuredClone(d.variants[0]));assert.throws(()=>M.validate(d));
 const x=doc();x.password='secret';assert.throws(()=>M.validate(x));
});
test('quote API denies worker before any provider read, including PDF',async()=>{
 for(const suffix of ['','/pdf']){let called=false;const r=await route({httpMethod:'GET',path:'/api/jobs/'+job+'/quote'+suffix},{},{role:'worker'},'/jobs/'+job+'/quote'+suffix,{UUID:M.UUID,reply:(status,payload)=>({status,payload}),sbFetch:()=>{called=true;}});assert.equal(r.status,403);assert.equal(called,false);}
});
test('quote API forwards caller JWT and supports provider CAS / absent schema',async()=>{
 const d=doc(),body={document:d,expected_version:0,client_id:crypto.randomUUID()},calls=[];
 const h={UUID:M.UUID,reply:(status,payload)=>({status,payload}),bodyJson:()=>body,sbFetch:async(c,p,o)=>{calls.push({p,o});return {version:1};}};
 const e={httpMethod:'POST',path:'/api/jobs/'+job+'/quote'};
 const r=await route(e,{}, {role:'coordinator',token:'caller-only'},'/jobs/'+job+'/quote',h);assert.equal(r.status,201);assert.equal(calls[0].o.token,'caller-only');assert.deepEqual(calls[0].o.data.p_document,d);
 h.sbFetch=async()=>{throw {providerCode:'40001'};};await assert.rejects(route(e,{}, {role:'coordinator'},'/jobs/'+job+'/quote',h),{status:409});
 h.sbFetch=async()=>{throw {providerCode:'PGRST202'};};await assert.rejects(route(e,{}, {role:'coordinator'},'/jobs/'+job+'/quote',h),{status:503});
});
test('PDF is a real multi-page document with embedded font, not HTML',async()=>{
 const d=doc();d.notes='Fikcyjne warunki współpracy. '.repeat(60);d.variants[0].lines=Array.from({length:35},()=>({...d.variants[0].lines[0],id:crypto.randomUUID()}));
 const data=await require('../netlify/functions/quote-pdf')({document:d,version:2},d.variants[0],job);assert.equal(data.subarray(0,8).toString(),'%PDF-1.3');const text=data.toString('latin1');assert.match(text,/\/FontFile2/);assert.ok((text.match(/\/Type \/Page\b/g)||[]).length>=3);assert.ok(data.length>12000);
});
