// Small Chrome DevTools pipe driver. No package dependency, external traffic or user profile.
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {existsSync} from 'node:fs';
export async function openBrowser(){
 const dir=await mkdtemp(join(tmpdir(),'akp-browser-'));
 await mkdir(join(dir,'config'));await mkdir(join(dir,'cache'));
 const bin=[process.env.CHROME_BIN,'/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].filter(Boolean).find(existsSync);
 if(!bin){await rm(dir,{recursive:true,force:true});throw Error('Chrome not installed');}
 const child=spawn(bin,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-background-networking','--remote-debugging-pipe','--user-data-dir='+join(dir,'profile'),'about:blank'],{
  env:{...process.env,XDG_CONFIG_HOME:join(dir,'config'),XDG_CACHE_HOME:join(dir,'cache')},stdio:['ignore','ignore','pipe','pipe','pipe']
 });
 let sequence=0,buffer='',errors='';const pending=new Map();
 const failAll=error=>{for(const {reject,timer} of pending.values()){clearTimeout(timer);reject(error)}pending.clear();};
 child.stderr.on('data',v=>{errors=(errors+v).slice(-2000)});
 child.on('error',failAll);child.on('exit',code=>failAll(Error('Chrome exited '+code+': '+errors)));
 child.stdio[4].on('data',chunk=>{
  buffer+=chunk.toString();let end;
  while((end=buffer.indexOf('\0'))>=0){
   const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;
   let msg;try{msg=JSON.parse(raw)}catch{continue}
   const call=pending.get(msg.id);if(!call)continue;pending.delete(msg.id);clearTimeout(call.timer);
   if(msg.error)call.reject(Error(msg.error.message));else call.resolve(msg.result);
  }
 });
 function send(method,params={},sessionId){
  const id=++sequence;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method+' '+errors))},10000);
   pending.set(id,{resolve,reject,timer});
   child.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0',error=>{if(error){clearTimeout(timer);pending.delete(id);reject(error)}});
  });
 }
 async function close(){
  try{await send('Browser.close')}catch{}
  if(child.exitCode===null){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),new Promise(r=>setTimeout(r,2000))]);}
  if(child.exitCode===null)child.kill('SIGKILL');
  failAll(Error('Browser closed'));await rm(dir,{recursive:true,force:true,maxRetries:3});
 }
 try{
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const command=(method,params)=>send(method,params,sessionId);
  await command('Page.enable');await command('Runtime.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
  const evaluate=async expression=>{
   const out=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(out.exceptionDetails)throw Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);
   return out.result?.value;
  };
  const waitFor=async(expression,timeout=10000)=>{
   const until=Date.now()+timeout;
   while(Date.now()<until){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,75));}
   throw Error('Browser condition timed out: '+expression);
  };
  return {command,evaluate,waitFor,close};
 }catch(e){await close();throw e}
}
