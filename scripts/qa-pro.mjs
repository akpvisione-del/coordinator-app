// Actual app, synthetic writable quote fixture only. No Supabase or production traffic.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {visualFixture} from './lib/visual-fixture.mjs';
import {openBrowser} from './lib/browser-pipe.mjs';
let snapshots=[];
const fixture=await visualFixture({handle:async({req,role,reply})=>{
 const u=new URL(req.url,'http://local.invalid');if(!/\/quote(?:\/pdf)?$/.test(u.pathname))return false;
 if(role!=='coordinator'){reply({message:'Forbidden'},403);return true;}
 if(req.method==='POST'){
  let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);
  if(b.expected_version!==snapshots.length)reply({message:'Konflikt wersji'},409);
  else {snapshots.push(b.document);reply({version:snapshots.length},201);}
 }else{
  const v=Number(u.searchParams.get('version'))||snapshots.length;
  reply({document:snapshots[v-1]||null,version:v,history:snapshots.map((_,i)=>({version:i+1,created_at:'2026-10-17T12:00:00Z'})).reverse()});
 }return true;
}});
const b=await openBrowser();const out='artifacts/supersprint-03';await mkdir(out,{recursive:true});
try{
 for(const width of [390,1280])for(const theme of ['light','dark']){
  snapshots=[];fixture.setRole('coordinator');await b.command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
  await b.command('Page.navigate',{url:fixture.url+'/index.html'});await b.waitFor("!!document.querySelector('[data-nav=jobs]')");
  await b.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector('[data-nav=jobs]').click()`);
  await b.waitFor("!!document.querySelector('[data-job]')");await b.evaluate("document.querySelector('[data-job]').click()");
  await b.waitFor("!!document.querySelector('[data-pro=load]')");await b.evaluate("document.querySelector('[data-pro=load]').click()");
  await b.waitFor("!!document.querySelector('[data-pro=add]')");await b.evaluate("document.querySelector('[data-pro=add]').click()");
  await b.evaluate(`for(const [path,val] of [['company.name','Firma fikcyjna'],['variants.0.lines.0.quantity','2.5'],['variants.0.lines.0.rate','100'],['variants.0.lines.0.discount','10']]){const el=document.querySelector('[data-path="'+path+'"]');el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));}`);
  assert.match(await b.evaluate("document.querySelector('[data-pro-total]').textContent"),/276,75/);
  await b.evaluate("document.querySelector('[data-pro=save]').click()");await b.waitFor("document.querySelector('[data-pro-editor]')?.textContent.includes('Zapisana wersja 1')");
  await b.evaluate("document.querySelector('[data-pro=clone]').click();document.querySelector('[data-pro=save]').click()");
  await b.waitFor("document.querySelector('[data-pro-editor]')?.textContent.includes('Zapisana wersja 2')");assert.equal(snapshots[1].variants.length,2);
  assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'no quote overflow '+width+theme);
  await b.evaluate("document.querySelector('[data-pro-editor] .pro-lines').scrollIntoView({block:'start'})");
  const image=await b.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(out+'/quote-'+width+'-'+theme+'.png',Buffer.from(image.data,'base64'));
  fixture.setRole('worker');await b.command('Page.navigate',{url:fixture.url+'/index.html'});await b.waitFor("!!document.querySelector('[data-job]')");await b.evaluate("document.querySelector('[data-job]').click()");await b.waitFor("!!document.querySelector('[data-back-jobs]')");
  assert.equal(await b.evaluate("document.querySelectorAll('[data-pro]').length"),0);assert.equal(fixture.requests.some(r=>r.includes('/quote')),false);
 }
 console.log('PRO_UI_PASS: 390/1280, light/dark, save, clone, history metadata, worker isolation');
}finally{await b.close();await fixture.close();}
