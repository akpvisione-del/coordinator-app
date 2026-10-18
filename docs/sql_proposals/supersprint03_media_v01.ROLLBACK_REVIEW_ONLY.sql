-- REVIEW ONLY. Preserve photographs, bucket, metadata and reservations. Do not drop restrictive guards:
-- broad historical permissive policies could otherwise grant access to retained media.
BEGIN;
REVOKE ALL ON FUNCTION public.akp_pro_photo_prepare(uuid,uuid,jsonb),public.akp_pro_photo_slot(uuid,uuid),public.akp_pro_photo_complete(uuid,uuid),public.akp_pro_photo_list(uuid,uuid),public.akp_pro_photo_file(uuid,uuid),public.akp_pro_photo_meta_save(uuid,uuid,integer,uuid,jsonb) FROM authenticated;
REVOKE ALL ON public.akp_pro_photo_uploads,public.akp_pro_photo_meta_versions FROM authenticated;
DROP POLICY akp_pro_storage_select ON storage.objects;
DROP POLICY akp_pro_storage_insert ON storage.objects;
CREATE OR REPLACE FUNCTION akp_pro_private.storage_access(object_name text,upload boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT false $$;
COMMIT;
