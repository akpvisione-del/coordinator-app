\set ON_ERROR_STOP on
-- Fixtures installed by 10_run.sql in a disposable database only.
CREATE ROLE anon NOLOGIN;
UPDATE public.akp_profiles SET is_active=true;
UPDATE public.akp_assignments SET active=true;
\i docs/sql_proposals/worker_deactivation_rls_20261017_v01.NOT_APPLIED.sql
\i docs/sql_proposals/supersprint01_chat_v01.REVIEW_ONLY.sql
CREATE FUNCTION test.expect_error(label text, state text, statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE=state THEN RAISE NOTICE 'RLS PASS [%] expected %',label,state; RETURN; END IF;
  RAISE;
 END;
 RAISE EXCEPTION 'Expected error: %',label;
END $$;
GRANT EXECUTE ON FUNCTION test.expect_error(text,text,text) TO authenticated;
-- Two independent private pairs and one job thread.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT (public.akp_chat_create_thread('22222222-2222-4222-8222-222222222222')->>'id') AS ta \gset
SELECT (public.akp_chat_create_thread('33333333-3333-4333-8333-333333333333')->>'id') AS tb \gset
SELECT (public.akp_chat_create_thread('22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444')->>'id') AS tj \gset
SELECT test.expect_count('create thread is idempotent',1,'select count(*) from public.akp_chat_threads where id='''||(:'ta')||'''');
SELECT test.expect_count('pair has exactly two members',2,'select count(*) from public.akp_chat_members where thread_id='''||(:'ta')||'''');
SELECT (public.akp_chat_send(:'ta','90000000-0000-4000-8000-000000000001','hello private A')->>'id') AS ma \gset
SELECT public.akp_chat_send(:'ta','90000000-0000-4000-8000-000000000001','hello private A');
SELECT test.expect_count('send retry creates one message',1,'select count(*) from public.akp_chat_messages where thread_id='''||(:'ta')||'''');
SELECT test.expect_error('same key different text','23505',format('select public.akp_chat_send(%L,%L,%L)',:'ta','90000000-0000-4000-8000-000000000001','different payload'));
SELECT public.akp_chat_send(:'tb','90000000-0000-4000-8000-000000000002','private B');
SELECT public.akp_chat_send(:'tj','90000000-0000-4000-8000-000000000003','job A message');
SELECT (public.akp_chat_send(:'ta','90000000-0000-4000-8000-000000000008','job-linked message inside general thread','pl','44444444-4444-4444-8444-444444444444')->>'id') AS mg \gset
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('worker A sees own two threads',2,'select count(*) from public.akp_chat_threads');
SELECT test.expect_count('worker A sees only own messages',3,'select count(*) from public.akp_chat_messages');
SELECT test.expect_count('worker A cannot see B members',0,'select count(*) from public.akp_chat_members where thread_id='''||(:'tb')||'''');
SELECT test.expect_error('foreign thread RPC read','42501',format('select public.akp_chat_messages_list(%L)',:'tb'));
SELECT test.expect_error('foreign thread RPC write','42501',format('select public.akp_chat_send(%L,%L,%L)',:'tb','90000000-0000-4000-8000-000000000004','attack'));
SELECT test.expect_error('direct insert denied','42501',format('insert into public.akp_chat_messages(thread_id,sender_id,client_id,body) values(%L,%L,%L,%L)',:'ta','22222222-2222-4222-8222-222222222222','90000000-0000-4000-8000-000000000005','bypass'));
SELECT test.expect_error('membership forgery denied','42501',format('insert into public.akp_chat_members(thread_id,user_id) values(%L,%L)',:'tb','22222222-2222-4222-8222-222222222222'));
SELECT test.expect_error('worker cannot create worker-peer thread','22023','select public.akp_chat_create_thread(''33333333-3333-4333-8333-333333333333'')');
SELECT test.expect_error('link to unassigned job denied','42501',format('select public.akp_chat_send(%L,%L,%L,%L,%L)',:'ta','90000000-0000-4000-8000-000000000006','bad link','pl','55555555-5555-4555-8555-555555555555'));
SELECT test.expect_count('search does not include other thread',1,format('select jsonb_array_length(public.akp_chat_messages_list(%L,NULL,''hello'')->''items'')',:'ta'));
SELECT test.expect_count('unread starts at three',3,'select (public.akp_chat_threads_list()->>''unread_total'')::int');
SELECT public.akp_chat_mark_read(:'ta',:'ma');
SELECT test.expect_count('read marker reduces unread',2,'select (public.akp_chat_threads_list()->>''unread_total'')::int');
SELECT public.akp_chat_mark_read(:'ta',:'mg');
SELECT public.akp_chat_mark_read(:'ta',:'ma');
SELECT test.expect_count('read watermark never regresses',1,'select (public.akp_chat_threads_list()->>''unread_total'')::int');
SELECT test.expect_error('read marker cannot name another thread message','22023',format('select public.akp_chat_mark_read(%L,%L)',:'tj',:'ma'));
COMMIT;
-- Deactivated account with the exact old JWT cannot use RPC or direct table reads.
UPDATE public.akp_profiles SET is_active=false WHERE user_id='22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('inactive stale JWT zero threads',0,'select count(*) from public.akp_chat_threads');
SELECT test.expect_count('inactive stale JWT zero messages',0,'select count(*) from public.akp_chat_messages');
SELECT test.expect_error('inactive RPC denied','42501','select public.akp_chat_threads_list()');
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_count('coordinator retains inactive account history',4,'select count(*) from public.akp_chat_messages');
SELECT test.expect_error('new message to disabled peer denied','42501',format('select public.akp_chat_send(%L,%L,%L)',:'ta','90000000-0000-4000-8000-000000000007','disabled'));
ROLLBACK;
UPDATE public.akp_profiles SET is_active=true WHERE user_id='22222222-2222-4222-8222-222222222222';
UPDATE public.akp_assignments SET active=false WHERE worker_id='22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('revoked job thread disappears; general remains',1,'select count(*) from public.akp_chat_threads');
SELECT test.expect_count('revoked job message disappears',1,'select count(*) from public.akp_chat_messages');
SELECT test.expect_count('worker still sees NO company finances',0,'select count(*) from public.akp_job_financials');
ROLLBACK;
-- Disable-only rollback preserves every message and does not touch worker RLS.
\i docs/sql_proposals/supersprint01_chat_v01.ROLLBACK_REVIEW_ONLY.sql
SELECT test.expect_count('rollback retains all messages',4,'select count(*) from public.akp_chat_messages');
SELECT test.expect_count('rollback revokes RPC',0,'select has_function_privilege(''authenticated'',''public.akp_chat_threads_list(int,int)'',''EXECUTE'')::int');
\echo CHAT RLS PASS
