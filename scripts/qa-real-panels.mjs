// Real Commander index.html/app.js browser smoke. Auth and API are mocked; no production traffic.
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {openBrowser} from './lib/browser-pipe.mjs';
const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const cfg=await readFile(new URL('../netlify.toml',import.meta.url),'utf8');
const policy=cfg.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
if(!policy?.includes("style-src 'self'")||!policy.includes("script-src 'self'"))throw Error('Strict CSP missing');
const html=await readFile(join(root,'index.html'),'utf8');
const ID='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222';
const start={id:ID,reference:'AKP-DEMO-001',akp_id:'AKP-DEMO-001',lm_number:'LM-DEMO-1',title:'Montaż kuchni DEMO',location:'Warszawa, Ursus',client_name:'Osoba testowa',client_phone:'+48 500 000 000',client_address:'Warszawa, ul. Testowa 1',due:'2026-10-22',due_date:'2026-10-22',status:'W_REALIZACJI',priority:'NORMALNY',assignees:[W],assignee:W,instructions:'Test',updated_at:'2026-10-16T00:00:00.000Z',revenue_net:1200,crew_cost:500};
let role='coordinator',job={...start},patches=0,requests=[];
function safeJob(){const data={...job};if(role==='worker'){delete data.revenue_net;delete data.crew_cost;delete data.source;}return data;}
const probe=[
"(async()=>{const errors=[],marker=document.createElement('output');marker.id='akp-real-panel-qa';",
"const wait=async(f)=>{const until=Date.now()+4500;while(!f()){if(Date.now()>until)throw Error('timeout');await new Promise(r=>setTimeout(r,60));}};",
"try{await wait(()=>document.getElementById('appView')?.hidden===false);",
"if(document.documentElement.scrollWidth>innerWidth)errors.push('overflow on sign-in');",
"document.querySelector('#mobileNav button[data-nav=jobs]').click();",
"await wait(()=>document.querySelectorAll('.job-card').length===1);",
"if(getComputedStyle(document.querySelector('.jobs-grid')).gridTemplateColumns.split(' ').length!==2)errors.push('mobile grid not 2 cols');",
"document.querySelector('.job-card button[data-job]').click();await wait(()=>document.querySelector('.f04a-detail-section'));",
"if(document.documentElement.scrollWidth>innerWidth)errors.push('overflow in detail');",
"const role=new URL(location.href).searchParams.get('role');",
"if(role==='worker'){",
"if(document.querySelector('[data-edit-job]'))errors.push('worker edit control');",
"if(document.querySelector('#mainContent').textContent.includes('Przychód netto'))errors.push('worker finance leakage');",
"if(document.querySelector('#mobileNav [data-nav=team]'))errors.push('worker team nav');",
"}else{",
"await wait(()=>document.querySelector('[data-edit-job]'));document.querySelector('[data-edit-job]').click();",
"await wait(()=>document.querySelector('form.job-edit-form input[name=title]'));",
"const input=document.querySelector('form.job-edit-form input[name=title]');input.value='Kuchnia po zmianie UI';input.dispatchEvent(new Event('input',{bubbles:true}));",
"document.querySelector('form.job-edit-form').requestSubmit();",
"await wait(()=>!document.querySelector('form.job-edit-form'));",
"await wait(()=>document.querySelector('[data-back-jobs]'));document.querySelector('[data-back-jobs]').click();",
"await wait(()=>document.querySelector('.job-card .job-title')?.textContent.includes('Kuchnia po zmianie UI'));",
"if(document.querySelector('.form-error:not([hidden])'))errors.push('PATCH error');",
"}",
"if(document.documentElement.scrollWidth>innerWidth)errors.push('overflow after actions');",
"}catch(e){errors.push(String(e));}",
"marker.setAttribute('data-pass',errors.length?'no':'yes');marker.textContent=errors.join('|')||'AKP_REAL_UI_PASS';document.body.append(marker);})();"
].join('\n');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.png':'image/png'};
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',policy);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const pathname=new URL(req.url,'http://localhost').pathname;
 const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
 if(pathname.startsWith('/api/')){
  const p=pathname.slice(4);requests.push(req.method+' '+p);
  if(p==='/health')return reply({configured:true,mode:'QA MOCK'});
  if(p==='/me')return reply({id:role==='worker'?W:'33333333-3333-4333-8333-333333333333',display:role==='worker'?'Monter Test':'Koordynator Test',role,preferred_lang:'pl'});
  if(p==='/jobs'&&req.method==='GET')return reply({items:[safeJob()]});
  if(p==='/jobs/'+ID&&req.method==='GET')return reply({job:{...safeJob(),checklist:[{title:'Pomiary',checked:false}],photos:[]}});
  if(p==='/jobs/'+ID&&req.method==='PATCH'){
    let body='';for await(const c of req)body+=c;const item=JSON.parse(body);
    if(role!=='coordinator')return reply({message:'Forbidden'},403);
    if(item.expected_updated_at!==job.updated_at)return reply({message:'Konflikt'},409);
    job={...job,...item,updated_at:'2026-10-16T00:01:00.000Z',due:item.due_date};patches++;return reply({ok:true});
  }
  if(p==='/reports')return reply({items:[]});
  if(p==='/dashboard')return role==='worker'?reply({message:'Forbidden'},403):reply({active:1});
  if(p==='/team')return role==='worker'?reply({message:'Forbidden'},403):reply({items:[{id:W,display:'Monter Test'}]});
  if(p==='/audit')return role==='worker'?reply({message:'Forbidden'},403):reply({items:[]});
  if(p==='/sources')return role==='worker'?reply({message:'Forbidden'},403):reply({count:0,status:'MOCK'});
  return reply({message:'Unsupported MOCK API '+p},404);
 }
 if(pathname==='/__qa/real'){res.setHeader('Content-Type',mime['.html']);res.end(html.replace('</body>','<script src="/__qa/probe.js" defer></script></body>'));return;}
 if(pathname==='/__qa/probe.js'){res.setHeader('Content-Type',mime['.js']);res.end(probe);return;}
 try{const p=resolve(root,'.'+pathname);if(!p.startsWith(root+sep)||!(await stat(p)).isFile())throw Error('missing');res.setHeader('Content-Type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}
 catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const screenshots=resolve('qa-actual-panels');await mkdir(screenshots,{recursive:true});
let browser;
try{
 browser=await openBrowser();
 await browser.command('Network.enable');
 await browser.command('Network.setBlockedURLs',{urls:['https://*']});
 for(const next of ['coordinator','worker']){
  role=next;job={...start};patches=0;requests=[];
  await browser.command('Page.navigate',{url:'http://127.0.0.1:'+port+'/__qa/real?role='+next});
  await browser.waitFor("document.querySelector('#akp-real-panel-qa')",15000);
  const result=await browser.evaluate("({pass:document.querySelector('#akp-real-panel-qa').dataset.pass,message:document.querySelector('#akp-real-panel-qa').textContent})");
  console.log('AKP authenticated mock UI '+next+' '+(result.pass==='yes'?'PASS':'FAIL')+' PATCH '+patches);
  if(result.pass!=='yes'){console.error('API calls:',requests);throw Error(result.message);}
  const screenshot=await browser.command('Page.captureScreenshot',{format:'png'});
  await writeFile(join(screenshots,next+'-actual-ui-390.png'),Buffer.from(screenshot.data,'base64'));
  if(next==='coordinator'&&patches!==1)throw Error('Coordinator PATCH/readback missing');
  if(next==='worker'&&requests.some(x=>/\/team|\/dashboard|\/sources|\/audit|PATCH/.test(x)))throw Error('Worker requested privileged API');
 }
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
