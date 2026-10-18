-- REVIEW-ONLY. DO NOT RUN without explicit owner authorization.
-- Requires pre-deploy read-only snapshot of pg_policies and rollback drill.
BEGIN;
DO $akpguard$
BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE schemaname='public'
 AND ((tablename='akp_assignments' AND policyname='akp_assignment_ro')
 OR (tablename='akp_jobs' AND policyname='akp_jobs_ro')
 OR (tablename='akp_reports' AND policyname IN ('akp_reports_ro','akp_reports_create'))
 OR (tablename='akp_checks' AND policyname IN ('akp_checks_ro','akp_checks_create','akp_checks_edit')))) <> 7
 THEN RAISE EXCEPTION 'AKP STOP: unexpected RLS policy set'; END IF;
 IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN ('public.akp_assignments'::regclass,'public.akp_jobs'::regclass,'public.akp_reports'::regclass,'public.akp_checks'::regclass) AND NOT relrowsecurity)
 THEN RAISE EXCEPTION 'AKP STOP: RLS disabled'; END IF;
END
$akpguard$;
ALTER POLICY akp_assignment_ro ON public.akp_assignments USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (active=true AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true)));
ALTER POLICY akp_jobs_ro ON public.akp_jobs USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_jobs.id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)));
ALTER POLICY akp_reports_ro ON public.akp_reports USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true)));
ALTER POLICY akp_reports_create ON public.akp_reports WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND status='SUBMITTED' AND reviewer_id IS NULL AND reviewed_at IS NULL AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_reports.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
ALTER POLICY akp_checks_ro ON public.akp_checks USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)));
ALTER POLICY akp_checks_create ON public.akp_checks WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
ALTER POLICY akp_checks_edit ON public.akp_checks USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)) WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_profiles p WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active=true) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
COMMIT;
