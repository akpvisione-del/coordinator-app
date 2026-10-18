// Synthetic display fixtures for the REAL application. No live Auth or database.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
export const IDs={worker:'22222222-2222-4222-8222-222222222222',coord:'33333333-3333-4333-8333-333333333333',thread:'44444444-4444-4444-8444-444444444444'};
const root=resolve(fileURLToPath(new URL('../../public/',import.meta.url)));
const date=(offset=0)=>{const d=new Date();d.setDate(d.getDate()+offset);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
export async function visualFixture(options={}){
 let role='coordinator',empty=false,unavailable=false;const requests=[];
 const policy=(await readFile(resolve(root,'../netlify.toml'),'utf8')).match(/Content-Security-Policy\s*=\s*"([^"]+)"/)[1];
 const jobs=[['Kuchnia · Apartament Mokotów','Warszawa, ul. Przykładowa 18',0,'W_REALIZACJI','WYSOKI'],['Montaż zabudowy garderoby','Piaseczno, ul. Testowa 7',1,'DO_REALIZACJI','NORMALNY'],['Pomiar · Dom nad jeziorem','Józefosław, ul. Próbna 12',0,'POMIAR','NORMALNY'],['Serwis frontów kuchennych','Warszawa, ul. Modelowa 4',-2,'SERWIS','KRYTYCZNY'],['Łazienka · Projekt północ','Konstancin, ul. Przykładowa 2',null,'NOWE','NORMALNY'],['Odbiór prac wykończeniowych','Warszawa, ul. Testowa 10',2,'DO_ODBIORU','NORMALNY']].map(([title,location,offset,status,priority],i)=>({id:'10000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),title,reference:'AKP / '+String(1041+i),location,client_address:location,client_name:'Klient demonstracyjny',client_phone:'+48 500 000 000',due:offset===null?null:date(offset),status,priority,assignees:[IDs.worker],instructions:'Zweryfikuj wymiary i dokumentację. Zabezpiecz miejsce pracy przed montażem.',updated_at:'2026-10-17T12:00:00Z',created_at:'2026-10-17T10:00:00Z',checklist:[{index:0,title:'Sprawdź dokumentację',done:true},{index:1,title:'Zabezpiecz miejsce pracy',done:false}],photos:[]}));
 const team=[{id:IDs.worker,display:'Marek Kowalski',is_active:true,preferred_lang:'pl'},{id:'55555555-5555-4555-8555-555555555555',display:'Oleh Melnyk',is_active:true,preferred_lang:'uk'},{id:'66666666-6666-4666-8666-666666666666',display:'Anna Nowak',is_active:false,preferred_lang:'pl'}];
 const safeJob=j=>role==='worker'?{...j}:{...j,revenue_net:12400,crew_cost:4200,margin_net:8200};
 const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
 const server=createServer(async(req,res)=>{
  res.setHeader('Content-Security-Policy',policy);res.setHeader('Cache-Control','no-store');
  const u=new URL(req.url,'http://localhost'),p=u.pathname;
  const reply=(data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
  if(p.startsWith('/api/')){
   requests.push(req.method+' '+p);
   if(options.handle&&await options.handle({req,res,role,jobs,reply}))return;
   if(req.method!=='GET')return reply({message:'Podgląd demonstracyjny — dane nie są zapisywane.'},409);
   if(p==='/api/health')return reply({configured:true,mode:'VISUAL MOCK'});
   if(p==='/api/me')return reply({id:role==='worker'?IDs.worker:IDs.coord,display:role==='worker'?'Marek Kowalski':'Aleksandra · Koordynacja',role,preferred_lang:'pl'});
   if(p==='/api/jobs')return reply({items:empty?[]:jobs.map(safeJob)});
   if(p.startsWith('/api/jobs/')){const job=jobs.find(j=>j.id===p.split('/')[3]);return job?reply({job:safeJob(job)}):reply({items:[]});}
   if(p==='/api/reports')return reply({items:[]});
   if(['/api/team','/api/dashboard','/api/audit','/api/sources'].includes(p)&&role==='worker')return reply({message:'Forbidden'},403);
   if(p==='/api/team')return reply({items:empty?[]:team,can_create:true});
   if(p==='/api/dashboard'||p==='/api/sources')return reply({count:0});
   if(p==='/api/audit')return reply({items:[]});
   if(p==='/api/chat/notifications')return reply({unread_total:empty?0:2});
   if(p.startsWith('/api/chat/')&&unavailable)return reply({message:'Komunikator chwilowo niedostępny. Spróbuj ponownie. Nie zapisano wiadomości.'},503);
   if(p==='/api/chat/recipients')return reply({items:[{id:role==='worker'?IDs.coord:IDs.worker,display:role==='worker'?'Aleksandra · Koordynacja':'Marek Kowalski'}]});
   if(p==='/api/chat/threads')return reply({items:empty?[]:[{id:IDs.thread,peer_display:role==='worker'?'Aleksandra · Koordynacja':'Marek Kowalski',unread:2}],unread_total:empty?0:2,next_offset:null});
   if(p.endsWith('/messages'))return reply({items:empty?[]:[{id:'m3',seq:'3',body:'Jasne, będziemy na miejscu o ustalonej porze. Dodam zdjęcia po zakończeniu.',sender_id:IDs.worker,source_language:'pl',created_at:date()+'T10:12:00Z'},{id:'m2',seq:'2',body:'Dokumentacja jest już uzupełniona. Proszę sprawdź wymiary przed rozpoczęciem montażu.',sender_id:IDs.coord,source_language:'pl',job_id:jobs[0].id,created_at:date()+'T10:10:00Z'},{id:'m1',seq:'1',body:'Dzień dobry! Potwierdzam odbiór zlecenia na Mokotowie.',sender_id:IDs.worker,source_language:'pl',created_at:date()+'T10:08:00Z'}],next_before:null});
   return reply({items:[],next_before:null});
  }
  try{
   const file=resolve(root,'.'+(p==='/'||p==='/login'?'/index.html':p));if(!file.startsWith(root+sep))throw Error('path');
   res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
  }catch{res.statusCode=404;res.end('Not found');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'http://127.0.0.1:'+server.address().port,jobs,requests,setRole:value=>{role=value;requests.length=0;},setEmpty:value=>empty=value,setUnavailable:value=>unavailable=value,close:()=>new Promise(r=>server.close(r))};
}
