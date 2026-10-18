# AKP VISIONE — Supabase staging, bezpłatny backup i plan odtworzenia v01

**Data przygotowania:** 2026-10-11  
**Projekt źródłowy:** `AKP COMMANDER staging`, `ttectcuirgdakjhpkkll` (PostgreSQL 17, EU)  
**Stan:** **BACKUP NIE WYKONANY. MIGRACJA SQL 004 NIEURUCHOMIONA.**  
**Zakres:** wyłącznie instrukcja, skrypt i odczyty metadanych; GitHub DEV `fix/sql004-unified-20261011`.  
**Gemini F02:** edytuje tylko frontend; nie synchronizować repo, nie dotykać `public/*` w pracach backendowych.

## Decyzja / koszt

- Projekt ma plan Free: brak automatycznych backupów w panelu. Nie ma potrzeby kupować Pro, by wykonać **manualną logiczną kopię bazy**.
- Rekomendowana metoda: oficjalny Supabase CLI `db dump`, lokalnie na komputerze (Windows/macOS/Linux), wymagane Supabase CLI + Docker Desktop + interaktywne logowanie.
- Przygotowany skrypt Windows: `scripts/backup_staging_readonly.ps1`. Jest zapisem w GitHubie, **nigdy nie był uruchomiony**.
- Kopia trafi **wyłącznie na dysk komputera** do `$HOME/AKP_BACKUPS_PRIVATE/STAGING_ttectcuirgdakjhpkkll_<UTC>/`. Nigdy nie commitować wynikowego SQL ani manifestu wraz z danymi klientów.

Dokumentacja producenta:
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/reference/cli/supabase-db-dump
- https://supabase.com/docs/guides/database/connecting-to-postgres
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/storage/management/download-objects

## Stan przed eksportem — sprawdzony odczytem

| Kontrola | Wynik 2026-10-11 |
|---|---:|
| Supabase project | ACTIVE_HEALTHY |
| `public.akp_jobs` | 16 |
| `public.akp_profiles` | 1 |
| `auth.users` | 1 |
| `public.akp_audit` | 16 |
| `public.akp_job_sources` | 16 |
| `storage.buckets` | 0 |
| `storage.objects` | 0 |
| `vault.secrets` | 0 |

Znane migracje `supabase_migrations.schema_migrations`:
- `20261010092620 akp_commander_initial`
- `20261010092644 restrict_auto_rls_trigger_execution`
- `20261010102349 google_source_import`

Dodatkowe ważne obiekty: schemat `akp_internal` z funkcją `akp_internal.log_change()`, funkcja `public.akp_import_google`; extension `supabase_vault` jest zainstalowane, ale liczba zapisanych sekretów Vault wynosi **0**. Samo 0 sekretów nie zwalnia z kontroli ewentualnego szyfrowania kolumn.

## Bezpieczny eksport na komputerze Windows — wykonaj dopiero na własnej maszynie

1. Zainstaluj oficjalne **Docker Desktop** oraz **Supabase CLI**. W razie potrzeby PostgreSQL `psql` będzie potrzebny dopiero do odtworzenia. Nie pobieraj przypadkowych instalatorów z innych źródeł.
2. Uruchom Docker Desktop. Upewnij się, że można zalogować się do Supabase i że istnieje projekt `ttectcuirgdakjhpkkll`.
3. Pobierz **sam plik skryptu** `scripts/backup_staging_readonly.ps1` z prywatnej gałęzi. Przeczytaj go przed uruchomieniem. Nie przenoś lokalnego projektu AI Studio ani kodu Gemini do repo.
4. W **PowerShell** uruchom zatwierdzony skrypt: `& "C:\\sciezka\\do\\backup_staging_readonly.ps1"` (konkretna ścieżka zależy od miejsca pobrania).
5. Skrypt: sprawdza `supabase` i `docker`, wymaga ręcznego wpisania `STAGING`, inicjalizuje lokalną konfigurację, loguje przez CLI i łączy **tylko** `ttectcuirgdakjhpkkll`. Gdy potrzeba, hasło bazy wpisuje się wyłącznie do oficjalnego promptu CLI. **Nie wysyłaj hasła w czacie i nie umieszczaj go w skrypcie.**
6. Następnie eksportuje pięć plików:
   - `roles.sql` — role bazy;
   - `schema.sql` — schemat i własne obiekty bazy (bez pełnej rekonstrukcji tabel zarządzanych platformą Auth/Storage);
   - `data.sql` — dane, w tym dane Auth, public i metadata Storage;
   - `history_schema.sql` i `history_data.sql` — historia wersji migracji.
7. Skrypt zatrzymuje się na błędzie polecenia i sprawdza wielkości plików. `manifest.json` zawiera rozmiary i sumy SHA-256, ale **nie potwierdza jeszcze poprawności odtworzenia**. Ostrzega, jeśli nie może znaleźć spodziewanych sekcji `auth.users`, `akp_jobs`, `akp_audit`, `akp_internal.log_change`.
8. Skopiuj gotowy folder na **drugi nośnik**, najlepiej archiwum szyfrowane silnym hasłem. Raw `data.sql` zawiera dane klientów i potencjalnie dane Auth — nie udostępniaj go na publicznym lub współdzielonym Dysku, GitHubie, e-mailem ani w czacie.

### Alternatywa bez skryptu: oficjalne pięć komend

