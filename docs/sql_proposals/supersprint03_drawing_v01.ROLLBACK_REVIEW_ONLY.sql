-- REVIEW ONLY. Originals, measurements and every saved version survive rollback.
BEGIN;
REVOKE ALL ON FUNCTION public.akp_pro_drawing_read(uuid,uuid,integer),public.akp_pro_drawing_save(uuid,uuid,integer,uuid,jsonb) FROM authenticated;
REVOKE ALL ON public.akp_pro_drawing_versions FROM authenticated;
COMMIT;
