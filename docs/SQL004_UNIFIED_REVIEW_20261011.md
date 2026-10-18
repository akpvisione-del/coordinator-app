# AKP COMMANDER — SQL 004 skonsolidowana, release gate (DEV only)

**Data:** 2026-10-11
**Repozytorium:** `akpvisione-del/akp-commander-hybrid-pro-dev`
**Gałąź:** `fix/sql004-unified-20261011` (od `main` `277e06d17ea869f85bbea6878bbbe22a13ea529b`)
**Supabase staging:** `ttectcuirgdakjhpkkll`
**Stan:** NO-GO dla wykonywania migracji, dopóki pełny CI, kopia bezpieczeństwa i zgoda właściciela nie będą potwierdzone.

## Zamysł

**Jedna migracja** na podstawie dwóch istniejących wariantów (`main` i `audit/etap1-sql004-20261011`) bez modyfikowania `main`, Supabase, Netlify lub produkcji. NIE synchronizować starszego kodu AI Studio do GitHuba i NIE łączyć gałęzi bez przeglądu.

## Potwierdzona baza (odczyt wyłącznie SELECT)

- Supabase status `ACTIVE_HEALTHY`, PostgreSQL 17.
- 16 jobs, 16 job_sources, 16 audit, 1 profil, 0 assignments, 0 reports; Storage buckets: 0.
- `akp_assignments` ma PK `(job_id)`, oczekiwane `(job_id,worker_id)`.
- 19 zastanych polityk RLS w ośmiu tabelach, w tym 17 w zakresie 7 zmienianych tabel i 2 poza tym zakresem (`akp_audit`, `akp_job_sources`).
- 7 statusów akceptowanych przez `akp_jobs_status_check`, a API akceptuje 19 (nowy constraint obejmuje zarówno 19 jak i historyczne).
- Brak `akp_photos`, brak bucketu `job-photos`, brak montera w Auth.
- Funkcja `akp_internal.log_change()` istnieje i działa jako trigger dla jobs, assignments, checks, reports i finance; zachowujemy historię.

## Co połączono w skrypcie

1. Poprawne `DO $$ ... END $$` i poprawne zamknięcie funkcji PL/pgSQL. Wersja `main` zawierała błędne `DO $` oraz `$ LANGUAGE`.
2. Preflight zamyka migrację na nieznanej polityce RLS (w siedmiu tabelach oraz storage.objects), zamiast po cichu usuwać cudze reguły. Po przejściu preflight usuwa komplet **znanych** polityk w zakresie i instaluje nowe.
3. `akp_coordinator_active`, `akp_worker_active`, `akp_worker_assigned`: wyłącznie podpisana sesja `authenticated`, aktywne konto i (dla workera) aktywny przydział. `SECURITY DEFINER` z `search_path=''`, rola `anon` i `PUBLIC` bez `EXECUTE`. Funkcje mogą sprawdzać wyłącznie bieżący UID — nie można przekazać dowolnego user_id.
4. `is_active NOT NULL` w tabeli profili. Koordynator ze statusem `false` jest blokowany także w RLS, nie tylko w Netlify API.
5. `akp_assignments`: zmiana na kompozytowy PK wyłącznie, gdy dotychczasowy to dokładnie `job_id`. Nieznany kształt PK = wyjątek. API przestaje fizycznie usuwać przydziały: `UPDATE active=false`; nowy przydział `UPSERT active=true`.
6. Pracownik może modyfikować tylko `phone` i `preferred_lang`. Nie może zmieniać `role`, `is_active` ani cudzych rekordów. Raport może stworzyć jako `SUBMITTED`, ale nie może akceptować.
7. Zdjęcia: `akp_photos`, unikalna ścieżka, `ON DELETE RESTRICT`, prywatny bucket `job-photos`, limity 10 MB i MIME, polityki wymagające przydziału, katalog `job_id` i nazwę pliku zaczynającą się od pełnego UUID zalogowanego pracownika. Metadane i plik nadal wymagają później prawdziwych testów uploadu.
8. `akp_photos_audit` korzysta z istniejącego `akp_internal.log_change()`; API nie wykonuje nieautoryzowanych ręcznych INSERT do `akp_audit`.
9. `REVOKE ALL` na tabelach objętych migracją, następnie minimalne `GRANT` (bez DELETE i TRUNCATE dla `authenticated` w danych domenowych). Dla `akp_audit` i `akp_job_sources` nie usuwa się istniejących polityk.
10. Nowy `akp_jobs_status_check` zachowuje historyczne statusy i dopuszcza wszystkie 19 wartości API.

## Kod i testy DEV