Po utworzeniu **lokalnego** projektu Supabase CLI, zalogowaniu i powiązaniu go z właściwym staging, przy użyciu `--linked`:

```bash
supabase db dump --linked -f roles.sql --role-only
supabase db dump --linked -f schema.sql
supabase db dump --linked -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
supabase db dump --linked -f history_schema.sql --schema supabase_migrations
supabase db dump --linked -f history_data.sql --use-copy --data-only --schema supabase_migrations
```

Zalecane jest `--linked`, a nie jawny ciąg `--db-url` z hasłem: hasła wpisane bezpośrednio w parametry procesu mogą pojawić się w historii poleceń lub narzędziach monitorujących. Przy `supabase link` upewnij się, że wskazany jest **staging**. Połączenie sesyjne/port 5432 jest właściwe dla `pg_dump` na IPv4; endpoint poolera należy pobrać w panelu Connect, **nie zgadywać**.

**Nigdy nie używaj w tym zadaniu:** `supabase db push`, `supabase db reset --linked`, `supabase migration up`, `apply_migration`, `psql` kierującego na staging z plikami SQL ani opcji Reset/Restore na źródłowej bazie.

## Backup i późniejszy test odtworzenia to dwie osobne operacje

**Po eksporcie, bez zmian w zdalnej bazie:**
- Weryfikuj obecność wszystkich pięciu plików, brak błędów komend, datę UTC oraz SHA-256.
- Sprawdź liczbę wierszy z lokalnego pliku (bez ujawniania ich) i obecność sekcji Auth, akp_jobs, akp_audit, akp_job_sources.
- W archiwum powinno być jedno spójne wydanie danych; przed finalnym eksportem zatrzymaj zapisy **na staging** albo potwierdź, że nikt niczego w nim nie zmienia. Eksporty do osobnych plików są wykonywane kolejno, więc nie są automatycznie jednym wspólnym snapshotem transakcyjnym.
- Potwierdź, że klucze i hasła nie zostały zapisane w GitHub / AI Studio / dokumentacji.

**Test odtworzenia — tylko po osobnym zatwierdzeniu i tylko do OSOBNEGO pustego środowiska**, nie do staging i nie do `akp.wtf`. Może to być tymczasowy projekt Supabase lub lokalny, izolowany stos Supabase. Sam Docker Postgres bez usług i schematów Supabase nie daje pełnego testu Auth/Storage.

Oficjalna procedura odtworzenia do osobnego projektu bez zastosowanej kryptografii Vault/column encryption:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_DB_URL"
```

`$NEW_DB_URL` to **NOWY, ODIZOLOWANY** projekt, nie `ttectcuirgdakjhpkkll` i nie baza produkcyjna. W przypadku zmian w schematach zarządzanych przez Supabase (`auth`, `storage`), trzeba odtworzyć także własne polityki/triggery z migracji; dla zapisanych sekretów Vault lub zaszyfrowanych kolumn wymagana jest dodatkowa procedura kluczy/konfiguracji według dokumentacji. Historia `supabase_migrations` może wymagać osobnego kontrolowanego odtworzenia; nie nakładaj jej ślepo na istniejące rekordy.

**Akceptacja próbnego przywrócenia**:
- Schemat i funkcje `public` oraz `akp_internal` istnieją (w tym trigger logowania historii);
- liczniki: 16 zleceń, 16 źródeł, 16 historii, 1 profil, 1 konto Auth (dla zamrożonego snapshotu);
- migracje 3 sztuki są poprawnie odtworzone;
- polityki RLS i uprawnienia działają; testy kont z nowego projektu odbywają się wyłącznie na izolowanym systemie;
- nie ma błędów relacji FK i kolejnych eksportów;
- wynik opatrzony czasem, hashem i osobą weryfikującą.

Samo `manifest.json` i pięć niepustych plików = **backup wyeksportowany, ale odtwarzalność NIEPOTWIERDZONA**.

## Przyszłe zdjęcia i pliki Storage

Obecnie `storage.objects=0`, więc nie ma fizycznych zdjęć do pobrania. Gdy uruchomimy `job-photos`, kopia SQL będzie zawierała co najwyżej *metadane* `storage.objects`. **Binarne obiekty należy pobierać osobno** przez Storage API/CLI (lub S3-compatible endpoint), najlepiej oryginalne pliki i sumy kontrolne. Odtwarzanie plików wykonuj przez Storage API, nigdy ręcznie przez SQL w schemacie `storage`. Zob. https://supabase.com/docs/guides/storage/management/download-objects .

## Bramka przed SQL004

- [ ] Wykonany backup z datą i pięcioma plikami, potwierdzone SHA256;
- [ ] Odtworzenie do osobnego środowiska sprawdzone (lub formalna decyzja o ryzyku i zatwierdzony plan odtworzenia);
- [ ] Tożsamość produkcyjnego `SUPABASE_URL` w Netlify zweryfikowana, różna od staging;
- [ ] GitHub Actions pełne PASS na *ostatecznym* commit po scaleniu F01/F02;
- [ ] Odrębna, jawna zgoda właściciela na wykonanie SQL004 **wyłącznie** na `ttectcuirgdakjhpkkll`.

**Obecny wynik: GO na przygotowanie i późniejszy eksport read-only; NO-GO dla migracji, nowego projektu, przywracania bazy i publikacji bez dodatkowych zgód.**
