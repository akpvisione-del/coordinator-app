\set ON_ERROR_STOP on
\i docs/sql_proposals/supersprint03_materials_v01.REVIEW_ONLY.sql
\set job '44444444-4444-4444-8444-444444444444'
\set item '90000000-0000-4000-8000-000000000020'
\set client '90000000-0000-4000-8000-000000000021'
\set data '{"name":null,"quantity":null,"unit":null,"quote_version":1,"quote_variant":"90000000-0000-4000-8000-000000000011","quote_line":"90000000-0000-4000-8000-000000000012","status":"TO_BUY","supplier":"Dostawca fikcyjny","notes":"Odbiór rano"}'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT public.akp_pro_material_save(:'job',:'item',0,:'client',:'data');
SELECT public.akp_pro_material_save(:'job',:'item',0,:'client',:'data');
SELECT test.expect_count('material idempotency one row',1,'select count(*) from public.akp_pro_materials');
SELECT test.expect_count('linked material does not copy name quantity or price',1,'select count(*) from public.akp_pro_materials where name is null and quantity is null and unit is null');
SELECT test.expect_error('material stale edit conflict','40001',format('select public.akp_pro_material_save(%L,%L,0,%L,%L)',:'job',:'item','90000000-0000-4000-8000-000000000023',:'data'));
SELECT test.expect_error('material cross-job quote denied','22023',format('select public.akp_pro_material_save(%L,%L,0,%L,%L)','55555555-5555-4555-8555-555555555555','90000000-0000-4000-8000-000000000024',:'client',:'data'));
SELECT test.expect_error('material direct SQL update denied','42501','update public.akp_pro_materials set status=''PURCHASED''');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('worker operational projection resolves name',1,format('select count(*) from jsonb_array_elements(public.akp_pro_material_read(%L)->''items'') x where x->>''name''=''Materiał demonstracyjny'' and x->>''quantity''=''2''',:'job'));
SELECT test.expect_count('worker material projection contains no rates company or quote',0,format('select count(*) from jsonb_array_elements(public.akp_pro_material_read(%L)->''items'') x where x ?| array[''rate'',''vat'',''discount'',''company'',''document'',''quote_version'']',:'job'));
SELECT test.expect_count('worker raw material rows hidden',0,'select count(*) from public.akp_pro_materials');
SELECT test.expect_error('worker material foreign job denied','42501','select public.akp_pro_material_read(''55555555-5555-4555-8555-555555555555'')');
SELECT test.expect_error('worker cannot edit operational descriptions','42501',format('select public.akp_pro_material_save(%L,%L,1,%L,%L)',:'job',:'item',:'client',:'data'));
SELECT public.akp_pro_material_status(:'job',:'item',1,'90000000-0000-4000-8000-000000000025','ORDERED');
SELECT public.akp_pro_material_status(:'job',:'item',1,'90000000-0000-4000-8000-000000000025','ORDERED');
SELECT test.expect_error('worker status stale CAS','40001',format('select public.akp_pro_material_status(%L,%L,1,%L,''PURCHASED'')',:'job',:'item','90000000-0000-4000-8000-000000000026'));
COMMIT;
UPDATE public.akp_profiles SET is_active=false WHERE user_id='22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_error('inactive worker old JWT materials denied','42501',format('select public.akp_pro_material_read(%L)',:'job'));
SELECT test.expect_error('inactive worker old JWT status denied','42501',format('select public.akp_pro_material_status(%L,%L,2,%L,''PURCHASED'')',:'job',:'item','90000000-0000-4000-8000-000000000027'));
ROLLBACK;
UPDATE public.akp_profiles SET is_active=true WHERE user_id='22222222-2222-4222-8222-222222222222';
\echo MATERIALS RLS PASS
