-- REVIEW ONLY. Requires quotes proposal / can_job. Never execute against production without approval.
-- Additive: existing akp_photos records and their metadata are not rewritten.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='akp_photos' AND column_name='storage_path') THEN
  RAISE EXCEPTION 'REVIEW BLOCKED: inspect actual akp_photos contract; storage_path is required. Do not run historical SQL004 blindly.';
 END IF;
END $$;
CREATE TABLE public.akp_pro_photo_uploads(
 id uuid PRIMARY KEY,job_id uuid NOT NULL REFERENCES public.akp_jobs(id),created_by uuid NOT NULL REFERENCES public.akp_profiles(user_id),
 storage_path text NOT NULL UNIQUE,mime_type text NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
 size integer NOT NULL CHECK(size BETWEEN 1 AND 3145728),sha256 text NOT NULL CHECK(sha256~'^[0-9a-f]{64}$'),
 request jsonb NOT NULL,status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','READY')),created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX akp_pro_photo_upload_job ON public.akp_pro_photo_uploads(job_id,status);
CREATE TABLE public.akp_pro_photo_meta_versions(
 photo_id uuid NOT NULL REFERENCES public.akp_photos(id),revision integer NOT NULL CHECK(revision>0),
 client_id uuid NOT NULL,caption text NOT NULL CHECK(length(caption)<=500),
 stage text NOT NULL CHECK(stage IN ('BEFORE','DURING','AFTER','DEFECT','PROTOCOL')),
 category text NOT NULL CHECK(category IN ('GENERAL','MEASUREMENT','PROGRESS','ISSUE','ACCEPTANCE')),
 created_by uuid NOT NULL REFERENCES public.akp_profiles(user_id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(photo_id,revision),UNIQUE(photo_id,client_id)
);
ALTER TABLE public.akp_pro_photo_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_pro_photo_meta_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.akp_pro_photo_uploads,public.akp_pro_photo_meta_versions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.akp_pro_photo_uploads,public.akp_pro_photo_meta_versions TO authenticated;
CREATE POLICY akp_pro_upload_ro ON public.akp_pro_photo_uploads FOR SELECT TO authenticated USING(akp_pro_private.can_job(job_id,false));
CREATE POLICY akp_pro_photo_meta_ro ON public.akp_pro_photo_meta_versions FOR SELECT TO authenticated USING(EXISTS(
 SELECT 1 FROM public.akp_photos p WHERE p.id=photo_id AND akp_pro_private.can_job(p.job_id,false)));
CREATE FUNCTION public.akp_pro_photo_prepare(p_job uuid,p_id uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE prior public.akp_pro_photo_uploads;extension text;object_path text;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR
 NOT p_data ?& ARRAY['id','mime_type','size','sha256','caption','stage','category'] OR
 EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) x WHERE x NOT IN ('id','mime_type','size','sha256','caption','stage','category')) OR
 p_data->>'id' IS DISTINCT FROM p_id::text OR
 jsonb_typeof(p_data->'mime_type')<>'string' OR p_data->>'mime_type' NOT IN ('image/jpeg','image/png','image/webp') OR
 jsonb_typeof(p_data->'size')<>'number' OR (p_data->>'size')!~'^[1-9][0-9]{0,6}$' OR (p_data->>'size')::integer>3145728 OR
 jsonb_typeof(p_data->'sha256')<>'string' OR (p_data->>'sha256')!~'^[0-9a-f]{64}$' OR
 jsonb_typeof(p_data->'caption')<>'string' OR length(p_data->>'caption')>500 OR
 jsonb_typeof(p_data->'stage')<>'string' OR p_data->>'stage' NOT IN ('BEFORE','DURING','AFTER','DEFECT','PROTOCOL') OR
 jsonb_typeof(p_data->'category')<>'string' OR p_data->>'category' NOT IN ('GENERAL','MEASUREMENT','PROGRESS','ISSUE','ACCEPTANCE') THEN RAISE EXCEPTION 'invalid photo' USING ERRCODE='22023';END IF;
 extension:=CASE p_data->>'mime_type' WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' ELSE 'webp' END;
 object_path:=p_job::text||'/'||auth.uid()::text||'_'||p_id::text||'.'||extension;
 PERFORM 1 FROM public.akp_jobs WHERE id=p_job FOR UPDATE;
 SELECT * INTO prior FROM public.akp_pro_photo_uploads WHERE id=p_id;
 IF prior.id IS NOT NULL THEN
  IF prior.job_id<>p_job OR prior.created_by<>auth.uid() OR prior.request IS DISTINCT FROM p_data THEN RAISE EXCEPTION 'retry mismatch' USING ERRCODE='40001';END IF;
 ELSE
  IF (SELECT count(*) FROM public.akp_pro_photo_uploads WHERE job_id=p_job AND created_by=auth.uid() AND status='PENDING')>=20 THEN RAISE EXCEPTION 'pending upload limit' USING ERRCODE='22023';END IF;
  INSERT INTO public.akp_pro_photo_uploads(id,job_id,created_by,storage_path,mime_type,size,sha256,request)
  VALUES(p_id,p_job,auth.uid(),object_path,p_data->>'mime_type',(p_data->>'size')::integer,p_data->>'sha256',p_data);
 END IF;
 RETURN jsonb_build_object('id',p_id,'status',coalesce(prior.status,'PENDING'));
END $$;
CREATE FUNCTION public.akp_pro_photo_slot(p_job uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item public.akp_pro_photo_uploads;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 SELECT * INTO item FROM public.akp_pro_photo_uploads WHERE id=p_id AND job_id=p_job AND created_by=auth.uid();
 IF item.id IS NULL THEN RAISE EXCEPTION 'slot missing' USING ERRCODE='P0002';END IF;
 RETURN jsonb_build_object('storage_path',item.storage_path,'mime_type',item.mime_type,'size',item.size,'sha256',item.sha256,'status',item.status);
END $$;
CREATE FUNCTION public.akp_pro_photo_complete(p_job uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item public.akp_pro_photo_uploads;
BEGIN
 PERFORM public.akp_pro_photo_slot(p_job,p_id);
 SELECT * INTO item FROM public.akp_pro_photo_uploads WHERE id=p_id FOR UPDATE;
 IF item.status='READY' THEN RETURN jsonb_build_object('id',p_id,'replayed',true);END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='akp-job-media' AND name=item.storage_path) THEN RAISE EXCEPTION 'file missing' USING ERRCODE='P0002';END IF;
 INSERT INTO public.akp_photos(id,job_id,stage,storage_path,caption,uploaded_by)
 VALUES(p_id,p_job,item.request->>'stage',item.storage_path,item.request->>'caption',auth.uid());
 INSERT INTO public.akp_pro_photo_meta_versions(photo_id,revision,client_id,caption,stage,category,created_by)
 VALUES(p_id,1,p_id,item.request->>'caption',item.request->>'stage',item.request->>'category',auth.uid());
 UPDATE public.akp_pro_photo_uploads SET status='READY' WHERE id=p_id;
 RETURN jsonb_build_object('id',p_id,'replayed',false);
END $$;
CREATE FUNCTION public.akp_pro_photo_list(p_job uuid,p_before uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE items jsonb;cursor_time timestamptz;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 IF p_before IS NOT NULL THEN
  SELECT created_at INTO cursor_time FROM public.akp_photos WHERE id=p_before AND job_id=p_job;
  IF cursor_time IS NULL THEN RAISE EXCEPTION 'invalid cursor' USING ERRCODE='22023';END IF;
 END IF;
 SELECT coalesce(jsonb_agg(x.item ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb) INTO items FROM (
 SELECT p.created_at,p.id,jsonb_build_object('id',p.id,'job_id',p.job_id,'caption',coalesce(m.caption,p.caption,''),'stage',coalesce(m.stage,p.stage),
 'category',coalesce(m.category,'GENERAL'),'meta_revision',coalesce(m.revision,0),'uploaded_by',p.uploaded_by,'created_at',p.created_at,
 'file_state',CASE WHEN u.status='READY' THEN 'READY' ELSE 'LEGACY' END) AS item
 FROM public.akp_photos p LEFT JOIN LATERAL (SELECT * FROM public.akp_pro_photo_meta_versions m WHERE m.photo_id=p.id ORDER BY revision DESC LIMIT 1) m ON true
 LEFT JOIN public.akp_pro_photo_uploads u ON u.id=p.id AND u.job_id=p.job_id
 WHERE p.job_id=p_job AND (p_before IS NULL OR (p.created_at,p.id)<(cursor_time,p_before)) ORDER BY p.created_at DESC,p.id DESC LIMIT 51) x;
 RETURN jsonb_build_object('items',(SELECT coalesce(jsonb_agg(value),'[]'::jsonb) FROM jsonb_array_elements(items) WITH ORDINALITY e WHERE ordinality<=50),
 'next_before',CASE WHEN jsonb_array_length(items)>50 THEN items->49->>'id' ELSE NULL END);
END $$;
CREATE FUNCTION public.akp_pro_photo_file(p_job uuid,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE photo public.akp_photos;bucket text;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 SELECT * INTO photo FROM public.akp_photos WHERE id=p_id AND job_id=p_job;
 IF photo.id IS NULL THEN RAISE EXCEPTION 'photo missing' USING ERRCODE='P0002';END IF;
 SELECT 'akp-job-media' INTO bucket FROM public.akp_pro_photo_uploads WHERE id=p_id AND job_id=p_job AND status='READY';
 RETURN jsonb_build_object('storage_path',photo.storage_path,'bucket',coalesce(bucket,'job-photos'));
END $$;
CREATE FUNCTION public.akp_pro_photo_meta_save(p_job uuid,p_id uuid,p_expected integer,p_client uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE photo public.akp_photos;previous public.akp_pro_photo_meta_versions;current_revision integer;
BEGIN
 IF NOT akp_pro_private.can_job(p_job,false) THEN RAISE EXCEPTION 'denied' USING ERRCODE='42501';END IF;
 SELECT * INTO photo FROM public.akp_photos WHERE id=p_id AND job_id=p_job FOR UPDATE;
 IF photo.id IS NULL THEN RAISE EXCEPTION 'missing' USING ERRCODE='P0002';END IF;
 IF NOT akp_pro_private.can_job(p_job,true) AND photo.uploaded_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'owner only' USING ERRCODE='42501';END IF;
 IF p_expected IS NULL OR p_expected<0 OR p_client IS NULL OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR
 NOT p_data ?& ARRAY['caption','stage','category'] OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) x WHERE x NOT IN ('caption','stage','category')) OR
 jsonb_typeof(p_data->'caption')<>'string' OR length(p_data->>'caption')>500 OR
 jsonb_typeof(p_data->'stage')<>'string' OR p_data->>'stage' NOT IN ('BEFORE','DURING','AFTER','DEFECT','PROTOCOL') OR
 jsonb_typeof(p_data->'category')<>'string' OR p_data->>'category' NOT IN ('GENERAL','MEASUREMENT','PROGRESS','ISSUE','ACCEPTANCE') THEN RAISE EXCEPTION 'invalid metadata' USING ERRCODE='22023';END IF;
 SELECT * INTO previous FROM public.akp_pro_photo_meta_versions WHERE photo_id=p_id AND client_id=p_client;
 IF previous.photo_id IS NOT NULL THEN
  IF jsonb_build_object('caption',previous.caption,'stage',previous.stage,'category',previous.category) IS DISTINCT FROM p_data THEN RAISE EXCEPTION 'retry mismatch' USING ERRCODE='40001';END IF;
  RETURN jsonb_build_object('revision',previous.revision);
 END IF;
 SELECT coalesce(max(revision),0) INTO current_revision FROM public.akp_pro_photo_meta_versions WHERE photo_id=p_id;
 IF current_revision<>p_expected THEN RAISE EXCEPTION 'metadata conflict' USING ERRCODE='40001';END IF;
 INSERT INTO public.akp_pro_photo_meta_versions(photo_id,revision,client_id,caption,stage,category,created_by)
 VALUES(p_id,current_revision+1,p_client,p_data->>'caption',p_data->>'stage',p_data->>'category',auth.uid());
 RETURN jsonb_build_object('revision',current_revision+1);
END $$;
-- Separate private bucket. Restrictive guards defeat broad legacy storage policies ONLY for this bucket.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('akp-job-media','akp-job-media',false,3145728,ARRAY['image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage.buckets WHERE id='akp-job-media' AND public=false AND file_size_limit=3145728 AND allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp']) THEN RAISE EXCEPTION 'bucket contract mismatch';END IF;
END $$;
CREATE FUNCTION akp_pro_private.storage_access(object_name text,upload boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.akp_pro_photo_uploads u WHERE u.storage_path=object_name
 AND akp_pro_private.can_job(u.job_id,false) AND (NOT upload OR (u.status='PENDING' AND u.created_by=auth.uid())));
$$;
REVOKE ALL ON FUNCTION akp_pro_private.storage_access(text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION akp_pro_private.storage_access(text,boolean) TO authenticated;
CREATE POLICY akp_pro_storage_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='akp-job-media' AND akp_pro_private.storage_access(name,false));
CREATE POLICY akp_pro_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='akp-job-media' AND akp_pro_private.storage_access(name,true));
CREATE POLICY akp_pro_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING(bucket_id<>'akp-job-media' OR akp_pro_private.storage_access(name,false));
CREATE POLICY akp_pro_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'akp-job-media' OR akp_pro_private.storage_access(name,true));
CREATE POLICY akp_pro_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'akp-job-media') WITH CHECK(bucket_id<>'akp-job-media');
CREATE POLICY akp_pro_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING(bucket_id<>'akp-job-media');
CREATE POLICY akp_pro_storage_anon_guard ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'akp-job-media') WITH CHECK(bucket_id<>'akp-job-media');
GRANT SELECT,INSERT ON storage.objects TO authenticated;
REVOKE ALL ON FUNCTION public.akp_pro_photo_prepare(uuid,uuid,jsonb),public.akp_pro_photo_slot(uuid,uuid),public.akp_pro_photo_complete(uuid,uuid),public.akp_pro_photo_list(uuid,uuid),public.akp_pro_photo_file(uuid,uuid),public.akp_pro_photo_meta_save(uuid,uuid,integer,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_pro_photo_prepare(uuid,uuid,jsonb),public.akp_pro_photo_slot(uuid,uuid),public.akp_pro_photo_complete(uuid,uuid),public.akp_pro_photo_list(uuid,uuid),public.akp_pro_photo_file(uuid,uuid),public.akp_pro_photo_meta_save(uuid,uuid,integer,uuid,jsonb) TO authenticated;
COMMIT;
