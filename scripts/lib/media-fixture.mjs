// In-process synthetic binary Storage + metadata. Never contacts Supabase.
import {visualFixture,IDs} from './visual-fixture.mjs';
export const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=','base64');
export async function mediaFixture(options={}){
 const slots=new Map(),photos=[],files=new Map(),uploads=[];
 const f=await visualFixture({handle:async({req,res,role,reply,...rest})=>{
  const u=new URL(req.url,'http://local.invalid'),p=u.pathname;
  if(options.handle&&await options.handle({req,res,role,reply,...rest}))return true;
  if(!p.includes('/media'))return false;
  let body=null;if(['POST','PUT'].includes(req.method)){const chunks=[];for await(const c of req)chunks.push(c);body=Buffer.concat(chunks);}
  if(p.endsWith('/media')){reply({items:photos,next_before:null});return true;}
  if(p.endsWith('/uploads')){const b=JSON.parse(body);slots.set(b.id,b);reply({id:b.id},201);return true;}
  const match=p.match(/\/uploads\/([^/]+)\/file$/);
  if(match){const slot=slots.get(match[1]);if(!slot){reply({message:'Missing slot'},404);return true;}uploads.push({id:slot.id,bytes:body});files.set(slot.id,body);photos.push({id:slot.id,caption:slot.caption,stage:slot.stage,category:slot.category,meta_revision:1,uploaded_by:role==='worker'?IDs.worker:IDs.coord,file_state:'READY',created_at:'2026-10-17T12:00:00Z'});reply({id:slot.id},201);return true;}
  const file=p.match(/\/photos\/([^/]+)\/file$/);
  if(file){res.writeHead(200,{'Content-Type':'image/png'});res.end(files.get(file[1])||png);return true;}
  const meta=p.match(/\/photos\/([^/]+)$/);
  if(meta&&req.method==='POST'){const b=JSON.parse(body),photo=photos.find(x=>x.id===meta[1]);Object.assign(photo,{caption:b.caption,stage:b.stage,category:b.category,meta_revision:photo.meta_revision+1});reply({revision:photo.meta_revision});return true;}
  reply({message:'Unknown synthetic endpoint'},404);return true;
 }});
 return {...f,photos,slots,files,uploads};
}
