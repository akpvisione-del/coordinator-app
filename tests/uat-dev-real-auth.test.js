'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {verifyTarget,run}=require('../scripts/uat-dev-real-auth-readonly.cjs');
const ORIGIN='https://deploy-preview-7--coordinator-a.netlify.app';
test('Live read-only UAT prevents production, arbitrary sites, credentials in URL and non-HTTPS',()=>{
 for(const value of ['https://akp.wtf','https://www.akp.wtf','http://deploy-preview-7--coordinator-a.netlify.app','https://evil.invalid/','https://user:pass@deploy-preview-7--coordinator-a.netlify.app']){
  assert.throws(()=>verifyTarget(value),value);
 }
 assert.equal(verifyTarget(ORIGIN),ORIGIN);
});
test('DEV coordinator reads safely over GET without customer record logging',async()=>{
 const requested=[];
 const fetcher=async(url,opts)=>{
  requested.push({path:new URL(url).pathname,method:opts.method,redirect:opts.redirect});
  const path=new URL(url).pathname;
  const body=path==='/api/me'?{role:'coordinator'}:path==='/api/jobs'?{items:[{id:'test',title:'private'}]}:{items:[]};
  return {status:200,ok:true,json:async()=>body};
 };
 const result=await run({origin:ORIGIN,cookie:'akp_access=SYNTHETIC_TEST_ONLY',role:'coordinator',fetcher});
 assert.equal(result.status,'PASS_READ_ONLY');
 assert.equal(result.writes,0);
 assert.ok(requested.every(x=>x.method==='GET'&&x.redirect==='manual'));
 assert.equal(result.requests,7);
});
test('DEV worker must be denied privileged endpoints and never receive finances',async()=>{
 const fetcher=async(url)=>{
  const path=new URL(url).pathname;
  if(path==='/api/me')return {status:200,ok:true,json:async()=>({role:'worker'})};
  if(path==='/api/jobs')return {status:200,ok:true,json:async()=>({items:[{id:'fake-assigned-job'}]})};
  if(path==='/api/reports')return {status:200,ok:true,json:async()=>({items:[]})};
  return {status:403,ok:false};
 };
 const result=await run({origin:ORIGIN,cookie:'akp_access=SYNTHETIC_TEST_ONLY',role:'worker',fetcher});
 assert.equal(result.status,'PASS_READ_ONLY');
 assert.equal(result.writes,0);
});
test('DEV worker unassigned yields PARTIAL, never a false full PASS',async()=>{
 const fetcher=async(url)=>{
  const path=new URL(url).pathname;
  if(path==='/api/me')return {status:200,ok:true,json:async()=>({role:'worker'})};
  if(path==='/api/jobs'||path==='/api/reports')return {status:200,ok:true,json:async()=>({items:[]})};
  return {status:403,ok:false};
 };
 const result=await run({origin:ORIGIN,cookie:'akp_access=SYNTHETIC_TEST_ONLY',role:'worker',fetcher});
 assert.equal(result.status,'PARTIAL_NO_ASSIGNED_JOBS');
});
test('Reject accidental financial payload to a worker in real UAT',async()=>{
 const fetcher=async(url)=>{
  const path=new URL(url).pathname;
  if(path==='/api/me')return {status:200,ok:true,json:async()=>({role:'worker'})};
  if(path==='/api/jobs')return {status:200,ok:true,json:async()=>({items:[{revenue_net:100}]})};
  return {status:403,ok:false};
 };
 await assert.rejects(run({origin:ORIGIN,cookie:'akp_access=SYNTHETIC_TEST_ONLY',role:'worker',fetcher}),/protected field/);
});
