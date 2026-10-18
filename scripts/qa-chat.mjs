// Real chat + app UI under CSP. Synthetic transport only, Android and desktop.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {openBrowser} from './lib/browser-pipe.mjs';
const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const csp=(await readFile(new URL('../netlify.toml',import.meta.url),'utf8')).match(/Content-Security-Policy\s*=\s*"([^"]+)"/)[1];
const T='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',J='44444444-4444-4444-8444-444444444444';
let role='coordinator',messages=[],sent=[],unread=1,failSend=true;
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const job={id:J,title:'Synthetic Chat Job',reference:'CHAT-TEST',due:null,status:'NOWE',assignees:[W],checklist:[],photos:[],updated_at:'2026-10-17T12:00:00Z'};
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',csp);res.setHeader('Cache-Control','no-store');
 const url=new URL(req.url,'http://localhost'),p=url.pathname;
 const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data))};
 if(p.startsWith('/api/')){
  const me=role==='worker'?W:C,peer=role==='worker'?C:W;
  if(p==='/api/health')return reply({configured:true});
  if(p==='/api/me')return reply({id:me,role,display:'Synthetic User',preferred_lang:'pl'});
  if(p==='/api/jobs')return reply({items:[job]});if(p==='/api/jobs/'+J)return reply({job});
  if(p==='/api/chat/notifications')return reply({unread_total:unread});
  if(p==='/api/chat/recipients')return reply({items:[{id:peer,display:'Synthetic Peer'}]});
  if(p==='/api/chat/threads')return reply(req.method==='POST'?{thread:{id:T}}:{items:[{id:T,peer_display:'Synthetic Peer',unread}],unread_total:unread,next_offset:null});
  if(p==='/api/chat/threads/'+T+'/read'){unread=0;return reply({ok:true})}
  if(p==='/api/chat/threads/'+T+'/messages'){
   if(req.method==='POST'){
    let raw='';for await(const chunk of req)raw+=chunk;const b=JSON.parse(raw);sent.push(b);
    if(failSend){failSend=false;return reply({message:'Synthetic send failure'},503)}
    messages.push({id:crypto.randomUUID(),seq:'2',body:b.body,sender_id:me,source_language:b.language,created_at:'2026-10-17T12:00:01Z'});return reply({message:messages.at(-1)},201);
   }
   const q=url.searchParams.get('q');return reply({items:messages.filter(m=>!q||m.body.includes(q)).slice().reverse(),next_before:null});
  }
  if(['/api/reports','/api/team','/api/audit'].includes(p))return reply({items:[]});
  if(['/api/dashboard','/api/sources'].includes(p))return reply({});
  return reply({message:'Unsupported mock route'},404);
 }
 try{const file=resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+sep))throw Error('path');res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await openBrowser();await browser.command('Network.enable');await browser.command('Network.setBlockedURLs',{urls:['https://*']});
 for(const width of [390,1280])for(const next of ['coordinator','worker']){
  role=next;sent=[];unread=1;failSend=true;messages=[{id:'55555555-5555-4555-8555-555555555555',seq:'1',body:'<img src=x onerror=alert(1)> original',sender_id:role==='worker'?C:W,job_id:J,source_language:'uk',created_at:'2026-10-17T12:00:00Z'}];
  await browser.command('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await browser.command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/?width='+width+'&role='+role});
  await browser.waitFor("document.querySelector('#appView')?.hidden===false && document.querySelector('#mobileNav [data-nav=chat]')");
  await browser.evaluate("document.querySelector('#mobileNav [data-nav=chat]').click()");
  await browser.waitFor("document.querySelector('[data-chat-open]')");await browser.evaluate("document.querySelector('[data-chat-open]').click()");
  await browser.waitFor("document.querySelector('.chat-message')");
  assert.equal(await browser.evaluate("!!document.querySelector('.chat-message img')"),false);
  assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth'),true,'overflow '+width);
  assert.ok(await browser.evaluate("document.querySelector('[data-chat-form=send] button').getBoundingClientRect().height>=48"));
  await browser.evaluate("(()=>{const t=document.querySelector('[data-chat-form=send] textarea');t.value='Retry test message';t.dispatchEvent(new Event('input',{bubbles:true}));t.form.requestSubmit()})()");
  await browser.waitFor("document.querySelector('#mainContent [role=alert]')?.textContent.includes('Synthetic send failure')");
  assert.equal(await browser.evaluate("document.querySelector('[data-chat-form=send] textarea').value"),'Retry test message');
  await browser.evaluate("document.querySelector('[data-chat-form=send]').requestSubmit()");await browser.waitFor("document.querySelector('.chat-log').textContent.includes('Retry test message')");
  assert.equal(sent.length,2);assert.equal(sent[0].client_id,sent[1].client_id);
  // Message appears before submit's final thread refresh enables actions.
  await browser.waitFor("document.querySelector('[data-chat-action=read]')?.disabled===false");
  await browser.evaluate("document.querySelector('[data-chat-action=read]').click()");await browser.waitFor("!document.querySelector('#mobileNav [data-nav=chat]').textContent.includes('(1)')");
  await browser.waitFor("document.querySelector('[data-chat-form=search] button')?.disabled===false");
  await browser.evaluate("(()=>{const input=document.querySelector('[data-chat-form=search] input');input.value='original';input.focus()})()");await browser.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await browser.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await browser.waitFor("document.querySelectorAll('.chat-message').length===1");
  await browser.evaluate("document.querySelector('[data-chat-job]').click()");await browser.waitFor("document.querySelector('[data-back-jobs]')");
  console.log('Chat browser '+role+' '+width+'px PASS — retry/search/read/job-link/CSP/touch');
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
