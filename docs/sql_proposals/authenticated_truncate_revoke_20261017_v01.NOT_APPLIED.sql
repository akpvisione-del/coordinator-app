-- REVIEW ONLY — NOT APPLIED — Owner approval required before running on Supabase.
-- Verified production: authenticated has TRUNCATE on these 8 tables.
-- RLS does not restrict TRUNCATE; retain SELECT/INSERT/UPDATE and RLS unchanged.
-- Before deployment verify has_table_privilege('authenticated', ..., 'TRUNCATE')=true for each.
BEGIN;
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
COMMIT;
