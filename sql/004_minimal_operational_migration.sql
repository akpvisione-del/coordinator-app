-- ==============================================================================
-- AKP COMMANDER HYBRID PRO — ETAP 1: SKONSOLIDOWANA MIGRACJA SQL 004 (DEV DRAFT)
-- BAZA DOCELOWA: Supabase Staging (projekt: ttectcuirgdakjhpkkll)
-- STATUS: DRAFT AUDYTOWANY DO PRZEGLĄDU — NIE URUCHAMIAĆ BEZ ZGODY WŁAŚCICIELA!
-- ==============================================================================
-- 
-- HISTORIA POPRAWEK BEZPIECZEŃSTWA (FINALNE WYMAGANIA OPERACYJNE):
-- 1. akp_profiles:
--    - Ścisła blokada UPDATE dla montera: może modyfikować WYŁĄCZNIE preferred_lang oraz phone.
--    - Trigger akp_protect_profile_update() blokuje dla montera zmianę: role, is_active, user_id, 
--      invited_by, display_name ORAZ created_at.
--    - RLS SELECT: odpięty lub nieaktywny monter nie ma dostępu. Monter widzi wyłącznie swój profil
--      bez danych innych pracowników, także tych z tej samej brygady.
-- 2. akp_jobs:
--    - Kolumny operacyjne: akp_id, lm_number, iproc_number, client_name, client_phone, client_email, client_address.
--    - Kolumna due_date POZOSTAJE nienaruszona jako termin realizacji/wizyty zlecenia.
--    - RLS SELECT dla montera: wymaga AKTYWNEGO profilu (is_active = true) ORAZ aktywnego przydziału (active = true).
-- 3. akp_assignments:
--    - Klucz główny: PRIMARY KEY (job_id, worker_id) z obsługą wielu monterów na jednym zleceniu.
--    - RLS SELECT dla montera: widzi wyłącznie własne aktywne przydziały i tylko pod warunkiem aktywnego profilu.
-- 4. akp_reports:
--    - Ścisła ochrona procedury odbioru: monter może wstawić raport wyłącznie ze statusem 'SUBMITTED',
--      oraz z pustymi polami decyzyjnymi: reviewer_id IS NULL, reviewed_at IS NULL, review_note IS NULL.
--    - Brak uprawnień UPDATE i DELETE dla montera na tabeli raportów (raport stanowi niezmienny dowód).
--    - RLS SELECT dla montera: wyłącznie dla aktywnego konta i tylko własne raporty powiązane z aktywnym zleceniem.
-- 5. akp_photos:
--    - Relacja do zlecenia: job_id NOT NULL REFERENCES akp_jobs(id) ON DELETE RESTRICT (ochrona dowodów przed skasowaniem zlecenia).
--    - Relacja do raportu: report_id REFERENCES akp_reports(id) ON DELETE RESTRICT.
--    - Walidacja powiązania i ścieżki: trigger weryfikuje, że report_id należy do tego samego job_id,
--      oraz że storage_path rozpoczyna się od prefiksu {job_id}/.
--    - RLS SELECT dla montera: wymaga aktywnego konta oraz aktywnego przydziału do zlecenia.
--    - RLS INSERT: uploaded_by = auth.uid(), aktywne konto i aktywny przydział.
-- 6. Supabase Storage ('job-photos'):
--    - Prywatny bucket (public = false, limit 10MB, jpeg/png/webp/heic).
--    - Polityka ścieżki: pliki przechowywane w folderze o nazwie job_id: {job_id}/{worker_id}_{filename}.
--    - Natychmiastowe odebranie uprawnień: odpięcie montera (active = false) lub dezaktywacja konta natychmiast blokuje dostęp.
-- 7. Uprawnienia SQL (Zasada Najmniejszych Uprawnień):
--    - REVOKE TRUNCATE, DELETE ze wszystkich tabel dla ról anon i authenticated (tam gdzie zabronione).
--    - Pełna wymiana istniejących polityk PERMISSIVE na tabelach objętych migracją.
--    - Zapis historii zapewnia istniejąca funkcja akp_internal.log_change().
-- ==============================================================================

