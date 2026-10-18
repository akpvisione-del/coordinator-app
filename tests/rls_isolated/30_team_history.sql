\set ON_ERROR_STOP on
ALTER TABLE public.akp_profiles ADD COLUMN preferred_lang text NOT NULL DEFAULT 'pl';
\i docs/sql_proposals/supersprint01_team_history_v01.REVIEW_ONLY.sql
SELECT test.expect_count('audit does not fabricate past events',0,'select count(*) from public.akp_team_events');
UPDATE public.akp_profiles SET display_name='Renamed synthetic worker',preferred_lang='ru' WHERE user_id='22222222-2222-4222-8222-222222222222';
UPDATE public.akp_profiles SET is_active=false WHERE user_id='22222222-2222-4222-8222-222222222222';
UPDATE public.akp_profiles SET is_active=true WHERE user_id='22222222-2222-4222-8222-222222222222';
UPDATE public.akp_assignments SET active=true WHERE worker_id='22222222-2222-4222-8222-222222222222';
UPDATE public.akp_assignments SET active=false WHERE worker_id='22222222-2222-4222-8222-222222222222';
UPDATE public.akp_assignments SET active=false WHERE worker_id='22222222-2222-4222-8222-222222222222';
SELECT test.expect_count('audit records five real changes, skips noop',5,'select count(*) from public.akp_team_events');
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_count('coordinator account and assignment history',5,'select jsonb_array_length(public.akp_team_history(''22222222-2222-4222-8222-222222222222'')->''items'')');
SELECT test.expect_count('job history filters account events out',2,'select jsonb_array_length(public.akp_team_history(NULL,''44444444-4444-4444-8444-444444444444'')->''items'')');
SELECT test.expect_count('audit has no password/email/finance payload',0,'select count(*) from public.akp_team_events where after_data ?| array[''password'',''email'',''revenue_net'',''crew_cost'']');
SELECT test.expect_error('audit direct forgery denied','42501','insert into public.akp_team_events(worker_id,action) values(''22222222-2222-4222-8222-222222222222'',''FORGED'')');
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('worker cannot read team audit',0,'select count(*) from public.akp_team_events');
SELECT test.expect_error('worker cannot call team audit RPC','42501','select public.akp_team_history(''22222222-2222-4222-8222-222222222222'')');
ROLLBACK;
UPDATE public.akp_profiles SET is_active=false WHERE user_id='11111111-1111-4111-8111-111111111111';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_count('inactive coordinator old JWT cannot read audit',0,'select count(*) from public.akp_team_events');
SELECT test.expect_error('inactive coordinator RPC denied','42501','select public.akp_team_history(''22222222-2222-4222-8222-222222222222'')');
ROLLBACK;
UPDATE public.akp_profiles SET is_active=true WHERE user_id='11111111-1111-4111-8111-111111111111';
\i docs/sql_proposals/supersprint01_team_history_v01.ROLLBACK_REVIEW_ONLY.sql
SELECT test.expect_count('audit rollback preserves history',5,'select count(*) from public.akp_team_events');
\echo TEAM HISTORY RLS PASS
