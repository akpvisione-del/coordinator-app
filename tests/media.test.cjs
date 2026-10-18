'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const route=require('../netlify/functions/media'),{safePath,validImage,bytes}=route._test;
const M=require('../public/pro-model');
const job='44444444-4444-4444-8444-444444444444',photo='90000000-0000-4000-8000-000000000031';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=','base64');
test('media refuses traversal, external URLs and executable image formats',()=>{
 for(const path of [job+'/../x.jpg',job+'/..',job+'/.hidden','https://evil.test/x',job+'/x?token=1'])assert.equal(safePath(path,job),false);
 assert.equal(safePath(job+'/user_photo.png',job),true);assert.equal(validImage(png,'image/png'),true);assert.equal(validImage(Buffer.from('<svg onload="alert()"/>'),'image/png'),false);assert.equal(validImage(png,'image/svg+xml'),false);
});
test('media byte reader bounds chunked responses, not only content-length',async()=>{
 const response=new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(20));c.enqueue(new Uint8Array(20));c.close();}}));await assert.rejects(bytes(response,30),{status:413});
});
test('media uploads binary original through caller JWT and completes only after success',async()=>{
 const old=global.fetch,calls=[];const sha=createHash('sha256').update(png).digest('hex');
 const h={UUID:M.UUID,reply:(status,payload)=>({status,payload}),sbFetch:async(c,path,o)=>{calls.push({path,o});if(path.endsWith('akp_pro_photo_slot'))return {storage_path:job+'/worker_'+photo+'.png',mime_type:'image/png',size:png.length,sha256:sha};return {id:photo};}};
 global.fetch=async(url,options)=>{assert.ok(url.startsWith('https://mock.supabase.co/storage/v1/object/akp-job-media/'));assert.equal(options.headers.Authorization,'Bearer caller');assert.equal(options.headers['x-upsert'],'false');assert.deepEqual(options.body,png);return new Response('{}',{status:200});};
 try{const r=await route({httpMethod:'PUT',isBase64Encoded:true,body:png.toString('base64')},{url:'https://mock.supabase.co',key:'fake'},{token:'caller'},'/jobs/'+job+'/media/uploads/'+photo+'/file',h);assert.equal(r.status,201);assert.ok(calls.at(-1).path.endsWith('akp_pro_photo_complete'));}
 finally{global.fetch=old;}
});
test('media checksum mismatch cannot reach Storage or mark upload complete',async()=>{
 const old=global.fetch;let calls=0;global.fetch=async()=>{throw Error('Storage must not be called');};
 const h={UUID:M.UUID,sbFetch:async()=>{calls++;return {storage_path:job+'/x.png',mime_type:'image/png',size:png.length,sha256:'a'.repeat(64)};}};
 try{await assert.rejects(route({httpMethod:'PUT',isBase64Encoded:true,body:png.toString('base64')},{},{},'/jobs/'+job+'/media/uploads/'+photo+'/file',h),{status:422});assert.equal(calls,1);}finally{global.fetch=old;}
});
