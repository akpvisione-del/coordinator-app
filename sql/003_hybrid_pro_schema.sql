-- ==============================================================================
-- PROJEKT ARCHITEKTURY OPERACYJNEJ: AKP COMMANDER HYBRID PRO (Etap 07)
-- STATUS: DRAFT ARCHITEKTONICZNY.
-- ZASADA BEZPIECZEŃSTWA: NIE uruchamiać migracji bez pisemnego zatwierdzenia użytkownika!
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- KROK 1: Profil użytkownika i preferencje językowe (PL / UA / RU / EN)
-- ------------------------------------------------------------------------------
ALTER TABLE public.akp_profiles
  ADD COLUMN IF NOT EXISTS preferred_lang text DEFAULT 'pl' CHECK (preferred_lang IN ('pl', 'uk', 'ru', 'en')),
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.akp_profiles(user_id);

-- ------------------------------------------------------------------------------
-- KROK 2: Rozszerzenie akp_jobs o model kontekstowy (klient, kontakt, adres, statusy)
-- ------------------------------------------------------------------------------
ALTER TABLE public.akp_jobs 
  ADD COLUMN IF NOT EXISTS akp_id text,
  ADD COLUMN IF NOT EXISTS lm_number text,
  ADD COLUMN IF NOT EXISTS iproc_number text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_address text,
  -- Model kontekstowy: opcjonalne wyłączenia, ryzyka, blokady w JSONB (nieobowiązkowe przy zakładaniu)
  ADD COLUMN IF NOT EXISTS exclusions jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blockers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS risks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS next_action text,
  -- Zintegrowany model: Wycena -> BOM -> Harmonogram (JEDNO źródło prawdy)
  ADD COLUMN IF NOT EXISTS calculation_model jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS drive_folder_url text;

-- ------------------------------------------------------------------------------
-- KROK 3: System komunikacji operacyjnej przy zleceniu (Wiadomości / Pytania / Zadania)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.akp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.akp_jobs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.akp_profiles(user_id),
  kind text NOT NULL DEFAULT 'NOTE' CHECK (kind IN ('NOTE', 'QUESTION', 'TASK', 'ALERT', 'STATUS')),
  text text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'ACKNOWLEDGED')),
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.akp_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.akp_messages TO authenticated;

-- RLS Komunikacji:
CREATE POLICY coordinator_messages ON public.akp_messages FOR ALL TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator');

CREATE POLICY worker_messages ON public.akp_messages FOR ALL TO authenticated
  USING (
    (select auth.jwt()->'app_metadata'->>'akp_role')='worker'
    AND EXISTS (SELECT 1 FROM public.akp_assignments WHERE job_id = akp_messages.job_id AND worker_id = auth.uid() AND active = true)
  )
  WITH CHECK (
    (select auth.jwt()->'app_metadata'->>'akp_role')='worker'
    AND sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.akp_assignments WHERE job_id = akp_messages.job_id AND worker_id = auth.uid() AND active = true)
  );

-- ------------------------------------------------------------------------------
-- KROK 4: Zdjęcia dowodowe i protokoły terenowe (SOP AKP)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.akp_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.akp_jobs(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'DURING' CHECK (stage IN ('BEFORE', 'DURING', 'AFTER', 'DEFECT', 'PROTOCOL')),
  file_url text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES public.akp_profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.akp_photos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.akp_photos TO authenticated;

CREATE POLICY coordinator_photos ON public.akp_photos FOR ALL TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator');

CREATE POLICY worker_photos ON public.akp_photos FOR ALL TO authenticated
  USING (
    (select auth.jwt()->'app_metadata'->>'akp_role')='worker'
    AND EXISTS (SELECT 1 FROM public.akp_assignments WHERE job_id = akp_photos.job_id AND worker_id = auth.uid() AND active = true)
  )
  WITH CHECK (
    (select auth.jwt()->'app_metadata'->>'akp_role')='worker'
    AND uploaded_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.akp_assignments WHERE job_id = akp_photos.job_id AND worker_id = auth.uid() AND active = true)
  );

-- ------------------------------------------------------------------------------
-- KROK 5: Bezpieczne zaproszenia i tworzenie kont pracowników (Invite Tokens)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.akp_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'worker' CHECK (role IN ('worker', 'coordinator')),
  display_name text NOT NULL,
  phone text,
  created_by uuid REFERENCES public.akp_profiles(user_id),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.akp_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.akp_invites TO authenticated;

CREATE POLICY coordinator_invites ON public.akp_invites FOR ALL TO authenticated
  USING ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator')
  WITH CHECK ((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator');

COMMIT;
