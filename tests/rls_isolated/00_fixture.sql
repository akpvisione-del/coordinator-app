-- CI ONLY: synthetic PostgreSQL-16 schema. NO production identifiers, secrets or customer data.
\set ON_ERROR_STOP on
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA test;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(current_setting('request.jwt.claims', true),'')::jsonb;
$fn$;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT NULLIF(auth.jwt()->>'sub','')::uuid;
$fn$;
CREATE FUNCTION test.expect_count(label text, expected bigint, statement text) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE actual bigint;
BEGIN
  EXECUTE statement INTO actual;
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'RLS FAIL [%] expected % got %: %',label,expected,actual,statement;
  END IF;
  RAISE NOTICE 'RLS PASS [%] = %',label,actual;
END
$fn$;

CREATE TABLE public.akp_profiles(
 user_id uuid PRIMARY KEY,
 display_name text NOT NULL,
 role text NOT NULL,
 is_active boolean NOT NULL
);
CREATE TABLE public.akp_jobs(
 id uuid PRIMARY KEY,
 title text NOT NULL
);
CREATE TABLE public.akp_assignments(
 job_id uuid NOT NULL REFERENCES public.akp_jobs(id),
 worker_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY (job_id,worker_id)
);
CREATE TABLE public.akp_reports(
 id uuid PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES public.akp_jobs(id),
 worker_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 status text NOT NULL,
 reviewer_id uuid,
 reviewed_at timestamptz,
 note text NOT NULL DEFAULT ''
);
CREATE TABLE public.akp_checks(
 job_id uuid NOT NULL REFERENCES public.akp_jobs(id),
 worker_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 step_index integer NOT NULL,
 done boolean NOT NULL DEFAULT false,
 PRIMARY KEY(job_id,worker_id,step_index)
);
CREATE TABLE public.akp_job_financials(
 job_id uuid PRIMARY KEY,
 revenue_net integer NOT NULL
);
CREATE TABLE public.akp_audit(id uuid PRIMARY KEY, action text NOT NULL);
CREATE TABLE public.akp_job_sources(job_id uuid PRIMARY KEY, source_record jsonb);

INSERT INTO public.akp_profiles(user_id,display_name,role,is_active) VALUES
('11111111-1111-4111-8111-111111111111','Coordinator DEMO','coordinator',true),
('22222222-2222-4222-8222-222222222222','Worker A DEMO','worker',true),
('33333333-3333-4333-8333-333333333333','Worker B DEMO','worker',true);
INSERT INTO public.akp_jobs(id,title) VALUES
('44444444-4444-4444-8444-444444444444','Synthetic Job A'),
('55555555-5555-4555-8555-555555555555','Synthetic Job B');
INSERT INTO public.akp_assignments(job_id,worker_id,active) VALUES
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',true),
('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333',true);
INSERT INTO public.akp_reports(id,job_id,worker_id,status,note) VALUES
('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','SUBMITTED','Demo report A'),
('77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','SUBMITTED','Demo report B');
INSERT INTO public.akp_checks(job_id,worker_id,step_index,done) VALUES
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222',0,false),
('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333',0,false);
INSERT INTO public.akp_job_financials(job_id,revenue_net)
VALUES ('44444444-4444-4444-8444-444444444444',9999);

ALTER TABLE public.akp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_job_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_job_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY akp_profiles_ro ON public.akp_profiles FOR SELECT TO authenticated
 USING (user_id=(SELECT auth.uid()) OR (SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator');
CREATE POLICY akp_finance_ro ON public.akp_job_financials FOR SELECT TO authenticated
 USING ((SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator');

-- The exact seven policies named in the draft, then overwritten with prechange
-- expressions by the separate rollback reference below.
CREATE POLICY akp_assignment_ro ON public.akp_assignments FOR SELECT TO authenticated USING (false);
CREATE POLICY akp_jobs_ro ON public.akp_jobs FOR SELECT TO authenticated USING (false);
CREATE POLICY akp_reports_ro ON public.akp_reports FOR SELECT TO authenticated USING (false);
CREATE POLICY akp_reports_create ON public.akp_reports FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY akp_checks_ro ON public.akp_checks FOR SELECT TO authenticated USING (false);
CREATE POLICY akp_checks_create ON public.akp_checks FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY akp_checks_edit ON public.akp_checks FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

GRANT USAGE ON SCHEMA auth,test,public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(),auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION test.expect_count(text,bigint,text) TO authenticated;
GRANT SELECT ON public.akp_profiles,public.akp_jobs,public.akp_assignments,
 public.akp_reports,public.akp_checks,public.akp_job_financials TO authenticated;
GRANT INSERT ON public.akp_reports,public.akp_checks TO authenticated;
GRANT UPDATE ON public.akp_checks TO authenticated;
-- Production grants also include TRUNCATE for authenticated (RLS does not protect this).
GRANT TRUNCATE ON public.akp_assignments,public.akp_audit,public.akp_checks,
 public.akp_job_financials,public.akp_job_sources,public.akp_jobs,public.akp_profiles,
 public.akp_reports TO authenticated;
