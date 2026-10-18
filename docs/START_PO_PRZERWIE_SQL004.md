# AKP COMMANDER HYBRID PRO — START PO PRZERWIE

**Stan zapisany:** 2026-10-11. To jest punkt wznowienia prac nad SQL 004.
**Repo DEV:** `akpvisione-del/akp-commander-hybrid-pro-dev`
**Gałąź robocza:** `fix/sql004-unified-20261011`
**Commit bazowy audytu:** `5cfdd0a1bef274431fed25aef59ae3eb6162e23a`; **aktualny commit** zawsze sprawdź na wierzchołku gałęzi `fix/sql004-unified-20261011`
**Źródło bazowe:** `main` @ `277e06d17ea869f85bbea6878bbbe22a13ea529b`.
**Projekt Supabase staging:** `ttectcuirgdakjhpkkll` (z dostępnych odczytów zdrowy, migracja 004 **NIEWYKONANA**).

## Co jest przygotowane

1. Jeden skonsolidowany **DRAFT SQL 004** z poprawionymi delimiterami, uwzględnieniem statusów API i historycznych statusów, walidacją zastanych polityk RLS (fail-closed), funkcjami aktywnego koordynatora i montera, kompozytowym kluczem przydziałów, ograniczeniami prywatnego Storage zdjęć oraz trwałym logiem zmian.
2. Backend `netlify/functions/api.js` ma logowanie `is_active===true` (bez RAM mock) i **miękkie odpinanie** zlecenia `active=false` zamiast fizycznego DELETE; historia jest obsługiwana przez istniejące triggery PostgreSQL.
3. `tests/api.test.js` rozszerzony o zachowanie historii po odpięciu montera, `tests/sql004.static.test.js` ma **12** statycznych testów.
4. GitHub Actions `.github/workflows/dev-check.yml` uruchamia kontrolę składni JS, `npm test` i parser składni PostgreSQL `pglast` na gałęzi `fix/sql004-unified-20261011`.
5. `sql/004_verify_readonly.sql` zawiera zapytania **dopiero po migracji**.
6. Szczegółowy raport: `docs/SQL004_UNIFIED_REVIEW_20261011.md`.

## Co zostało obiektywnie sprawdzone

- Odczytowe zapytania do Supabase staging; nie dokonywano zmian w bazie.
- Repo `fix/sql004-unified-20261011` jest odrębną gałęzią zawierającą kolejne poprawki po `main`; aktualną liczbę commitów sprawdź poprzez GitHub Compare przed wznowieniem. Nie wykonano merge.
- Składnia zmienionych plików JS przeszła w izolowanej kontroli V8. Dwanaście testów SQL/UI statycznych — PASS po kolejnych poprawkach (izolowana kontrola V8) w izolowanym uruchomieniu (nie zastępuje pełnego Node CI).
- API ma 19 obsługiwanych statusów; draft SQL uwzględnia wszystkie i zachowuje historyczne.
- Poprawione zostają niepełne bloki `DO $$` z `main`.
- **Nie uzyskano wiarygodnego, szczegółowego odczytu przebiegu GitHub Actions push-run** z udostępnionych narzędzi; status dla konkretnego commita **NIEPOTWIERDZONY**. Nie twierdzić, że pełny CI, `npm test` lub `pglast` przeszły, zanim zobaczymy run z gałęzi `fix/...`.

## Najbliższe kroki — dokładna kolejność

1. Odczytaj **GitHub Actions** dla workflow `AKP Commander DEV - safety checks` na gałęzi `fix/sql004-unified-20261011` i zobacz trzy kroki: `npm run check`, `npm test`, `pglast`. Link: https://github.com/akpvisione-del/akp-commander-hybrid-pro-dev/actions/workflows/dev-check.yml
2. W razie FAIL popraw jedynie gałąź `fix/sql004-unified-20261011`, zachowaj wyniki i SHA, **bez merge do main**.
3. Gdy CI będzie zielony: przegląd semantyki PL/pgSQL, RLS dla pracownika i koordynatora, Storage, kompatybilności triggerów i zależności w PostgreSQL, następnie **potwierdzenie backupu i odrębności staging od prod Netlify**.
4. **NIE URUCHAMIAJ MIGRACJI BEZ OSOBNEGO, JAWNEGO ZATWIERDZENIA WŁAŚCICIELA.**
5. Po zgodzie na SQL staging: uruchom migrację tylko na `ttectcuirgdakjhpkkll`, kontrola `sql/004_verify_readonly.sql`, realne testy RLS z podpisanymi JWT coordinator/worker A/worker B, a potem faktyczny upload i pobranie zdjęć. Dopiero kolejne zatwierdzenie produkcji.

## Blokady i rzeczy, których nie robić

