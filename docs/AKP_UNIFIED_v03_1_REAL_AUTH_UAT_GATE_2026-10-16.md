AKP COMMANDER UNIFIED — INTEGRATION UAT GATE v03.1
2026-10-16 — TESTOWA / DEV, PR #7

Purpose: verify real Supabase Auth + JWT and Row Level Security without touching operational jobs.

ACTUAL LIVE, READ-ONLY AUDIT
Supabase project ttectcuirgdakjhpkkll: ACTIVE_HEALTHY, public.akp_jobs 30 rows, public.akp_profiles 1 row (coordinator), public.akp_assignments 0 rows, financials 0, reports 0, photos 0. Checked via Supabase project's own metadata and read-only SQL. Migrations: initial + import + HOTFIX001 through HOTFIX004 (the existing applied set). The only active coordinator has no worker to assign; zero worker profiles makes a full real worker/JWT test impossible now.
RLS from pg_policies: authenticated coordinator may read all jobs; worker may read only active assigned jobs. Workers may not read akp_job_financials, akp_job_sources or audit; photos require active profile plus coordinator or assigned worker. This is policy inspection, NOT a test with a real worker JWT.
Supabase advisor: leaked password protection disabled (pre-existing WARNING); enable only after reviewing Auth impact and owner consent.
No INSERT, UPDATE, DELETE, DDL or accounts were run.

NEW CODE
- public/app.js now rejects HTTP responses from the wrong sessionEpoch, including stale 401 responses that previously could log out a new user, and stale detail fetches which could repopulate old client/finance information.
- tests/unified-v02-and-v19-review.test.js guards session/HTTP security.
- scripts/uat-dev-real-auth-readonly.cjs: manually run from a trusted workstation, DEV-only URL regex, cookie read solely from private environment, GET requests only, redacted PASS/FAIL.
- tests/uat-dev-real-auth.test.js: synthetic unit tests for production URL rejection, no mutations, coordinator permissions, worker restricted endpoints, worker financial isolation, partial/no-assignment result.

RUN ONCE A REAL TEST SESSION EXISTS (PRIVATE TEST DEVICE ONLY)
AKP_UAT_ORIGIN=https://deploy-preview-7--coordinator-a.netlify.app
AKP_UAT_ROLE=worker or coordinator
AKP_UAT_COOKIE set PRIVATELY from the authenticated test session (never paste it into chat, tickets, logs, or source).
node scripts/uat-dev-real-auth-readonly.cjs
Note: this command is not executed by default in CI. It cannot read secrets by itself; creating worker credentials is a separate authorized step.
An unauthenticated context, mismatched role, missing assignment or denied GET returns an explicit failure or partial status, not success.
Only read-only endpoints are requested, no PATCH, no POST. No customer names, emails, addresses, job identifiers, or cookies are logged.

HARD GATE BEFORE LIVE TEST
1. Netlify Deploy Preview must have correct context-specific SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and an explicit APP_ORIGIN equal to its real preview URL. Existing production APP_ORIGIN must remain unchanged. Do not disable Origin protection and do not add wildcard.
2. Create a synthetic worker account and profile, assignment and job ONLY inside an isolated DB test branch or other specifically approved non-operational environment, after separately checking cost/permissions. Never test with real customers.
3. Verify real coordinator and worker sign-in; coordinator GET and worker denied endpoints; synthetic PATCH->refresh->readback->409 with approved cleanup inside isolated environment.
4. Physical Android 360/390/430px and backup+rollback.
5. Keep PR #7 Draft, production akp.wtf untouched until UAT PASS and owner accepts.

KNOWN LIMITATIONS
- Real JWT worker login and DB write-readback have NOT been executed: no worker accounts nor approved isolated dataset.
- Supabase project's operational staging has real jobs. Real DB update tests there are unsafe without test fixtures and owner agreement.
- External Netlify preview cannot be navigated via these tools with the user's logged-in browser; readiness and code can be checked, not claimed as live E2E.
- Running a read-only script with an existing session does not prove writes.
- No sync to Google Drive or new worker accounts were provisioned.

CI TESTS: existing Chrome mock E2E + CSP and API tests; check latest workflow before release.
ROLLBACK: PR Draft only, revert this branch; no data migrations.