- `sql/004_minimal_operational_migration.sql` — docelowy draft migracji.
- `netlify/functions/api.js` — soft unassign i auth fail closed (brak demo RAM).
- `tests/api.test.js` — regresja, historyczny nieaktywny rekord przydziału.
- `tests/sql004.static.test.js` — dwanaście testów statycznych obejmujących wersję migracji, preflight, role, PK, statusy, uprawnienia i zdjęcia.
- `sql/004_verify_readonly.sql` — weryfikacja po zatwierdzonej migracji; nie uruchamiać wcześniej.
- `.github/workflows/dev-check.yml` — `npm run check`, `npm test`, `pglast.parse_sql` (parser gramatyki PostgreSQL), wyzwalanie na nowej gałęzi.

**Lokalne kontrole V8:** składnia `api.js` i plików testów poprawna; dwanaście testów SQL/UI statycznych PASS (izolowany adapter); liczba par `$$` prawidłowa. **Pełny wynik GitHub Actions / PostgreSQL parser wymaga potwierdzenia.** Te kontrole nie testują zachowania triggerów PL/pgSQL w działającym PostgreSQL.

## Kryteria GO do jednorazowego uruchomienia staging (osobna zgoda)

- [ ] GitHub Actions dla konkretnego commita: **PASS** wszystkich testów i `pglast` parsera SQL.
- [ ] SQL przejrzany ręcznie, w tym `SECURITY DEFINER`, UPDATE profili, polityki Storage i preflight; żadne nowe nieznane polityki.
- [ ] Backup `ttectcuirgdakjhpkkll` obejmuje dane i schemat, kopię auth i plan odtworzenia; sprawdzony proces rollbacku.
- [ ] Staging jest niezależny od produkcji: porównano Netlify `SUPABASE_URL` i środowisko. Samo oddzielne repo nie stanowi dowodu izolacji.
- [ ] Osobne potwierdzenie właściciela **„Zgadzam się na uruchomienie zatwierdzonego SQL004 na staging”**.

## Po zgodzie i migracji: warunki PASS używalności

- Postmigration `sql/004_verify_readonly.sql`: żadnych `FAIL` strukturalnych.
- Autentyczne konto coordinator (aktywny/nieaktywny), worker A/B (aktywny/nieaktywny), test RLS, obejście REST i brak rekursji `42P17`.
- Dwa przydziały na jedno zadanie. Odpięcie A zachowuje historyczny rekord `active=false` i blokuje dostęp; B działa nadal.
- Worker nie widzi marży ani finansów, źródeł Google i cudzych zleceń nawet przez REST.
- Worker zgłasza raport `SUBMITTED`, nie zatwierdza go; coordinator odbiera raport.
- Zdjęcie: prawdziwy upload binarny, odczyt po ponownym zalogowaniu, blokada cudzych folderów i polityka krótkiego TTL signed URL. Wcześniej wystawione signed URL może pozostać ważne do wygaśnięcia — nie deklarować natychmiastowej pełnej blokady pobrania.
- Eventy w `akp_audit` sprawdzane w bazie.
- Integracja operacyjna z centralną bazą zleceń i teczką klienta AKP Drive wymaga osobnego etapu.

## Rzeczy, których NIE wykonano

**Nie uruchomiono żadnego SQL DDL/DML, nie tworzono ani nie edytowano Supabase Storage, użytkowników, Netlify i `akp.wtf`.** Tworzono tylko pliki i commity na **osobnej gałęzi DEV**.

## Aktualizacja audytu DEV — 2026-10-11

Wykryto, że dotychczasowe polityki `akp_audit_coordinator_read` oraz `coordinator_sources` przyznawały dostęp na podstawie podpisanej roli JWT bez sprawdzania `is_active`. Skonsolidowana SQL004 w gałęzi DEV: preflight blokuje nieznane polityki obu tabel, a następnie zastępuje WYŁĄCZNIE dwie znane polityki kontrolą `akp_coordinator_active()`; **nie usuwa danych ani triggerów historii**. `sql/004_verify_readonly.sql` sprawdza ten kontrakt po przyszłej migracji.

Dodatkowy problem: `public/app.js` używał pierwszych 8 znaków UUID, co kłóciło się z `storage.objects` RLS wymagającym pełnego UUID pracownika. Aplikacja tworzy teraz pełną ścieżkę UUID, `netlify/functions/api.js` odrzuca błędny prefiks i zagnieżdżone ścieżki, testy API obejmują błędy. Komunikaty PL/UA/RU/EN informują, że w obecnej implementacji istnieje **TYLKO lokalny podgląd zdjęcia + ewidencja metadanych, bez fizycznego uploadu do Storage**.

Po tych poprawkach **12/12 testów statycznych** przeszło izolowaną kontrolę V8, składnia JS również PASS. Nie ma potwierdzonego odczytu pełnego `npm test` / `pglast` z GitHub Actions: to nadal obowiązkowa bramka, podobnie jak backup, izolacja staging/prod i osobna zgoda na migrację. **NO-GO** dla SQL004 do tego czasu.
