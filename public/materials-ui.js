'use strict';
(function(root){
 function create(){
  let ctx,epoch=0;const states=new Map(),M=root.AKPProModel;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={TO_BUY:'Do kupienia',ORDERED:'Zamówione',PURCHASED:'Zakupione'};
  const fresh=()=>({id:root.crypto.randomUUID(),expected_revision:0,source:'',name:'',quantity:'1',unit:'szt.',status:'TO_BUY',supplier:'',notes:''});
  function state(id){if(!states.has(id))states.set(id,{loaded:false,busy:false,dirty:false,error:'',items:[],sources:[],draft:fresh(),attempt:null});return states.get(id);}
  const changed=()=>ctx?.changed();
  async function load(id){const s=state(id),e=epoch;if(s.busy)return;s.busy=true;s.error='';changed();try{const r=await ctx.api('/jobs/'+id+'/materials');if(e===epoch){s.items=r.items;s.loaded=true;}}catch(err){if(e===epoch)s.error=err.message;}finally{if(e===epoch){s.busy=false;changed();}}}
  async function sources(id){const s=state(id),e=epoch;if(s.busy)return;s.busy=true;changed();try{const r=await ctx.api('/jobs/'+id+'/quote');if(e===epoch){s.sources=(r.document?.variants||[]).flatMap(v=>v.lines.map(l=>({value:[r.version,v.id,l.id].join('|'),name:'v'+r.version+' / '+v.name+' / '+l.name})));s.error=s.sources.length?'':'Brak zapisanych pozycji wyceny. Możesz dodać materiał ręcznie.';}}catch(err){if(e===epoch)s.error=err.message;}finally{if(e===epoch){s.busy=false;changed();}}}
  async function submit(form){
   const id=form.dataset.materialForm,s=state(id),e=epoch;if(s.busy)return;
   const d=s.draft,ref=d.source?d.source.split('|'):null;
   const body={id:d.id,expected_revision:d.expected_revision,status:d.status,supplier:d.supplier,notes:d.notes,name:ref?null:d.name,quantity:ref?null:d.quantity.replace(',','.'),unit:ref?null:d.unit,quote_version:ref?Number(ref[0]):null,quote_variant:ref?ref[1]:null,quote_line:ref?ref[2]:null};
   const signature=JSON.stringify(body);if(s.attempt?.signature!==signature)s.attempt={signature,client_id:root.crypto.randomUUID()};
   s.busy=true;s.error='';changed();try{await ctx.api('/jobs/'+id+'/materials',{method:'POST',body:{...body,client_id:s.attempt.client_id}});if(e!==epoch)return;s.draft=fresh();s.dirty=false;s.attempt=null;s.busy=false;ctx.toast('Zapisano materiał.');await load(id);}catch(err){if(e===epoch){s.error=err.message+' Szkic zachowano.';s.busy=false;changed();}}
  }
  async function status(id,itemId){
   const s=state(id),item=s.items.find(x=>x.id===itemId),e=epoch;if(!item||s.busy)return;
   const value=root.document.querySelector('[data-material-status="'+itemId+'"]')?.value;if(!value)return;
   const body={id:item.id,expected_revision:item.revision,status:value};const signature=JSON.stringify(body);if(s.attempt?.signature!==signature)s.attempt={signature,client_id:root.crypto.randomUUID()};
   s.busy=true;s.error='';changed();try{await ctx.api('/jobs/'+id+'/materials',{method:'POST',body:{...body,client_id:s.attempt.client_id}});if(e!==epoch)return;s.attempt=null;s.busy=false;await load(id);}catch(err){if(e===epoch){s.busy=false;s.error=err.message;changed();}}
  }
  function remember(input){const id=input.dataset.materialField;if(!id)return;const s=state(id);if(!s.busy){s.draft[input.name]=input.value;s.dirty=true;if(input.name==='source')changed();}}
  function click(b){
   const action=b.dataset.material;if(!action)return false;const id=b.dataset.materialJob,s=state(id);if(s.busy)return true;
   if(action==='load')void load(id);if(action==='sources'&&ctx.me()?.role==='coordinator')void sources(id);
   if(action==='new'&&(!s.dirty||root.confirm('Odrzucić szkic materiału?'))){s.draft=fresh();s.dirty=false;changed();}
   if(action==='edit'&&ctx.me()?.role==='coordinator'&&(!s.dirty||root.confirm('Odrzucić szkic materiału?'))){const item=s.items.find(x=>x.id===b.dataset.item);if(item){s.draft={...item,expected_revision:item.revision,source:item.quote_version?[item.quote_version,item.quote_variant,item.quote_line].join('|'):''};s.dirty=false;changed();}}
   if(action==='status'&&ctx.me()?.role==='worker')void status(id,b.dataset.item);return true;
  }
  function view(id){
   const s=state(id),coord=ctx.me()?.role==='coordinator',d=s.draft;
   const button=(action,label,extra='')=>`<button type="button" class="btn" data-material="${action}" data-material-job="${esc(id)}" ${s.busy?'disabled':''} ${extra}>${esc(label)}</button>`;
   const error=s.error?`<p class="pro-error" role="alert">${esc(s.error)}</p>`:'';
   if(!s.loaded)return `<div class="akp-pro">${error}${button('load',s.busy?'Wczytywanie…':'Otwórz listę materiałów')}</div>`;
   const field=(name,label,max=200)=>`<label>${label}<input name="${name}" data-material-field="${esc(id)}" value="${esc(d[name])}" maxlength="${max}" ${d.source&&['name','quantity'].includes(name)?'disabled':''} ${name==='quantity'?'inputmode="decimal"':''}></label>`;
   return `<div class="akp-pro" data-material-list="${esc(id)}">${error}<p>Lista zakupów zlecenia · ${s.items.length} pozycji</p>${button('load','Odśwież listę')}
   ${s.items.map(item=>`<article class="pro-line"><h3>${esc(item.name)}</h3><p>${esc(item.quantity)} ${esc(item.unit)} · <strong>${esc(labels[item.status])}</strong></p><p>${esc(item.supplier)} ${esc(item.notes)}</p>
   ${coord?`${item.quote_version?`<p>Źródło: zapisana wycena v${item.quote_version}; ilość i opis odczytywane z pozycji.</p>`:''}${button('edit','Edytuj',`data-item="${esc(item.id)}"`)}`:`<label>Status zakupów<select data-material-status="${esc(item.id)}">${Object.entries(labels).map(([v,label])=>`<option value="${v}" ${v===item.status?'selected':''}>${label}</option>`).join('')}</select></label>${button('status','Zapisz status',`data-item="${esc(item.id)}"`)}`}</article>`).join('')||'<p>Brak materiałów. Koordynator może uzupełnić listę zakupów.</p>'}
   ${coord?`<form data-material-form="${esc(id)}"><fieldset ${s.busy?'disabled':''}><legend>${d.expected_revision?'Edycja materiału':'Nowy materiał'}</legend>${button('sources','Wczytaj pozycje zapisanej wyceny')}
   <label>Źródło<select name="source" data-material-field="${esc(id)}"><option value="">Materiał wpisany ręcznie</option>${d.source&&!s.sources.some(x=>x.value===d.source)?`<option value="${esc(d.source)}" selected>Dotychczasowa pozycja wyceny (bez zmiany źródła)</option>`:''}${s.sources.map(x=>`<option value="${esc(x.value)}" ${x.value===d.source?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
   ${d.source?'<p>Nazwa, jednostka i ilość pochodzą z zapisanej pozycji wyceny. Nie kopiujemy cen.</p>':`${field('name','Materiał')}<div class="pro-grid">${field('quantity','Ilość',13)}<label>Jednostka<select name="unit" data-material-field="${esc(id)}">${M.units.map(u=>`<option ${u===d.unit?'selected':''}>${esc(u)}</option>`).join('')}</select></label></div>`}
   <label>Status<select name="status" data-material-field="${esc(id)}">${Object.entries(labels).map(([v,label])=>`<option value="${v}" ${v===d.status?'selected':''}>${label}</option>`).join('')}</select></label>${field('supplier','Dostawca',160)}${field('notes','Notatki operacyjne (bez kwot)',1000)}
   <button class="btn" type="submit">Zapisz materiał</button>${button('new','Nowy materiał')}</fieldset></form>`:''}</div>`;
  }
  return {configure:c=>ctx=c,reset:()=>{epoch++;states.clear();},view,click,remember,submit,dirty:()=>[...states.values()].some(s=>s.dirty)};
 }
 root.AKPMaterials=create();if(typeof module==='object')module.exports={create};
})(globalThis);
