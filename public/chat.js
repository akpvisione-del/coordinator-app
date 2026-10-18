/* AKP private messenger. In-memory drafts only; backend/RLS owns authorization. */
'use strict';
(function(root){
 function create(){
  let ctx,epoch=0,selection=0;
  const fresh=()=>({threads:[],recipients:[],messages:[],selected:null,next:null,nextThreads:null,query:'',loading:false,sending:false,error:'',drafts:{},attempts:{}});
  let state=fresh();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={pl:['Wiadomości','Nowa rozmowa','Odbiorca','Bez zlecenia','Rozpocznij','Wyślij','Szukaj w rozmowie','Oznacz jako przeczytaną','Starsze wiadomości','Brak rozmów. Wybierz odbiorcę, aby rozpocząć.','Brak wiadomości.','Nie zapisano wiadomości. Szkic pozostaje w tej karcie.'],
   uk:['Повідомлення','Нова розмова','Одержувач','Без замовлення','Почати','Надіслати','Пошук у розмові','Позначити прочитаним','Старі повідомлення','Немає розмов. Виберіть одержувача.','Немає повідомлень.','Повідомлення не збережено. Чернетка залишається у вкладці.'],
   ru:['Сообщения','Новая беседа','Получатель','Без заказа','Начать','Отправить','Поиск в беседе','Отметить прочитанным','Старые сообщения','Нет бесед. Выберите получателя.','Нет сообщений.','Сообщение не сохранено. Черновик остаётся во вкладке.'],
   en:['Messages','New conversation','Recipient','No job','Start','Send','Search this conversation','Mark as read','Older messages','No conversations. Choose a recipient to start.','No messages.','Message was not saved. The draft remains in this tab.']};
  const l=()=>labels[ctx.me()?.preferred_lang]||labels.pl;
  const changed=()=>ctx?.changed();
  const configure=value=>ctx=value;
  const reset=()=>{epoch++;selection++;state=fresh();};
  const fail=e=>{state.error=e.message;changed();};
  async function notifications(){
   const v=epoch;if(!ctx?.me())return;
   try{const r=await ctx.api('/chat/notifications');if(v===epoch)ctx.unread(Number(r.unread_total)||0);}catch{/* Optional schema may not be deployed; no demo fallback. */}
  }
  async function load(more=false){
   const v=epoch;state.loading=true;state.error='';changed();
   try{
    const [threads,recipients]=await Promise.all([ctx.api('/chat/threads'+(more?'?offset='+state.nextThreads:'')),ctx.api('/chat/recipients')]);
    if(v!==epoch)return;
    state.threads=more?[...new Map([...state.threads,...threads.items].map(t=>[t.id,t])).values()]:threads.items;
    state.nextThreads=threads.next_offset;state.recipients=recipients.items;ctx.unread(Number(threads.unread_total)||0);
   }catch(e){if(v===epoch)fail(e)}finally{if(v===epoch){state.loading=false;changed();}}
  }
  async function open(id){
   state.selected=id;state.messages=[];state.query='';state.next=null;selection++;await history();
  }
  async function history(older=false){
   const v=epoch,s=selection,id=state.selected;if(!id)return;
   state.loading=true;state.error='';changed();
   try{
    const query=new URLSearchParams();if(older&&state.next)query.set('before',state.next);if(state.query)query.set('q',state.query);
    const r=await ctx.api('/chat/threads/'+id+'/messages'+(query.size?'?'+query:''));
    if(v!==epoch||s!==selection)return;
    const items=[...r.items].reverse();state.messages=older?[...new Map([...items,...state.messages].map(m=>[m.id,m])).values()]:items;state.next=r.next_before;
   }catch(e){if(v===epoch&&s===selection){if(e.status===403){state.messages=[];state.selected=null;}fail(e)}}finally{if(v===epoch&&s===selection){state.loading=false;changed();}}
  }
  function remember(input){
   if(input.matches('[data-chat-draft]')&&state.selected)state.drafts[state.selected]={...(state.drafts[state.selected]||{}),[input.name]:input.value};
  }
  async function submit(form){
   const kind=form.dataset.chatForm;if(state.sending)return;
   const values=Object.fromEntries(new FormData(form)),v=epoch,id=state.selected;
   state.sending=true;state.error='';changed();
   try{
    if(kind==='new'){
     const r=await ctx.api('/chat/threads',{method:'POST',body:{other_user_id:values.recipient,job_id:values.job_id||null}});
     if(v!==epoch)return;await load();if(v!==epoch)return;await open(r.thread.id);
    }else if(kind==='search'){
     state.query=String(values.q||'').trim();selection++;await history();
    }else if(kind==='send'&&id){
     const payload={body:String(values.body||'').trim(),job_id:values.job_id||null,language:ctx.me()?.preferred_lang||'pl'};
     if(!payload.body||payload.body.length>4000)throw Error('Wiadomość: 1–4000 znaków.');
     state.drafts[id]={body:values.body,job_id:values.job_id||''};
     const signature=JSON.stringify(payload),previous=state.attempts[id];
     const attempt=previous?.signature===signature?previous:{signature,client_id:crypto.randomUUID()};state.attempts[id]=attempt;
     await ctx.api('/chat/threads/'+id+'/messages',{method:'POST',body:{...payload,client_id:attempt.client_id}});
     if(v!==epoch)return;
     delete state.attempts[id];delete state.drafts[id];
     if(state.selected===id){state.query='';selection++;await history();}await load();
    }
   }catch(e){if(v===epoch){state.error=e.message+(kind==='send'?' '+l()[11]:'');changed();}}
   finally{if(v===epoch){state.sending=false;changed();}}
  }
  async function markRead(){
   const last=state.messages.at(-1),id=state.selected,v=epoch;if(!last||!id)return;
   try{await ctx.api('/chat/threads/'+id+'/read',{method:'POST',body:{message_id:last.id}});if(v===epoch)await load();}catch(e){if(v===epoch)fail(e)}
  }
  function click(button){
   if(button.dataset.chatOpen){void open(button.dataset.chatOpen);return true;}
   if(button.dataset.chatAction){
    const action=button.dataset.chatAction;
    if(action==='refresh')void load().then(()=>state.selected?history():null);
    if(action==='older')void history(true);
    if(action==='more')void load(true);
    if(action==='read')void markRead();return true;
   }
   if(button.dataset.chatJob){ctx.openJob(button.dataset.chatJob);return true;}
   return false;
  }
  function view(){
   const text=l(),thread=state.threads.find(t=>t.id===state.selected),draft=state.drafts[state.selected]||{};
   const options=(selected,empty)=>`<option value="">${esc(empty)}</option>`+ctx.jobs().map(j=>`<option value="${esc(j.id)}" ${j.id===selected?'selected':''}>${esc(j.reference||j.title)}</option>`).join('');
   const disabled=state.loading||state.sending?'disabled':'';
   return `<div class="page-hero"><h1>${text[0]}</h1><button type="button" class="btn" data-chat-action="refresh" aria-label="${esc(text[0])} ↻" ${disabled}>↻</button></div>${state.error?`<p class="form-error" role="alert">${esc(state.error)}</p>`:''}<div class="chat-layout" aria-busy="${state.loading||state.sending}"><section class="card chat-threads"><h2>${text[1]}</h2><form data-chat-form="new"><label>${text[2]}<select name="recipient" required>${state.recipients.map(p=>`<option value="${esc(p.id)}">${esc(p.display)}</option>`).join('')}</select></label><label>Job<select name="job_id">${options('',text[3])}</select></label><button class="btn" type="submit" ${disabled}>${text[4]}</button></form><nav aria-label="${text[0]}">${state.threads.map(t=>`<button type="button" class="btn chat-thread" data-chat-open="${esc(t.id)}" ${t.id===state.selected?'aria-current="true"':''}>${esc(t.peer_display)}${t.job_id?' · Job':''}${t.unread?` <strong>(${Number(t.unread)})</strong>`:''}</button>`).join('')||`<p>${text[9]}</p>`}</nav>${state.nextThreads!==null?'<button type="button" class="btn" data-chat-action="more">＋</button>':''}</section><section class="card chat-conversation">${state.selected?`<h2>${esc(thread?.peer_display||text[0])}</h2><form data-chat-form="search" role="search"><label>${text[6]}<input name="q" maxlength="100" value="${esc(state.query)}"></label><button type="submit" class="btn" aria-label="${esc(text[6])}" ${disabled}>⌕</button></form>${state.next?`<button class="btn" type="button" data-chat-action="older" ${disabled}>${text[8]}</button>`:''}<div role="log" aria-live="polite" class="chat-log">${state.messages.map(m=>`<article class="chat-message ${m.sender_id===ctx.me()?.id?'chat-own':''}"><small>${m.sender_id===ctx.me()?.id?'●':'○'} · ${esc(new Date(m.created_at).toLocaleString())} · ${esc(m.source_language)}</small><p>${esc(m.body)}</p>${m.job_id?`<button type="button" class="btn" data-chat-job="${esc(m.job_id)}">↗ Job</button>`:''}</article>`).join('')||`<p>${text[10]}</p>`}</div>${state.messages.length?`<button type="button" class="btn" data-chat-action="read" ${disabled}>${text[7]}</button>`:''}<form data-chat-form="send"><label>${text[0]}<textarea name="body" required maxlength="4000" data-chat-draft="1">${esc(draft.body||'')}</textarea></label><label>Job<select name="job_id" data-chat-draft="1">${options(draft.job_id||thread?.job_id||'',text[3])}</select></label><button class="btn primary" type="submit" ${disabled}>${text[5]}</button></form>`:`<p>${text[9]}</p>`}</section></div>`;
  }
  return {configure,reset,load,open,history,remember,submit,click,view,notifications,getState:()=>state};
 }
 if(typeof module==='object'&&module.exports)module.exports={create};else root.AKPChat=create();
})(globalThis);
