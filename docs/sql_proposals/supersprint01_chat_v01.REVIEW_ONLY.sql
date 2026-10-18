-- REVIEW ONLY. New optional chat schema; never auto-apply to production.
-- Does NOT repeat migration 20261017181541 or alter assignments PK.
-- PostgreSQL >=15 (UNIQUE NULLS NOT DISTINCT). Apply only after separate approval.
BEGIN;
CREATE SCHEMA akp_chat_private;
REVOKE ALL ON SCHEMA akp_chat_private FROM PUBLIC;
GRANT USAGE ON SCHEMA akp_chat_private TO authenticated;
CREATE TABLE public.akp_chat_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 coordinator_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 worker_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 job_id uuid REFERENCES public.akp_jobs(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(coordinator_id<>worker_id),
 UNIQUE NULLS NOT DISTINCT(coordinator_id,worker_id,job_id)
);
CREATE TABLE public.akp_chat_members (
 thread_id uuid NOT NULL REFERENCES public.akp_chat_threads(id),
 user_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 last_read_seq bigint NOT NULL DEFAULT 0 CHECK(last_read_seq>=0),
 PRIMARY KEY(thread_id,user_id)
);
CREATE TABLE public.akp_chat_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 thread_id uuid NOT NULL REFERENCES public.akp_chat_threads(id),
 sender_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 client_id uuid NOT NULL,
 job_id uuid REFERENCES public.akp_jobs(id),
 body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),
 source_language text NOT NULL DEFAULT 'pl' CHECK(source_language IN ('pl','ru','uk','en')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(thread_id,sender_id,client_id)
);
-- Original text is immutable; future translations must be a separate, authorized
-- projection keyed by message_id + target_language + translation version.
CREATE INDEX akp_chat_members_user_idx ON public.akp_chat_members(user_id,thread_id);
CREATE INDEX akp_chat_messages_thread_seq_idx ON public.akp_chat_messages(thread_id,seq DESC);
CREATE INDEX akp_chat_messages_search_idx ON public.akp_chat_messages USING gin(to_tsvector('simple',body));
CREATE INDEX akp_chat_messages_job_idx ON public.akp_chat_messages(job_id) WHERE job_id IS NOT NULL;
ALTER TABLE public.akp_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_chat_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.akp_chat_threads,public.akp_chat_members,public.akp_chat_messages FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.akp_chat_messages_seq_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.akp_chat_threads,public.akp_chat_members,public.akp_chat_messages TO authenticated;

CREATE FUNCTION akp_chat_private.actor_role() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
 SELECT p.role FROM public.akp_profiles p WHERE p.user_id=auth.uid() AND p.is_active=true
 AND p.role IN ('coordinator','worker') AND p.role=auth.jwt()->'app_metadata'->>'akp_role'
$$;
CREATE FUNCTION akp_chat_private.job_access(p_job uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
 SELECT p_job IS NULL OR (EXISTS(SELECT 1 FROM public.akp_jobs j WHERE j.id=p_job) AND
 (akp_chat_private.actor_role()='coordinator' OR (akp_chat_private.actor_role()='worker' AND EXISTS(
 SELECT 1 FROM public.akp_assignments a WHERE a.job_id=p_job AND a.worker_id=auth.uid() AND a.active=true))))
$$;
CREATE FUNCTION akp_chat_private.thread_access(p_thread uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
 SELECT akp_chat_private.actor_role() IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.akp_chat_threads t JOIN public.akp_chat_members m ON m.thread_id=t.id
 WHERE t.id=p_thread AND m.user_id=auth.uid() AND akp_chat_private.job_access(t.job_id))
$$;
CREATE POLICY akp_chat_threads_read ON public.akp_chat_threads FOR SELECT TO authenticated USING(akp_chat_private.thread_access(id));
CREATE POLICY akp_chat_members_read ON public.akp_chat_members FOR SELECT TO authenticated USING(akp_chat_private.thread_access(thread_id));
CREATE POLICY akp_chat_messages_read ON public.akp_chat_messages FOR SELECT TO authenticated
 USING(akp_chat_private.thread_access(thread_id) AND akp_chat_private.job_access(job_id));

CREATE FUNCTION public.akp_chat_recipients() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_role text:=akp_chat_private.actor_role(); result jsonb;
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'Chat access denied' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.user_id,'display',p.display_name) ORDER BY p.display_name,p.user_id),'[]') INTO result
 FROM public.akp_profiles p WHERE p.is_active=true AND p.role=CASE WHEN v_role='coordinator' THEN 'worker' ELSE 'coordinator' END;
 RETURN result;
