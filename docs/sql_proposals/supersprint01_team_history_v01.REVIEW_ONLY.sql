-- REVIEW ONLY. Forward-only sanitized account/assignment audit. No backfill, no production execution.
-- Existing migration 20261017181541 and assignments PK remain unchanged.
BEGIN;
CREATE SCHEMA akp_team_audit_private;
REVOKE ALL ON SCHEMA akp_team_audit_private FROM PUBLIC;
CREATE TABLE public.akp_team_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 worker_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 job_id uuid REFERENCES public.akp_jobs(id),
 actor_id uuid,
 action text NOT NULL,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX akp_team_events_worker_idx ON public.akp_team_events(worker_id,id DESC);
CREATE INDEX akp_team_events_job_idx ON public.akp_team_events(job_id,id DESC) WHERE job_id IS NOT NULL;
ALTER TABLE public.akp_team_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.akp_team_events FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.akp_team_events_id_seq FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.akp_team_events TO authenticated;
CREATE POLICY akp_team_events_read ON public.akp_team_events FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.akp_profiles p WHERE p.user_id=auth.uid() AND p.role='coordinator' AND p.is_active=true
 AND auth.jwt()->'app_metadata'->>'akp_role'='coordinator'));
CREATE FUNCTION akp_team_audit_private.capture() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE before_value jsonb; after_value jsonb; worker uuid; job uuid; event text;
BEGIN
 IF TG_TABLE_NAME='akp_profiles' THEN
  IF NEW.role<>'worker' THEN RETURN NEW; END IF;
  after_value:=jsonb_build_object('display_name',NEW.display_name,'preferred_lang',NEW.preferred_lang,'is_active',NEW.is_active);
  IF TG_OP='UPDATE' THEN before_value:=jsonb_build_object('display_name',OLD.display_name,'preferred_lang',OLD.preferred_lang,'is_active',OLD.is_active); END IF;
  worker:=NEW.user_id;event:=CASE WHEN TG_OP='INSERT' THEN 'ACCOUNT_CREATED' ELSE 'ACCOUNT_UPDATED' END;
 ELSE
  after_value:=jsonb_build_object('active',NEW.active);
  IF TG_OP='UPDATE' THEN before_value:=jsonb_build_object('active',OLD.active); END IF;
  worker:=NEW.worker_id;job:=NEW.job_id;event:=CASE WHEN NEW.active THEN 'ASSIGNED' ELSE 'UNASSIGNED' END;
 END IF;
 IF before_value IS NOT DISTINCT FROM after_value THEN RETURN NEW; END IF;
 INSERT INTO public.akp_team_events(worker_id,job_id,actor_id,action,before_data,after_data)
 VALUES(worker,job,auth.uid(),event,before_value,after_value);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION akp_team_audit_private.capture() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER akp_sprint_profile_audit AFTER INSERT OR UPDATE OF display_name,preferred_lang,is_active ON public.akp_profiles FOR EACH ROW EXECUTE FUNCTION akp_team_audit_private.capture();
CREATE TRIGGER akp_sprint_assignment_audit AFTER INSERT OR UPDATE OF active ON public.akp_assignments FOR EACH ROW EXECUTE FUNCTION akp_team_audit_private.capture();
CREATE FUNCTION public.akp_team_history(p_worker uuid DEFAULT NULL,p_job uuid DEFAULT NULL,p_before bigint DEFAULT NULL,p_limit int DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE items jsonb; oldest bigint; n int;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.akp_profiles WHERE user_id=auth.uid() AND role='coordinator' AND is_active=true
 AND auth.jwt()->'app_metadata'->>'akp_role'='coordinator') THEN RAISE EXCEPTION 'History denied' USING ERRCODE='42501'; END IF;
 IF (p_worker IS NULL AND p_job IS NULL) OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR p_before<1 THEN RAISE EXCEPTION 'Invalid history filter' USING ERRCODE='22023'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id::text,'worker_id',e.worker_id,'job_id',e.job_id,'actor_id',e.actor_id,'action',e.action,'before',e.before_data,'after',e.after_data,'created_at',e.created_at) ORDER BY e.id DESC),'[]'),min(e.id),count(*) INTO items,oldest,n
 FROM(SELECT * FROM public.akp_team_events WHERE(p_worker IS NULL OR worker_id=p_worker) AND(p_job IS NULL OR job_id=p_job) AND(p_before IS NULL OR id<p_before) ORDER BY id DESC LIMIT p_limit)e;
 RETURN jsonb_build_object('items',items,'next_before',CASE WHEN n=p_limit THEN oldest::text ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION public.akp_team_history(uuid,uuid,bigint,int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_team_history(uuid,uuid,bigint,int) TO authenticated;
COMMIT;
