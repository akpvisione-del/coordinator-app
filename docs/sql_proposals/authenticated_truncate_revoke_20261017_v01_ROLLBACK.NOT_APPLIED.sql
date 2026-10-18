-- REVIEW ONLY — NOT APPLIED — CONDITIONAL rollback, REINTRODUCES risk.
-- Restores the original 2026-10-17 authenticated TRUNCATE grants.
-- Prefer keeping the safer revoked state when rolling back application features.
-- NEVER run automatically. Requires explicit security decision.
BEGIN;
GRANT TRUNCATE ON TABLE
  public.akp_assignments,
  public.akp_audit,
  public.akp_checks,
  public.akp_job_financials,
  public.akp_job_sources,
  public.akp_jobs,
  public.akp_profiles,
  public.akp_reports
TO authenticated;
COMMIT;
