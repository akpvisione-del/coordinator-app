-- REVIEW ONLY: stop new audit collection and reads; keep all existing audit records.
BEGIN;
DROP TRIGGER akp_sprint_profile_audit ON public.akp_profiles;
DROP TRIGGER akp_sprint_assignment_audit ON public.akp_assignments;
REVOKE EXECUTE ON FUNCTION public.akp_team_history(uuid,uuid,bigint,int) FROM authenticated;
REVOKE SELECT ON public.akp_team_events FROM authenticated;
COMMIT;
