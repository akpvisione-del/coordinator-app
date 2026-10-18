'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/api');
const U='11111111-1111-4111-8111-111111111111',T='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
process.env.SUPABASE_URL='https://mock.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='synthetic-publishable';process.env.APP_ORIGIN='https://mock.example.test';
let calls=[],active=true,providerError=null;
global.fetch=async(url,options={})=>{
 assert.ok(url.startsWith('https://mock.supabase.co/'),'no real network');
 const p=new URL(url).pathname;
 if(p==='/auth/v1/user')return new Response(JSON.stringify({id:U,app_metadata:{akp_role:'worker'}}));
 if(p==='/rest/v1/akp_profiles')return new Response(JSON.stringify([{role:'worker',is_active:active}]));
 assert.ok(p.startsWith('/rest/v1/rpc/akp_chat_'));
 const body=JSON.parse(options.body);calls.push({p,body,options});
 return new Response(JSON.stringify(providerError?{code:providerError}:{items:[],unread_total:2,id:T}),{status:providerError==='42501'?403:providerError?400:200});
};
async function call(path,method='GET',body,headers={}){
 const r=await handler({path:'/api'+path,httpMethod:method,headers:{cookie:'akp_access=synthetic.jwt',origin:'https://mock.example.test','x-akp-request':'commander-v10',...headers},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.statusCode,data:JSON.parse(r.body)};
}
test('chat RPC uses verified caller JWT, never service credentials or caller-supplied sender',async()=>{
 calls=[];assert.equal((await call('/chat/threads/'+T+'/messages','POST',{body:' hello ',client_id:C,language:'uk'})).status,201);
 const req=calls[0];assert.equal(req.options.headers.Authorization,'Bearer synthetic.jwt');assert.equal(req.body.p_body,'hello');assert.equal(req.body.p_language,'uk');assert.equal(req.body.p_thread,T);assert.equal(req.body.p_client_id,C);
 assert.equal((await call('/chat/threads/'+T+'/messages','POST',{body:'attack',client_id:C,sender_id:C})).status,422);assert.equal(calls.length,1);
});
test('deactivated stale JWT and CSRF fail before RPC',async()=>{
 calls=[];active=false;try{assert.equal((await call('/chat/threads')).status,401)}finally{active=true}
 assert.equal((await call('/chat/threads','POST',{other_user_id:C},{origin:'https://evil.test'})).status,403);assert.equal(calls.length,0);
});
test('message search and bigint keyset pagination preserve string precision',async()=>{
 calls=[];assert.equal((await call('/chat/threads/'+T+'/messages?before=9007199254740993&q=monta%C5%BC&limit=10')).status,200);
 assert.equal(calls[0].body.p_before,'9007199254740993');assert.equal(calls[0].body.p_search,'montaż');assert.equal(calls[0].body.p_limit,10);
 for(const suffix of ['?before=9223372036854775808','?before=-1','?limit=1000','?q='+('a'.repeat(101))])assert.equal((await call('/chat/threads/'+T+'/messages'+suffix)).status,422);
});
test('RLS and idempotency errors are mapped without provider payloads',async()=>{
 for(const [code,status] of [['42501',403],['23505',409],['22023',422],['PGRST202',503]]){
  providerError=code;try{const result=await call('/chat/threads');assert.equal(result.status,status);assert.equal(JSON.stringify(result).includes(code),false)}finally{providerError=null}
 }
});
test('private general and job threads plus read markers use exact RPC contracts',async()=>{
 calls=[];assert.equal((await call('/chat/threads','POST',{other_user_id:C})).status,201);assert.equal(calls[0].body.p_job,null);
 assert.equal((await call('/chat/threads','POST',{other_user_id:C,job_id:U})).status,201);assert.equal(calls[1].body.p_job,U);
 assert.equal((await call('/chat/threads/'+T+'/read','POST',{message_id:C})).status,200);assert.equal(calls[2].body.p_message,C);
 assert.equal((await call('/chat/notifications')).data.unread_total,2);
});
test('Netlify queryStringParameters works when production event.path has no query',async()=>{
 calls=[];const result=await handler({path:'/api/chat/threads/'+T+'/messages',httpMethod:'GET',headers:{cookie:'akp_access=synthetic.jwt'},queryStringParameters:{q:'монтаж',before:'9007199254740993',limit:'25'}});
 assert.equal(result.statusCode,200);assert.equal(calls[0].body.p_search,'монтаж');assert.equal(calls[0].body.p_before,'9007199254740993');assert.equal(calls[0].body.p_limit,25);
});
