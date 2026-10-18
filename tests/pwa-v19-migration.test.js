'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('V19 root worker updates safely: network-first, preserve all legacy caches',async()=>{
 const source=fs.readFileSync('public/sw.js','utf8');
 const listeners={};let online=true,claimed=false,skip=false;
 const legacy='akp-v17-'+encodeURIComponent('https://akp.wtf/')+'-19-0-0-v09';
 let deleted=[];const store=new Map();
 const cache={addAll:async(paths)=>paths.forEach(p=>store.set(p,{offline:p}))};
 const context={self:{location:{origin:'https://akp.wtf'},registration:{scope:'https://akp.wtf/'},clients:{claim:async()=>{claimed=true}},skipWaiting:async()=>{skip=true},addEventListener:(type,fn)=>listeners[type]=fn},
  caches:{open:async()=>cache,keys:async()=>[legacy,'akp-offline-only-v02','important-private-cache','akp-offline-only-v03'],
   delete:async(key)=>{deleted.push(key);return true},match:async(key)=>store.get(key)},
  fetch:async(req)=>{if(!online)throw Error('offline');return {online:req.url}},URL,Response};
 vm.runInNewContext(source,context,{timeout:3000});
 let pending;listeners.install({waitUntil:x=>pending=x});await pending;
 assert.equal(skip,true);
 assert.deepEqual([...store.keys()].sort(),['/offline.css','/offline.html']);
 listeners.activate({waitUntil:x=>pending=x});await pending;assert.equal(claimed,true);
 assert.deepEqual(deleted,[], 'historical caches and possible user photos remain untouched');
 async function handle(req){let response;listeners.fetch({request:req,respondWith:p=>response=p});return response?await response:null;}
 const nav={method:'GET',mode:'navigate',url:'https://akp.wtf/login'};
 assert.deepEqual(await handle(nav),{online:nav.url});
 online=false;assert.equal((await handle(nav)).offline,'/offline.html');
 assert.equal(await handle({method:'GET',mode:'cors',url:'https://akp.wtf/api/jobs'}),null);
 assert.equal(await handle({method:'GET',mode:'cors',url:'https://akp.wtf/manifest.webmanifest'}),null);
 assert.equal(await handle({method:'POST',mode:'navigate',url:'https://akp.wtf/login'}),null);
});
test('manifest is versioned, no-store, PNG icons and stable Commander app ID',()=>{
 const m=JSON.parse(fs.readFileSync('public/manifest.webmanifest','utf8'));
 assert.equal(m.id,'/login');assert.equal(m.start_url,'/login');
 assert.equal(m.name,'AKP Commander');
 const html=fs.readFileSync('public/index.html','utf8');
 assert.match(html,/manifest\.webmanifest\?v=20261016-commander-pwa-v03/);
 const config=fs.readFileSync('netlify.toml','utf8');
 assert.match(config,/for = "\/manifest.webmanifest"[\s\S]*?no-store/);
 for(const size of [192,512]){
  const icon=m.icons.find(i=>i.type==='image/png'&&i.sizes===size+'x'+size);
  assert.ok(icon);const data=fs.readFileSync('public'+icon.src);
  assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16),size);assert.equal(data.readUInt32BE(20),size);
 }
});
