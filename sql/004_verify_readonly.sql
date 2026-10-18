-- AKP Commander ETAP 1 / SQL 004 / STAGING READ ONLY (po zatwierdzonej migracji)
-- URUCHOMIĆ DOPIERO PO OSOBNEJ ZGODZIE NA MIGRACJĘ 004.
-- Te SELECT-y badają STRUKTURĘ, NIE zastępują testów prawdziwych JWT/RLS.
BEGIN TRANSACTION READ ONLY;

WITH t AS (
  SELECT unnest(ARRAY[
    'akp_profiles','akp_jobs','akp_assignments','akp_checks',
    'akp_reports','akp_photos','akp_job_financials'
  ]) AS tablename
)
SELECT t.tablename,
  CASE WHEN to_regclass('public.'||t.tablename) IS NULL THEN 'FAIL: TABLE MISSING'
    WHEN EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
      AND p.tablename=t.tablename AND p.policyname NOT LIKE 'akp004_%'
    ) THEN 'FAIL: LEGACY POLICY STILL PRESENT'
    WHEN NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
      AND p.tablename=t.tablename AND p.policyname LIKE 'akp004_%'
    ) THEN 'FAIL: NO NEW POLICY'
    ELSE 'PASS: POLICY SET' END AS result
FROM t ORDER BY t.tablename;

SELECT 'assignments_composite_pk' AS test,
 CASE WHEN (
   SELECT count(*) FROM information_schema.key_column_usage
   WHERE table_schema='public' AND table_name='akp_assignments'
     AND constraint_name='akp_assignments_pkey'
 )=2 THEN 'PASS' ELSE 'FAIL' END AS result;

SELECT 'worker_security_definer_helpers' AS test,
 CASE WHEN (
   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname IN ('akp_worker_active','akp_worker_assigned')
     AND p.prosecdef IS TRUE
     AND EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')
 )=2 THEN 'PASS' ELSE 'FAIL' END AS result;

SELECT 'no_truncate_for_authenticated' AS test,
 CASE WHEN NOT (
   has_table_privilege('authenticated','public.akp_jobs','TRUNCATE')
   OR has_table_privilege('authenticated','public.akp_assignments','TRUNCATE')
   OR has_table_privilege('authenticated','public.akp_reports','TRUNCATE')
   OR has_table_privilege('authenticated','public.akp_audit','TRUNCATE')
   OR has_table_privilege('authenticated','public.akp_job_sources','TRUNCATE')
 ) THEN 'PASS' ELSE 'FAIL' END AS result;

SELECT 'no_user_delete_photos_or_assignments' AS test,
 CASE WHEN NOT (
   has_table_privilege('authenticated','public.akp_assignments','DELETE')
   OR has_table_privilege('authenticated','public.akp_photos','DELETE')
 ) THEN 'PASS' ELSE 'FAIL' END AS result;

SELECT 'job_photos_private_bucket' AS test,
 CASE WHEN EXISTS (
  SELECT 1 FROM storage.buckets
  WHERE id='job-photos' AND public IS FALSE AND file_size_limit=10485760
 ) THEN 'PASS' ELSE 'FAIL' END AS result;

SELECT 'photo_table_exists' AS test,
 CASE WHEN to_regclass('public.akp_photos') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS result;

SELECT 'job_statuses_match_api' AS test,
 CASE WHEN EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.akp_jobs'::regclass AND conname='akp_jobs_status_check'
    AND pg_get_constraintdef(oid) LIKE '%DO_ODBIORU%'
    AND pg_get_constraintdef(oid) LIKE '%POMIARY%'
 ) THEN 'PASS' ELSE 'FAIL' END AS result;

-- Aktywny koordynator: RLS danych operacyjnych ORAZ audytu/importu musi
-- opierać się na jego aktywnym profilu, nie na samej roli zapisanej w JWT.
SELECT 'history_sources_require_active_coordinator' AS test,
 CASE WHEN (
   SELECT count(*) FROM pg_policies
   WHERE schemaname='public'
     AND ((tablename='akp_audit' AND policyname='akp_audit_coordinator_read' AND cmd='SELECT')
       OR (tablename='akp_job_sources' AND policyname='coordinator_sources' AND cmd='ALL'))
     AND qual ILIKE '%akp_coordinator_active%'
 )=2 AND EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='akp_job_sources'
     AND policyname='coordinator_sources'
     AND with_check ILIKE '%akp_coordinator_active%'
 ) THEN 'PASS' ELSE 'FAIL' END AS result;

ROLLBACK;
-- PASS/FAIL dla autoryzacji wymaga dwóch autentycznych kont Auth i podpisanych JWT:
-- coordinator: dostęp do finansów i całego przydziału.
-- worker A: własne przypisane job/checks/photos/reports i brak finansów/cudzych job.
-- worker B: widzi wspólne job; po odpięciu A dalej widzi wspólne job.
-- worker A po active=false: 0 jobs/checks/photos/reports.
-- deactivate profile A: zero dostępu; ponowna aktywacja wg reguł.
-- worker: UPDATE role/is_active/created_at -> 403; phone/lang -> PASS.
-- worker: self-approve report -> 403.
-- Storage: upload pod {job_uuid}/{full_user_uuid}_plik; brak uploadu poza folderem;
-- Signed download odpiętego pracownika nie może być wydany.
-- Wszystkie dane testowe: wyłącznie oddzielne rekordy testowe, żadnych zleceń klientów.
