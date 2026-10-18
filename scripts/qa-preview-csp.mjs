// AKP DEV: browser smoke test with the real Netlify Content-Security-Policy.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {openBrowser} from './lib/browser-pipe.mjs';

const publicDir=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const config=await readFile(new URL('../netlify.toml',import.meta.url),'utf8');
const csp=config.match(/Content-Security-Policy\s*=\s*"([^"]+)"/)?.[1];
if(!csp?.includes("script-src 'self'")||!csp.includes("style-src 'self'")) throw Error('Strict CSP missing');
const html=await readFile(join(publicDir,'unified-design-system.html'),'utf8');
const testScript=[
"(() => {",
" const el=document.createElement('output');el.id='akp-browser-smoke';",
" const failures=[];",
" const style=getComputedStyle(document.body);",
" if(style.backgroundColor!=='rgb(11, 18, 29)') failures.push('CSS not applied:'+style.backgroundColor);",
" if(!style.fontFamily.includes('system-ui')) failures.push('font fallback');",
" document.querySelector('button[data-view=\"jobs\"]').click();",
" if(!document.querySelector('[data-screen=\"jobs\"]').classList.contains('active')) failures.push('navigation');",
" const input=document.getElementById('searchJob');",
" input.value='kuchni';input.dispatchEvent(new Event('input',{bubbles:true}));",
" if(document.querySelectorAll('#jobGrid .job:not([hidden])').length!==1) failures.push('search');",
" document.getElementById('themeButton').click();",
" if(document.documentElement.dataset.theme!=='light') failures.push('theme');",
" el.setAttribute('data-pass',failures.length?'no':'yes');",
" el.textContent=failures.join(',')||'AKP_CSP_BROWSER_PASS';document.body.appendChild(el);",
"})();"
].join('\n');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
 res.setHeader('Content-Security-Policy',csp);
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','no-store');
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/__qa/preview'){res.setHeader('Content-Type',mime['.html']);res.end(html.replace('</body>','<script defer src="/__qa/probe.js"></script></body>'));return;}
 if(path==='/__qa/probe.js'){res.setHeader('Content-Type',mime['.js']);res.end(testScript);return;}
 const file=resolve(publicDir,'.'+path);
 try{
  if(!file.startsWith(publicDir+sep)||!(await stat(file)).isFile())throw Error('unsafe');
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const port=server.address().port;
let browser;
try{
 browser=await openBrowser();
 await browser.command('Network.enable');
 await browser.command('Network.setBlockedURLs',{urls:['https://*']});
 await browser.command('Page.navigate',{url:'http://127.0.0.1:'+port+'/__qa/preview'});
 await browser.waitFor("document.querySelector('#akp-browser-smoke')");
 const result=await browser.evaluate("({pass:document.querySelector('#akp-browser-smoke').dataset.pass,message:document.querySelector('#akp-browser-smoke').textContent})");
 console.log('AKP CSP browser smoke: '+(result.pass==='yes'?'PASS':'FAIL'));
 if(result.pass!=='yes')throw Error(result.message);
}finally{if(browser)await browser.close();await new Promise(ok=>server.close(ok));}
