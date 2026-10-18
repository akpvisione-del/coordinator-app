(function(){
'use strict';
const title={home:'Centrum koordynatora',jobs:'Lista zleceń',detail:'Karta zlecenia',field:'Panel montera',more:'System i zespół'};
function openScreen(view){
 if(!Object.hasOwn(title,view))return;
 document.querySelectorAll('[data-screen]').forEach(e=>e.classList.toggle('active',e.dataset.screen===view));
 document.querySelectorAll('button[data-view]').forEach(e=>{const active=e.dataset.view===view;e.classList.toggle('active',active);if(active)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')});
 document.getElementById('currentTitle').textContent=title[view];
 window.scrollTo({top:0,behavior:'instant'});
}
function setTheme(){
 const root=document.documentElement;
 root.dataset.theme=root.dataset.theme==='dark'?'light':'dark';
 document.getElementById('themeButton').textContent=root.dataset.theme==='dark'?'☀':'☾';
}
function updateJobs(){
 const q=document.getElementById('searchJob').value.trim().toLowerCase();
 const f=document.querySelector('.chip.active').dataset.filter;
 let visible=0;
 document.querySelectorAll('#jobGrid .job').forEach(c=>{const match=(!q||c.dataset.name.includes(q))&&(f==='all'||c.dataset.status===f);c.hidden=!match;if(match)visible++});
 document.getElementById('emptyJobs').hidden=visible>0;
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view)openScreen(b.dataset.view);
 if(b.dataset.filter){document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('active',c===b));updateJobs()}
 if(b.dataset.message){const t=document.getElementById('toast');if(t){t.textContent=b.dataset.message;t.hidden=false;clearTimeout(window.__akpToastTimer);window.__akpToastTimer=setTimeout(()=>t.hidden=true,3000)}}
 if(b.id==='themeButton'||b.id==='themeSecondary')setTheme();
});
document.getElementById('searchJob').addEventListener('input',updateJobs);
})();
