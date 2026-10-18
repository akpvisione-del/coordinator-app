-- REVIEW ONLY: disable chat without deleting conversations, messages, profiles or history.
-- Re-enable only after a separate review; never roll back applied worker security.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.akp_chat_recipients(),public.akp_chat_create_thread(uuid,uuid),public.akp_chat_send(uuid,uuid,text,text,uuid),public.akp_chat_messages_list(uuid,bigint,text,int),public.akp_chat_mark_read(uuid,uuid),public.akp_chat_threads_list(int,int) FROM authenticated;
REVOKE SELECT ON public.akp_chat_threads,public.akp_chat_members,public.akp_chat_messages FROM authenticated;
COMMIT;
