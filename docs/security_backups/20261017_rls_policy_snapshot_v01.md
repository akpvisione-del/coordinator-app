# AKP 2026-10-17 — SNAPSHOT BEFORE AUTHORIZED SECURITY MIGRATION

**Source:** live Supabase project `ttectcuirgdakjhpkkll`, read-only `pg_policies`; **contains policy definitions only**, no customer records. Original policy definitions as JSON (fully captured), not a substitute for the detailed rollback verification. New proposed SQL is in `docs/sql_proposals/*NOT_APPLIED.sql`.

```json
[
  {
    "cmd": "SELECT",
    "roles": [
      "authenticated"
    ],
    "table": "akp_assignments",
    "using": "((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'coordinator'::text) OR (active AND (worker_id = ( SELECT auth.uid() AS uid))))",
    "policy": "akp_assignment_ro",
    "permissive": "PERMISSIVE",
    "with_check": null
  },
  {
    "cmd": "INSERT",
    "roles": [
      "authenticated"
    ],
    "table": "akp_checks",
    "using": null,
    "policy": "akp_checks_create",
    "permissive": "PERMISSIVE",
    "with_check": "((worker_id = ( SELECT auth.uid() AS uid)) AND (( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'worker'::text) AND (EXISTS ( SELECT 1\n   FROM akp_assignments a\n  WHERE ((a.job_id = akp_checks.job_id) AND (a.worker_id = ( SELECT auth.uid() AS uid)) AND (a.active = true)))))"
  },
  {
    "cmd": "UPDATE",
    "roles": [
      "authenticated"
    ],
    "table": "akp_checks",
    "using": "((worker_id = ( SELECT auth.uid() AS uid)) AND (( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'worker'::text) AND (EXISTS ( SELECT 1\n   FROM akp_assignments a\n  WHERE ((a.job_id = akp_checks.job_id) AND (a.worker_id = ( SELECT auth.uid() AS uid)) AND (a.active = true)))))",
    "policy": "akp_checks_edit",
    "permissive": "PERMISSIVE",
    "with_check": "((worker_id = ( SELECT auth.uid() AS uid)) AND (( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'worker'::text) AND (EXISTS ( SELECT 1\n   FROM akp_assignments a\n  WHERE ((a.job_id = akp_checks.job_id) AND (a.worker_id = ( SELECT auth.uid() AS uid)) AND (a.active = true)))))"
  },
  {
    "cmd": "SELECT",
    "roles": [
      "authenticated"
    ],
    "table": "akp_checks",
    "using": "((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'coordinator'::text) OR ((worker_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1\n   FROM akp_assignments a\n  WHERE ((a.job_id = akp_checks.job_id) AND (a.worker_id = ( SELECT auth.uid() AS uid)) AND (a.active = true))))))",
    "policy": "akp_checks_ro",
    "permissive": "PERMISSIVE",
    "with_check": null
  },
  {
    "cmd": "SELECT",
    "roles": [
      "authenticated"
    ],
    "table": "akp_jobs",
    "using": "((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'coordinator'::text) OR (EXISTS ( SELECT 1\n   FROM akp_assignments a\n  WHERE ((a.job_id = akp_jobs.id) AND (a.worker_id = ( SELECT auth.uid() AS uid)) AND (a.active = true)))))",
    "policy": "akp_jobs_ro",
    "permissive": "PERMISSIVE",
    "with_check": null
  },
  {
    "cmd": "INSERT",
    "roles": [
      "authenticated"
    ],
    "table": "akp_reports",
    "using": null,
    "policy": "akp_reports_create",
    "permissive": "PERMISSIVE",
    "with_check": "((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'worker'::text) AND (worker_id = ( SELECT auth.uid() AS uid)) AND (status = 'SUBMITTED'::text) AND (reviewer_id IS NULL) AND (reviewed_at IS NULL) AND (EXISTS ( SELECT 1\n   FROM akp_assignments a\n  WHERE ((a.job_id = akp_reports.job_id) AND (a.worker_id = ( SELECT auth.uid() AS uid)) AND (a.active = true)))))"
  },
  {
    "cmd": "SELECT",
    "roles": [
      "authenticated"
    ],
    "table": "akp_reports",
    "using": "((( SELECT ((auth.jwt() -> 'app_metadata'::text) ->> 'akp_role'::text)) = 'coordinator'::text) OR (worker_id = ( SELECT auth.uid() AS uid)))",
    "policy": "akp_reports_ro",
    "permissive": "PERMISSIVE",
    "with_check": null
  }
]
```
