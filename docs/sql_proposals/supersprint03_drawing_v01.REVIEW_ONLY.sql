-- REVIEW ONLY. Requires quotes + media proposals. Original images are never modified.
BEGIN;
CREATE TABLE public.akp_pro_drawing_versions(
 job_id uuid NOT NULL REFERENCES public.akp_jobs(id),photo_id uuid NOT NULL REFERENCES public.akp_photos(id),
 version integer NOT NULL CHECK(version>0),client_id uuid NOT NULL,
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=60000),
 created_by uuid NOT NULL REFERENCES public.akp_profiles(user_id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(photo_id,version),UNIQUE(photo_id,client_id)
);
CREATE INDEX akp_pro_drawing_job ON public.akp_pro_drawing_versions(job_id,photo_id,version DESC);
ALTER TABLE public.akp_pro_drawing_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.akp_pro_drawing_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.akp_pro_drawing_versions TO authenticated;
CREATE POLICY akp_pro_drawing_ro ON public.akp_pro_drawing_versions FOR SELECT TO authenticated USING(akp_pro_private.can_job(job_id,false));
CREATE FUNCTION akp_pro_private.validate_drawing(d jsonb) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE s jsonb;k text;ids text[]:='{}';
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' OR octet_length(d::text)>60000 OR NOT d ?& ARRAY['schema','width','height','source_sha256','shapes'] OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(d) x WHERE x NOT IN ('schema','width','height','source_sha256','shapes')) OR d->'schema'<>'1'::jsonb OR
 jsonb_typeof(d->'width')<>'number' OR (d->>'width')!~'^[1-9][0-9]{0,4}$' OR
 jsonb_typeof(d->'height')<>'number' OR (d->>'height')!~'^[1-9][0-9]{0,4}$' OR
 jsonb_typeof(d->'source_sha256')<>'string' OR (d->>'source_sha256')!~'^[0-9a-f]{64}$' OR jsonb_typeof(d->'shapes')<>'array' THEN RAISE EXCEPTION 'invalid drawing' USING ERRCODE='22023';END IF;
 IF (d->>'width')::integer>12000 OR (d->>'height')::integer>12000 OR (d->>'width')::bigint*(d->>'height')::bigint>40000000 OR jsonb_array_length(d->'shapes')>100 THEN RAISE EXCEPTION 'drawing bounds' USING ERRCODE='22023';END IF;
 FOR s IN SELECT * FROM jsonb_array_elements(d->'shapes') LOOP
  IF jsonb_typeof(s)<>'object' OR NOT s ?& ARRAY['id','type','x1','y1','x2','y2','text','color'] OR
  EXISTS(SELECT 1 FROM jsonb_object_keys(s) x WHERE x NOT IN ('id','type','x1','y1','x2','y2','text','color')) OR
  jsonb_typeof(s->'id')<>'string' OR (s->>'id')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (s->>'id')=ANY(ids) OR
  jsonb_typeof(s->'type')<>'string' OR s->>'type' NOT IN ('line','arrow','dimension','label') OR
  jsonb_typeof(s->'color')<>'string' OR s->>'color' NOT IN ('red','blue') OR
  jsonb_typeof(s->'text')<>'string' OR length(s->>'text')>120 OR (s->>'text')~'[[:cntrl:]]' OR
  ((s->>'type') IN ('dimension','label') AND length(btrim(s->>'text'))=0) OR
  ((s->>'type') IN ('line','arrow') AND s->>'text'<>'') THEN RAISE EXCEPTION 'invalid shape' USING ERRCODE='22023';END IF;
  ids:=array_append(ids,s->>'id');
  FOREACH k IN ARRAY ARRAY['x1','y1','x2','y2'] LOOP
   IF jsonb_typeof(s->k)<>'number' OR (s->>k)!~'^(0|[1-9][0-9]{0,4})$' OR (s->>k)::integer>10000 THEN RAISE EXCEPTION 'invalid coordinates' USING ERRCODE='22023';END IF;
  END LOOP;
  IF s->>'type'<>'label' AND s->>'x1'=s->>'x2' AND s->>'y1'=s->>'y2' THEN RAISE EXCEPTION 'zero line' USING ERRCODE='22023';END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION akp_pro_private.validate_drawing(jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.akp_pro_drawing_read(p_job uuid,p_photo uuid,p_version integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item public.akp_pro_drawing_versions;history jsonb;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.akp_photos WHERE id=p_photo AND job_id=p_job) THEN RAISE EXCEPTION 'missing photo' USING ERRCODE='P0002';END IF;
 SELECT * INTO item FROM public.akp_pro_drawing_versions WHERE photo_id=p_photo AND job_id=p_job AND (p_version IS NULL OR version=p_version) ORDER BY version DESC LIMIT 1;
 IF p_version IS NOT NULL AND item.photo_id IS NULL THEN RAISE EXCEPTION 'missing version' USING ERRCODE='P0002';END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY version DESC),'[]'::jsonb) INTO history FROM
 (SELECT version,created_at,created_by FROM public.akp_pro_drawing_versions WHERE photo_id=p_photo AND job_id=p_job ORDER BY version DESC LIMIT 100) x;
 RETURN jsonb_build_object('version',coalesce(item.version,0),'document',item.document,'history',history);
END $$;
CREATE FUNCTION public.akp_pro_drawing_save(p_job uuid,p_photo uuid,p_expected integer,p_client uuid,p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE prior public.akp_pro_drawing_versions;current_version integer;original_hash text;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 IF p_expected IS NULL OR p_expected<0 OR p_client IS NULL THEN RAISE EXCEPTION 'invalid save' USING ERRCODE='22023';END IF;
 PERFORM akp_pro_private.validate_drawing(p_document);
 PERFORM 1 FROM public.akp_photos WHERE id=p_photo AND job_id=p_job FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'missing photo' USING ERRCODE='P0002';END IF;
 SELECT sha256 INTO original_hash FROM public.akp_pro_photo_uploads WHERE id=p_photo AND job_id=p_job AND status='READY';
 IF original_hash IS NOT NULL AND original_hash IS DISTINCT FROM p_document->>'source_sha256' THEN RAISE EXCEPTION 'wrong original' USING ERRCODE='22023';END IF;
 SELECT * INTO prior FROM public.akp_pro_drawing_versions WHERE photo_id=p_photo AND client_id=p_client;
 IF prior.photo_id IS NOT NULL THEN
  IF prior.document IS DISTINCT FROM p_document THEN RAISE EXCEPTION 'retry mismatch' USING ERRCODE='40001';END IF;
  RETURN jsonb_build_object('version',prior.version);
 END IF;
 SELECT coalesce(max(version),0) INTO current_version FROM public.akp_pro_drawing_versions WHERE photo_id=p_photo;
 IF current_version<>p_expected THEN RAISE EXCEPTION 'drawing conflict' USING ERRCODE='40001';END IF;
 INSERT INTO public.akp_pro_drawing_versions(job_id,photo_id,version,client_id,document,created_by)
 VALUES(p_job,p_photo,current_version+1,p_client,p_document,auth.uid());
 RETURN jsonb_build_object('version',current_version+1);
END $$;
REVOKE ALL ON FUNCTION public.akp_pro_drawing_read(uuid,uuid,integer),public.akp_pro_drawing_save(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_pro_drawing_read(uuid,uuid,integer),public.akp_pro_drawing_save(uuid,uuid,integer,uuid,jsonb) TO authenticated;
COMMIT;
