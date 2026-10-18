# Password recovery hotfix

Fix: recovery links previously redirected to localhost:3000 and the app had no password update screen.
Adds /reset-password.html, same-origin /api/recovery/request and /complete, fixed recovery fragment redirect from landing/login, and a forgot-password link.
Provider validates bearer; existing Auth role and active profile required. No service key, new accounts or permission changes. Credentials never returned or persisted by the frontend. Password setting is performed by the user.
Validation: 11/11 isolated Node tests with synthetic data, plus syntax check. Real email/password update requires owner action; not yet PASS.
Run: node --test tests/recovery.test.cjs
Configuration required: Supabase Authentication > URL Configuration > Site URL = https://akp.wtf. Recovery request uses that exact origin + /. Old localhost links must be discarded; request a new email after configuration.
Rollback: production deploy 6ad13c2786b52bd26c637042, commit 78f20f0. No SQL migrations in this patch. HOTFIX001 database compatibility is already applied separately and should be preserved.
