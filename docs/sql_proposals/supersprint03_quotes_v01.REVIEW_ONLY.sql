-- REVIEW ONLY. Separate approval required. NOT a production migration command.
-- No changes to assignments PK, existing photos, accounts or applied 20261017181541.
BEGIN;
CREATE SCHEMA akp_pro_private;
REVOKE ALL ON SCHEMA akp_pro_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA akp_pro_private TO authenticated;
CREATE FUNCTION akp_pro_private.can_job(p_job uuid,p_financial boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.akp_profiles p JOIN public.akp_jobs j ON j.id=p_job
 WHERE p.user_id=auth.uid() AND p.is_active AND p.role=auth.jwt()->'app_metadata'->>'akp_role'
 AND (p.role='coordinator' OR (NOT p_financial AND p.role='worker' AND EXISTS(
 SELECT 1 FROM public.akp_assignments a WHERE a.job_id=p_job AND a.worker_id=p.user_id AND a.active))));
$$;
REVOKE ALL ON FUNCTION akp_pro_private.can_job(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION akp_pro_private.can_job(uuid,boolean) TO authenticated;
CREATE TABLE public.akp_pro_quote_versions(
 job_id uuid NOT NULL REFERENCES public.akp_jobs(id),
 version integer NOT NULL CHECK(version>0),
 client_id uuid NOT NULL,
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=40000),
 created_by uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(job_id,version), UNIQUE(job_id,client_id)
);
ALTER TABLE public.akp_pro_quote_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.akp_pro_quote_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.akp_pro_quote_versions TO authenticated;
CREATE POLICY akp_pro_quotes_ro ON public.akp_pro_quote_versions FOR SELECT TO authenticated
 USING (akp_pro_private.can_job(job_id,true));
