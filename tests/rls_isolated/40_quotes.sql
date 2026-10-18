\set ON_ERROR_STOP on
\i docs/sql_proposals/supersprint03_quotes_v01.REVIEW_ONLY.sql
UPDATE public.akp_profiles SET is_active=true;
UPDATE public.akp_assignments SET active=true;
\set job '44444444-4444-4444-8444-444444444444'
\set client '90000000-0000-4000-8000-000000000010'
\set document '{"title":"Fikcyjna wycena","company":{"name":"Demo","address":"","tax_id":"","email":""},"customer":{"name":"","address":"","tax_id":"","email":""},"notes":"","variants":[{"id":"90000000-0000-4000-8000-000000000011","name":"Podstawowy","lines":[{"id":"90000000-0000-4000-8000-000000000012","name":"Materiał demonstracyjny","unit":"szt.","quantity":"2","rate":"100","discount":"0","vat":"23"}]}]}'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_count('new quote starts at zero',0,format('select (public.akp_pro_quote_read(%L)->>''version'')::integer',:'job'));
SELECT public.akp_pro_quote_save(:'job',0,:'client',:'document');
SELECT public.akp_pro_quote_save(:'job',0,:'client',:'document');
SELECT test.expect_count('quote retry creates one revision',1,'select count(*) from public.akp_pro_quote_versions');
SELECT test.expect_error('quote CAS rejects stale version','40001',format('select public.akp_pro_quote_save(%L,0,%L,%L)',:'job','90000000-0000-4000-8000-000000000013',:'document'));
SELECT test.expect_error('quote immutable even for coordinator','42501','update public.akp_pro_quote_versions set document=''{}''');
SELECT test.expect_error('quote raw RPC rejects forged JSON','22023',format('select public.akp_pro_quote_save(%L,1,%L,''{}'')',:'job','90000000-0000-4000-8000-000000000013'));
SELECT test.expect_error('quote raw RPC rejects negative price','22023',format('select public.akp_pro_quote_save(%L,1,%L,%L)',:'job','90000000-0000-4000-8000-000000000013',replace(:'document','"100"','"-1"')));
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('assigned worker sees zero quote rows',0,'select count(*) from public.akp_pro_quote_versions');
SELECT test.expect_error('worker quote RPC forbidden','42501',format('select public.akp_pro_quote_read(%L)',:'job'));
ROLLBACK;
UPDATE public.akp_profiles SET is_active=false WHERE user_id='11111111-1111-4111-8111-111111111111';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_count('inactive coordinator old JWT hides quotes',0,'select count(*) from public.akp_pro_quote_versions');
SELECT test.expect_error('inactive coordinator quote save denied','42501',format('select public.akp_pro_quote_save(%L,1,%L,%L)',:'job','90000000-0000-4000-8000-000000000013',:'document'));
ROLLBACK;
UPDATE public.akp_profiles SET is_active=true WHERE user_id='11111111-1111-4111-8111-111111111111';
\echo QUOTES RLS PASS
