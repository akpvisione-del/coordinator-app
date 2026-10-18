/* Pointer/keyboard photo annotation. Session memory only; immutable versions on server. */
'use strict';
(function(root){
 function create(){
  let ctx,epoch=0;const states=new Map(),M=root.AKPDrawingModel;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const changed=()=>ctx?.changed();
  function state(job){if(!states.has(job))states.set(job,{photo:null,image:null,document:null,version:0,viewVersion:0,history:[],busy:false,dirty:false,error:'',undo:[],redo:[],pointer:null,tool:'arrow',zoom:'1',color:'red',text:'',coords:{x1:'10',y1:'15',x2:'80',y2:'65'},attempt:null});return states.get(job);}
  function decode(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('Nie odczytano oryginału.'));reader.onload=()=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Nie można zdekodować zdjęcia. Oryginał zachowano.'));image.src=reader.result;};reader.readAsDataURL(blob);});}
  async function open(job,photo){
   const s=state(job),e=epoch;if(s.busy)return;if(s.photo&&s.dirty&&!root.confirm('Odrzucić szkic rysunku i wczytać zapisane dane?'))return;
   s.photo=photo;s.busy=true;s.error='';s.image=null;s.document=null;s.pointer=null;changed();
   try{
    const [blob,r]=await Promise.all([ctx.api('/jobs/'+job+'/media/photos/'+photo+'/file',{returnBlob:true}),ctx.api('/jobs/'+job+'/drawings/'+photo)]);if(e!==epoch)return;
    const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');const image=await decode(blob);if(e!==epoch)return;
    const doc=r.document||{schema:1,width:image.naturalWidth,height:image.naturalHeight,source_sha256:hash,shapes:[]};M.validate(doc);
    if(doc.source_sha256!==hash||doc.width!==image.naturalWidth||doc.height!==image.naturalHeight)throw Error('Zapisany rysunek odnosi się do innego oryginału. Nie nakładamy go na zmieniony plik.');
    s.image=image;s.document=doc;s.version=r.version;s.viewVersion=r.version;s.history=r.history;s.undo=[];s.redo=[];s.dirty=false;s.attempt=null;
   }catch(err){if(e===epoch)s.error=err.message;}finally{if(e===epoch){s.busy=false;changed();}}
  }
  async function history(job,version){
   const s=state(job),e=epoch;if(!s.image||s.busy)return;if(s.dirty&&!root.confirm('Zastąpić szkic wybraną wersją?'))return;s.busy=true;s.error='';changed();
   try{const r=await ctx.api('/jobs/'+job+'/drawings/'+s.photo+'?version='+version);if(e!==epoch)return;M.validate(r.document);if(r.document.source_sha256!==s.document.source_sha256)throw Error('Ta wersja dotyczy innego oryginału zdjęcia.');s.document=r.document;s.viewVersion=r.version;s.undo=[];s.redo=[];s.dirty=false;s.attempt=null;
   }catch(err){if(e===epoch)s.error=err.message;}finally{if(e===epoch){s.busy=false;changed();}}
  }
  async function save(job){
   const s=state(job),e=epoch;if(!s.document||s.busy)return;
   try{M.validate(s.document);}catch(err){s.error=err.message;changed();return;}
   const signature=JSON.stringify(s.document);if(s.attempt?.signature!==signature)s.attempt={signature,id:root.crypto.randomUUID()};
   s.busy=true;s.error='';s.pointer=null;changed();
   try{const r=await ctx.api('/jobs/'+job+'/drawings/'+s.photo,{method:'POST',body:{expected_version:s.version,client_id:s.attempt.id,document:s.document}});if(e!==epoch)return;
    s.version=r.version;s.viewVersion=r.version;s.dirty=false;s.attempt=null;s.history=[{version:r.version,created_at:new Date().toISOString()},...s.history.filter(x=>x.version!==r.version)];ctx.toast('Zapisano wersję rysunku '+r.version+'.');
   }catch(err){if(e===epoch)s.error=err.message+' Szkic pozostaje w tej sesji.';}finally{if(e===epoch){s.busy=false;changed();}}
  }
  function mutate(s,shapes){s.undo.push(structuredClone(s.document.shapes));if(s.undo.length>50)s.undo.shift();s.redo=[];s.document.shapes=shapes;s.dirty=true;s.error='';}
  function shape(s,a,b){return {id:root.crypto.randomUUID(),type:s.tool,x1:a.x,y1:a.y,x2:s.tool==='label'?a.x:b.x,y2:s.tool==='label'?a.y:b.y,text:['label','dimension'].includes(s.tool)?s.text.trim():'',color:s.color};}
  function add(s,value){try{const doc={...s.document,shapes:[...s.document.shapes,value]};M.validate(doc);mutate(s,doc.shapes);}catch(err){s.error=err.message;}changed();}
  function undo(s,redo=false){const from=redo?s.redo:s.undo,to=redo?s.undo:s.redo;if(!from.length)return;to.push(structuredClone(s.document.shapes));s.document.shapes=from.pop();s.pointer=null;s.dirty=true;changed();}
  function mount(){
   for(const canvas of root.document.querySelectorAll('[data-drawing-canvas]')){
    const job=canvas.dataset.drawingCanvas,s=states.get(job),e=epoch;if(!s?.image||!s.document)continue;
    const paint=preview=>M.render(canvas,s.image,s.document,preview);
    paint();if(canvas.dataset.mounted)continue;canvas.dataset.mounted='1';
    const active=()=>e===epoch&&!s.busy&&states.get(job)===s;
    canvas.addEventListener('pointerdown',event=>{if(!active()||s.tool==='pan'||s.pointer||!event.isPrimary||event.button!==0)return;event.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);const p=M.point(canvas.getBoundingClientRect(),event.clientX,event.clientY);s.pointer={id:event.pointerId,start:p,end:p};});
    canvas.addEventListener('pointermove',event=>{if(!active()||s.pointer?.id!==event.pointerId)return;event.preventDefault();s.pointer.end=M.point(canvas.getBoundingClientRect(),event.clientX,event.clientY);paint(shape(s,s.pointer.start,s.pointer.end));});
    canvas.addEventListener('pointerup',event=>{if(!active()||s.pointer?.id!==event.pointerId)return;event.preventDefault();const pointer=s.pointer;s.pointer=null;const end=M.point(canvas.getBoundingClientRect(),event.clientX,event.clientY);if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);add(s,shape(s,pointer.start,end));});
    const cancel=()=>{if(e!==epoch)return;s.pointer=null;paint();};canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
    canvas.addEventListener('keydown',event=>{if(!active())return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(s,event.shiftKey);}if(event.key==='Escape'){s.pointer=null;paint();}});
   }
  }
  function download(job,type){
   const s=state(job);if(!s.image||!s.document)return;
   const a=root.document.createElement('a'),base='AKP-rysunek-'+s.photo+'-'+(s.dirty?'szkic':'v'+s.viewVersion);
   if(type==='png'){
    const c=root.document.createElement('canvas'),scale=Math.min(1,4096/Math.max(s.document.width,s.document.height));c.width=Math.max(1,Math.round(s.document.width*scale));c.height=Math.max(1,Math.round(s.document.height*scale));M.render(c,s.image,s.document);a.href=c.toDataURL('image/png');a.download=base+'.png';
   }else {a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify({job_id:job,photo_id:s.photo,version:s.viewVersion,unsaved:s.dirty,document:s.document},null,2));a.download=base+'.json';}
   root.document.body.append(a);a.click();a.remove();
  }
  function remember(input){const job=input.dataset.drawingField;if(!job)return;const s=state(job);if(s.busy)return;if(input.name==='zoom'){s.zoom=['1','2','3'].includes(input.value)?input.value:'1';changed();return;}if(input.name==='tool'){s.tool=input.value;root.document.querySelector('[data-drawing-canvas]')?.classList.toggle('pro-canvas-pan',s.tool==='pan');return;}if(input.name in s.coords)s.coords[input.name]=input.value;else if(['tool','text','color'].includes(input.name))s[input.name]=input.value;}
  function click(b){
   if(b.dataset.drawingOpen){void open(b.dataset.drawingOpen,b.dataset.drawingPhoto);return true;}
   const action=b.dataset.drawing;if(!action)return false;const job=b.dataset.drawingJob,s=state(job);if(s.busy)return true;
   if(action==='reload')void open(job,s.photo);if(action==='save')void save(job);if(action==='history')void history(job,Number(b.dataset.version));
   if(action==='undo')undo(s);if(action==='redo')undo(s,true);
   if(action==='add'&&s.document&&s.tool!=='pan'){const c=s.coords;add(s,shape(s,{x:Math.round(Number(c.x1)*100),y:Math.round(Number(c.y1)*100)},{x:Math.round(Number(c.x2)*100),y:Math.round(Number(c.y2)*100)}));}
   if(action==='remove'&&s.document){mutate(s,s.document.shapes.filter(x=>x.id!==b.dataset.shape));changed();}
   if(action==='png'||action==='json')download(job,action);
   if(action==='close'&&(!s.dirty||root.confirm('Zamknąć i odrzucić niezapisany rysunek?'))){states.delete(job);changed();}return true;
  }
  function view(job){
   const s=states.get(job);if(!s?.photo)return '';
   const button=(action,label,extra='')=>`<button type="button" class="btn" data-drawing="${action}" data-drawing-job="${esc(job)}" ${s.busy?'disabled':''} ${extra}>${esc(label)}</button>`,error=s.error?`<p class="pro-error" role="alert">${esc(s.error)}</p>`:'';
   if(!s.image||!s.document)return `<section class="akp-drawing"><h3>DrawingCanvas</h3>${error}<p>${s.busy?'Odczyt oryginału i wersji…':'Nie otwarto rysunku.'}</p>${button('reload','Ponów odczyt')}${button('close','Zamknij DrawingCanvas')}</section>`;
   const scale=Math.min(1,1600/Math.max(s.document.width,s.document.height));
   return `<section class="akp-drawing" data-drawing-editor="${esc(job)}"><h3>DrawingCanvas · ${esc(s.photo.slice(0,8))}</h3><p role="status">${s.busy?'Trwa zapis / odczyt…':s.dirty?'Niezapisany szkic rysunku':s.version?'Zapisana wersja '+s.version:'Nowy rysunek'}${s.viewVersion&&s.viewVersion!==s.version?' · Kopia wersji '+s.viewVersion:''}</p>${error}
   <p>Rysuj jednym palcem. Stronę przewijaj poza zdjęciem. Wymiary wpisuj z pomiarów w terenie — zdjęcie nie jest skalą.</p>
   <fieldset ${s.busy?'disabled':''}><legend>Narzędzia</legend><div class="pro-grid"><label>Narzędzie<select name="tool" data-drawing-field="${esc(job)}">${[['line','Linia'],['arrow','Strzałka'],['dimension','Wymiar'],['label','Podpis'],['pan','Przesuwanie powiększenia']].map(([v,l])=>`<option value="${v}" ${s.tool===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Kolor<select name="color" data-drawing-field="${esc(job)}"><option value="red" ${s.color==='red'?'selected':''}>Czerwony AKP</option><option value="blue" ${s.color==='blue'?'selected':''}>Niebieski AI</option></select></label></div><label>Wymiar / podpis (np. 1250 mm)<input name="text" data-drawing-field="${esc(job)}" maxlength="120" value="${esc(s.text)}"></label></fieldset>
   <label>Powiększenie<select name="zoom" data-drawing-field="${esc(job)}">${['1','2','3'].map(v=>`<option value="${v}" ${s.zoom===v?'selected':''}>${v==='1'?'Dopasuj do ekranu':v+'× — wybierz przesuwanie, aby obejrzeć fragment'}</option>`).join('')}</select></label><div class="pro-canvas-viewport pro-drawing-zoom${s.zoom}"><canvas class="pro-drawing-canvas ${s.tool==='pan'?'pro-canvas-pan':''}" data-drawing-canvas="${esc(job)}" width="${Math.round(s.document.width*scale)}" height="${Math.round(s.document.height*scale)}" tabindex="0" aria-label="Zdjęcie z adnotacjami. Alternatywa klawiaturowa: współrzędne i lista elementów poniżej. Ctrl+Z cofa zmianę."></canvas></div>
   <div class="pro-actions">${button('undo','Cofnij',s.undo.length?'':'disabled')}${button('redo','Ponów',s.redo.length?'':'disabled')}${button('save','Zapisz kolejną wersję')}${button('reload','Wczytaj najnowszą')}${button('png','Eksport PNG')}${button('json','Eksport danych rysunku')}${button('close','Zamknij DrawingCanvas')}</div>
   <details><summary>Rysowanie klawiaturą i lista elementów (${s.document.shapes.length}/100)</summary><fieldset ${s.busy?'disabled':''}><legend>Współrzędne w % szerokości / wysokości zdjęcia</legend><div class="pro-grid">${Object.entries(s.coords).map(([key,val])=>`<label>${key.toUpperCase()} %<input name="${key}" type="number" min="0" max="100" step="0.1" data-drawing-field="${esc(job)}" value="${esc(val)}"></label>`).join('')}</div>${button('add','Dodaj element ze współrzędnych')}</fieldset><ol>${s.document.shapes.map((shape,i)=>`<li>${i+1}. ${esc(shape.type)} ${esc(shape.text)} ${button('remove','Usuń element '+(i+1),`data-shape="${esc(shape.id)}"`)}</li>`).join('')}</ol></details>
   <details><summary>Historia rysunku (${s.history.length}, ostatnie 100)</summary>${s.history.map(h=>button('history','Wersja '+h.version+' · '+new Date(h.created_at).toLocaleString('pl-PL'),`data-version="${h.version}"`)).join('')||'<p>Brak zapisanych wersji.</p>'}</details><p>Eksport PNG: oryginał z adnotacjami, maks. 4096 px na dłuższym boku; JSON zachowuje wektory. Oryginał i wcześniejsze wersje nie są zmieniane.</p></section>`;
  }
  return {configure:c=>ctx=c,reset:()=>{epoch++;states.clear();},open,view,mount,click,remember,dirty:()=>[...states.values()].some(s=>s.dirty)};
 }
 root.AKPDrawing=create();if(typeof module==='object')module.exports={create};
})(globalThis);