END $$;
CREATE FUNCTION public.akp_chat_create_thread(p_other uuid,p_job uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE v_role text:=akp_chat_private.actor_role(); peer_role text; coord uuid; worker uuid; thread uuid;
BEGIN
 IF v_role IS NULL THEN RAISE EXCEPTION 'Chat access denied' USING ERRCODE='42501'; END IF;
 SELECT p.role INTO peer_role FROM public.akp_profiles p WHERE p.user_id=p_other AND p.is_active=true FOR SHARE;
 IF peer_role IS DISTINCT FROM (CASE WHEN v_role='coordinator' THEN 'worker' ELSE 'coordinator' END) THEN RAISE EXCEPTION 'Invalid recipient' USING ERRCODE='22023'; END IF;
 coord:=CASE WHEN v_role='coordinator' THEN auth.uid() ELSE p_other END;
 worker:=CASE WHEN v_role='worker' THEN auth.uid() ELSE p_other END;
 IF NOT akp_chat_private.job_access(p_job) OR (p_job IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.akp_assignments a WHERE a.job_id=p_job AND a.worker_id=worker AND a.active=true)) THEN
 RAISE EXCEPTION 'Job unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.akp_chat_threads(coordinator_id,worker_id,job_id) VALUES(coord,worker,p_job)
 ON CONFLICT(coordinator_id,worker_id,job_id) DO NOTHING RETURNING id INTO thread;
 IF thread IS NULL THEN SELECT id INTO thread FROM public.akp_chat_threads WHERE coordinator_id=coord AND worker_id=worker AND job_id IS NOT DISTINCT FROM p_job; END IF;
 INSERT INTO public.akp_chat_members(thread_id,user_id) VALUES(thread,coord),(thread,worker) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('id',thread,'job_id',p_job);
END $$;
CREATE FUNCTION public.akp_chat_send(p_thread uuid,p_client_id uuid,p_body text,p_language text DEFAULT 'pl',p_job uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE t public.akp_chat_threads; m public.akp_chat_messages; effective_job uuid;
BEGIN
 IF NOT akp_chat_private.thread_access(p_thread) THEN RAISE EXCEPTION 'Thread unavailable' USING ERRCODE='42501'; END IF;
 -- Serialize sends per thread before allocating seq: read watermarks cannot skip an older, uncommitted send.
 SELECT * INTO t FROM public.akp_chat_threads WHERE id=p_thread FOR UPDATE;
 -- Both accounts must be active for new messages, even though coordinator history survives deactivation.
 PERFORM 1 FROM public.akp_profiles WHERE user_id IN(t.coordinator_id,t.worker_id) AND is_active=true FOR SHARE;
 IF (SELECT count(*) FROM public.akp_profiles WHERE user_id IN(t.coordinator_id,t.worker_id) AND is_active=true)<>2 THEN RAISE EXCEPTION 'Inactive recipient' USING ERRCODE='42501'; END IF;
 IF p_client_id IS NULL OR p_body IS NULL OR length(btrim(p_body)) NOT BETWEEN 1 AND 4000 OR p_language IS NULL OR p_language NOT IN('pl','ru','uk','en') THEN RAISE EXCEPTION 'Invalid message' USING ERRCODE='22023'; END IF;
 IF t.job_id IS NOT NULL AND p_job IS NOT NULL AND p_job<>t.job_id THEN RAISE EXCEPTION 'Different job' USING ERRCODE='22023'; END IF;
 effective_job:=coalesce(t.job_id,p_job);
 IF NOT akp_chat_private.job_access(effective_job) OR (effective_job IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.akp_assignments a WHERE a.job_id=effective_job AND a.worker_id=t.worker_id AND a.active=true)) THEN RAISE EXCEPTION 'Job unavailable' USING ERRCODE='42501'; END IF;
 INSERT INTO public.akp_chat_messages(thread_id,sender_id,client_id,job_id,body,source_language)
 VALUES(p_thread,auth.uid(),p_client_id,effective_job,btrim(p_body),p_language)
 ON CONFLICT(thread_id,sender_id,client_id) DO NOTHING RETURNING * INTO m;
 IF m.id IS NULL THEN
 SELECT * INTO m FROM public.akp_chat_messages WHERE thread_id=p_thread AND sender_id=auth.uid() AND client_id=p_client_id;
 IF m.body<>btrim(p_body) OR m.job_id IS DISTINCT FROM effective_job OR m.source_language<>p_language THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='23505'; END IF;
 END IF;
 RETURN jsonb_build_object('id',m.id,'seq',m.seq::text,'body',m.body,'sender_id',m.sender_id,'job_id',m.job_id,'source_language',m.source_language,'created_at',m.created_at);
