\set ON_ERROR_STOP on
\echo [AKP-RLS] Isolated PostgreSQL 16 test only. ZERO production connections.
\i tests/rls_isolated/00_fixture.sql

-- Install pre-change policies exactly as stored in the rollback reference.
\i docs/sql_proposals/worker_deactivation_rls_20261017_v01_ROLLBACK.NOT_APPLIED.sql
\echo [AKP-RLS] PRE: verify historical exposure from stale worker JWT
UPDATE public.akp_profiles SET is_active=false WHERE user_id='22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('OLD RLS inactive worker sees assigned job',1,'select count(*) from public.akp_jobs');
SELECT test.expect_count('OLD RLS inactive worker sees assignment',1,'select count(*) from public.akp_assignments');
SELECT test.expect_count('OLD RLS inactive worker sees old report',1,'select count(*) from public.akp_reports');
ROLLBACK;
UPDATE public.akp_profiles SET is_active=true WHERE user_id='22222222-2222-4222-8222-222222222222';

\echo [AKP-RLS] APPLY DRAFT IN TEST DATABASE ONLY
\i docs/sql_proposals/worker_deactivation_rls_20261017_v01.NOT_APPLIED.sql

\echo [AKP-RLS] ACTIVE Worker A; direct SQL simulating authenticated REST JWT
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('worker active jobs only assigned',1,'select count(*) from public.akp_jobs');
SELECT test.expect_count('worker active assignments own',1,'select count(*) from public.akp_assignments');
SELECT test.expect_count('worker active own reports',1,'select count(*) from public.akp_reports');
SELECT test.expect_count('worker active own checks',1,'select count(*) from public.akp_checks');
SELECT test.expect_count('worker sees NO company finances',0,'select count(*) from public.akp_job_financials');
UPDATE public.akp_checks SET done=true WHERE worker_id='22222222-2222-4222-8222-222222222222';
SELECT test.expect_count('worker active update checklist',1,'select count(*) from public.akp_checks where done=true');
INSERT INTO public.akp_checks(job_id,worker_id,step_index,done) VALUES
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',1,true);
INSERT INTO public.akp_reports(id,job_id,worker_id,status,note) VALUES
 ('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','SUBMITTED','Synthetic active report');
ROLLBACK;

\echo [AKP-RLS] Worker B sees only their own job and no finances
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('worker B single assigned job',1,'select count(*) from public.akp_jobs');
SELECT test.expect_count('worker B cannot see job A',0,'select count(*) from public.akp_jobs where id=''44444444-4444-4444-8444-444444444444''');
SELECT test.expect_count('worker B own report only',1,'select count(*) from public.akp_reports');
SELECT test.expect_count('worker B finances denied',0,'select count(*) from public.akp_job_financials');
ROLLBACK;

\echo [AKP-RLS] Deactivate worker A, REUSE THE EXACT SAME JWT — must become inaccessible
UPDATE public.akp_profiles SET is_active=false WHERE user_id='22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('inactive worker sees zero jobs',0,'select count(*) from public.akp_jobs');
SELECT test.expect_count('inactive worker sees zero assignments',0,'select count(*) from public.akp_assignments');
SELECT test.expect_count('inactive worker sees zero reports',0,'select count(*) from public.akp_reports');
SELECT test.expect_count('inactive worker sees zero checks',0,'select count(*) from public.akp_checks');
SELECT test.expect_count('inactive worker sees zero finances',0,'select count(*) from public.akp_job_financials');
SELECT test.expect_count('inactive worker may read own status ONLY',1,'select count(*) from public.akp_profiles');
DO $$
BEGIN
 BEGIN
  INSERT INTO public.akp_reports(id,job_id,worker_id,status,note) VALUES
  ('88888888-8888-4888-8888-888888888888','44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','SUBMITTED','Denied');
  RAISE EXCEPTION 'FAIL: inactive worker submitted report';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'RLS PASS: inactive worker INSERT report denied (42501)';
 END;
 BEGIN
  INSERT INTO public.akp_checks(job_id,worker_id,step_index,done) VALUES
  ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',5,true);
  RAISE EXCEPTION 'FAIL: inactive worker inserted checklist';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'RLS PASS: inactive worker INSERT checklist denied (42501)';
 END;
END $$;
UPDATE public.akp_checks SET done=true WHERE worker_id='22222222-2222-4222-8222-222222222222';
SELECT test.expect_count('inactive worker cannot UPDATE invisible checks',0,'select count(*) from public.akp_checks where worker_id=''22222222-2222-4222-8222-222222222222'' and done=true');
ROLLBACK;

\echo [AKP-RLS] Coordinator retains access to all 2 demo jobs and 1 financial record
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_count('coordinator all jobs',2,'select count(*) from public.akp_jobs');
SELECT test.expect_count('coordinator all assignments',2,'select count(*) from public.akp_assignments');
SELECT test.expect_count('coordinator all reports',2,'select count(*) from public.akp_reports');
SELECT test.expect_count('coordinator all checks',2,'select count(*) from public.akp_checks');
SELECT test.expect_count('coordinator finance remains accessible',1,'select count(*) from public.akp_job_financials');
ROLLBACK;

\echo [AKP-RLS] Critical NEGATIVE TEST: production-like TRUNCATE grant bypasses RLS
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
-- This runs against disposable local DEMO rows, then ROLLBACK.
TRUNCATE public.akp_checks;
SELECT test.expect_count('TRUNCATE bypass demonstrated (MUST REVOKE in production)',0,'select count(*) from public.akp_checks');
ROLLBACK;

\echo [AKP-RLS] Revoke unnecessary TRUNCATE on all eight fake AKP tables
\i docs/sql_proposals/authenticated_truncate_revoke_20261017_v01.NOT_APPLIED.sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
DO $akp_truncate_test$
DECLARE has_access boolean;
BEGIN
 SELECT has_table_privilege('authenticated','public.akp_checks','TRUNCATE') INTO has_access;
 IF has_access THEN RAISE EXCEPTION 'FAIL: authenticated TRUNCATE still allowed'; END IF;
 BEGIN
  TRUNCATE public.akp_checks;
  RAISE EXCEPTION 'FAIL: TRUNCATE succeeded after REVOKE';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'RLS PASS: TRUNCATE denied independently of RLS (42501)';
 END;
END $akp_truncate_test$;
ROLLBACK;

\echo [AKP-RLS] ROLLBACK DRAFT — check original behavior restored (SECURITY REGRESSION)
\i docs/sql_proposals/worker_deactivation_rls_20261017_v01_ROLLBACK.NOT_APPLIED.sql
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('rollback restores old inactive-worker job exposure',1,'select count(*) from public.akp_jobs');
ROLLBACK;
\echo [AKP-RLS] ISOLATED PASS: RLS and TRUNCATE revocation; production remains UNCHANGED, deployment approval required.