CREATE FUNCTION akp_pro_private.validate_quote(d jsonb) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog AS $$
DECLARE v jsonb;l jsonb;p jsonb;k text;n integer:=0;ids text[]:='{}';line_ids text[];value text;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>40000 OR
 NOT d ?& ARRAY['title','company','customer','notes','variants'] OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(d) x WHERE x NOT IN ('title','company','customer','notes','variants')) OR
 jsonb_typeof(d->'title')<>'string' OR length(btrim(d->>'title')) NOT BETWEEN 1 AND 120 OR
 jsonb_typeof(d->'notes')<>'string' OR length(d->>'notes')>2000 OR
 jsonb_typeof(d->'variants')<>'array' THEN RAISE EXCEPTION 'invalid quote' USING ERRCODE='22023';END IF;
 IF jsonb_array_length(d->'variants') NOT BETWEEN 1 AND 6 THEN RAISE EXCEPTION 'invalid variants' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['company','customer'] LOOP
  p:=d->k;
  IF jsonb_typeof(p)<>'object' OR NOT p ?& ARRAY['name','address','tax_id','email'] OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(p) x WHERE x NOT IN ('name','address','tax_id','email')) THEN RAISE EXCEPTION 'invalid party' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(p) e WHERE jsonb_typeof(e.value)<>'string' OR length(e.value#>>'{}')>CASE e.key WHEN 'address' THEN 300 WHEN 'tax_id' THEN 40 ELSE 160 END) THEN RAISE EXCEPTION 'invalid party text' USING ERRCODE='22023';END IF;
 END LOOP;
 FOR v IN SELECT * FROM jsonb_array_elements(d->'variants') LOOP
  IF jsonb_typeof(v)<>'object' OR NOT v ?& ARRAY['id','name','lines'] OR EXISTS(SELECT 1 FROM jsonb_object_keys(v) x WHERE x NOT IN ('id','name','lines')) OR
  jsonb_typeof(v->'id')<>'string' OR (v->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (v->>'id')=ANY(ids) OR
  jsonb_typeof(v->'name')<>'string' OR length(btrim(v->>'name')) NOT BETWEEN 1 AND 80 OR jsonb_typeof(v->'lines')<>'array' THEN RAISE EXCEPTION 'invalid variant' USING ERRCODE='22023';END IF;
  ids:=array_append(ids,v->>'id');line_ids:='{}';
  IF jsonb_array_length(v->'lines')>80 THEN RAISE EXCEPTION 'too many lines' USING ERRCODE='22023';END IF;
  FOR l IN SELECT * FROM jsonb_array_elements(v->'lines') LOOP
   n:=n+1;
   IF jsonb_typeof(l)<>'object' OR NOT l ?& ARRAY['id','name','unit','quantity','rate','discount','vat'] OR
   EXISTS(SELECT 1 FROM jsonb_object_keys(l) x WHERE x NOT IN ('id','name','unit','quantity','rate','discount','vat')) OR
   jsonb_typeof(l->'id')<>'string' OR (l->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (l->>'id')=ANY(line_ids) OR
   jsonb_typeof(l->'name')<>'string' OR length(btrim(l->>'name')) NOT BETWEEN 1 AND 200 OR
   jsonb_typeof(l->'unit')<>'string' OR NOT (l->>'unit'=ANY(ARRAY['szt.','m','m²','m³','kg','l','kpl.','godz.'])) THEN RAISE EXCEPTION 'invalid line' USING ERRCODE='22023';END IF;
   line_ids:=array_append(line_ids,l->>'id');
   FOREACH k IN ARRAY ARRAY['quantity','rate','discount','vat'] LOOP
    value:=l->>k;
    IF jsonb_typeof(l->k)<>'string' OR value !~ (CASE WHEN k='quantity' THEN '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,3})?$' ELSE '^(0|[1-9][0-9]{0,8})(\.[0-9]{1,2})?$' END) THEN RAISE EXCEPTION 'invalid decimal' USING ERRCODE='22023';END IF;
    IF value::numeric>(CASE WHEN k='quantity' THEN 1000000 WHEN k='rate' THEN 100000 ELSE 100 END) THEN RAISE EXCEPTION 'decimal limit' USING ERRCODE='22023';END IF;
   END LOOP;
  END LOOP;
 END LOOP;
 IF n>100 THEN RAISE EXCEPTION 'too many lines' USING ERRCODE='22023';END IF;
END $$;
REVOKE ALL ON FUNCTION akp_pro_private.validate_quote(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.akp_pro_quote_read(p_job uuid,p_version integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item public.akp_pro_quote_versions;history jsonb;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,true) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 SELECT * INTO item FROM public.akp_pro_quote_versions WHERE job_id=p_job AND (p_version IS NULL OR version=p_version) ORDER BY version DESC LIMIT 1;
 IF p_version IS NOT NULL AND item.job_id IS NULL THEN RAISE EXCEPTION 'version missing' USING ERRCODE='P0002';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.version DESC),'[]'::jsonb) INTO history FROM
 (SELECT version,created_at,created_by FROM public.akp_pro_quote_versions WHERE job_id=p_job ORDER BY version DESC LIMIT 100) x;
 RETURN jsonb_build_object('version',coalesce(item.version,0),'document',item.document,'history',history);
END $$;
CREATE FUNCTION public.akp_pro_quote_save(p_job uuid,p_expected integer,p_client uuid,p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE current_version integer; prior public.akp_pro_quote_versions;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,true) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 IF p_client IS NULL OR p_expected IS NULL OR p_expected<0 THEN RAISE EXCEPTION 'invalid write' USING ERRCODE='22023';END IF;
 PERFORM akp_pro_private.validate_quote(p_document);
 -- Serializes concurrent saves, including first revision. No broad service-role key.
 PERFORM 1 FROM public.akp_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO prior FROM public.akp_pro_quote_versions WHERE job_id=p_job AND client_id=p_client;
 IF prior.job_id IS NOT NULL THEN
  IF prior.document IS DISTINCT FROM p_document THEN RAISE EXCEPTION 'idempotency mismatch' USING ERRCODE='40001';END IF;
  RETURN jsonb_build_object('version',prior.version,'replayed',true);
 END IF;
 SELECT coalesce(max(version),0) INTO current_version FROM public.akp_pro_quote_versions WHERE job_id=p_job;
 IF current_version<>p_expected THEN RAISE EXCEPTION 'version conflict' USING ERRCODE='40001';END IF;
 INSERT INTO public.akp_pro_quote_versions(job_id,version,client_id,document,created_by) VALUES(p_job,current_version+1,p_client,p_document,auth.uid());
 RETURN jsonb_build_object('version',current_version+1,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.akp_pro_quote_read(uuid,integer),public.akp_pro_quote_save(uuid,integer,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_pro_quote_read(uuid,integer),public.akp_pro_quote_save(uuid,integer,uuid,jsonb) TO authenticated;
COMMIT;
