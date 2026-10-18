'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {parseFieldIntent:parse,fieldLanguages}=require('../public/field-assistant.js');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
const js=fs.readFileSync(path.join(__dirname,'../public/field-assistant.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../public/field-assistant.css'),'utf8');
const cases=[
 ['pulpit','dashboard'],['show jobs','jobs'],['moje zlecenia',null],['zlecenia','jobs'],['konto','account'],['zespół','team'],
 ['pokaż archiwum','archive'],['nowe zlecenia','new'],['obecne','current'],['dziś','today'],['jutro','tomorrow'],
 ['po terminie','overdue'],['bez terminu','noDate'],['resetuj filtry','reset'],['ciemny motyw','dark'],['jasny motyw','light'],
 ['tryb terenowy','fieldMode'],['kompaktowy','compactMode'],['pomiary','measurements'],['kuchnie','kitchens'],['remonty','renovations'],
 ['найди LM 333','search'],['завтра','tomorrow'],['сегодня','today'],['dark mode','dark'],['znajdź LM 123','search'],
 ['pomoc','help'],['podsumowanie','summary']
];
for(const [phrase,expected] of cases)test('command parse: '+phrase,()=>assert.equal(parse(phrase)?.kind||null,expected));
test('search preserves normalized query and length bounds',()=>{assert.equal(parse('Szukaj LM-2026/081')?.query,'lm-2026/081');assert.equal(parse('find x'),null);assert.equal(parse('x'.repeat(141)),null);});
test('never guesses free-form destructive commands',()=>{for(const x of ['usuń wszystkie zlecenia','wyślij fakturę','przelej 5000','rozlicz monterów','zmień marżę','usuń zdjęcie'])assert.equal(parse(x),null);});
test('four language dictionaries have all safety and privacy labels',()=>{for(const l of ['pl','uk','ru','en'])for(const k of ['voiceRisk','unavailable','noCategories','done','blocked','unknown','listen','speechError','help','info'])assert.ok(fieldLanguages[l][k],l+'/'+k);});
test('voice cannot execute without preview and user confirmation',()=>{assert.match(js,/rec\.onresult=e=>/);assert.match(js,/previewIntent\(\);/);assert.match(js,/getElementById\('akpFieldExecute'\)\.addEventListener\('click',execute\)/);assert.doesNotMatch(js,/rec\.onresult[\s\S]{0,260}execute\(/);});
test('commands are read-only and do not call backend API',()=>{assert.doesNotMatch(js,/\bapi\s*\(|\bfetch\s*\(|\/api\//);assert.match(js,/No server data was changed/);});
test('protect coordinator financial and unsaved edit state',()=>{assert.match(js,/checkUnsavedEdit\(\)/);assert.match(js,/STATE\.financeDrafts\?\.\[STATE\.openJob\]\?\.dirty/);assert.match(js,/!coordinator/);});
test('browser speech recognition is opt-in with disclosure and explicit abort',()=>{assert.match(js,/SpeechRecognition\|\|window\.webkitSpeechRecognition/);assert.match(js,/speechCtor\(\)\?t\('mic'\):t\('unavailable'\)/);assert.match(js,/old\.abort\(\)/);assert.match(js,/voiceRisk/);});
test('all user text appears as textContent or protected normalized local search',()=>{assert.match(js,/out\.textContent=preview/);assert.match(js,/STATE\.search=i\.query/);assert.match(js,/const MAX=140/);});
test('keyboard shortcuts, focus trap and reduced-motion CSS',()=>{assert.match(js,/e\.key==='Escape'/);assert.match(js,/e\.key==='Tab'/);assert.match(js,/e\.ctrlKey\|\|e\.metaKey/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);});
test('touch sizes >=48px and mobile safe area',()=>{assert.match(css,/min-height:48px;min-width:48px/);assert.match(css,/env\(safe-area-inset-top/);});
test('explicit no AI inference and no transcript persistence',()=>{assert.match(js,/not connected to an AI agent/);assert.doesNotMatch(js,/localStorage\.setItem\([^,]*(?:transcript|speech|audio)/);});
test('launcher loaded after existing app to reuse role checks',()=>{assert.match(html,/<script src="\/app\.js" defer><\/script>\s*<script src="\/field-assistant\.js" defer><\/script>/);assert.match(html,/field-assistant\.css/);});
test('density switch affects styles, not hidden content',()=>{assert.match(css,/:root\[data-akp-density="field"\]/);assert.match(css,/:root\[data-akp-density="compact"\]/);assert.doesNotMatch(css,/:root\[data-akp-density[^}]*display:none/);});
test('category search only uses metadata, never infers from titles',()=>{assert.match(js,/typeof jobCategory==='function'&&jobCategory\(j\)/);assert.match(js,/t\('noCategories'\)/);});
test('no cloud or production database integration, profile unaffected',()=>{assert.doesNotMatch(js,/supabase|google\.com\/maps|cookie\s*=|indexedDB/);assert.match(js,/STATE\.me\.role==='coordinator'/);});