BEGIN;

-- Preflight: refuse unknown policy rather than silently dropping its permissions.
DO $$
DECLARE unexpected text;
BEGIN
  SELECT string_agg(format('%I.%I/%I',schemaname,tablename,policyname),', ')
    INTO unexpected FROM pg_policies
  WHERE schemaname='public' AND tablename IN
    ('akp_profiles','akp_jobs','akp_assignments','akp_checks','akp_reports','akp_photos','akp_job_financials')
    AND policyname NOT IN ('akp_jobs_ro','akp_jobs_create','akp_jobs_edit','akp_profiles_ro','akp_assignment_ro','akp_assignment_create','akp_assignment_edit','akp_assignment_remove','akp_checks_ro','akp_checks_create','akp_checks_edit','akp_reports_ro','akp_reports_create','akp_reports_edit','akp_finance_ro','akp_finance_create','akp_finance_edit','coordinator_profiles_all','worker_profiles_select','worker_update_own_profile','akp_profiles_select','akp_profiles_update','coordinator_jobs','worker_jobs','akp_jobs_select','coordinator_assignments','worker_assignments','akp_assignments_ro','coordinator_checks_select','worker_checks_select','worker_checks_insert','worker_checks_update','coordinator_financials','worker_financials','akp_job_financials_ro','coordinator_reports','worker_reports','worker_reports_insert','akp_reports_select','akp_reports_insert','coordinator_photos_all','worker_photos_select','worker_photos_insert','akp004_profiles_coord','akp004_profiles_self','akp004_profiles_update_self','akp004_jobs_coord','akp004_jobs_worker','akp004_assignments_coord','akp004_assignments_worker','akp004_checks_coord_read','akp004_checks_worker_read','akp004_checks_worker_insert','akp004_checks_worker_update','akp004_financials_coord','akp004_reports_coord','akp004_reports_worker_select','akp004_reports_worker_insert','akp004_photos_coord_read','akp004_photos_coord_insert','akp004_photos_worker_read','akp004_photos_worker_insert','akp004_storage_coord_read','akp004_storage_coord_insert','akp004_storage_worker_read','akp004_storage_worker_insert');
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'SQL004 NO-GO: unknown RLS policy: %',unexpected;
  END IF;
  SELECT string_agg(policyname, ', ') INTO unexpected
  FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname NOT IN ('coordinator_storage_all','worker_storage_select','worker_storage_insert',
      'akp004_storage_coord_read','akp004_storage_coord_insert','akp004_storage_worker_read','akp004_storage_worker_insert');
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'SQL004 NO-GO: unknown storage RLS policy: %',unexpected;
  END IF;
  -- Legacy history and source policy MUST be scoped to an active coordinator.
  -- Inspect their exact known policy names before replacing them.
  SELECT string_agg(format('%I.%I/%I',schemaname,tablename,policyname),', ')
  INTO unexpected FROM pg_policies
  WHERE schemaname='public' AND (
    (tablename='akp_audit' AND policyname<>'akp_audit_coordinator_read')
    OR (tablename='akp_job_sources' AND policyname<>'coordinator_sources')
  );
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'SQL004 NO-GO: unknown history/source RLS policy: %',unexpected;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='akp_audit'
      AND policyname='akp_audit_coordinator_read' AND cmd='SELECT'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='akp_job_sources'
      AND policyname='coordinator_sources' AND cmd='ALL'
  ) THEN
    RAISE EXCEPTION 'SQL004 NO-GO: expected history/source policy is absent or changed';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. PROFILE UŻYTKOWNIKÓW I KONTROLA KOLUMN (akp_profiles)
-- ------------------------------------------------------------------------------

-- 1.1. Rozszerzenie kolumn profilu
ALTER TABLE public.akp_profiles
  ADD COLUMN IF NOT EXISTS preferred_lang text DEFAULT 'pl',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.akp_profiles(user_id);
UPDATE public.akp_profiles SET is_active=true WHERE is_active IS NULL;
ALTER TABLE public.akp_profiles ALTER COLUMN is_active SET NOT NULL;

