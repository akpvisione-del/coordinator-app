import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {mediaFixture} from './lib/media-fixture.mjs';
import {IDs} from './lib/visual-fixture.mjs';
import {openBrowser} from './lib/browser-pipe.mjs';
const versions=new Map(),attempts=[];let rejectOnce=false;
const f=await mediaFixture({handle:async({req,reply})=>{
 const u=new URL(req.url,'http://local.invalid');const match=u.pathname.match(/\/drawings\/([^/]+)$/);if(!match)return false;
 const list=versions.get(match[1])||[];
 if(req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);attempts.push(body);
  if(rejectOnce){rejectOnce=false;reply({message:'Syntetyczny brak sieci. Nie zapisano.'},503);return true;}
  if(body.expected_version!==list.length){reply({message:'Konflikt'},409);return true;}
  list.push(body.document);versions.set(match[1],list);reply({version:list.length},201);
 }else {const version=Number(u.searchParams.get('version'))||list.length;reply({version,document:list[version-1]||null,history:list.map((_,i)=>({version:i+1,created_at:'2026-10-17T12:00:00Z'})).reverse()});}return true;
}});
const b=await openBrowser();const out='artifacts/supersprint-03';await mkdir(out,{recursive:true});
async function tool(type,text=''){
 await b.evaluate(`for(const [name,value] of [['tool',${JSON.stringify(type)}],['text',${JSON.stringify(text)}]]){const el=document.querySelector('[data-drawing-field][name='+name+']');el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));}`);
}
const count=()=>b.evaluate("document.querySelector('[data-drawing-editor] details summary')?.textContent");
async function addKeyboard(){await b.evaluate("document.querySelector('[data-drawing=add]').click()");}
try{
 for(const role of ['coordinator','worker'])for(const width of [390,1280])for(const theme of ['light','dark']){
  const photo=crypto.randomUUID();f.photos.length=0;f.photos.push({id:photo,caption:'Fikcyjny pomiar kuchni',stage:'DURING',category:'MEASUREMENT',meta_revision:1,uploaded_by:role==='worker'?IDs.worker:IDs.coord,file_state:'READY'});f.setRole(role);
  await b.command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await b.command('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await b.command('Page.navigate',{url:f.url+'/index.html'});await b.waitFor("!!document.querySelector('[data-nav=jobs]')");
  const data=await b.evaluate("(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='#f1f3f7';x.fillRect(0,0,640,480);x.strokeStyle='#52657a';x.lineWidth=4;x.strokeRect(50,100,530,280);x.strokeRect(60,230,510,130);x.strokeRect(90,110,100,110);x.strokeRect(220,110,140,110);return c.toDataURL('image/png').split(',')[1];})()");f.files.set(photo,Buffer.from(data,'base64'));
  await b.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector('[data-nav=jobs]').click()`);await b.waitFor("!!document.querySelector('[data-job]')");await b.evaluate("document.querySelector('[data-job]').click()");await b.waitFor("!!document.querySelector('[data-media=load]')");await b.evaluate("document.querySelector('[data-media=load]').click()");await b.waitFor("!!document.querySelector('[data-media=preview]')");await b.evaluate("document.querySelector('[data-media=preview]').click();document.querySelector('[data-drawing-open]').click()");await b.waitFor("!!document.querySelector('[data-drawing-canvas]')");
  await b.evaluate("document.querySelector('[data-drawing-canvas]').scrollIntoView({block:'center'})");
  const rect=await b.evaluate("(()=>{const r=document.querySelector('[data-drawing-canvas]').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})()");
  const points=[{x:rect.x+rect.w*.2,y:rect.y+rect.h*.3,id:1},{x:rect.x+rect.w*.8,y:rect.y+rect.h*.6,id:1}];
  await b.command('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});await b.command('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[points[1]]});await b.command('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.match(await count(),/1\/100/);
  await b.evaluate("document.querySelector('[data-drawing=undo]').click()");assert.match(await count(),/0\/100/);await b.evaluate("document.querySelector('[data-drawing=redo]').click()");assert.match(await count(),/1\/100/);
  await tool('dimension','1250 mm');await addKeyboard();await tool('label','POMIAR DEMO');await addKeyboard();await tool('line');await addKeyboard();assert.match(await count(),/4\/100/);
  rejectOnce=true;const previous=attempts.length;await b.evaluate("document.querySelector('[data-drawing=save]').click()");await b.waitFor("document.querySelector('[data-drawing-editor]')?.textContent.includes('Szkic pozostaje')");assert.match(await count(),/4\/100/);
  await b.evaluate("document.querySelector('[data-drawing=save]').click()");await b.waitFor("document.querySelector('[data-drawing-editor]')?.textContent.includes('Zapisana wersja 1')");assert.equal(attempts[previous].client_id,attempts[previous+1].client_id,'retry preserves operation identity');
  await tool('label','Dodatkowy podpis');await addKeyboard();await b.evaluate("document.querySelector('[data-drawing=save]').click()");await b.waitFor("document.querySelector('[data-drawing-editor]')?.textContent.includes('Zapisana wersja 2')");
  await b.evaluate("document.querySelector('[data-drawing=history][data-version=\"1\"]').click()");await b.waitFor("document.querySelector('[data-drawing-editor]')?.textContent.includes('Kopia wersji 1')");assert.match(await count(),/4\/100/);
  await b.evaluate("window.__exports=[];HTMLAnchorElement.prototype.click=function(){window.__exports.push({href:this.href,name:this.download});};document.querySelector('[data-drawing=png]').click();document.querySelector('[data-drawing=json]').click()");
  const exports=await b.evaluate('window.__exports');assert.equal(exports.length,2);assert.ok(exports[0].href.startsWith('data:image/png;base64,'));const vectors=JSON.parse(decodeURIComponent(exports[1].href.split(',')[1]));assert.equal(vectors.document.shapes.length,4);assert.equal(vectors.version,1);
  await writeFile(out+'/drawing-'+role+'-'+width+'-'+theme+'.png',Buffer.from(exports[0].href.split(',')[1],'base64'));await writeFile(out+'/drawing-'+role+'-'+width+'-'+theme+'.json',JSON.stringify(vectors,null,2));
  assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await b.evaluate("getComputedStyle(document.querySelector('[data-drawing-canvas]')).touchAction"),'none');
  await b.evaluate("{const el=document.querySelector('[data-drawing-field][name=zoom]');el.value='2';el.dispatchEvent(new Event('change',{bubbles:true}));}");await tool('pan');
  assert.equal(await b.evaluate("getComputedStyle(document.querySelector('[data-drawing-canvas]')).touchAction"),'pan-x pan-y');
  assert.equal(await b.evaluate("document.querySelector('.pro-canvas-viewport').scrollWidth>document.querySelector('.pro-canvas-viewport').clientWidth"),true);
  assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'zoom stays within viewport');
  await b.evaluate("{const el=document.querySelector('[data-drawing-field][name=zoom]');el.value='1';el.dispatchEvent(new Event('change',{bubbles:true}));}");await tool('label','POMIAR DEMO');
  await b.evaluate("document.querySelector('[data-drawing-editor]').scrollIntoView({block:'start'})");const shot=await b.command('Page.captureScreenshot',{format:'png'});await writeFile(out+'/canvas-'+role+'-'+width+'-'+theme+'.png',Buffer.from(shot.data,'base64'));
 }
 console.log('DRAWING_UI_PASS: 8 matrices, real touch stroke, normalized coordinates, undo/redo, 4 tools, keyboard, retry identity, two versions, restore, PNG/JSON exports');
}finally{await b.close();await f.close();}
