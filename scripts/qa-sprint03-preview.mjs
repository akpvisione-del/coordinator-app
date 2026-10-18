import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openBrowser} from './lib/browser-pipe.mjs';
const html=await readFile('artifacts/supersprint-03/PREVIEW.html');
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await openBrowser();
try{
 await b.command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});await b.waitFor("document.querySelectorAll('article img').length===20");
 await b.command('Network.enable');await b.command('Network.setBlockedURLs',{urls:['https://*','http://*']});
 await b.evaluate("for(const i of document.images)i.loading='eager'");await b.waitFor('[...document.images].every(i=>i.complete&&i.naturalWidth>0)');
 assert.equal(await b.evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.equal(await b.evaluate("[...document.images].every(i=>i.src.startsWith('data:image/png;base64,'))"),true);
 assert.equal((await readFile('artifacts/supersprint-03/WYCENA_DEMO.pdf')).subarray(0,5).toString(),'%PDF-');
 console.log('SPRINT03_OFFLINE_PREVIEW_PASS: 20 embedded images with HTTP(S) blocked, 390px, actual PDF artifact');
}finally{await b.close();await new Promise(r=>server.close(r));}
