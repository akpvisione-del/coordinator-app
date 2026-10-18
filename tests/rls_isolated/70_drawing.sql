\set ON_ERROR_STOP on
\i docs/sql_proposals/supersprint03_drawing_v01.REVIEW_ONLY.sql
\set job '44444444-4444-4444-8444-444444444444'
\set photo '90000000-0000-4000-8000-000000000031'
\set client '90000000-0000-4000-8000-000000000040'
\set document '{"schema":1,"width":640,"height":480,"source_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","shapes":[{"id":"90000000-0000-4000-8000-000000000041","type":"dimension","x1":1000,"y1":2000,"x2":8000,"y2":6000,"text":"1250 mm","color":"blue"}]}'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT public.akp_pro_drawing_save(:'job',:'photo',0,:'client',:'document');
SELECT public.akp_pro_drawing_save(:'job',:'photo',0,:'client',:'document');
SELECT test.expect_count('drawing retry one version',1,'select count(*) from public.akp_pro_drawing_versions');
SELECT test.expect_error('drawing immutable direct UPDATE denied','42501','update public.akp_pro_drawing_versions set document=''{}''');
SELECT test.expect_error('drawing stale save CAS','40001',format('select public.akp_pro_drawing_save(%L,%L,0,%L,%L)',:'job',:'photo','90000000-0000-4000-8000-000000000042',:'document'));
SELECT test.expect_error('drawing forged vectors rejected by SQL','22023',format('select public.akp_pro_drawing_save(%L,%L,1,%L,%L)',:'job',:'photo','90000000-0000-4000-8000-000000000042',replace(:'document','"x1":1000','"x1":-1')));
SELECT test.expect_error('drawing mismatched original hash rejected','22023',format('select public.akp_pro_drawing_save(%L,%L,1,%L,%L)',:'job',:'photo','90000000-0000-4000-8000-000000000042',replace(:'document',repeat('a',64),repeat('b',64))));
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('other worker cannot read drawing versions',0,'select count(*) from public.akp_pro_drawing_versions');
SELECT test.expect_error('other worker drawing RPC denied','42501',format('select public.akp_pro_drawing_read(%L,%L)',:'job',:'photo'));
SELECT test.expect_error('photo from foreign job cannot be relinked','P0002',format('select public.akp_pro_drawing_save(%L,%L,1,%L,%L)','55555555-5555-4555-8555-555555555555',:'photo','90000000-0000-4000-8000-000000000042',:'document'));
ROLLBACK;
INSERT INTO public.akp_assignments(job_id,worker_id,active) VALUES('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333',true);
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"akp_role":"worker"}}',true);
SELECT public.akp_pro_drawing_save(:'job',:'photo',1,'90000000-0000-4000-8000-000000000042',:'document');
SELECT test.expect_count('shared crew can append without overwriting previous drawing',2,'select count(*) from public.akp_pro_drawing_versions');
COMMIT;
UPDATE public.akp_assignments SET active=false WHERE job_id=:'job' AND worker_id='33333333-3333-4333-8333-333333333333';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_error('unassigned author cannot read drawing anymore','42501',format('select public.akp_pro_drawing_read(%L,%L)',:'job',:'photo'));
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('remaining assigned worker keeps complete drawing history',2,format('select jsonb_array_length(public.akp_pro_drawing_read(%L,%L)->''history'')',:'job',:'photo'));
ROLLBACK;
UPDATE public.akp_profiles SET is_active=false WHERE user_id='22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_error('inactive old JWT drawing save denied','42501',format('select public.akp_pro_drawing_save(%L,%L,2,%L,%L)',:'job',:'photo','90000000-0000-4000-8000-000000000043',:'document'));
ROLLBACK;
UPDATE public.akp_profiles SET is_active=true WHERE user_id='22222222-2222-4222-8222-222222222222';
\echo DRAWING RLS PASS
