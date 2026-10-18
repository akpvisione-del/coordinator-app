// Managed Chrome disallows file://. Serve the self-contained artifact internally;
// after initial load block all HTTP(S), then verify controls and embedded images.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {openBrowser} from './lib/browser-pipe.mjs';
const html=await readFile('artifacts/visual-sprint-02/AKP_PREMIUM_BEFORE_AFTER.html');
const server=createServer((_req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await openBrowser();await b.command('Page.navigate',{url:'http://127.0.0.1:'+server.address().port});
 await b.waitFor("document.querySelector('#after')?.complete&&document.querySelector('#after').naturalWidth===1280");
 await b.command('Network.enable');await b.command('Network.setBlockedURLs',{urls:['https://*','http://*']});
 await b.evaluate("document.querySelector('#role').value='worker';document.querySelector('#role').dispatchEvent(new Event('change'));document.querySelector('#width').value='390';document.querySelector('#theme').value='light';document.querySelector('#view').value='jobs';document.querySelector('#view').dispatchEvent(new Event('change'))");
 await b.waitFor("document.querySelector('#after').complete&&document.querySelector('#after').naturalWidth===390");
 assert.equal(await b.evaluate("[...document.querySelector('#view').options].some(x=>x.value==='team')"),false);
 assert.equal(await b.evaluate("document.querySelector('#download-after').download"),'worker-jobs-390-light-after.png');
 console.log('Self-contained gallery PASS — embedded images, filters/downloads with HTTP(S) blocked');
}finally{if(b)await b.close();await new Promise(r=>server.close(r));}