END $$;
CREATE FUNCTION public.akp_chat_messages_list(p_thread uuid,p_before bigint DEFAULT NULL,p_search text DEFAULT '',p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE items jsonb; oldest bigint; n int;
BEGIN
 IF NOT akp_chat_private.thread_access(p_thread) THEN RAISE EXCEPTION 'Thread unavailable' USING ERRCODE='42501'; END IF;
 IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_search IS NULL OR length(p_search)>100 OR p_before<1 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'seq',m.seq::text,'body',m.body,'sender_id',m.sender_id,'job_id',m.job_id,'source_language',m.source_language,'created_at',m.created_at) ORDER BY m.seq DESC),'[]'),min(m.seq),count(*) INTO items,oldest,n
 FROM(SELECT * FROM public.akp_chat_messages x WHERE x.thread_id=p_thread AND akp_chat_private.job_access(x.job_id)
 AND (p_before IS NULL OR x.seq<p_before) AND (p_search='' OR to_tsvector('simple',x.body)@@plainto_tsquery('simple',p_search)) ORDER BY x.seq DESC LIMIT p_limit) m;
 RETURN jsonb_build_object('items',items,'next_before',CASE WHEN n=p_limit THEN oldest::text ELSE NULL END);
END $$;
CREATE FUNCTION public.akp_chat_mark_read(p_thread uuid,p_message uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE watermark bigint;
BEGIN
 IF NOT akp_chat_private.thread_access(p_thread) THEN RAISE EXCEPTION 'Thread unavailable' USING ERRCODE='42501'; END IF;
 SELECT seq INTO watermark FROM public.akp_chat_messages WHERE id=p_message AND thread_id=p_thread AND akp_chat_private.job_access(job_id);
 IF watermark IS NULL THEN RAISE EXCEPTION 'Message unavailable' USING ERRCODE='22023'; END IF;
 UPDATE public.akp_chat_members SET last_read_seq=greatest(last_read_seq,watermark) WHERE thread_id=p_thread AND user_id=auth.uid();
 RETURN jsonb_build_object('ok',true);
END $$;
CREATE FUNCTION public.akp_chat_threads_list(p_offset int DEFAULT 0,p_limit int DEFAULT 50) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE items jsonb; unread bigint;
BEGIN
 IF akp_chat_private.actor_role() IS NULL THEN RAISE EXCEPTION 'Chat access denied' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO unread FROM public.akp_chat_messages x JOIN public.akp_chat_members m ON m.thread_id=x.thread_id AND m.user_id=auth.uid()
 WHERE akp_chat_private.thread_access(x.thread_id) AND akp_chat_private.job_access(x.job_id) AND x.seq>m.last_read_seq AND x.sender_id<>auth.uid();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'job_id',t.job_id,'created_at',t.created_at,'peer_id',p.user_id,'peer_display',p.display_name,
 'unread',(SELECT count(*) FROM public.akp_chat_messages x WHERE x.thread_id=t.id AND x.seq>m.last_read_seq AND x.sender_id<>auth.uid() AND akp_chat_private.job_access(x.job_id))) ORDER BY t.created_at DESC,t.id),'[]') INTO items
 FROM(SELECT * FROM public.akp_chat_threads WHERE akp_chat_private.thread_access(id) ORDER BY created_at DESC,id LIMIT p_limit OFFSET p_offset)t
 JOIN public.akp_chat_members m ON m.thread_id=t.id AND m.user_id=auth.uid()
 JOIN public.akp_profiles p ON p.user_id=CASE WHEN t.coordinator_id=auth.uid() THEN t.worker_id ELSE t.coordinator_id END;
 RETURN jsonb_build_object('items',items,'unread_total',unread,'next_offset',CASE WHEN jsonb_array_length(items)=p_limit THEN p_offset+p_limit ELSE NULL END);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA akp_chat_private FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA akp_chat_private TO authenticated;
REVOKE ALL ON FUNCTION public.akp_chat_recipients(),public.akp_chat_create_thread(uuid,uuid),public.akp_chat_send(uuid,uuid,text,text,uuid),public.akp_chat_messages_list(uuid,bigint,text,int),public.akp_chat_mark_read(uuid,uuid),public.akp_chat_threads_list(int,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_chat_recipients(),public.akp_chat_create_thread(uuid,uuid),public.akp_chat_send(uuid,uuid,text,text,uuid),public.akp_chat_messages_list(uuid,bigint,text,int),public.akp_chat_mark_read(uuid,uuid),public.akp_chat_threads_list(int,int) TO authenticated;
COMMIT;
