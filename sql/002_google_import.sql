BEGIN;
CREATE TABLE public.akp_job_sources (
 job_id uuid PRIMARY KEY REFERENCES public.akp_jobs(id) ON DELETE CASCADE,
 source text NOT NULL DEFAULT 'GOOGLE_SHEETS',
 source_record jsonb NOT NULL,
 source_hash text NOT NULL,
 synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.akp_job_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.akp_job_sources FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.akp_job_sources TO authenticated;
CREATE POLICY coordinator_sources ON public.akp_job_sources FOR ALL TO authenticated
 USING ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator')
 WITH CHECK ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator');
CREATE FUNCTION public.akp_import_google(rows jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r jsonb; j public.akp_jobs%ROWTYPE; s public.akp_job_sources%ROWTYPE;
 added int:=0; updated int:=0; skipped int:=0; conflicts int:=0;
BEGIN
 IF (select auth.jwt()->'app_metadata'->>'akp_role') IS DISTINCT FROM 'coordinator' THEN RAISE EXCEPTION 'Coordinator required'; END IF;
 IF jsonb_typeof(rows)!='array' OR jsonb_array_length(rows)>500 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(rows)) != (SELECT count(DISTINCT value->>'reference') FROM jsonb_array_elements(rows)) THEN RAISE EXCEPTION 'Duplicate references'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(rows) LOOP
  IF coalesce(r->>'reference','')='' OR coalesce(r->>'source_hash','') !~ '^[a-f0-9]{64}$' OR octet_length((r->'source_record')::text)>30000 THEN RAISE EXCEPTION 'Invalid source'; END IF;
  SELECT * INTO j FROM public.akp_jobs WHERE reference=r->>'reference' FOR UPDATE;
  IF FOUND THEN
   SELECT * INTO s FROM public.akp_job_sources WHERE job_id=j.id;
   IF NOT FOUND THEN conflicts:=conflicts+1; CONTINUE; END IF;
   IF s.source_hash=r->>'source_hash' THEN skipped:=skipped+1; CONTINUE; END IF;
   IF j.updated_at>s.synced_at THEN conflicts:=conflicts+1; CONTINUE; END IF;
   UPDATE public.akp_jobs SET title=r->>'title',location=r->>'location',due_date=nullif(r->>'due_date','')::date,status=r->>'status',priority=r->>'priority',instructions=r->>'instructions',updated_at=now() WHERE id=j.id;
   updated:=updated+1;
  ELSE
   INSERT INTO public.akp_jobs(reference,title,location,due_date,status,priority,instructions)
   VALUES(r->>'reference',r->>'title',r->>'location',nullif(r->>'due_date','')::date,r->>'status',r->>'priority',r->>'instructions') RETURNING * INTO j;
   added:=added+1;
  END IF;
  INSERT INTO public.akp_job_sources(job_id,source_record,source_hash,synced_at) VALUES(j.id,r->'source_record',r->>'source_hash',now())
  ON CONFLICT(job_id) DO UPDATE SET source_record=excluded.source_record,source_hash=excluded.source_hash,synced_at=excluded.synced_at;
 END LOOP;
 RETURN jsonb_build_object('added',added,'updated',updated,'skipped',skipped,'conflicts',conflicts);
END;$$;
REVOKE ALL ON FUNCTION public.akp_import_google(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_import_google(jsonb) TO authenticated;
COMMIT;
