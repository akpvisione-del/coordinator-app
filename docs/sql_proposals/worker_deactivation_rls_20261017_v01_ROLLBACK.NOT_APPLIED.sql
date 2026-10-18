-- READ-ONLY REFERENCE / ROLLBACK PLAN. Do NOT execute without separate owner approval.
-- This rollback restores the seven original worker policies documented from live pg_policies on 2026-10-17.
-- WARNING: restoring them permits a deactivated worker with an unexpired JWT to query some records.
-- Prefer rolling back application code while KEEPING stricter RLS if safe; use this only after a security review.
BEGIN;
ALTER POLICY akp_assignment_ro ON public.akp_assignments USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (active=true AND worker_id=(SELECT auth.uid())));
ALTER POLICY akp_jobs_ro ON public.akp_jobs USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_jobs.id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
ALTER POLICY akp_reports_ro ON public.akp_reports USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR worker_id=(SELECT auth.uid()));
ALTER POLICY akp_reports_create ON public.akp_reports WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND status='SUBMITTED' AND reviewer_id IS NULL AND reviewed_at IS NULL AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_reports.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
ALTER POLICY akp_checks_ro ON public.akp_checks USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator' OR (worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)));
ALTER POLICY akp_checks_create ON public.akp_checks WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
ALTER POLICY akp_checks_edit ON public.akp_checks USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true)) WITH CHECK ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker' AND worker_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.akp_assignments a WHERE a.job_id=akp_checks.job_id AND a.worker_id=(SELECT auth.uid()) AND a.active=true));
COMMIT;