-- 1.2. Ograniczenie dozwolonych języków (pl, uk, ru, en)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'akp_profiles_preferred_lang_check'
  ) THEN
    ALTER TABLE public.akp_profiles 
      ADD CONSTRAINT akp_profiles_preferred_lang_check 
      CHECK (preferred_lang IN ('pl', 'uk', 'ru', 'en'));
  END IF;
END $$;

-- 1.3. Bezpieczna, przyszłościowa lista dozwolonych pól (allowlist).
-- SQL admin poza rolą authenticated zachowuje prawa konserwacyjne.
CREATE OR REPLACE FUNCTION public.akp_protect_profile_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF (SELECT auth.role()) = 'authenticated'
     AND (SELECT auth.jwt()->'app_metadata'->>'akp_role') IS DISTINCT FROM 'coordinator'
     AND (to_jsonb(NEW) - 'preferred_lang' - 'phone')
       IS DISTINCT FROM (to_jsonb(OLD) - 'preferred_lang' - 'phone')
  THEN
    RAISE EXCEPTION 'AKP: wolno edytować tylko phone i preferred_lang'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_akp_protect_profile_update ON public.akp_profiles;
CREATE TRIGGER trg_akp_protect_profile_update BEFORE UPDATE ON public.akp_profiles
FOR EACH ROW EXECUTE FUNCTION public.akp_protect_profile_update();

-- 1.4. Nie odwołujemy się do tabeli akp_profiles z jej RLS.
-- Podpisany JWT identyfikuje bieżącego użytkownika.
-- SECURITY DEFINER + search_path='' usuwa rekurencję RLS
-- profiles <-> assignments; wywołujący nie może pytać o cudzy profil.
CREATE OR REPLACE FUNCTION public.akp_worker_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT auth.role())='authenticated'
    AND (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.jwt()->'app_metadata'->>'akp_role')='worker'
    AND EXISTS (
      SELECT 1 FROM public.akp_profiles p
      WHERE p.user_id=(SELECT auth.uid()) AND p.role='worker' AND p.is_active IS TRUE
    );
