# AKP COMMANDER — F03 API Contract + STAGING GO/NO-GO (2026-10-13)

**Źródła:** bezpośrednie odczyty metadanych Supabase staging `ttectcuirgdakjhpkkll` i plików aktualnej gałęzi GitHub DEV `merge/f01-f02-20261011`. **Nie wykonywano SQL, nie zmieniano Supabase ani produkcji.**

## 1. Potwierdzony aktualny stan staging

- Supabase projekt `AKP COMMANDER staging`: `ACTIVE_HEALTHY` w `eu-west-1`.
- Dokładnie **8 tabel public**; RLS włączone dla każdej: `akp_profiles` (1 rekord), `akp_jobs` (16), `akp_job_sources` (16), `akp_audit` (16), `akp_assignments`, `akp_checks`, `akp_job_financials`, `akp_reports` (po 0).
- 3 migracje: `20261010092620 akp_commander_initial`, `20261010092644 restrict_auto_rls_trigger_execution`, `20261010102349 google_source_import`.
- **SQL 004 nie jest zastosowany.** Brak tabeli `akp_photos`.
- `akp_assignments` ma tylko `PRIMARY KEY(job_id)`, co obecnie blokuje przypisanie więcej niż jednego pracownika na zlecenie. SQL004 zakłada `PRIMARY KEY(job_id,worker_id)`.
- `akp_jobs` obecnie ma: `id, reference, title, location, due_date, status, priority, instructions, created_at, updated_at`. Backend F02 dodatkowo odczytuje `akp_id, lm_number, iproc_number, client_name, client_phone, client_email, client_address`; bez SQL004 prawdziwa lista / szczegóły mogą kończyć się błędem API.
- `akp_profiles` ma obecnie tylko `user_id, display_name, role, created_at`. Backend oczekuje m.in. `is_active, phone, preferred_lang`. Bez SQL004 logowanie jest zablokowane (fail-closed), nie należy obchodzić.
- `akp_jobs.status` w staging dopuszcza tylko 7 starych wartości; frontend/backend F02 mają znacznie szerszy zbiór. SQL004 aktualizuje ograniczenie, ale nie jest wdrożony.
- Czy istnieje pełny backup oraz czy produkcja `akp.wtf` nie korzysta z `ttectcuirgdakjhpkkll`: **NIEPOTWIERDZONE**. Eksport 4 niepustych tabel do CSV = częściowa kopia danych, nie kopia schematu/Auth/Storage.

## 2. Backend F02 — niezmienny kontrakt dla Gemini F03

- `GET /api/me` — zalogowany użytkownik (`role: coordinator|worker`, UUID, display).
- `GET /api/jobs` — `{items:[...],total:N}`, data `due` jest mapowana na `due_date` zależnie od endpointu; nie zgadywać!
- `GET /api/jobs/:uuid` — `{job:{...}}`, m.in. `assignees:[UUID]`, `photos`, `checklist`.
- `PATCH /api/jobs/:uuid` (TYLKO koordynator) — pola `title,reference,location,due_date,status,priority,instructions,akp_id,lm_number,iproc_number,client_name,client_phone,client_email,client_address`. Limit `instructions` **2500**. Konflikt referencji **409**, walidacja **422**.
- `GET /api/team` (koordynator) — `{items:[{id:UUID,display,role}]}`.
- `POST /api/jobs/:uuid/assign` z `{worker: UUID}` — przydział montera; selektywne odpięcie `{action:'unassign',worker:UUID}`. To **nie** jest `{pracownik:...}` ani `{akcja:'anuluj przypisanie'}`.
- `PATCH /api/jobs/:uuid/checklist` — `{index:integer,checked:boolean}`, tylko przypisany monter.
- `POST /api/jobs/:uuid/reports` — `{idempotencyKey,note,issue}`, tylko przypisany monter.
- `POST /api/jobs/:uuid/photos` — **tylko metadata**, nie wysyła binarnego pliku do Storage! Lokalny podgląd zdjęcia nie oznacza, że zdjęcie zapisano w chmurze.
- `PATCH /api/jobs/:uuid/finance` (koordynator), `GET /api/dashboard`, `GET /api/audit`, `GET /api/sources`, `POST /api/google/sync` (koordynator).
- Mutacje wymagają prawdziwej sesji Supabase Auth z uprawnieniami i nagłówka CSRF `X-AKP-Request: commander-v10`; Netlify wymaga dokładnego `APP_ORIGIN`. Nie wolno budować fałszywego logowania lub pomijać RLS. Kwoty tylko dla koordynatora.

## 3. Odbiór F03 od Gemini

1. ZIP / kompletny eksport źródeł — **bez sekretów** i bez nadpisywania nowszego backendu/SQL.
2. Lista dokładnie zmienionych plików: F03 dopuszcza wyłącznie interfejs `public/app.js`, `public/styles.css`, `public/index.html`, ewentualnie konieczne pomocnicze zasoby `public/` po audycie.
3. Filtry i wyszukiwanie po LM/AKP, statusach i terminach; bez utraty istniejących ekranów F01/F02.
4. Zakładki karty zlecenia nie mogą obiecywać trwałego zapisu bez istniejącego endpointu. Wyceny/szkice oznaczać `w przygotowaniu` jeśli brak API.
5. Nie mieszać danych demonstracyjnych z prawdziwymi zleceniami, nie wywoływać produkcji z podglądu DEV.
6. Po imporcie: `npm run check`, `npm test`, parser SQL004, kontrola mobilna 360/390/430 px, smoke testy osobno koordynator i monter, kontrola braku wycieku finansów.
7. PR na nowej odrębnej gałęzi DEV, bez automatycznego merge do main i bez publikacji.

## 4. Najkrótsza droga do uruchomienia

**A. Już teraz:** odrębny, bezpieczny podgląd demo HTML/Netlify, bez wrażliwych danych i bez prawdziwej bazy.

**B. Prawdziwy staging:** sprawdzenie izolacji PROD vs staging, **kompletna odtwarzalna kopia** Supabase (schemat, Auth, dane; Storage osobno) + formalna bramka GO, dopiero potem osobna zgoda na SQL004.

**C. Po migracji:** sprawdzenie polityk RLS, użytkowników/aktywności `app_metadata`, koordynatora i montera, przypisanie wielu monterów, edycja/409, fotografie (odróżnić metadane od przesyłu plików), audit i wyceny. Bez dotykania `akp.wtf`, zanim etap staging nie zostanie odebrany.

**D. Hosting:** gdy właściciel zatwierdzi publikację, stworzyć osobną izolowaną witrynę TEST, ustawić tylko dedykowane `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` i właściwy `APP_ORIGIN`. Nie podłączać domeny produkcyjnej.

### Decyzja operacyjna

**GO:** rozwój F03 UI, audyt read-only, QA, demonstracyjny podgląd.

**NO-GO:** SQL004, publikacja produkcyjna, zmiany danych staging oraz automatyczne synchronizacje z Gemini.

**Uwagi:** Powyższe dotyczy rzeczywistego backendu F02, nie kodu symulacyjnego podglądu HTML. GitHub Actions ostatnio potwierdził **48/48 PASS** na commicie `7a13d14`; nowsze commity lub F03 wymagają ponownego sprawdzenia.
