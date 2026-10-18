'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../docs/sql_proposals');
const forward=fs.readFileSync(path.join(dir,'worker_deactivation_rls_20261017_v01.NOT_APPLIED.sql'),'utf8');
const rollback=fs.readFileSync(path.join(dir,'worker_deactivation_rls_20261017_v01_ROLLBACK.NOT_APPLIED.sql'),'utf8');
const names=['akp_assignment_ro','akp_jobs_ro','akp_reports_ro','akp_reports_create','akp_checks_ro','akp_checks_create','akp_checks_edit'];
test('draft changes exactly seven existing SELECT/INSERT/UPDATE worker policies; no data or privileges',()=>{
 assert.match(forward,/DO NOT RUN without explicit owner authorization/);
 const lines=forward.split('\n').filter(x=>x.startsWith('ALTER POLICY '));
 assert.equal(lines.length,names.length);
 for(const name of names){
   const line=lines.find(x=>x.startsWith('ALTER POLICY '+name+' '));
   assert.ok(line,'missing '+name);
   assert.ok(line.includes("p.is_active=true"),'missing fresh profile activation check '+name);
   assert.ok(line.includes("p.role='worker'"),'missing worker restriction '+name);
 }
 assert.doesNotMatch(forward,/\b(GRANT|REVOKE|DROP TABLE|DELETE FROM|UPDATE public\.akp_profiles|INSERT INTO)\b/i);
 assert.match(forward,/BEGIN;/);
 assert.match(forward,/COMMIT;/);
});
test('rollback explicitly restores only original seven policies, warns about old JWT exposure',()=>{
 const lines=rollback.split('\n').filter(x=>x.startsWith('ALTER POLICY '));
 assert.equal(lines.length,names.length);
 for(const name of names)assert.ok(lines.some(x=>x.startsWith('ALTER POLICY '+name+' ')));
 assert.match(rollback,/unexpired JWT/i);
 assert.doesNotMatch(rollback,/\b(GRANT|REVOKE|DROP TABLE|DELETE FROM)\b/i);
});
