import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {mediaFixture} from './lib/media-fixture.mjs';
import {openBrowser} from './lib/browser-pipe.mjs';
const f=await mediaFixture(),b=await openBrowser();await mkdir('artifacts/supersprint-03',{recursive:true});
try{
 for(const role of ['coordinator','worker'])for(const width of [390,1280])for(const theme of ['light','dark']){
  f.photos.length=0;f.setRole(role);await b.command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await b.command('Page.navigate',{url:f.url+'/index.html'});
  await b.waitFor("!!document.querySelector('[data-nav=jobs]')");await b.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector('[data-nav=jobs]').click()`);await b.waitFor("!!document.querySelector('[data-job]')");await b.evaluate("document.querySelector('[data-job]').click()");await b.waitFor("!!document.querySelector('[data-media=load]')");await b.evaluate("document.querySelector('[data-media=load]').click()");await b.waitFor("!!document.querySelector('[data-media-upload]')");
  // Generate a real PNG in the browser and select it like an Android file picker.
  await b.evaluate(`(async()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');x.fillStyle='#e5e7eb';x.fillRect(0,0,640,480);x.fillStyle='#2463c2';x.fillRect(80,120,400,200);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'fikcyjna-kuchnia.png',{type:'image/png'}));const el=document.querySelector('[data-media-file]');el.files=dt.files;el.dispatchEvent(new Event('change',{bubbles:true}));const caption=document.querySelector('[data-media-upload] [name=caption]');caption.value='Fikcyjna dokumentacja';caption.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-media-upload]').requestSubmit();})()`);
  await b.waitFor("document.querySelectorAll('[data-media=preview]').length===1");assert.equal(f.photos.length,1);assert.ok(f.uploads.at(-1).bytes.length>1000);
  await b.evaluate("document.querySelector('[data-media=preview]').click()");await b.waitFor("document.querySelector('.pro-photo-detail>img')?.naturalWidth===640");
  await b.evaluate("{const el=document.querySelector('[data-media-meta] [name=caption]');el.value='Opis po pomiarze';el.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-media-meta]').requestSubmit();}");await b.waitFor("document.querySelector('[data-media-gallery]')?.textContent.includes('Opis po pomiarze')");assert.equal(f.photos[0].meta_revision,2);
  assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await b.evaluate("document.querySelector('.pro-photo-detail').scrollIntoView({block:'center'})");const shot=await b.command('Page.captureScreenshot',{format:'png'});await writeFile('artifacts/supersprint-03/photo-'+role+'-'+width+'-'+theme+'.png',Buffer.from(shot.data,'base64'));
 }
 console.log('MEDIA_UI_PASS: both roles, 390/1280, light/dark, real PNG upload + preview + metadata version');
}finally{await b.close();await f.close();}
