'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.resolve(__dirname,'../public/app.js'),'utf8');
const userA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',userB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const jobA='cccccccc-cccc-4ccc-8ccc-cccccccccccc',jobB='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const moduleStart=app.indexOf('const REPORT_DRAFT_PREFIX=');
const moduleEnd=app.indexOf('\nfunction stageLabel(',moduleStart);
assert.ok(moduleStart!==-1 && moduleEnd>moduleStart,'report draft helpers must exist');
const moduleCode=app.slice(moduleStart,moduleEnd);
function store(){
 const m=new Map();
 return {m,
  get length(){return m.size;},
  key(i){return [...m.keys()][i]??null;},
  getItem(k){return m.has(k)?m.get(k):null;},
  setItem(k,v){m.set(String(k),String(v));},
  removeItem(k){m.delete(String(k));}
 };
}
function harness(storage=store(),user=userA,role='worker'){
 const STATE={me:{id:user,role},notes:{},issues:{}};
 const c=vm.createContext({STATE,sessionStorage:storage,Date,console});
 vm.runInContext(moduleCode,c);
 return {storage,STATE,c,key(id){return vm.runInContext('reportDraftKey('+JSON.stringify(id)+')',c);},
  save(id){return vm.runInContext('saveReportDraft('+JSON.stringify(id)+')',c);},
  restore(){return vm.runInContext('restoreReportDrafts()',c);},
  clear(id){return vm.runInContext('clearReportDraft('+JSON.stringify(id)+')',c);},
  logoutClear(){return vm.runInContext('clearUserReportDrafts()',c);}};
}
test('draft storage: saves worker report text scoped to job and user',()=>{
 const h=harness();h.STATE.notes[jobA]='Prace zakończone';h.STATE.issues[jobA]='Brak listwy';h.save(jobA);
 const raw=JSON.parse(h.storage.getItem(h.key(jobA)));
 assert.equal(raw.note,'Prace zakończone');assert.equal(raw.issue,'Brak listwy');assert.ok(raw.savedAt>0);
 assert.ok(h.key(jobA).includes(userA));assert.ok(h.key(jobA).includes(jobA));
});
test('draft storage: restores after full reload in same tab for same user',()=>{
 const local=store();const before=harness(local);before.STATE.notes[jobA]='Draft';before.save(jobA);
 const after=harness(local);after.restore();assert.equal(after.STATE.notes[jobA],'Draft');
});
test('draft storage: different user and coordinator cannot read it',()=>{
 const local=store(),a=harness(local);a.STATE.notes[jobA]='Sensitive note';a.save(jobA);
 const b=harness(local,userB);b.restore();assert.equal(b.STATE.notes[jobA],undefined);
 const manager=harness(local,userA,'coordinator');manager.restore();assert.equal(manager.STATE.notes[jobA],undefined);
 assert.equal(manager.key(jobA),null);
});
test('draft storage: wrong and empty IDs never create storage keys',()=>{
 const h=harness();assert.equal(h.key('123'),null);
 h.STATE.notes['123']='N';h.save('123');assert.equal(h.storage.length,0);
 const unknown=harness(h.storage,'demo-user');unknown.STATE.notes[jobA]='x';unknown.save(jobA);assert.equal(h.storage.length,0);
});
test('draft storage: trims to max textarea lengths',()=>{
 const h=harness();h.STATE.notes[jobA]='n'.repeat(3000);h.STATE.issues[jobA]='i'.repeat(2000);h.save(jobA);
 const copy=harness(h.storage);copy.restore();assert.equal(copy.STATE.notes[jobA].length,2000);assert.equal(copy.STATE.issues[jobA].length,1200);
});
test('draft storage: clears one job and preserves another',()=>{
 const h=harness();h.STATE.notes[jobA]='A';h.STATE.notes[jobB]='B';h.save(jobA);h.save(jobB);
 h.clear(jobA);assert.equal(h.storage.getItem(h.key(jobA)),null);assert.ok(h.storage.getItem(h.key(jobB)));
});
test('draft storage: blank text removes persisted draft',()=>{
 const h=harness();h.STATE.notes[jobA]='A';h.save(jobA);h.STATE.notes[jobA]='';h.save(jobA);assert.equal(h.storage.length,0);
});
test('draft storage: expired and future timestamp drafts are purged',()=>{
 const h=harness(),key=h.key(jobA);h.storage.setItem(key,JSON.stringify({note:'stale',savedAt:Date.now()-26*3600000}));
 h.restore();assert.equal(h.STATE.notes[jobA],undefined);assert.equal(h.storage.length,0);
 h.storage.setItem(key,JSON.stringify({note:'future',savedAt:Date.now()+120000}));h.restore();assert.equal(h.storage.length,0);
});
test('draft storage: invalid JSON is purged on restore',()=>{
 const h=harness();h.storage.setItem(h.key(jobA),'{');h.restore();assert.equal(h.storage.length,0);
});
test('draft storage: browser storage refusal does not throw or falsely clear live notes',()=>{
 const blocked={get length(){throw Error('disabled')},key(){throw Error('disabled')},setItem(){throw Error('disabled')},removeItem(){throw Error('disabled')},getItem(){throw Error('disabled')}};
 const h=harness(blocked);h.STATE.notes[jobA]='Not yet saved';assert.doesNotThrow(()=>h.save(jobA));assert.equal(h.STATE.notes[jobA],'Not yet saved');
 assert.doesNotThrow(()=>h.restore());assert.doesNotThrow(()=>h.clear(jobA));
});
test('draft storage: logout erases own drafts but not another account from same tab',()=>{
 const local=store(),a=harness(local),b=harness(local,userB);
 a.STATE.notes[jobA]='A';a.save(jobA);b.STATE.notes[jobB]='B';b.save(jobB);
 a.logoutClear();assert.equal(local.getItem(a.key(jobA)),null);assert.ok(local.getItem(b.key(jobB)));
 assert.deepEqual(JSON.parse(JSON.stringify(a.STATE.notes)),{});
});
test('draft integration: input saves both textareas and successful submit clears only then',()=>{
 assert.match(app,/if\(t\.dataset\.note\)\{STATE\.notes\[t\.dataset\.note\]=t\.value;saveReportDraft\(t\.dataset\.note\);\}/);
 assert.match(app,/if\(t\.dataset\.issue\)\{STATE\.issues\[t\.dataset\.issue\]=t\.value;saveReportDraft\(t\.dataset\.issue\);\}/);
 assert.match(app,/await api\('\/jobs\/'\+id\+'\/reports',[\s\S]{0,200}STATE\.notes\[id\]='';STATE\.issues\[id\]='';clearReportDraft\(id\);/);
 assert.match(app,/async function logout\(\)[\s\S]{0,150}finally\{clearUserReportDrafts\(\);showLogin\(\);\}/);
});
test('draft integration: notice exists in all four languages and theme is localized',()=>{
 assert.equal((app.match(/reportDraftLocal:/g)||[]).length,4);
 assert.equal((app.match(/toggleTheme:/g)||[]).length,4);
 assert.match(app,/button\.setAttribute\('aria-label',t\('toggleTheme'\)\)/);
 assert.match(app,/setTheme\(document\.documentElement\.dataset\.theme\)/);
});