$$;
CREATE OR REPLACE FUNCTION public.akp_worker_assigned(p_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.akp_worker_active()
    AND EXISTS (
      SELECT 1 FROM public.akp_assignments a
      WHERE a.job_id=p_job_id AND a.worker_id=(SELECT auth.uid())
        AND a.active IS TRUE
    );
$$;
REVOKE ALL ON FUNCTION public.akp_worker_active() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.akp_worker_assigned(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.akp_worker_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.akp_worker_assigned(uuid) TO authenticated;
-- SECURITY DEFINER checks only the signed-in coordinator's own active profile.
CREATE OR REPLACE FUNCTION public.akp_coordinator_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT (SELECT auth.role())='authenticated'
    AND (SELECT auth.uid()) IS NOT NULL
    AND (SELECT auth.jwt()->'app_metadata'->>'akp_role')='coordinator'
    AND EXISTS (
      SELECT 1 FROM public.akp_profiles p
      WHERE p.user_id=(SELECT auth.uid()) AND p.role='coordinator' AND p.is_active IS TRUE
    );
$$;
REVOKE ALL ON FUNCTION public.akp_coordinator_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.akp_coordinator_active() TO authenticated;

-- Polityki w jednym kompletnym bloku w sekcji 7.

-- ------------------------------------------------------------------------------
-- 2. DANE OPERACYJNE ZLECENIA I KLIENTA (akp_jobs)
-- ------------------------------------------------------------------------------
ALTER TABLE public.akp_jobs 
  ADD COLUMN IF NOT EXISTS akp_id text,
  ADD COLUMN IF NOT EXISTS lm_number text,
  ADD COLUMN IF NOT EXISTS iproc_number text,
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_address text;

CREATE INDEX IF NOT EXISTS idx_akp_jobs_reference ON public.akp_jobs(reference);
CREATE INDEX IF NOT EXISTS idx_akp_jobs_lm_number ON public.akp_jobs(lm_number) WHERE lm_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_akp_jobs_akp_id ON public.akp_jobs(akp_id) WHERE akp_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. OBSŁUGA WIELU MONTERÓW NA ZLECENIU (akp_assignments)
-- Migracja klucza głównego na PRIMARY KEY (job_id, worker_id)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_type = 'PRIMARY KEY'
      AND table_schema = 'public'
      AND table_name = 'akp_assignments'
      AND constraint_name = 'akp_assignments_pkey'
  ) THEN
    IF (
      SELECT string_agg(column_name,',' ORDER BY ordinal_position) FROM information_schema.key_column_usage
      WHERE table_schema = 'public'
        AND table_name = 'akp_assignments'
        AND constraint_name = 'akp_assignments_pkey'
    ) = 'job_id' THEN
      ALTER TABLE public.akp_assignments DROP CONSTRAINT akp_assignments_pkey;
      ALTER TABLE public.akp_assignments ADD PRIMARY KEY (job_id, worker_id);
    ELSIF (
      SELECT string_agg(column_name,',' ORDER BY ordinal_position)
      FROM information_schema.key_column_usage
      WHERE table_schema='public' AND table_name='akp_assignments'
        AND constraint_name='akp_assignments_pkey'
    ) IS DISTINCT FROM 'job_id,worker_id' THEN
      RAISE EXCEPTION 'SQL004 NO-GO: unknown assignment PK';
    END IF;
  ELSE
    ALTER TABLE public.akp_assignments ADD PRIMARY KEY (job_id, worker_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_akp_assignments_worker ON public.akp_assignments(worker_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_akp_assignments_job ON public.akp_assignments(job_id) WHERE active = true;

-- ------------------------------------------------------------------------------
-- 4. RAPORTY MONTERA I KONTROLA AKCEPTACJI (akp_reports)
-- ------------------------------------------------------------------------------

-- Raport montera może być tylko SUBMITTED, bez decyzji koordynatora.
CREATE OR REPLACE FUNCTION public.check_report_worker_submission()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE caller_role text;
BEGIN
  caller_role:=coalesce((SELECT auth.jwt()->'app_metadata'->>'akp_role'),'');
  IF (SELECT auth.role())='authenticated' AND caller_role <> 'coordinator' THEN
    IF caller_role <> 'worker' OR TG_OP <> 'INSERT'
       OR NEW.status IS DISTINCT FROM 'SUBMITTED'
       OR NEW.worker_id IS DISTINCT FROM (SELECT auth.uid())
       OR NEW.reviewer_id IS NOT NULL OR NEW.reviewed_at IS NOT NULL
       OR NEW.review_note IS NOT NULL
    THEN
      RAISE EXCEPTION 'AKP: pracownik nie może zatwierdzać raportów'
        USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_check_report_worker_submission ON public.akp_reports;
CREATE TRIGGER trg_check_report_worker_submission
BEFORE INSERT OR UPDATE ON public.akp_reports
FOR EACH ROW EXECUTE FUNCTION public.check_report_worker_submission();

-- ------------------------------------------------------------------------------
-- 5. TABELA ZDJĘĆ TERENOWYCH I PROTOKOŁÓW (akp_photos)
-- Ochrona materiału dowodowego: ON DELETE RESTRICT dla zlecenia
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.akp_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.akp_jobs(id) ON DELETE RESTRICT,
  report_id uuid REFERENCES public.akp_reports(id) ON DELETE RESTRICT,
  stage text NOT NULL DEFAULT 'DURING' CHECK (stage IN ('BEFORE', 'DURING', 'AFTER', 'DEFECT', 'PROTOCOL')),
  storage_path text NOT NULL, -- Ścieżka w buckecie: {job_id}/{worker_id}_{filename}
  caption text,
  file_size int,
  mime_type text,
  uploaded_by uuid REFERENCES public.akp_profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT akp_photos_storage_path_unique UNIQUE(storage_path)
);

CREATE INDEX IF NOT EXISTS idx_akp_photos_job ON public.akp_photos(job_id);
CREATE INDEX IF NOT EXISTS idx_akp_photos_report ON public.akp_photos(report_id) WHERE report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_akp_photos_uploaded_by ON public.akp_photos(uploaded_by);

-- 5.1. TRIGGER SPÓJNOŚCI ZDJĘĆ:
-- - Walidacja czy wskazany report_id rzeczywiście należy do wskazanego job_id
-- - Walidacja czy storage_path rozpoczyna się od prefiksu {job_id}/
CREATE OR REPLACE FUNCTION public.check_photo_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Weryfikacja zgodności raportu ze zleceniem
  IF NEW.report_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.akp_reports r
      WHERE r.id = NEW.report_id AND r.job_id = NEW.job_id
    ) THEN
      RAISE EXCEPTION 'Błąd integralności danych: Raport % nie należy do zlecenia %.', NEW.report_id, NEW.job_id;
    END IF;
  END IF;

  -- Weryfikacja ścieżki magazynu: musi rozpoczynać się od job_id/
  IF NOT (NEW.storage_path LIKE NEW.job_id::text || '/%') THEN
    RAISE EXCEPTION 'Błąd integralności ścieżki: Plik musi znajdować się w katalogu zlecenia (%/). Podano: %', NEW.job_id, NEW.storage_path;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_photo_integrity ON public.akp_photos;
CREATE TRIGGER trg_check_photo_integrity
  BEFORE INSERT OR UPDATE ON public.akp_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_photo_integrity();

-- ------------------------------------------------------------------------------
-- 6. PRYWATNY BUCKET SUPABASE STORAGE ('job-photos')
-- Limit: 10 MB, dozwolone typy obrazów, public = false
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-photos',
  'job-photos',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

-- ------------------------------------------------------------------------------
-- 7. STAGING RLS: pełna wymiana starych polityk PERMISSIVE.
-- 2026-10-11: znaleziono na staging także akp_jobs_create/edit,
-- akp_assignment_create/edit/remove oraz akp_checks_*.
-- Stare częściowe DROP POLICY nie usuwają tych reguł!
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname,tablename,policyname FROM pg_policies
    WHERE schemaname='public' AND tablename IN (
      'akp_profiles','akp_jobs','akp_assignments','akp_checks',
      'akp_reports','akp_photos','akp_job_financials'
    )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
  END LOOP;
END $$;
-- Preserve all history/source rows and triggers; replace ONLY the known JWT-only policies.
-- Otherwise an inactive coordinator could still query these tables directly via REST.
DROP POLICY IF EXISTS akp_audit_coordinator_read ON public.akp_audit;
DROP POLICY IF EXISTS coordinator_sources ON public.akp_job_sources;
CREATE POLICY akp_audit_coordinator_read ON public.akp_audit
  FOR SELECT TO authenticated USING (public.akp_coordinator_active());
CREATE POLICY coordinator_sources ON public.akp_job_sources
  FOR ALL TO authenticated USING (public.akp_coordinator_active())
  WITH CHECK (public.akp_coordinator_active());

ALTER TABLE public.akp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.akp_job_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY akp004_profiles_coord ON public.akp_profiles
FOR ALL TO authenticated
USING (public.akp_coordinator_active())
WITH CHECK (public.akp_coordinator_active());
-- Monter widzi wyłącznie siebie (nie wszystkich pracowników ani ich kont).
CREATE POLICY akp004_profiles_self ON public.akp_profiles
FOR SELECT TO authenticated
USING (public.akp_worker_active() AND user_id=(SELECT auth.uid()));
CREATE POLICY akp004_profiles_update_self ON public.akp_profiles
FOR UPDATE TO authenticated
USING (public.akp_worker_active() AND user_id=(SELECT auth.uid()))
WITH CHECK (public.akp_worker_active() AND user_id=(SELECT auth.uid()));

CREATE POLICY akp004_jobs_coord ON public.akp_jobs
FOR ALL TO authenticated
USING (public.akp_coordinator_active())
WITH CHECK (public.akp_coordinator_active());
CREATE POLICY akp004_jobs_worker ON public.akp_jobs
FOR SELECT TO authenticated
USING (public.akp_worker_assigned(id));

CREATE POLICY akp004_assignments_coord ON public.akp_assignments
FOR ALL TO authenticated
USING (public.akp_coordinator_active())
WITH CHECK (public.akp_coordinator_active());
CREATE POLICY akp004_assignments_worker ON public.akp_assignments
FOR SELECT TO authenticated
USING (public.akp_worker_active() AND worker_id=(SELECT auth.uid()) AND active IS TRUE);

CREATE POLICY akp004_checks_coord_read ON public.akp_checks
FOR SELECT TO authenticated
USING (public.akp_coordinator_active());
CREATE POLICY akp004_checks_worker_read ON public.akp_checks
FOR SELECT TO authenticated
USING (worker_id=(SELECT auth.uid()) AND public.akp_worker_assigned(job_id));
CREATE POLICY akp004_checks_worker_insert ON public.akp_checks
FOR INSERT TO authenticated
WITH CHECK (worker_id=(SELECT auth.uid()) AND public.akp_worker_assigned(job_id));
CREATE POLICY akp004_checks_worker_update ON public.akp_checks
FOR UPDATE TO authenticated
USING (worker_id=(SELECT auth.uid()) AND public.akp_worker_assigned(job_id))
WITH CHECK (worker_id=(SELECT auth.uid()) AND public.akp_worker_assigned(job_id));

CREATE POLICY akp004_financials_coord ON public.akp_job_financials
FOR ALL TO authenticated
USING (public.akp_coordinator_active())
WITH CHECK (public.akp_coordinator_active());

CREATE POLICY akp004_reports_coord ON public.akp_reports
FOR ALL TO authenticated
USING (public.akp_coordinator_active())
WITH CHECK (public.akp_coordinator_active());
CREATE POLICY akp004_reports_worker_select ON public.akp_reports
FOR SELECT TO authenticated
USING (worker_id=(SELECT auth.uid()) AND public.akp_worker_assigned(job_id));
CREATE POLICY akp004_reports_worker_insert ON public.akp_reports
FOR INSERT TO authenticated
WITH CHECK (
  worker_id=(SELECT auth.uid()) AND public.akp_worker_assigned(job_id)
  AND status='SUBMITTED' AND reviewer_id IS NULL
  AND reviewed_at IS NULL AND review_note IS NULL
);

CREATE POLICY akp004_photos_coord_read ON public.akp_photos
FOR SELECT TO authenticated
USING (public.akp_coordinator_active());
CREATE POLICY akp004_photos_coord_insert ON public.akp_photos
FOR INSERT TO authenticated
WITH CHECK (public.akp_coordinator_active());
CREATE POLICY akp004_photos_worker_read ON public.akp_photos
FOR SELECT TO authenticated
USING (public.akp_worker_assigned(job_id));
CREATE POLICY akp004_photos_worker_insert ON public.akp_photos
FOR INSERT TO authenticated
WITH CHECK (uploaded_by=(SELECT auth.uid()) AND public.akp_worker_assigned(job_id)
  AND split_part(storage_path,'/',2) LIKE ((SELECT auth.uid())::text || '!_%') ESCAPE '!'
  AND cardinality(string_to_array(storage_path,'/')) = 2);

-- Bucket prywatny; żadnych polityk anon ani dostępu do innego bucketu.
DROP POLICY IF EXISTS coordinator_storage_all ON storage.objects;
DROP POLICY IF EXISTS worker_storage_select ON storage.objects;
DROP POLICY IF EXISTS worker_storage_insert ON storage.objects;
DROP POLICY IF EXISTS akp004_storage_coord_read ON storage.objects;
DROP POLICY IF EXISTS akp004_storage_coord_insert ON storage.objects;
DROP POLICY IF EXISTS akp004_storage_worker_read ON storage.objects;
DROP POLICY IF EXISTS akp004_storage_worker_insert ON storage.objects;
CREATE POLICY akp004_storage_coord_read ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='job-photos' AND public.akp_coordinator_active());
CREATE POLICY akp004_storage_coord_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id='job-photos' AND public.akp_coordinator_active());
CREATE POLICY akp004_storage_worker_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id='job-photos' AND public.akp_worker_active()
  AND cardinality(storage.foldername(name)) = 1
  AND EXISTS (
    SELECT 1 FROM public.akp_assignments a
    WHERE a.job_id::text=(storage.foldername(name))[1]
      AND a.worker_id=(SELECT auth.uid()) AND a.active IS TRUE
  )
);
CREATE POLICY akp004_storage_worker_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='job-photos' AND public.akp_worker_active()
  AND cardinality(storage.foldername(name)) = 1
  AND owner_id=(SELECT auth.uid()::text)
  AND split_part(name,'/',2) LIKE ((SELECT auth.uid())::text || '!_%') ESCAPE '!'
  AND EXISTS (
    SELECT 1 FROM public.akp_assignments a
    WHERE a.job_id::text=(storage.foldername(name))[1]
      AND a.worker_id=(SELECT auth.uid()) AND a.active IS TRUE
  )
);

