-- Applied to existing Supabase AKP project with user authorization on 2026-10-17.
-- Migration name: akp_worker_deactivation_rls_and_truncate_hardening_20261017_v01
-- Supabase migration version: 20261017181541
-- This document is the live migration record (not an executable auto-migration).
-- DO NOT APPLY AGAIN; exact rollback requires separate security assessment.

-- User approved three described security changes on 2026-10-17. Only existing policy edits, limited column GRANT, TRUNCATE REVOKE. No business data changes.
BEGIN;
DO $akp_preflight$
BEGIN
 IF EXISTS (
  SELECT 1
  FROM (VALUES ('akp_assignments','akp_assignment_ro','b88b95d50990116f20de42351f126af9'),('akp_jobs','akp_jobs_ro','2598b59ed54d6b2de77958be3f393c06'),('akp_reports','akp_reports_ro','dec56943b65f3e1b491f3e78686dd249'),('akp_reports','akp_reports_create','0a7d7415273554c100acdcd9b13857e9'),('akp_checks','akp_checks_ro','303fed9e6eb5fcf781b75d773e9744a1'),('akp_checks','akp_checks_create','e9cb750fe78ee996ff430b1fa6c09c6c'),('akp_checks','akp_checks_edit','2d2010a7311e720318b86d2da72896da')) AS exp(tab,pol,h)
  LEFT JOIN pg_policies p ON p.schemaname='public' AND p.tablename=exp.tab AND p.policyname=exp.pol
  WHERE p.policyname IS NULL OR md5(coalesce(p.qual,'')||':'||coalesce(p.with_check,''))<>exp.h
     OR p.permissive<>'PERMISSIVE' OR p.roles<>ARRAY['authenticated']::name[]
 ) THEN RAISE EXCEPTION 'AKP STOP: one or more policy definitions changed since snapshot'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND (
 (tablename='akp_assignments' AND policyname='akp_assignment_ro') OR
 (tablename='akp_jobs' AND policyname='akp_jobs_ro') OR
 (tablename='akp_reports' AND policyname IN ('akp_reports_ro','akp_reports_create')) OR
 (tablename='akp_checks' AND policyname IN ('akp_checks_ro','akp_checks_create','akp_checks_edit')))) <> 7
 THEN RAISE EXCEPTION 'AKP STOP: unexpected policy count'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE oid=ANY(ARRAY['public.akp_assignments'::regclass,'public.akp_jobs'::regclass,'public.akp_reports'::regclass,'public.akp_checks'::regclass]) AND NOT relrowsecurity)
 THEN RAISE EXCEPTION 'AKP STOP: RLS disabled'; END IF;
 IF NOT has_table_privilege('service_role','public.akp_profiles','SELECT') OR NOT has_table_privilege('service_role','public.akp_profiles','INSERT') OR
 has_column_privilege('service_role','public.akp_profiles','display_name','UPDATE') OR
 has_column_privilege('service_role','public.akp_profiles','preferred_lang','UPDATE') OR
 has_column_privilege('service_role','public.akp_profiles','is_active','UPDATE')
 THEN RAISE EXCEPTION 'AKP STOP: profile privileges differ from preflight'; END IF;
 IF EXISTS (SELECT 1 FROM (VALUES ('public.akp_assignments'),('public.akp_audit'),('public.akp_checks'),('public.akp_job_financials'),('public.akp_job_sources'),('public.akp_jobs'),('public.akp_profiles'),('public.akp_reports')) AS v(t) WHERE NOT has_table_privilege('authenticated',v.t,'TRUNCATE'))
 THEN RAISE EXCEPTION 'AKP STOP: authenticated TRUNCATE baseline changed'; END IF;
END $akp_preflight$;
ALTER POLICY akp_assignment_ro ON public.akp_assignments USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (active=true AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true)));
ALTER POLICY akp_jobs_ro ON public.akp_jobs USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_jobs.id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)));
ALTER POLICY akp_reports_ro ON public.akp_reports USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true)));
ALTER POLICY akp_reports_create ON public.akp_reports WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND status='SUBMITTED' AND reviewer_id IS NULL AND reviewed_at IS NULL AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_reports.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
ALTER POLICY akp_checks_ro ON public.akp_checks USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)));
ALTER POLICY akp_checks_create ON public.akp_checks WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
ALTER POLICY akp_checks_edit ON public.akp_checks USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)) WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
GRANT UPDATE(display_name,preferred_lang,is_active) ON TABLE public.akp_profiles TO service_role;
REVOKE TRUNCATE ON TABLE
  public.akp_assignments,
  public.akp_audit,
  public.akp_checks,
  public.akp_job_financials,
  public.akp_job_sources,
  public.akp_jobs,
  public.akp_profiles,
  public.akp_reports
FROM authenticated;
DO $akp_postflight$
BEGIN
 IF NOT has_column_privilege('service_role','public.akp_profiles','display_name','UPDATE') OR
 NOT has_column_privilege('service_role','public.akp_profiles','preferred_lang','UPDATE') OR
 NOT has_column_privilege('service_role','public.akp_profiles','is_active','UPDATE') OR
 has_column_privilege('service_role','public.akp_profiles','role','UPDATE') OR
 has_column_privilege('service_role','public.akp_profiles','user_id','UPDATE')
 THEN RAISE EXCEPTION 'AKP STOP: wrong column privileges after GRANT'; END IF;
 IF EXISTS (SELECT 1 FROM (VALUES ('public.akp_assignments'),('public.akp_audit'),('public.akp_checks'),('public.akp_job_financials'),('public.akp_job_sources'),('public.akp_jobs'),('public.akp_profiles'),('public.akp_reports')) AS v(t) WHERE has_table_privilege('authenticated',v.t,'TRUNCATE'))
 THEN RAISE EXCEPTION 'AKP STOP: authenticated still has TRUNCATE'; END IF;
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND (
 (tablename='akp_assignments' AND policyname='akp_assignment_ro') OR
 (tablename='akp_jobs' AND policyname='akp_jobs_ro') OR
 (tablename='akp_reports' AND policyname IN ('akp_reports_ro','akp_reports_create')) OR
 (tablename='akp_checks' AND policyname IN ('akp_checks_ro','akp_checks_create','akp_checks_edit')))
 AND (coalesce(qual,'')||coalesce(with_check,'')) LIKE '%p.is_active%')<>7
 THEN RAISE EXCEPTION 'AKP STOP: 7 policies not hardened'; END IF;
END $akp_postflight$;
COMMIT;
