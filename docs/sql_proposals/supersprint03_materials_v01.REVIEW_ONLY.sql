-- REVIEW ONLY. Requires quotes proposal. No production execution authorized.
BEGIN;
CREATE TABLE public.akp_pro_materials(
 id uuid PRIMARY KEY,job_id uuid NOT NULL REFERENCES public.akp_jobs(id),
 name text,quantity numeric(12,3),unit text,
 quote_version integer,quote_variant uuid,quote_line uuid,
 status text NOT NULL CHECK(status IN ('TO_BUY','ORDERED','PURCHASED')),
 supplier text NOT NULL DEFAULT '' CHECK(length(supplier)<=160),notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),last_client uuid NOT NULL,last_payload jsonb NOT NULL,
 updated_by uuid NOT NULL REFERENCES public.akp_profiles(user_id),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(job_id,quote_version) REFERENCES public.akp_pro_quote_versions(job_id,version),
 CONSTRAINT material_source CHECK((quote_version IS NOT NULL AND quote_variant IS NOT NULL AND quote_line IS NOT NULL AND name IS NULL AND quantity IS NULL AND unit IS NULL)
 OR (quote_version IS NULL AND quote_variant IS NULL AND quote_line IS NULL AND name IS NOT NULL AND quantity IS NOT NULL AND unit IS NOT NULL AND length(btrim(name)) BETWEEN 1 AND 200 AND quantity BETWEEN 0 AND 1000000 AND unit IN ('szt.','m','m²','m³','kg','l','kpl.','godz.')))
);
CREATE INDEX akp_pro_material_job ON public.akp_pro_materials(job_id,updated_at DESC);
CREATE UNIQUE INDEX akp_pro_material_quote_once ON public.akp_pro_materials(job_id,quote_version,quote_variant,quote_line) WHERE quote_version IS NOT NULL;
ALTER TABLE public.akp_pro_materials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.akp_pro_materials FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.akp_pro_materials TO authenticated;
CREATE POLICY akp_pro_materials_ro ON public.akp_pro_materials FOR SELECT TO authenticated USING(akp_pro_private.can_job(job_id,true));
CREATE FUNCTION public.akp_pro_material_read(p_job uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;coord boolean;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 coord:=akp_pro_private.can_job(p_job,true);
 -- A deliberately constructed operational projection. Never select a quote document into worker response.
 SELECT coalesce(jsonb_agg(x.item ORDER BY x.updated_at DESC),'[]'::jsonb) INTO result FROM (
 SELECT m.updated_at,jsonb_build_object('id',m.id,'revision',m.revision,'name',coalesce(m.name,line->>'name'),
 'quantity',coalesce(m.quantity::text,line->>'quantity'),'unit',coalesce(m.unit,line->>'unit'),
 'status',m.status,'supplier',m.supplier,'notes',m.notes,'updated_at',m.updated_at)
 || CASE WHEN coord THEN jsonb_build_object('quote_version',m.quote_version,'quote_variant',m.quote_variant,'quote_line',m.quote_line) ELSE '{}'::jsonb END AS item
 FROM public.akp_pro_materials m
 LEFT JOIN public.akp_pro_quote_versions q ON q.job_id=m.job_id AND q.version=m.quote_version
 LEFT JOIN LATERAL (SELECT l AS line FROM jsonb_array_elements(q.document->'variants') v,
 jsonb_array_elements(v->'lines') l WHERE lower(v->>'id')=m.quote_variant::text AND lower(l->>'id')=m.quote_line::text LIMIT 1) source ON true
 WHERE m.job_id=p_job LIMIT 500) x;
 RETURN jsonb_build_object('items',result);
END $$;
CREATE FUNCTION public.akp_pro_material_save(p_job uuid,p_id uuid,p_expected integer,p_client uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE prior public.akp_pro_materials;source jsonb;qv integer;qvariant uuid;qline uuid;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,true) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_client IS NULL OR p_expected IS NULL OR p_expected<0 OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR
 NOT p_data ?& ARRAY['name','quantity','unit','quote_version','quote_variant','quote_line','status','supplier','notes'] OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) x WHERE x NOT IN ('name','quantity','unit','quote_version','quote_variant','quote_line','status','supplier','notes')) OR
 jsonb_typeof(p_data->'status')<>'string' OR p_data->>'status' NOT IN ('TO_BUY','ORDERED','PURCHASED') OR
 jsonb_typeof(p_data->'supplier')<>'string' OR length(p_data->>'supplier')>160 OR
 jsonb_typeof(p_data->'notes')<>'string' OR length(p_data->>'notes')>1000 THEN RAISE EXCEPTION 'invalid material' USING ERRCODE='22023';END IF;
 IF p_data->'quote_version'<>'null'::jsonb THEN
  IF jsonb_typeof(p_data->'quote_version')<>'number' OR (p_data->>'quote_version')!~'^[1-9][0-9]{0,8}$' OR
  p_data->'name'<>'null'::jsonb OR p_data->'quantity'<>'null'::jsonb OR p_data->'unit'<>'null'::jsonb THEN RAISE EXCEPTION 'duplicated source' USING ERRCODE='22023';END IF;
  qv:=(p_data->>'quote_version')::integer;qvariant:=(p_data->>'quote_variant')::uuid;qline:=(p_data->>'quote_line')::uuid;
  SELECT l INTO source FROM public.akp_pro_quote_versions q,jsonb_array_elements(q.document->'variants') v,jsonb_array_elements(v->'lines') l
   WHERE q.job_id=p_job AND q.version=qv AND lower(v->>'id')=qvariant::text AND lower(l->>'id')=qline::text;
  IF source IS NULL OR qvariant IS NULL OR qline IS NULL THEN RAISE EXCEPTION 'source missing' USING ERRCODE='22023';END IF;
 ELSE
  IF p_data->'quote_variant'<>'null'::jsonb OR p_data->'quote_line'<>'null'::jsonb OR
   jsonb_typeof(p_data->'name')<>'string' OR length(btrim(p_data->>'name')) NOT BETWEEN 1 AND 200 OR
   jsonb_typeof(p_data->'quantity')<>'string' OR (p_data->>'quantity')!~'^(0|[1-9][0-9]{0,6})(\.[0-9]{1,3})?$' OR (p_data->>'quantity')::numeric>1000000 OR
   jsonb_typeof(p_data->'unit')<>'string' OR p_data->>'unit' NOT IN ('szt.','m','m²','m³','kg','l','kpl.','godz.') THEN RAISE EXCEPTION 'invalid manual source' USING ERRCODE='22023';END IF;
 END IF;
 PERFORM 1 FROM public.akp_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO prior FROM public.akp_pro_materials WHERE id=p_id AND job_id=p_job;
 IF prior.last_client=p_client THEN
  IF prior.last_payload IS DISTINCT FROM p_data THEN RAISE EXCEPTION 'retry mismatch' USING ERRCODE='40001';END IF;
  RETURN jsonb_build_object('revision',prior.revision);
 END IF;
 IF coalesce(prior.revision,0)<>p_expected THEN RAISE EXCEPTION 'conflict' USING ERRCODE='40001';END IF;
 IF prior.id IS NULL AND (SELECT count(*) FROM public.akp_pro_materials WHERE job_id=p_job)>=500 THEN RAISE EXCEPTION 'material limit' USING ERRCODE='22023';END IF;
 INSERT INTO public.akp_pro_materials(id,job_id,name,quantity,unit,quote_version,quote_variant,quote_line,status,supplier,notes,last_client,last_payload,updated_by)
 VALUES(p_id,p_job,p_data->>'name',(p_data->>'quantity')::numeric,p_data->>'unit',qv,qvariant,qline,p_data->>'status',p_data->>'supplier',p_data->>'notes',p_client,p_data,auth.uid())
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,quantity=excluded.quantity,unit=excluded.unit,quote_version=excluded.quote_version,quote_variant=excluded.quote_variant,quote_line=excluded.quote_line,
 status=excluded.status,supplier=excluded.supplier,notes=excluded.notes,last_client=p_client,last_payload=p_data,revision=akp_pro_materials.revision+1,updated_by=auth.uid(),updated_at=clock_timestamp()
 WHERE akp_pro_materials.job_id=p_job;
 IF NOT FOUND THEN RAISE EXCEPTION 'conflict' USING ERRCODE='40001';END IF;
 RETURN jsonb_build_object('revision',p_expected+1);
