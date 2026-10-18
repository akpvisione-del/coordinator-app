'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareReview}=require('../integrations/v19/preview-exchange.cjs');
const base={format:'AKP-Exchange',schemaVersion:1,operations:[]};
test('V19 adapter: empty valid exchange has no writes',()=>{const r=prepareReview(base);assert.equal(r.writes,0);assert.equal(r.mode,'dry-run');assert.equal(r.requiresApproval,true)});
test('V19 adapter: reject unexpected schema and operation type',()=>{assert.throws(()=>prepareReview({...base,schemaVersion:2}));assert.equal(prepareReview({...base,operations:[{type:'finance',id:'x',action:'upsert',record:{}}]}).blocked.length,1)});
test('V19 adapter: order maps to manual review only; no implicit customer match',()=>{
 const r=prepareReview({...base,operations:[{type:'orders',id:'demo-one',action:'upsert',record:{uid:'demo-one',focus14:{title:'Kuchnia demo'}}}]});
 assert.equal(r.review[0].targetTable,'akp_jobs');assert.equal(r.review[0].draft,null);assert.equal(r.writes,0);
});
test('V19 adapter: destructive archive never auto-applied',()=>{const r=prepareReview({...base,operations:[{type:'orders',id:'demo-one',action:'archive'}]});assert.equal(r.blocked[0].reason,'DESTRUCTIVE_ARCHIVE_REQUIRES_SEPARATE_APPROVAL')});
test('V19 adapter: duplicate identifiers fail closed',()=>{const r=prepareReview({...base,operations:[{type:'events',id:'e1',action:'upsert',record:{title:'Pomiar',date:'2026-10-20'}},{type:'events',id:'e1',action:'upsert',record:{title:'Pomiar',date:'2026-10-20'}}]});assert.equal(r.review.length,1);assert.equal(r.blocked.length,1)});
test('V19 adapter: worker never becomes Supabase Auth user',()=>{const r=prepareReview({...base,operations:[{type:'workers',id:'w1',action:'upsert',record:{id:'w1',name:'Test User'}}]});assert.equal(r.review[0].targetTable,null);assert.equal(r.writes,0)});
test('V19 adapter: event requires valid date and preserves only candidate fields',()=>{const r=prepareReview({...base,operations:[{type:'events',id:'e1',action:'upsert',record:{title:'Pomiar',date:'2026-10-20',workerId:'private-worker'}}]});assert.equal(r.review[0].draft.date,'2026-10-20');assert.equal(r.review[0].draft.workerLinkUnverified,true);assert.equal('workerId' in r.review[0].draft,false)});
test('V19 adapter: invalid event becomes blocker',()=>{const r=prepareReview({...base,operations:[{type:'events',id:'e1',action:'upsert',record:{title:'Test',date:'bad'}}]});assert.equal(r.blocked[0].reason,'INVALID_EVENT_DATE_OR_TITLE')});
test('Unified v02: app loads the new post-auth stylesheet after previous CSS',()=>{
 const fs=require('node:fs'),html=fs.readFileSync('public/index.html','utf8');
 assert.ok(html.includes('/akp-unified.css'));assert.ok(html.indexOf('/akp-unified.css')>html.indexOf('/auth-premium.css'));
});
test('Unified v02: DS covers mobile navigation, dashboard, cards, detail, forms, team and reports',()=>{
 const fs=require('node:fs'),s=fs.readFileSync('public/akp-unified.css','utf8');
 for(const key of ['--u-canvas','.mobile-nav','.f04a-kpi','.jobs-grid','.job-detail','.job-edit-form','.action-line','.report-actions','.sidebar','.topbar'])assert.ok(s.includes(key),key);
 assert.ok(s.includes('prefers-reduced-motion'));assert.ok(s.includes('focus-visible'));
});
test('Unified v02: demo does not use Auth, live API or Storage',()=>{
 const fs=require('node:fs'),s=fs.readFileSync('public/unified-design-system.html','utf8');
 assert.ok(s.includes('DANE WYŁĄCZNIE DEMO'));assert.ok(s.includes('data-theme'));
 assert.ok(!s.includes('fetch(')&&!s.includes('/api/')&&!s.includes('SUPABASE_URL')&&!s.includes('localStorage.'));
});

