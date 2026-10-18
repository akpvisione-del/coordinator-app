'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../contracts/field-intent.v02.schema.json'),'utf8'));
const legacy=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../contracts/field-intent.v01.schema.json'),'utf8'));
test('contract v02 is a new version rather than a destructive change to v01',()=>{assert.equal(c.properties.schema_version.const,'2.0');assert.equal(legacy.properties.schema_version.const,'1.0')});
test('contract always requires a human confirmation and forbids write permission',()=>{assert.equal(c.properties.confirmation_required.const,true);assert.equal(c.properties.write_allowed.const,false)});
test('contract accepts only known proposed intents, never execute or delete',()=>{assert.equal(c.additionalProperties,false);assert.ok(c.properties.intent.enum.every(x=>x.startsWith('PROPOSE_')||x==='UNKNOWN'));assert.equal(c.properties.intent.enum.length,8)});
test('contract input contains bounded plain-text request and an optional UUID scope',()=>{assert.equal(c.properties.request.maxLength,140);assert.equal(c.properties.job_id.format,'uuid');assert.equal(c.properties.status.const,'draft')});
test('schema cannot imply an approved action',()=>{assert.ok(c.required.includes('source'));assert.ok(c.required.includes('confirmation_required'));assert.equal(c.properties.source.enum.includes('ai_proposal'),true);assert.ok(!c.properties.intent.enum.includes('SEND_EMAIL'))});
