-- REVIEW ONLY. Retains all materials and immutable quote references.
BEGIN;
REVOKE ALL ON FUNCTION public.akp_pro_material_read(uuid),public.akp_pro_material_save(uuid,uuid,integer,uuid,jsonb),public.akp_pro_material_status(uuid,uuid,integer,uuid,text) FROM authenticated;
REVOKE ALL ON public.akp_pro_materials FROM authenticated;
COMMIT;