- Staging nie ma nadal `akp_photos` ani bucketu `job-photos`; testy JS nie są dowodem fizycznego uploadu zdjęć.
- Niezweryfikowane: produkcyjne `SUPABASE_URL` w Netlify, niezależność staging i prod, kopia zapasowa.
- **Nie klikaj** w AI Studio: `Przywrócić`, `Prześlij zmiany do GitHub` ani `Publikuj`; AI Studio jest zsynchronizowane z `main`, **nie** z gałęzią `fix/sql004-unified-20261011`.
- Nie rozbudowuj widoków demonstracyjnych, nie zużywaj kredytów Gemini na powtarzanie testów CI.
- Nie modyfikuj produkcji `akp.wtf`, Netlify production, Supabase Auth, Storage ani danych klientów na staging bez osobnej zgody.
- Zlecenia nadal mają być powiązane z centralną bazą i teczką właściwego zlecenia na Drive; to przyszły etap integracyjny, a nie część migracji 004.

## AKTUALIZACJA WZNOWIENIA — 2026-10-11 (po ponownym audycie)

- Odczytano aktualną gałąź, potwierdzono jej rozdzielenie od main.
- Supabase staging zweryfikowano WYŁĄCZNIE SELECT: 16 jobs, 1 profile, 0 assignments, 16 wpisów audytu, 0 bucketów.
- Zidentyfikowano nieaktywny-koordinator bypass: stare JWT-only polityki `akp_audit_coordinator_read` i `coordinator_sources`. Skrypt SQL004 na DEV **zachowuje tabele i historię**, ale po fail-closed preflight wymienia te dwie polityki na `akp_coordinator_active()`.
- Dodano testy statyczne i strukturalną weryfikację RLS źródeł/historii w `sql/004_verify_readonly.sql` (uruchamiać dopiero po przyszłej, zatwierdzonej migracji).
- Rozbieżność zdjęć: mobilny `public/app.js` używał 8 znaków ID montera, SQL/Storage wymaga pełnego UUID. Zmieniono generator, walidację API i testy. Interfejs nazywa podgląd lokalnym, nie prawdziwym uploadem do Storage. **Prawdziwe wysyłanie plików nie zostało wdrożone.**
- **12/12 testów statycznych PASS w izolowanym wykonaniu V8**, składnia czterech skontrolowanych plików JavaScript PASS. **Nie jest to wynik pełnego `npm test` ani parsera PostgreSQL w GitHub Actions.**
- GitHub Actions: narzędzie do odczytu `fetch_commit_workflow_runs` udostępnia tylko PR-triggered runs, `get_commit_combined_status` nie zwraca Actions check-runs. **Wynik najnowszego PUSH workflow nadal wymaga sprawdzenia przez UI GitHub**. Link do `dev-check.yml` poniżej.
- **Decyzja: NO-GO** dla migracji staging i publikacji do czasu pełnego CI, weryfikacji backupu/izolacji produkcji, testów realnego RLS i osobnej zgody właściciela.

## Komenda wznowienia dla ChatGPT

> **AKP Commander — WZNÓW**. Przeczytaj `docs/START_PO_PRZERWIE_SQL004.md` i `docs/SQL004_UNIFIED_REVIEW_20261011.md` z gałęzi `fix/sql004-unified-20261011`. Sprawdź wyniki GitHub Actions dla najnowszego SHA. Jeśli są błędy, napraw je tylko w tej gałęzi i ponów testy. Jeśli są zielone, przygotuj końcowe GO/NO-GO z potwierdzeniem backupu i izolacji staging. **Nie uruchamiaj SQL, nie zmieniaj Supabase i nie publikuj produkcji bez mojej osobnej zgody.**

## WZNOWIENIE BACKUPU — 2026-10-11

Zatwierdzony plan dalszej pracy bez migracji: `docs/SUPABASE_STAGING_BACKUP_FREE_V01.md`. 
Gotowy, **NIEURUCHOMIONY** skrypt na Windows: `scripts/backup_staging_readonly.ps1`.
Na planie Supabase Free nie ma dziennych backupów; procedura tworzy ręczny eksport ról, schematu, danych Auth/AKP i historii migracji. Na osobnym nośniku trzeba zachować kopię zaszyfrowaną. Doświadczenie odtworzenia planowane wyłącznie na odrębnej instancji, nie na staging.
Stan staging odczytowy: 16 jobs, 1 profil, 1 użytkownik Auth, 16 audit, 16 source, 0 bucketów/obiektów, 0 sekretów Vault; migracje: initial, restrict_auto_rls_trigger_execution, google_source_import.
**Wciąż NO-GO SQL 004** do zakończenia eksportu, potwierdzenia odtwarzalności, rozdziału Netlify prod/staging i oddzielnej zgody właściciela.
**Gemini F02 pracuje nad frontendem; nie dotykaj `public/*` i nie synchronizuj AI Studio.**