-- Historia: istniejące triggery akp_internal.log_change() pozostają aktywne.
-- Dodajemy tylko fotografię, bez kasowania istniejących zdarzeń.
DO $$
BEGIN
  IF to_regprocedure('akp_internal.log_change()') IS NULL THEN
    RAISE EXCEPTION 'Brak istniejącej funkcji audytu akp_internal.log_change()';
  END IF;
END $$;
DROP TRIGGER IF EXISTS akp_photos_audit ON public.akp_photos;
CREATE TRIGGER akp_photos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.akp_photos
FOR EACH ROW EXECUTE FUNCTION akp_internal.log_change();

-- 8. GRANTS/REVOKES: brak fizycznego DELETE, TRUNCATE i TRIGGER dla JWT.
-- Usuwanie pracownika z przydziału jest miękkie: active=false.
REVOKE ALL PRIVILEGES ON
  public.akp_profiles,public.akp_jobs,public.akp_assignments,
  public.akp_checks,public.akp_reports,public.akp_photos,
  public.akp_job_financials
FROM PUBLIC,anon,authenticated;
REVOKE TRUNCATE,TRIGGER,REFERENCES ON
  public.akp_audit,public.akp_job_sources
FROM PUBLIC,anon,authenticated;
GRANT SELECT,UPDATE ON public.akp_profiles TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.akp_jobs TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.akp_assignments TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.akp_checks TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.akp_reports TO authenticated;
GRANT SELECT,INSERT ON public.akp_photos TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.akp_job_financials TO authenticated;

