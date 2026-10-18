'use strict';
(function(root){
 function create(){
  let ctx,epoch=0;const states=new Map();
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stages={BEFORE:'Przed pracami',DURING:'W trakcie',AFTER:'Po pracach',DEFECT:'Usterka',PROTOCOL:'Odbiór'};
  const categories={GENERAL:'Ogólne',MEASUREMENT:'Pomiary',PROGRESS:'Postęp',ISSUE:'Problem',ACCEPTANCE:'Dokumentacja odbioru'};
  const fresh=()=>({caption:'',stage:'DURING',category:'PROGRESS'});
  const state=id=>{if(!states.has(id))states.set(id,{loaded:false,busy:false,error:'',items:[],next:null,selected:null,file:null,draft:fresh(),meta:null,attempt:null,metaAttempt:null,dirty:false});return states.get(id);};
  const changed=()=>ctx?.changed();
  async function load(id,more=false){const s=state(id),e=epoch;if(s.busy)return;s.busy=true;s.error='';changed();
   try{const r=await ctx.api('/jobs/'+id+'/media'+(more&&s.next?'?before='+s.next:''));if(e!==epoch)return;s.items=more?[...new Map([...s.items,...r.items].map(x=>[x.id,x])).values()]:r.items;s.next=r.next_before;s.loaded=true;
   }catch(err){if(e===epoch)s.error=err.message;}finally{if(e===epoch){s.busy=false;changed();}}
  }
  async function upload(form){
   const id=form.dataset.mediaUpload,s=state(id),file=s.file,e=epoch;if(s.busy)return;
   if(!file||file.size>3*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){s.error='Wybierz JPEG, PNG lub WebP do 3 MB. Oryginał nie jest zmniejszany ani nadpisywany.';changed();return;}
   s.busy=true;s.error='';changed();
   try{const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');if(e!==epoch)return;
    const data={...s.draft,mime_type:file.type,size:file.size,sha256:hash},signature=JSON.stringify(data);
    if(s.attempt?.signature!==signature)s.attempt={id:root.crypto.randomUUID(),signature};
    const uploadId=s.attempt.id;
    await ctx.api('/jobs/'+id+'/media/uploads',{method:'POST',body:{...data,id:uploadId}});if(e!==epoch)return;
    await ctx.api('/jobs/'+id+'/media/uploads/'+uploadId+'/file',{method:'PUT',file});if(e!==epoch)return;
    s.file=null;s.draft=fresh();s.dirty=false;s.attempt=null;s.busy=false;ctx.toast('Zapisano oryginał zdjęcia i metadane.');await load(id);
   }catch(err){if(e===epoch){s.busy=false;s.error=err.message+' Plik pozostaje w tej karcie do ponowienia.';changed();}}
  }
  async function saveMeta(form){
   const id=form.dataset.mediaMeta,s=state(id),item=s.items.find(x=>x.id===s.selected),e=epoch;if(s.busy||!item)return;
   const data={...s.meta,expected_revision:item.meta_revision},signature=JSON.stringify(data);if(s.metaAttempt?.signature!==signature)s.metaAttempt={signature,id:root.crypto.randomUUID()};
   s.busy=true;s.error='';changed();try{await ctx.api('/jobs/'+id+'/media/photos/'+item.id,{method:'POST',body:{...data,client_id:s.metaAttempt.id}});if(e!==epoch)return;s.dirty=false;s.metaAttempt=null;s.busy=false;await load(id);const updated=s.items.find(x=>x.id===item.id);if(updated)s.meta={caption:updated.caption,stage:updated.stage,category:updated.category};changed();}
   catch(err){if(e===epoch){s.busy=false;s.error=err.message+' Zachowano opis do ponowienia.';changed();}}
  }
  function remember(input){
   const id=input.dataset.mediaField||input.dataset.mediaFile;if(!id)return;const s=state(id);if(s.busy)return;
   if(input.dataset.mediaFile)s.file=input.files?.[0]||s.file;
   else if(input.dataset.meta==='1'&&s.meta)s.meta[input.name]=input.value;else s.draft[input.name]=input.value;
   s.dirty=true;
  }
  function click(b){
   const action=b.dataset.media;if(!action)return false;const id=b.dataset.mediaJob,s=state(id);if(s.busy)return true;
   if(action==='load')void load(id);if(action==='more')void load(id,true);
   if(action==='preview'){
    if(s.dirty&&s.meta&&!root.confirm('Zastąpić niezapisany opis?'))return true;
    const item=s.items.find(x=>x.id===b.dataset.photo);if(item){s.selected=item.id;s.meta={caption:item.caption,stage:item.stage,category:item.category};s.dirty=!!s.file;changed();}
   }
   if(action==='close'){s.selected=null;s.meta=null;changed();}return true;
  }
  function controls(id,d,meta=false){
   const attr=`data-media-field="${esc(id)}" ${meta?'data-meta="1"':''}`;
   return `<label>Opis zdjęcia<input name="caption" ${attr} maxlength="500" value="${esc(d.caption)}"></label><div class="pro-grid"><label>Etap prac<select name="stage" ${attr}>${Object.entries(stages).map(([v,l])=>`<option value="${v}" ${v===d.stage?'selected':''}>${l}</option>`).join('')}</select></label><label>Kategoria<select name="category" ${attr}>${Object.entries(categories).map(([v,l])=>`<option value="${v}" ${v===d.category?'selected':''}>${l}</option>`).join('')}</select></label></div>`;
  }
  function view(id){
   const s=state(id),button=(action,label,extra='')=>`<button type="button" class="btn" data-media="${action}" data-media-job="${esc(id)}" ${s.busy?'disabled':''} ${extra}>${esc(label)}</button>`,error=s.error?`<p class="pro-error" role="alert">${esc(s.error)}</p>`:'';
   if(!s.loaded)return `<div class="akp-pro">${error}<p>Prywatne oryginały, kategorie i wersje opisów. Dotychczasowe fotografie pozostają w dokumentacji poniżej.</p>${button('load',s.busy?'Wczytywanie…':'Otwórz galerię i dodawanie zdjęć')}</div>`;
   const item=s.items.find(x=>x.id===s.selected),url=photo=>'/api/jobs/'+id+'/media/photos/'+photo.id+'/file';
   return `<div class="akp-pro" data-media-gallery="${esc(id)}">${error}${button('load','Odśwież galerię')}<div class="pro-photo-grid">${s.items.map(p=>`<article><button type="button" class="pro-photo-preview" data-media="preview" data-media-job="${esc(id)}" data-photo="${esc(p.id)}"><img loading="lazy" src="${esc(url(p))}" alt="${esc(p.caption||categories[p.category])}"><strong>${esc(p.caption||'Zdjęcie bez opisu')}</strong><span>${esc(stages[p.stage])} · ${esc(categories[p.category])}</span></button><small>Oryginał prywatny · ${p.file_state==='LEGACY'?'historyczna ścieżka Storage':'przesłany plik'}</small></article>`).join('')||'<p>Brak zdjęć. Dodaj pierwszą dokumentację prac.</p>'}</div>${s.next?button('more','Starsze zdjęcia'):''}
   ${item?`<section class="pro-photo-detail" aria-label="Podgląd zdjęcia"><h3>${esc(item.caption||'Oryginał zdjęcia')}</h3><img src="${esc(url(item))}" alt="${esc(item.caption||'Oryginał')}">${button('close','Zamknij podgląd')}<a class="btn" href="${esc(url(item))}" download>Pobierz oryginał</a>
   <button type="button" class="btn" data-drawing-open="${esc(id)}" data-drawing-photo="${esc(item.id)}">Pomiary i DrawingCanvas</button>
   ${ctx.me()?.role==='coordinator'||item.uploaded_by===ctx.me()?.id?`<form data-media-meta="${esc(id)}"><fieldset ${s.busy?'disabled':''}><legend>Nowa wersja metadanych (oryginał pozostaje bez zmian)</legend>${controls(id,s.meta||item,true)}<button class="btn" type="submit">Zapisz opis, etap i kategorię</button></fieldset></form>`:''}</section>`:''}
   ${root.AKPDrawing?.view(id)||''}
   <form data-media-upload="${esc(id)}"><fieldset ${s.busy?'disabled':''}><legend>Dodaj oryginał zdjęcia</legend>${controls(id,s.draft)}<label>Plik JPEG / PNG / WebP, maks. 3 MB<input type="file" accept="image/jpeg,image/png,image/webp" data-media-file="${esc(id)}"></label>${s.file?`<p>Wybrano: ${esc(s.file.name)} (${Math.ceil(s.file.size/1024)} kB)</p>`:''}<button class="btn" type="submit">${s.busy?'Przesyłanie…':'Prześlij i zapisz zdjęcie'}</button></fieldset></form><p>Brak publicznych linków. Dostęp sprawdzany przy każdym pobraniu. Nie kasujemy wcześniejszych zdjęć ani opisów.</p></div>`;
  }
  return {configure:c=>ctx=c,reset:()=>{epoch++;states.clear();},view,click,remember,upload,saveMeta,dirty:()=>[...states.values()].some(s=>s.dirty)};
 }
 root.AKPMedia=create();if(typeof module==='object')module.exports={create};
})(globalThis);
