# AKP Commander Hybrid Pro — ETAP 1: audyt RLS 004 i plan migracji

Data przeglądu: 2026-10-11. Status: **DEV ONLY / NIE WDRAŻAĆ BEZ ZGODY**.

## Zakres i źródła

- Prywatne repozytorium: `akpvisione-del/akp-commander-hybrid-pro-dev`, branch `main`.
- Odczyty **wyłącznie SELECT** z rzeczywistego Supabase staging `ttectcuirgdakjhpkkll`: `pg_policies`, `information_schema.columns`, `pg_constraint`, `information_schema.table_privileges`, `storage.buckets`.
- Kontrola GitHub: `akpvisione-del/coordinator-app`, branch `akp-commander-staging-20261010`, **tylko odczyt**. Zmiennych i aktywnego środowiska Netlify nie można było zweryfikować.
- Operacyjna zasada AKP: osobna baza zleceń + folder zlecenia; nie mieszać klientów ani danych historycznych.

## Rzeczywisty stan staging PRZED migracją

- 16 rekordów `akp_jobs`, 1 `akp_profiles`, 0 `akp_assignments`, 0 `akp_checks`, 0 `akp_reports`, 0 `akp_job_financials`.
- `akp_photos` **nie istnieje**; `storage.buckets`: **0**.
- `akp_assignments_pkey` = `PRIMARY KEY(job_id)`; brak FK z innych tabel do tego klucza (stwierdzono FK na `job_id` do `akp_jobs` i `worker_id` do `akp_profiles`).
- `storage.objects.owner` ma typ `uuid`, a `owner_id` typ `text`.
- Wszystkie wskazane tabele AKP mają włączone RLS, ale **same polityki nie realizują jeszcze wymogów nowej aplikacji**.
- Istniejące polityki:
  - `akp_jobs`: `akp_jobs_ro`, `akp_jobs_create`, `akp_jobs_edit`.
  - `akp_assignments`: `akp_assignment_ro`, `akp_assignment_create`, `akp_assignment_edit`, `akp_assignment_remove`.
  - `akp_checks`: `akp_checks_ro`, `akp_checks_create`, `akp_checks_edit`.
  - `akp_reports`: `akp_reports_ro`, `akp_reports_create`, `akp_reports_edit`.
  - `akp_profiles`: `akp_profiles_ro`.
  - `akp_job_financials`: `akp_finance_ro`, `akp_finance_create`, `akp_finance_edit`.
  - `akp_audit`: `akp_audit_coordinator_read`; `akp_job_sources`: `coordinator_sources`.
- Te starsze polityki są `PERMISSIVE`; po utworzeniu nowych bez ich usunięcia może nastąpić sumowanie dostępu.

## Wykryte błędy i poprawki w repo DEV

| Obszar | Przed | Poprawka w kodzie DEV |
|---|---|---|
| Polityki legacy | SQL 004 nie usuwał wszystkich rzeczywistych `akp_assignment_*`, `akp_finance_*`, `akp_jobs_create/edit`, `akp_reports_edit` i `akp_checks_*` | Jawne `DROP POLICY IF EXISTS` dla nazw potwierdzonych z bazy |
| Nieznane polityki | Przyszłe reguły mogły zostać niezauważone | Preflight SQL blokuje migrację na nieznanej polityce we wskazanych tabelach |
| Rekurencja `akp_profiles` | Polityka pracownika zawierała `SELECT FROM akp_profiles self` i sprawdzenie brygady przez `akp_assignments`; możliwe 42P17/cykl | Monter może w RLS czytać wyłącznie **własny aktywny profil**, bez podzapytania do tej samej tabeli |
| Odpięcie/dezaktywacja | Stare polityki na checklistach/raportach nie sprawdzały `is_active` | Nowe RLS dla checklist i ograniczenia `is_active` + aktywnego przydziału na danych terenowych |
| Profile | Ryzyko eskalacji przez UPDATE | Trigger bez `SECURITY DEFINER`, kontrola pól uprzywilejowanych; API odrzuca sesję profilu `is_active=false` |
| Wielu monterów | PK tylko `job_id`, upsert `job_id,worker_id` nie działa | Projekt DDL kompozytowego PK z jawną kontrolą obecnego PK; **jeszcze niewykonany** |
| Test pseudo-PASS | W bloku SQL wyjątek był łapany bez rozróżnienia porażki; deklarowano „bezpieczeństwo PASS” | Usunięto pozorny test triggera; oddzielono kontrolę struktury od realnych testów autoryzacji |
| Mock produkcyjny | Brak ENV włączał fikcyjne konta i rekordy | Usunięto z runtime bazę demo/RAM i fikcyjne logowanie; brak konfiguracji => HTTP 503 |
| APP_ORIGIN | Puste APP_ORIGIN mogło ominąć kontrolę Origin | Poprawna konfiguracja wymaga `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN` |
| Historia | Uprawnienia TRUNCATE / DELETE potencjalnie niepotrzebne | Projekt SQL odbiera TRUNCATE i nie udostępnia DELETE zleceń, zdjęć i raportów roli `authenticated` |

