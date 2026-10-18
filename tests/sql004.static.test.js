'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '../sql/004_minimal_operational_migration.sql'),'utf8');
const api = fs.readFileSync(path.join(__dirname, '../netlify/functions/api.js'),'utf8');
const mobile = fs.readFileSync(path.join(__dirname, '../public/app.js'),'utf8');

test('SQL004 is a reviewed DEV draft with transaction boundaries',()=>{
  assert.match(sql,/STATUS: DRAFT/i);
  assert.match(sql,/^BEGIN;/m);
  assert.match(sql,/^COMMIT;/m);
  assert.doesNotMatch(sql,/^DO \$\s*$/m);
  assert.doesNotMatch(sql,/^END \$;/m);
  assert.doesNotMatch(sql,/^\$ LANGUAGE/m);
  assert.equal((sql.match(/\$\$/g)||[]).length%2,0,'unbalanced PostgreSQL dollar quotes');
});
test('preflight fails on unexpected RLS policies before any schema modification',()=>{
  assert.ok(sql.indexOf('unknown RLS policy')>0);
  assert.ok(sql.indexOf('unknown storage RLS policy')>0);
  assert.ok(sql.indexOf('unknown RLS policy')<sql.indexOf('ALTER TABLE public.akp_profiles'));
  for(const name of ['akp_jobs_create','akp_jobs_edit','akp_assignment_ro','akp_assignment_edit','akp_reports_edit','akp_finance_ro','akp_checks_ro']){
    assert.ok(sql.includes("'"+name+"'"),'missing observed legacy policy '+name);
  }
});
test('RLS policies require active signed-in coordinator or assigned worker',()=>{
  for(const fn of ['akp_coordinator_active','akp_worker_active','akp_worker_assigned']){
    assert.match(sql,new RegExp('CREATE OR REPLACE FUNCTION public\\.'+fn+'\\('));
    assert.match(sql,new RegExp('GRANT EXECUTE ON FUNCTION public\\.'+fn+'\\('));
  }
  assert.match(sql,/public\.akp_coordinator_active\(\)/);
  assert.match(sql,/public\.akp_worker_assigned\(job_id\)/);
  assert.match(sql,/is_active IS TRUE/);
  assert.match(sql,/a\.active IS TRUE/);
});
test('RLS uses SECURITY DEFINER only for user-scoped helpers with empty search_path',()=>{
  assert.match(sql,/FUNCTION public\.akp_worker_active\(\)[\s\S]*?SECURITY DEFINER SET search_path = ''/);
  assert.match(sql,/FUNCTION public\.akp_coordinator_active\(\)[\s\S]*?SECURITY DEFINER SET search_path = ''/);
  assert.match(sql,/FUNCTION public\.akp_worker_assigned\(p_job_id uuid\)[\s\S]*?SECURITY DEFINER SET search_path = ''/);
  const segment=sql.slice(sql.indexOf('CREATE POLICY akp004_profiles_self'),sql.indexOf('CREATE POLICY akp004_profiles_update_self'));
  assert.doesNotMatch(segment,/FROM\s+public\.akp_profiles/i);
});
test('preserve soft assignment history and exactly verify old PK shape',()=>{
  assert.match(sql,/PRIMARY KEY \(job_id, worker_id\)/);
  assert.match(sql,/= 'job_id' THEN/);
  assert.match(sql,/unknown assignment PK/);
  assert.doesNotMatch(api,/akp_assignments[^\n]{0,170}method:'DELETE'/);
  assert.match(api,/akp_assignments[^\n]{0,170}method:'PATCH',data:\{active:false\}/);
});
test('v10 statuses and legacy statuses are accepted in target schema',()=>{
  const arr=api.match(/const ALLOWED_STATUS=\[([^\]]+)\]/);
  assert.ok(arr,'API status list not found');
  const statuses=[...arr[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  const start=sql.indexOf('ALTER TABLE public.akp_jobs ADD CONSTRAINT akp_jobs_status_check');
  assert.ok(start>=0,'new status constraint not created');
  const block=sql.slice(start,start+950);
  for(const value of [...statuses,'POMIARY','PLANOWANE','REALIZACJA'])assert.ok(block.includes("'"+value+"'"),'missing status: '+value);
});
test('photo evidence and storage RLS use private bucket and flat worker ownership',()=>{
  assert.match(sql,/CONSTRAINT akp_photos_storage_path_unique UNIQUE\(storage_path\)/);
  assert.match(sql,/CREATE TRIGGER akp_photos_audit/);
  assert.match(sql,/ON DELETE RESTRICT/);
  assert.match(sql,/cardinality\(storage\.foldername\(name\)\) = 1/);
  assert.match(sql,/file_size_limit = 10485760/);
  assert.match(sql,/bucket_id='job-photos'/);
  assert.match(sql,/owner_id=\(SELECT auth\.uid\(\)::text\)/);
  assert.doesNotMatch(sql,/\bowner=\(SELECT auth\.uid\(\)\)/);
});
test('deny destructive DML in JWT roles and preserve PostgreSQL audit trail',()=>{
  assert.match(sql,/REVOKE ALL PRIVILEGES ON/);
  assert.match(sql,/GRANT SELECT,INSERT,UPDATE ON public\.akp_assignments/);
  assert.doesNotMatch(sql,/GRANT[^\n]*\bDELETE\b[^\n]*authenticated/);
  assert.match(sql,/akp_internal\.log_change\(\)/);
  assert.doesNotMatch(api,/await recordAudit\(/);
  assert.doesNotMatch(sql,/PERFORM public\.check_report_worker_submission\(\)/);
});

test('worker helper checks signed role against stored profile role',()=>{
  const start=sql.indexOf('CREATE OR REPLACE FUNCTION public.akp_worker_active()');
  const end=sql.indexOf('CREATE OR REPLACE FUNCTION public.akp_worker_assigned',start);
  assert.ok(start>=0 && end>start);
  assert.match(sql.slice(start,end),/p\.role='worker'/);
  assert.match(sql.slice(start,end),/p\.is_active IS TRUE/);
});
test('worker photo metadata cannot reference another owner or nested path',()=>{
  const start=sql.indexOf('CREATE POLICY akp004_photos_worker_insert');
  const end=sql.indexOf('-- Bucket prywatny;',start);
  assert.ok(start>=0 && end>start);
  const policy=sql.slice(start,end);
  assert.match(policy,/uploaded_by=\(SELECT auth\.uid\(\)\)/);
  assert.match(policy,/split_part\(storage_path,'\/',2\)/);
  assert.match(policy,/cardinality\(string_to_array\(storage_path,'\/'\)\) = 2/);
});

test('deactivated coordinator cannot read audit history or imported sources over REST',()=>{
  const first=sql.indexOf('CREATE POLICY akp_audit_coordinator_read ON public.akp_audit');
  const second=sql.indexOf('CREATE POLICY coordinator_sources ON public.akp_job_sources');
  const end=sql.indexOf('ALTER TABLE public.akp_profiles ENABLE ROW LEVEL SECURITY',second);
  assert.ok(first>0 && second>first && end>second,'expected history/source policy block');
  const audit=sql.slice(first,second);
  const sources=sql.slice(second,end);
  assert.match(audit,/FOR SELECT TO authenticated USING \(public\.akp_coordinator_active\(\)\)/);
  assert.match(sources,/FOR ALL TO authenticated USING \(public\.akp_coordinator_active\(\)\)/);
  assert.match(sources,/WITH CHECK \(public\.akp_coordinator_active\(\)\)/);
  assert.match(sql,/unknown history\/source RLS policy/);
  assert.match(sql,/expected history\/source policy is absent or changed/);
  assert.match(sql,/DROP POLICY IF EXISTS akp_audit_coordinator_read/);
  assert.match(sql,/DROP POLICY IF EXISTS coordinator_sources/);
});

test('mobile photo path uses full UUID and never calls local preview a Storage upload',()=>{
  assert.match(mobile,/const userPrefix = STATE\.me\?\.id \|\| ''/);
  assert.doesNotMatch(mobile,/const userPrefix =[^\n]*slice\(0,\s*8\)/);
  assert.match(mobile,/(?:Storage nie jest podłączony|Plik NIE został przesłany do chmury Storage)/);
  assert.match(mobile,/if \(!\/\^\[0-9a-f\]\{8\}/);
  assert.match(api,/Nazwa zdjęcia musi zaczynać się od pełnego ID zalogowanego montera/);
});

test('new and updated job instructions both obey staging DB maximum 2500 chars',()=>{
  assert.match(api,/instructions:pickText\(b\.instructions,2500\)/);
  assert.match(api,/fields\.instructions=pickText\(b\.instructions,2500\)/);
  assert.doesNotMatch(api,/fields\.instructions=pickText\(b\.instructions,3000\)/);
});
