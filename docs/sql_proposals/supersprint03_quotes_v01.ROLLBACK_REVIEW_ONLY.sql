-- REVIEW ONLY. Disable API and data access; retain every quote and version.
BEGIN;
REVOKE ALL ON FUNCTION public.akp_pro_quote_read(uuid,integer),public.akp_pro_quote_save(uuid,integer,uuid,jsonb) FROM authenticated;
REVOKE ALL ON public.akp_pro_quote_versions FROM authenticated;
-- Keep shared can_job: materials, media and drawings use it too.
COMMIT;