## Aktualne blokady (oznaczać FAIL / NOT TESTED, nie PASS)

1. **SQL 004 nadal nie wykonano**. Staging nie ma `is_active`, danych kontaktowych ani tabeli `akp_photos`. Nowy backend z założenia odmawia zalogowania (brak `is_active`) aż do zatwierdzonej migracji; pobieranie zleceń używające przyszłych kolumn nie jest teraz operacyjne.
2. **Brak testowego użytkownika montera** w rzeczywistym Supabase Auth/RLS. Nie było żywych prób worker/coordinator; testy Node korzystają z **atrapy HTTP** i nie dowodzą działania realnego RLS.
3. **Zdjęcia: tylko ścieżki/metadane, brak rzeczywistego uploadu binarnego** do Storage oraz kontrolnego odczytu pliku po odświeżeniu strony.
4. **Audyt działań:** backend `recordAudit()` tłumi błędy; istniejąca `akp_audit` ma tylko politykę odczytu koordynatora, więc zapis z poziomu JWT jest obecnie niesprawdzony/prawdopodobnie blokowany. Zaprojektować bezpieczny, dopisywalny dziennik przed produkcją.
5. **Netlify produkcja:** nie potwierdzono rzeczywistych wartości `SUPABASE_URL`, `APP_ORIGIN`, klucza publishable ani bieżącego commita opublikowanego na `akp.wtf`. GitHub `coordinator-app` nie został zmodyfikowany. **Nie wolno zakładać, że staging jest bazą produkcyjną**.
6. Nie ma jeszcze niezależnych rzeczywistych testów HTTP po migracji, testu ról i pełnego testu telefonicznego PWA. Brak zatwierdzenia publikacji.

## Gotowy plan wdrożenia migracji — po odrębnej zgodzie

**A. Kontrola przed wdrożeniem (READ ONLY):**
- Potwierdź projekt `ttectcuirgdakjhpkkll`, aktualną listę tabel, liczbę rekordów, `pg_policies` i klucze PK/FK. Porównaj z powyższą migawką. Każda dodatkowa polityka = STOP i ponowna analiza.
- Zapewnij punkt przywracania/backup bazy i kopię aktualnego kodu. Wybierz okno testowe staging. Nie kasuj istniejących rekordów.
- Uruchom lokalne `npm run check` i `npm test`, zachowaj log i SHA commita. Testy SQL statyczne to tylko preflight, nie dowód RLS.

**B. Migracja staging — wymaga jawnego potwierdzenia właściciela:**
- Wykonaj **tylko** zweryfikowany `sql/004_minimal_operational_migration.sql` na staging (nie na produkcji) po ponownym przeglądzie skryptu i backupie.
- Natychmiast skontroluj wynik: transakcja `COMMIT`, istnienie kolumn, tabeli `akp_photos`, PK (`job_id,worker_id`), prywatnego `job-photos`, RLS i listy dokładnie nowych polityk.
- W razie błędu transakcja powinna zostać wycofana. Po zatwierdzonej migracji nie stosuj automatycznej „migracji wstecz” bez oceny danych (zdjęcia/protokoły mają zachować historię).

