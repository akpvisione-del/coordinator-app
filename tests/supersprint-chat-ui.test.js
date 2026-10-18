'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {create}=require('../public/chat');
const T='11111111-1111-4111-8111-111111111111';
function fixture(api){const chat=create();let unread=0,changed=0;chat.configure({api,me:()=>({id:'self',preferred_lang:'pl'}),jobs:()=>[],changed:()=>changed++,unread:n=>unread=n,openJob:()=>{}});return {chat,unread:()=>unread,changed:()=>changed};}
test('chat displays original text safely and marks only an explicit message read',async()=>{
 const calls=[];const {chat}=fixture(async(path,opt)=>{calls.push({path,opt});if(path.includes('/messages'))return {items:[{id:'m',seq:'1',body:'<img src=x onerror=alert(1)>',created_at:'2026-10-17T12:00:00Z',sender_id:'peer'}]};if(path.includes('/recipients'))return {items:[]};return {items:[{id:T,peer_display:'<script>peer</script>',unread:1}],unread_total:1};});
 await chat.load();await chat.open(T);const html=chat.view();assert.match(html,/&lt;img/);assert.match(html,/&lt;script/);assert.doesNotMatch(html,/<img|<script/);assert.equal(calls.some(c=>c.path.endsWith('/read')),false);
 chat.click({dataset:{chatAction:'read'}});await new Promise(r=>setImmediate(r));assert.equal(calls.find(c=>c.path.endsWith('/read')).opt.body.message_id,'m');
});
test('unknown send outcome preserves draft and reuses idempotency key on retry',async()=>{
 const old=global.FormData;global.FormData=class{constructor(form){return Object.entries(form.values)}};
 try{
  const sent=[];const {chat}=fixture(async(path,opt)=>{if(opt?.method==='POST'){sent.push(opt.body);if(sent.length===1)throw Error('network');return {message:{id:'saved'}}}if(path.includes('messages'))return {items:[]};return {items:[]};});
  await chat.open(T);const form={dataset:{chatForm:'send'},values:{body:'test message',job_id:''}};
  await chat.submit(form);assert.equal(chat.getState().drafts[T].body,'test message');assert.match(chat.view(),/Szkic/);
  await chat.submit(form);assert.equal(sent[0].client_id,sent[1].client_id);assert.equal(sent[0].sender_id,undefined);assert.equal(chat.getState().drafts[T],undefined);
 }finally{global.FormData=old}
});
test('session reset discards sensitive messages and ignores earlier in-flight history',async()=>{
 let resolve;const {chat}=fixture(()=>new Promise(r=>resolve=r));const pending=chat.open(T);chat.reset();resolve({items:[{id:'secret',body:'PRIVATE'}]});await pending;assert.equal(chat.getState().messages.length,0);assert.equal(chat.getState().selected,null);
});
test('foreign/inaccessible thread clears visible history and exposes no demo fallback',async()=>{
 const {chat}=fixture(async()=>{throw Object.assign(Error('Forbidden'),{status:403})});await chat.open(T);assert.equal(chat.getState().selected,null);assert.equal(chat.getState().messages.length,0);assert.match(chat.view(),/Forbidden/);
});
