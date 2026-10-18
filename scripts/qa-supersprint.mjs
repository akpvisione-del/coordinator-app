// Actual application UI, strict Netlify CSP, synthetic API. No production requests.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {openBrowser} from './lib/browser-pipe.mjs';
const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const policy=(await readFile(new URL('../netlify.toml',import.meta.url),'utf8')).match(/Content-Security-Policy\s*=\s*"([^"]+)"/)[1];
const W='22222222-2222-4222-8222-222222222222',J='11111111-1111-4111-8111-111111111111';
let role='coordinator',calls=[],job,conflict=false;
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',policy);res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url,'http://localhost'),p=url.pathname;
 const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))};
 if(p.startsWith('/api/')){
  calls.push(req.method+' '+p);
  if(p==='/api/health')return reply({configured:true});
  if(p==='/api/me')return reply({id:W,role,display:'Synthetic User',preferred_lang:'pl'});
  if(p==='/api/jobs')return reply({items:[job]});
  if(p==='/api/jobs/'+J&&req.method==='PATCH'){
   let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);
   if(role!=='coordinator')return reply({message:'Forbidden'},403);
   if(conflict||b.expected_updated_at!==job.updated_at)return reply({message:'Konflikt — odśwież dane przed zapisem.'},409);
   assert.equal(req.headers['x-akp-request'],'commander-v10');
   job={...job,due:b.due_date,updated_at:'2026-10-18T12:00:00Z'};return reply({ok:true,job});
  }
  if(p==='/api/team/invite'&&req.method==='POST'){
   let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);assert.equal(b.password,undefined);assert.equal(b.confirm_access,true);return reply({worker:{id:'55555555-5555-4555-8555-555555555555',role:'worker'},invited:true},201);
  }
  if(p.startsWith('/api/team/')&&p.endsWith('/history'))return reply({items:[{id:'1',action:'ACCOUNT_UPDATED',created_at:'2026-10-17T12:00:00Z',before:{display_name:'Before'},after:{display_name:'Audit Worker'}}],next_before:null});
  if(p==='/api/reports'||p==='/api/audit')return reply({items:[]});
  if(p==='/api/team')return reply({can_create:true,items:[{id:W,display:'Active Worker',is_active:true},{id:'33333333-3333-4333-8333-333333333333',display:'Disabled Worker',is_active:false}]});
  if(p==='/api/dashboard'||p==='/api/sources')return reply({count:0});
  return reply({message:'Unexpected mock request '+p},404);
 }
 try{
  const file=resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+sep))throw Error('path');
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await openBrowser();
 // Block any accidental non-local request in this synthetic browser test.
 await browser.command('Network.enable');
 await browser.command('Network.setBlockedURLs',{urls:['https://*','http://*.com/*','http://*.co/*']});
 for(const width of [390,1280])for(const next of ['coordinator','worker']){
  await browser.command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  role=next;calls=[];conflict=false;job={id:J,title:'Synthetic Schedule Job',reference:'AKP-TEST',status:'NOWE',due:null,assignees:[W],updated_at:'2026-10-17T12:00:00Z'};
  await browser.command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/?role='+role});
  await browser.waitFor("document.querySelector('#appView')?.hidden===false && document.querySelector('#mobileNav [data-nav=schedule]')");
  await browser.evaluate("document.querySelector('#mobileNav [data-nav=schedule]').click()");
  await browser.waitFor("document.querySelector('.schedule-grid') && document.querySelector('#mainContent').textContent.includes('Synthetic Schedule Job')");
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,role+' mobile overflow');
  if(role==='coordinator'){
   conflict=true;
   await browser.evaluate("(()=>{const input=document.querySelector('.schedule-form input');input.value='2026-10-23';input.dispatchEvent(new Event('input',{bubbles:true}));input.form.requestSubmit()})()");
   await browser.waitFor("document.querySelector('.schedule-form .form-error')?.hidden===false");
   assert.equal(await browser.evaluate("document.querySelector('.schedule-form input').value"),'2026-10-23');
   conflict=false;
   await browser.evaluate("document.querySelector('.schedule-form').requestSubmit()");
   await browser.waitFor("document.querySelector('#toast').textContent==='Termin zapisany.'");
   assert.equal(job.due,'2026-10-23');assert.equal(calls.filter(c=>c.startsWith('PATCH')).length,2);
   await browser.evaluate("document.querySelector('#mobileNav [data-nav=team]').click()");
   await browser.waitFor("document.querySelector('#workerCreate') && document.querySelectorAll('[data-worker-toggle]').length===2");
   assert.equal(await browser.evaluate("document.querySelector('#workerCreate input[name=password]').type"),'password');
   await browser.evaluate("(()=>{const t=document.querySelector('#teamSearch');t.value='Disabled';t.dispatchEvent(new Event('input',{bubbles:true}))})()");
   assert.equal(await browser.evaluate("document.querySelectorAll('[data-worker-toggle]').length"),1);
   await browser.evaluate("(()=>{const t=document.querySelector('#teamSearch');t.value='';t.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-team-history]').click()})()");
   await browser.waitFor("document.querySelector('.team-history')?.textContent.includes('Audit Worker')");
   await browser.evaluate("(()=>{const f=document.querySelector('#workerInvite');f.closest('details').open=true;f.elements.name.value='Invited Worker';f.elements.email.value='invite@example.test';f.elements.confirm_access.checked=true;f.requestSubmit()})()");
   await browser.waitFor("document.querySelector('#toast').textContent.includes('Zaproszenie wysłane')");
   await browser.evaluate("document.querySelector('[data-team-jobs]').click()");await browser.waitFor("document.querySelector('.team-filter-banner') && document.querySelector('.job-card')");
   assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'team overflow');
  }else{
   assert.equal(await browser.evaluate("!!document.querySelector('.schedule-form, #scheduleWorker')"),false);
   assert.equal(calls.some(c=>/PATCH|\/team|\/audit|\/dashboard|\/sources/.test(c)),false);
  }
  console.log('SUPERSPRINT browser '+role+' '+width+'px PASS — strict CSP, synthetic API');
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
