import assert from 'node:assert/strict';
import {visualFixture} from './lib/visual-fixture.mjs';
import {openBrowser} from './lib/browser-pipe.mjs';
import M from '../public/pro-model.js';
const doc=M.blank('Fikcyjna wycena');doc.variants[0].lines=[{id:crypto.randomUUID(),name:'Płyta demonstracyjna',quantity:'2',unit:'m²',rate:'400',discount:'0',vat:'23'}];
let items=[],workerWrites=0;
const f=await visualFixture({handle:async({req,role,reply})=>{
 const p=new URL(req.url,'http://local.invalid').pathname;
 if(p.endsWith('/quote')){reply(role==='coordinator'?{version:1,document:doc,history:[]}:{message:'Forbidden'},role==='coordinator'?200:403);return true;}
 if(!p.endsWith('/materials'))return false;
 if(req.method==='GET'){reply({items:items.map(x=>role==='coordinator'?x:Object.fromEntries(Object.entries(x).filter(([k])=>!k.startsWith('quote_'))))});return true;}
 let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw),prior=items.find(x=>x.id===b.id);
 if(role==='worker'){assert.deepEqual(Object.keys(b).sort(),['id','expected_revision','client_id','status'].sort());assert.ok(prior);prior.status=b.status;prior.revision++;workerWrites++;}
 else{
  let item={...b,revision:(prior?.revision||0)+1};if(b.quote_version){assert.equal(b.name,null);assert.equal(b.quantity,null);item={...item,...Object.fromEntries(['name','quantity','unit'].map(k=>[k,doc.variants[0].lines[0][k]]))};}
  items=prior?items.map(x=>x.id===b.id?item:x):[...items,item];
 }reply({ok:true});return true;
}});
const b=await openBrowser();
const input=async(name,value)=>b.evaluate(`{const el=document.querySelector('[data-material-field][name=${JSON.stringify(name)}]');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));}`);
async function open(role,width,theme){f.setRole(role);await b.command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});await b.command('Page.navigate',{url:f.url+'/index.html'});await b.waitFor("!!document.querySelector('[data-nav=jobs]')");await b.evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)};document.querySelector('[data-nav=jobs]').click()`);await b.waitFor("!!document.querySelector('[data-job]')");await b.evaluate("document.querySelector('[data-job]').click()");await b.waitFor("!!document.querySelector('[data-material=load]')");await b.evaluate("document.querySelector('[data-material=load]').click()");await b.waitFor("!!document.querySelector('[data-material-list]')");}
try{
 for(const width of [390,1280])for(const theme of ['light','dark']){
  items=[];await open('coordinator',width,theme);await input('name','Wkręty fikcyjne');await input('quantity','12');
  await b.evaluate("document.querySelector('[data-material-form]').requestSubmit()");await b.waitFor("document.querySelectorAll('[data-material=edit]').length===1");
  await b.evaluate("document.querySelector('[data-material=sources]').click()");await b.waitFor("document.querySelector('[name=source]').options.length===2");
  await b.evaluate("{const s=document.querySelector('[name=source]');s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}));}");
  await b.evaluate("document.querySelector('[data-material-form]').requestSubmit()");await b.waitFor("document.querySelectorAll('[data-material=edit]').length===2");
  assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);
  await open('worker',width,theme);assert.equal(await b.evaluate("document.querySelectorAll('[data-material-form]').length"),0);
  await b.evaluate("document.querySelector('[data-material-status]').value='PURCHASED';document.querySelector('[data-material=status]').click()");await b.waitFor("document.querySelector('[data-material-list]')?.textContent.includes('Zakupione')");
  assert.equal(f.requests.some(x=>x.endsWith('/quote')),false);assert.equal(await b.evaluate("document.querySelector('[data-material-list]').textContent.includes('400')"),false);
 }
 assert.equal(workerWrites,4);console.log('MATERIALS_UI_PASS: 390/1280, light/dark, manual + quote reference, worker status only, no prices');
}finally{await b.close();await f.close();}
