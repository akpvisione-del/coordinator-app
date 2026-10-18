'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const css=fs.readFileSync('public/styles.css','utf8');

test('Unified UX: compact 2-column job layout applies to typical mobile widths',()=>{
  const block=css.slice(css.indexOf('/* AKP UNIFIED UX v01'));
  assert.ok(block.includes('@media (min-width:350px) and (max-width:660px)'));
  assert.match(block,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(block,/align-items:stretch/);
});
test('Unified UX: narrow screen has safe single-column fallback and tappable action',()=>{
  const block=css.slice(css.indexOf('/* AKP UNIFIED UX v01'));
  assert.ok(block.includes('@media (max-width:349px)'));
  assert.match(block,/min-height:48px/);
  assert.match(block,/overflow-wrap:anywhere/);
});
test('Unified UX: reduced motion and unmodified content visibility',()=>{
  const block=css.slice(css.indexOf('/* AKP UNIFIED UX v01'));
  assert.ok(block.includes('@media (prefers-reduced-motion:reduce)'));
  assert.doesNotMatch(block,/display:\s*none/);
});
