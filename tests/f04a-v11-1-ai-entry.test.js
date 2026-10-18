'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const js=fs.readFileSync(path.resolve(__dirname,'../public/field-assistant.js'),'utf8');
const css=fs.readFileSync(path.resolve(__dirname,'../public/field-assistant.css'),'utf8');
test('F04A v11.1 assistant opens with AI label, speech stays inside',()=>{
 assert.match(js,/btn\.textContent='✦ AI'/);
 assert.doesNotMatch(js,/btn\.textContent='🎙'/);
 assert.match(js,/akpFieldMic/);
 assert.match(js,/speechCtor\(\)/);
});
test('F04A v11.1 navy AI control remains 48+px and theme aware',()=>{
 assert.match(css,/F04A v11\.1 NAVY hotfix/);
 assert.match(css,/\.akp-field-open\{[^}]*min-height:48px/);
 assert.match(css,/:root\[data-theme="dark"\] \.akp-field-panel/);
});
test('F04A v11.1 proposals are non-executable',()=>{
 assert.match(js,/non-executable/);
 assert.match(js,/function copyProposal\(/);
 assert.match(js,/function proposeFieldPlan\(/);
});