END $$;
CREATE FUNCTION public.akp_pro_material_status(p_job uuid,p_id uuid,p_expected integer,p_client uuid,p_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE prior public.akp_pro_materials;payload jsonb;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_client IS NULL OR p_expected IS NULL OR p_expected<1 OR p_status IS NULL OR p_status NOT IN ('TO_BUY','ORDERED','PURCHASED') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE='22023';END IF;
 SELECT * INTO prior FROM public.akp_pro_materials WHERE job_id=p_job AND id=p_id FOR UPDATE;
 IF prior.id IS NULL THEN RAISE EXCEPTION 'missing' USING ERRCODE='P0002';END IF;
 payload:=jsonb_build_object('status',p_status);
 IF prior.last_client=p_client AND prior.last_payload=payload THEN RETURN jsonb_build_object('revision',prior.revision);END IF;
 IF prior.last_client=p_client OR prior.revision<>p_expected THEN RAISE EXCEPTION 'conflict' USING ERRCODE='40001';END IF;
 UPDATE public.akp_pro_materials SET status=p_status,revision=revision+1,last_client=p_client,last_payload=payload,updated_by=auth.uid(),updated_at=clock_timestamp() WHERE id=p_id;
 RETURN jsonb_build_object('revision',p_expected+1);
END $$;
REVOKE ALL ON FUNCTION public.akp_pro_material_read(uuid),public.akp_pro_material_save(uuid,uuid,integer,uuid,jsonb),public.akp_pro_material_status(uuid,uuid,integer,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_pro_material_read(uuid),public.akp_pro_material_save(uuid,uuid,integer,uuid,jsonb),public.akp_pro_material_status(uuid,uuid,integer,uuid,text) TO authenticated;
COMMIT;