**C. Testy realnych ról:**
- Po zatwierdzeniu utwórz/zidentyfikuj realne konta staging coordinator i worker w Auth + `akp_profiles`, z kontrolą zgodności podpisanego `app_metadata.akp_role`. Nie używaj klucza service_role w przeglądarce.
- Testy dla dwójki monterów na jednym zleceniu, nieprzypisanego montera, odpiętego montera, dezaktywowanego profilu, ról i finansów, checklisty, raportów, zdjęć oraz protokołów.
- Test `42P17`: zapytania do profilu/zleceń/przydziałów/checklisty dla workera nie mogą wywoływać rekursji lub zapętlenia.

**D. Produkcyjne uruchomienie — osobne zatwierdzenie:**
- Najpierw izolowany deploy preview DEV ze stagingiem i rzeczywisty odbiór na telefonie; poprawić upload Storage i audit trail.
- Dopiero później weryfikacja Netlify env oraz właściwej **bazy produkcyjnej**, kopia zapasowa, plan rollbacku kodu i schematu, zgoda i kontrolowane wdrożenie `akp.wtf`.

## Kryteria PASS/FAIL (bramki)

| Kryterium | PASS wyłącznie gdy | Stan obecny |
|---|---|---|
| Polityki RLS | Brak nieoczekiwanych `PERMISSIVE` dla zmienianych tabel; właściwe JWT/RLS | **FAIL — migracja niewykonana** |
| Brak rekurencji | Testy worker w Postgres bez `42P17` | **NOT TESTED LIVE** |
| Profil aktywny | `is_active=false` odmawia logowania i dostępu do danych | **NOT TESTED LIVE** |
| Multi-monter | Dwóch workerów na job, odpięcie A nie usuwa B | **NOT TESTED LIVE** |
| Izolacja finansów | Worker nie odczyta `akp_job_financials` żadnym endpointem ani REST | **NOT TESTED LIVE** |
| Zdjęcie | Faktyczny bajtowy upload, reload, odczyt tylko upoważnionych, brak dostępu po odpięciu | **FAIL — brak Storage** |
| Raport | Worker nie zatwierdzi własnego raportu; coordinator zatwierdzi, historia pozostaje | **NOT TESTED LIVE** |
| Audyt | Zapis działań sprawdzony w bazie, brak cichego pomijania | **FAIL — brak dowodu** |
| Konfiguracja | Brak env = 503, brak mock; prod Origin = `https://akp.wtf`, prod DB nie staging | **DEV STATIC PASS / PROD NIEZWERYFIKOWANE** |
| Testy kodu | Zielone `npm run check`, `npm test` na docelowym commicie | **SKŁADNIA ZWERYFIKOWANA; PEŁNY TEST NIEURUCHOMIONY** |

## Zmienione pliki DEV

- `sql/004_minimal_operational_migration.sql` — polityki, rekurencja, preflight, kontrola struktury i historia.
- `netlify/functions/api.js` — brak mock runtime, bezpieczne wymaganie env, profil `is_active`.
- `tests/api.test.js` — dodatkowe testy nieaktywnego konta i braku konfiguracji.
- `tests/sql004.static.test.js` — inwentarz nazw starych polityk, brak cyklu, warunki odcięcia uprawnień.
- `package.json` — zestaw testów obejmuje plik kontroli SQL.
- `.env.example` — jawne wymagania konfiguracyjne bez sekretów.

**Stan:** zmieniono wyłącznie kod prywatnego GitHub DEV. Bez SQL na bazie, bez bucketu, bez dotykania Netlify/produkcji. AI Studio może mieć starszą kopię: NIE pushować jej do GitHub, zanim nie zostanie pobrana aktualna wersja.
