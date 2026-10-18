\set ON_ERROR_STOP on
\i docs/sql_proposals/supersprint03_drawing_v01.ROLLBACK_REVIEW_ONLY.sql
\i docs/sql_proposals/supersprint03_media_v01.ROLLBACK_REVIEW_ONLY.sql
\i docs/sql_proposals/supersprint03_materials_v01.ROLLBACK_REVIEW_ONLY.sql
\i docs/sql_proposals/supersprint03_quotes_v01.ROLLBACK_REVIEW_ONLY.sql
SELECT test.expect_count('rollback preserves quotes',1,'select count(*) from public.akp_pro_quote_versions');
SELECT test.expect_count('rollback preserves materials',1,'select count(*) from public.akp_pro_materials');
SELECT test.expect_count('rollback preserves original photos',2,'select count(*) from public.akp_photos');
SELECT test.expect_count('rollback preserves metadata versions',2,'select count(*) from public.akp_pro_photo_meta_versions');
SELECT test.expect_count('rollback preserves drawing versions',2,'select count(*) from public.akp_pro_drawing_versions');
SELECT test.expect_count('rollback preserves original storage file',1,'select count(*) from storage.objects');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_error('rolled-back quote RPC denied','42501','select public.akp_pro_quote_read(''44444444-4444-4444-8444-444444444444'')');
SELECT test.expect_error('rolled-back materials RPC denied','42501','select public.akp_pro_material_read(''44444444-4444-4444-8444-444444444444'')');
SELECT test.expect_error('rolled-back photo RPC denied','42501','select public.akp_pro_photo_list(''44444444-4444-4444-8444-444444444444'')');
SELECT test.expect_error('rolled-back drawing RPC denied','42501','select public.akp_pro_drawing_read(''44444444-4444-4444-8444-444444444444'',''90000000-0000-4000-8000-000000000031'')');
SELECT test.expect_count('rollback guards still block broad legacy storage policy',0,'select count(*) from storage.objects');
ROLLBACK;
\echo SUPERSPRINT03 ROLLBACK PASS