test('Unified v02.1: isolated preview does not import operational CSS or real app script',()=>{
 const fs=require('node:fs'),s=fs.readFileSync('public/unified-design-system.html','utf8');
 for(const forbidden of ['/styles.css','/akp-unified.css','/app.js','/field-assistant.js','/api/','fetch(','localStorage.','SUPABASE_URL'])assert.ok(!s.includes(forbidden),'Found forbidden dependency '+forbidden);
 for(const screen of ['home','jobs','detail','field','more'])assert.ok(s.includes('data-screen="'+screen+'"'),'Missing real demo screen '+screen);
 assert.ok(s.includes('PROTOTYP WIZUALNY'));assert.ok(s.includes('DANE FIKCYJNE'));
});
test('Unified v02.2: self-hosted stylesheet/script respect the strict Netlify CSP',()=>{
 const fs=require('node:fs');
 const html=fs.readFileSync('public/unified-design-system.html','utf8');
 const css=fs.readFileSync('public/unified-preview.css','utf8');
 const js=fs.readFileSync('public/unified-preview.js','utf8');
 const netlify=fs.readFileSync('netlify.toml','utf8');
 assert.ok(netlify.includes("style-src 'self'"),'Style CSP must remain secure');
 assert.ok(netlify.includes("script-src 'self'"),'Script CSP must remain secure');
 assert.match(html,/<link rel="stylesheet" href="\/unified-preview\.css\?v=\d+-\d+">/);
 assert.match(html,/<script src="\/unified-preview\.js\?v=\d+-\d+" defer><\/script>/);
 assert.doesNotMatch(html,/<style\b|\sstyle\s*=|<script(?!\s+src)|\son\w+\s*=/i);
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
 assert.ok(css.includes('@media(max-width:760px)'));
 assert.ok(css.includes('[hidden]{display:none!important}'));
 assert.ok(css.includes('color-scheme:dark'));
 assert.ok(html.includes('data-view="jobs"'));
 assert.ok(js.includes("addEventListener('input',updateJobs)"));
 assert.ok(css.includes('button:focus-visible'));
 for(const banned of ['fetch(', 'localStorage.', '/api/', 'SUPABASE_URL'])assert.ok(!html.includes(banned)&&!js.includes(banned),'Unsafe preview dependency '+banned);
});

test('Unified v02.2: actual Commander forms do not emit CSP-blocked inline styles',()=>{
 const fs=require('node:fs');
 const app=fs.readFileSync('public/app.js','utf8');
 const css=fs.readFileSync('public/akp-unified.css','utf8');
 assert.doesNotMatch(app,/\sstyle\s*=/i,'Inline CSS is blocked on Netlify');
 for(const cls of ['akp-u-mt10','akp-u-mt16','akp-u-mb12','akp-u-mt20','akp-u-report-submit','akp-u-photo-time','akp-u-upload-btn','akp-u-finance-submit','akp-u-ml8']){
  assert.ok(app.includes(cls),'Missing semantic class in app: '+cls);
  assert.ok(css.includes('.'+cls),'Missing CSS implementation: '+cls);
 }
});

test('Unified v03: cross-role logout clears all cached data and rejects stale refresh writes',()=>{
 const fs=require('node:fs'),s=fs.readFileSync('public/app.js','utf8');
 assert.ok(s.includes('function resetSessionData()'));
 for(const marker of ['STATE.jobs=[]','STATE.reports=[]','STATE.team=[]','STATE.audit=[]','STATE.sources=null','STATE.financeDrafts={}','STATE.detail=null','Object.keys(LOCAL_PHOTO_PREVIEWS)'])assert.ok(s.includes(marker),marker);
 assert.ok(s.includes('function showLogin(){resetSessionData()'));
 assert.ok(s.includes('function showApp(me){resetSessionData()'));
 assert.ok(s.includes('if(epoch!==STATE.sessionEpoch||!STATE.me)return'));
 assert.ok(s.includes('if(epoch===STATE.sessionEpoch&&STATE.me)'));
});

test('Unified v04: stale session HTTP response cannot log out a newly signed-in role',()=>{
 const fs=require('node:fs'),code=fs.readFileSync('public/app.js','utf8');
 assert.ok(code.includes('function staleSessionError()'));
 assert.ok(code.includes("code:'STALE_SESSION'"));
 assert.ok(code.includes('if(epoch!==STATE.sessionEpoch)throw staleSessionError();'));
 assert.ok(code.includes('if(response.status===401&&STATE.me)showLogin()'));
 assert.ok(code.indexOf('if(epoch!==STATE.sessionEpoch)throw staleSessionError();',code.indexOf('let data={}')) < code.indexOf('if(response.status===401&&STATE.me)showLogin()'));
 assert.ok(code.includes("if(e.code!=='STALE_SESSION'&&epoch===STATE.sessionEpoch&&STATE.openJob===id)"));
 assert.ok(code.includes('if(activeEpoch===STATE.sessionEpoch&&STATE.me)toast('));
});
