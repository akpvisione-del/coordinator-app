/* Quotes are lazy-loaded, session-only drafts. Server/RLS owns all authorization. */
'use strict';
(function(root){
 function create(){
  let ctx,epoch=0;const states=new Map();const M=root.AKPProModel;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state=id=>{if(!states.has(id))states.set(id,{loaded:false,busy:false,dirty:false,error:'',version:0,viewVersion:0,history:[],doc:null,variant:0,attempt:null});return states.get(id);};
  const changed=()=>ctx?.changed();
  function reset(){epoch++;states.clear();}
  function configure(value){ctx=value;}
  async function load(id,version){
   const s=state(id),e=epoch;if(s.busy)return;
   if(s.dirty&&!root.confirm('Zastąpić niezapisany szkic wybraną wersją?'))return;
   s.busy=true;s.error='';changed();
   try{const r=await ctx.api('/jobs/'+id+'/quote'+(version?'?version='+version:''));if(e!==epoch)return;
    s.version=version?s.version:r.version;s.viewVersion=r.version;s.doc=r.document||M.blank('Wycena zlecenia');s.history=r.history;s.variant=0;s.loaded=true;s.dirty=false;s.attempt=null;
   }catch(err){if(e===epoch)s.error=err.message;}finally{if(e===epoch){s.busy=false;changed();}}
  }
  async function save(id){
   const s=state(id),e=epoch;if(s.busy)return;
   try{M.validate(s.doc);}catch(err){s.error=err.message;changed();return;}
   const signature=JSON.stringify(s.doc);if(s.attempt?.signature!==signature)s.attempt={signature,client_id:root.crypto.randomUUID()};
   s.busy=true;s.error='';changed();
   try{const r=await ctx.api('/jobs/'+id+'/quote',{method:'POST',body:{expected_version:s.version,client_id:s.attempt.client_id,document:s.doc}});
    if(e!==epoch)return;s.version=r.version;s.viewVersion=r.version;s.dirty=false;s.attempt=null;s.history=[{version:r.version,created_at:new Date().toISOString()},...s.history.filter(x=>x.version!==r.version)];
    ctx.toast('Zapisano wersję '+r.version+'.');
   }catch(err){if(e===epoch)s.error=err.message+' Szkic pozostaje w tej sesji.';}finally{if(e===epoch){s.busy=false;changed();}}
  }
  function field(id,path,label,value,extra=''){return `<label>${esc(label)}<input data-pro-field="${esc(id)}" data-path="${esc(path)}" value="${esc(value)}" ${extra}></label>`;}
  function summary(s){try{const t=M.totals(s.doc.variants[s.variant]);return `Netto ${M.money(t.net)} · VAT ${M.money(t.tax)} · Brutto ${M.money(t.gross)}`;}catch{return 'Sprawdź liczby: ilość do 3 miejsc, stawka / % do 2 miejsc po kropce.';}}
  function view(id){
   if(ctx.me()?.role!=='coordinator')return '';
   const s=state(id),button=(action,label,extra='')=>`<button type="button" class="btn" data-pro="${action}" data-pro-job="${esc(id)}" ${s.busy?'disabled':''} ${extra}>${esc(label)}</button>`;
   const error=s.error?`<p class="pro-error" role="alert">${esc(s.error)}</p>`:'';
   if(!s.loaded)return `<div class="akp-pro"><p>Pozycje, warianty, rabaty i VAT. Dane firmowe: tylko koordynator.</p>${error}${button('load',s.busy?'Wczytywanie…':'Otwórz Wyceny PRO')}</div>`;
   const d=s.doc,v=d.variants[s.variant];
   return `<div class="akp-pro" data-pro-editor="${esc(id)}"><p role="status">${s.busy?'Trwa zapis / odczyt…':s.dirty?'Niezapisany szkic w tej sesji':s.version?'Zapisana wersja '+s.version:'Nowa wycena'}${s.viewVersion&&s.viewVersion!==s.version?' · Edytujesz kopię wersji '+s.viewVersion:''}</p>${error}
    <fieldset ${s.busy?'disabled':''}><legend>Dane dokumentu · PLN</legend>${field(id,'title','Tytuł',d.title,'maxlength="120"')}
    <div class="pro-grid">${['company','customer'].map((party,i)=>`<div><h3>${i?'Klient':'Wykonawca'}</h3>${[['name','Nazwa',160],['address','Adres',300],['tax_id','NIP',40],['email','E-mail',160]].map(([key,label,max])=>field(id,party+'.'+key,label,d[party][key],`maxlength="${max}"`)).join('')}</div>`).join('')}</div>
    <label>Wariant<select data-pro-variant="${esc(id)}">${d.variants.map((item,i)=>`<option value="${i}" ${i===s.variant?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label>
    ${field(id,'variants.'+s.variant+'.name','Nazwa wariantu',v.name,'maxlength="80"')}
    ${button('clone','Powiel wariant',d.variants.length>=6?'disabled':'')}
    <div class="pro-lines">${v.lines.map((l,i)=>`<fieldset class="pro-line"><legend>Pozycja ${i+1}</legend>${field(id,`variants.${s.variant}.lines.${i}.name`,'Nazwa',l.name,'maxlength="200"')}
    <div class="pro-line-grid"><label>Jednostka<select data-pro-field="${esc(id)}" data-path="variants.${s.variant}.lines.${i}.unit">${M.units.map(u=>`<option ${l.unit===u?'selected':''}>${esc(u)}</option>`).join('')}</select></label>
    ${[['quantity','Ilość'],['rate','Stawka netto PLN'],['discount','Rabat %'],['vat','VAT %']].map(([key,label])=>field(id,`variants.${s.variant}.lines.${i}.${key}`,label,l[key],'inputmode="decimal" maxlength="13"')).join('')}</div>
    ${button('remove','Usuń pozycję',`data-index="${i}"`)}</fieldset>`).join('')||'<p>Brak pozycji. Dodaj pierwszą pozycję kosztorysu.</p>'}</div>
    ${button('add','Dodaj pozycję',v.lines.length>=80?'disabled':'')}
    <label>Uwagi i warunki<textarea data-pro-field="${esc(id)}" data-path="notes" maxlength="2000">${esc(d.notes)}</textarea></label></fieldset>
    <p class="pro-total" data-pro-total="${esc(id)}" aria-live="polite">${esc(summary(s))}</p>
    <div class="pro-actions">${button('save','Zapisz nową wersję')}${button('load','Wczytaj najnowszą')}
    ${s.version?`<a class="btn" href="/api/jobs/${esc(id)}/quote/pdf?version=${s.viewVersion||s.version}&amp;variant=${esc(v.id)}" download>PDF zapisanej wersji</a>`:''}</div>
    <p>PDF zawiera wyłącznie zapisane dane. Zaokrąglenia: baza pozycji do grosza → rabat → VAT do grosza; sumowanie pozycji.</p>
    <details><summary>Historia wersji (${s.history.length}, ostatnie 100)</summary>${s.history.map(h=>button('history','Wersja '+h.version+' · '+new Date(h.created_at).toLocaleString('pl-PL'),`data-version="${h.version}"`)).join('')||'<p>Brak zapisanych wersji.</p>'}</details></div>`;
  }
  function remember(input){
   const id=input.dataset.proField;if(!id||ctx.me()?.role!=='coordinator')return;
   const s=state(id);if(!s.doc||s.busy)return;
   const path=input.dataset.path.split('.');let target=s.doc;for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=(input.inputMode==='decimal'?input.value.replace(',','.'):input.value);s.dirty=true;
   const total=root.document?.querySelector('[data-pro-total="'+id+'"]');if(total)total.textContent=summary(s);
  }
  function change(input){remember(input);if(input.dataset.proVariant){const s=state(input.dataset.proVariant);s.variant=Number(input.value);changed();}}
  function click(b){
   if(!b.dataset.pro)return false;const id=b.dataset.proJob,s=state(id);if(ctx.me()?.role!=='coordinator'||s.busy)return true;
   const action=b.dataset.pro;if(action==='load')void load(id);else if(action==='history')void load(id,Number(b.dataset.version));else if(action==='save')void save(id);
   else if(s.doc){const v=s.doc.variants[s.variant];if(action==='add')v.lines.push({id:root.crypto.randomUUID(),name:'Nowa pozycja',unit:'szt.',quantity:'1',rate:'0',discount:'0',vat:'23'});
    if(action==='remove')v.lines.splice(Number(b.dataset.index),1);
    if(action==='clone'&&s.doc.variants.length<6){s.doc.variants.push({...structuredClone(v),id:root.crypto.randomUUID(),name:(v.name+' — kopia').slice(0,80)});s.variant=s.doc.variants.length-1;}
    s.dirty=true;changed();
   }return true;
  }
  return {configure,reset,view,click,remember,change,dirty:()=>[...states.values()].some(s=>s.dirty)};
 }
 root.AKPPro=create();if(typeof module==='object')module.exports={create};
})(globalThis);