-- Statusy: zachowaj historyczne statusy staging oraz przyjmuj standard v10.
-- Staging obecnie ogranicza statusy do 7 wartości, API obsługuje więcej.
ALTER TABLE public.akp_jobs DROP CONSTRAINT IF EXISTS akp_jobs_status_check;
ALTER TABLE public.akp_jobs ADD CONSTRAINT akp_jobs_status_check CHECK (
  status IN (
    'NOWE','POMIARY','PLANOWANE','REALIZACJA','SERWIS','WSTRZYMANE','ZAKONCZONE',
    'DO_KONTAKTU','DO_UMOWIENIA','UMOWIONE','POMIAR','DO_WYCENY',
    'WYCENA_W_TOKU','OCZEKUJE_NA_KLIENTA','OCZEKUJE_NA_MATERIAL',
    'OCZEKUJE_NA_DOSTAWE','DO_REALIZACJI','W_REALIZACJI','DO_ODBIORU',
    'DO_ROZLICZENIA','REKLAMACJA','ANULOWANE'
  )
);

COMMIT;

-- ==============================================================================
-- 9. Walidacja struktury: sql/004_verify_readonly.sql.
-- Testy RLS wymagają prawdziwych JWT coordinator/worker w staging.
-- Nie uruchomiono tej migracji ani testów integracyjnych.
-- Zakazane: ogłaszanie PASS na podstawie ignorowanych wyjątków w DO/EXCEPTION.
-- ==============================================================================
