'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/api');
const U='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222';
process.env.SUPABASE_URL='https://mock.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='synthetic';process.env.APP_ORIGIN='https://sprint.example.test';
let role='coordinator',calls=[];
global.fetch=async(url,opt={})=>{assert.ok(url.startsWith('https://mock.supabase.co'));const p=new URL(url).pathname;if(p==='/auth/v1/user')return new Response(JSON.stringify({id:U,app_metadata:{akp_role:role}}));if(p==='/rest/v1/akp_profiles')return new Response(JSON.stringify([{role,is_active:true}]));calls.push({p,body:JSON.parse(opt.body),opt});return new Response(JSON.stringify(p.includes('/functions/')?{worker:{id:W,role:'worker'}}:{items:[],next_before:null}));};
async function call(path,method='GET',body){const r=await handler({path:'/api'+path,httpMethod:method,headers:{cookie:'akp_access=synthetic',origin:'https://sprint.example.test','x-akp-request':'commander-v10'},body:body===undefined?undefined:JSON.stringify(body)});return r.statusCode;}
test('invitations forward fixed action without any password or callback supplied by the browser',async()=>{
 calls=[];const form={name:'Synthetic Worker',email:'worker@example.test',language:'uk',confirm_access:true};assert.equal(await call('/team/invite','POST',form),201);assert.equal(calls[0].body.action,'invite_worker');assert.equal(calls[0].body.password,undefined);assert.equal(calls[0].opt.headers.Authorization,'Bearer synthetic');
 for(const extra of [{password:'not-allowed'},{redirect_to:'https://evil.test'},{role:'coordinator'}])assert.equal(await call('/team/invite','POST',{...form,...extra}),422);
});
test('team and assignment history are coordinator-only with explicit immutable target filters',async()=>{
 calls=[];assert.equal(await call('/team/'+W+'/history'),200);assert.equal(calls[0].body.p_worker,W);assert.equal(calls[0].body.p_job,null);
 assert.equal(await call('/jobs/'+U+'/assignment-history'),200);assert.equal(calls[1].body.p_worker,null);assert.equal(calls[1].body.p_job,U);
 role='worker';try{const before=calls.length;assert.equal(await call('/team/'+W+'/history'),403);assert.equal(await call('/jobs/'+U+'/assignment-history'),403);assert.equal(await call('/team/invite','POST',{}),403);assert.equal(calls.length,before)}finally{role='coordinator'}
});
