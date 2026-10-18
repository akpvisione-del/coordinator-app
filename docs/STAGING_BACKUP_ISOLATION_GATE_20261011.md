# AKP Commander Hybrid Pro — bramka STAGING BACKUP / IZOLACJA / CI

**Status:** NO-GO dla migracji SQL 004, publikacji, aktualizacji danych i konfiguracji.
**Zakres wykonany:** tylko odczyty GitHub i Supabase przez konektory + statyczna kontrola kodu; nie uruchamiano SQL.

## 1. Dowody z dostępnych odczytów

- GitHub DEV `akpvisione-del/akp-commander-hybrid-pro-dev`; gałąź `fix/sql004-unified-20261011`.
- `main` jest osobną wersją zsynchronizowaną z Google AI Studio. Plików `public/*` **nie edytować** w trakcie prac Gemini.
- GitHub Actions w `.github/workflows/dev-check.yml` ma etapy `npm run check`, `npm test`, parser PostgreSQL `pglast`.
- Konektor GitHub zwraca pustą listę `statuses` dla ostatniego commita i tylko PR-triggered runs (brak push-run w interfejsie konektora). **Nie ma potwierdzenia zielonego CI** dla aktualnego HEAD. Potrzebny log/zrzut z GitHub Actions.
- Supabase `AKP COMMANDER staging`, ID `ttectcuirgdakjhpkkll`, stan `ACTIVE_HEALTHY`; obecne migracje: `akp_commander_initial`, `restrict_auto_rls_trigger_execution`, `google_source_import`; SQL 004 **niezastosowany**.
- Obecnie 16 jobs, 1 profil, 0 przydziałów, 16 wpisów `akp_audit`, 0 bucketów Storage. Bazowano na publicznie dostępnych metadanych API zarządzania oraz wcześniejszych odczytach katalogu, bez zmian.
- Projekt `hhudjjrvvpzwjghijrft` jest na liście Supabase, ale ma status `INACTIVE`. **To nie dowodzi, że prod Netlify jest do niego podłączony.**
- Netlify/akp.wtf: brak dostępu do aktywnych wartości `SUPABASE_URL` i `APP_ORIGIN`; nie znamy aktywnego production deploy commit ani site environment. **Izolacji niepotwierdzono.**
- Supabase: brak konektorowej operacji `list_backups` i potwierdzonego recovery point. **Backup niepotwierdzony.**
- Advisor Supabase security: `auth_leaked_password_protection` = WARN (disabled), konieczne rozważyć włączenie przed udostępnieniem użytkownikom.
- Advisor performance: 3 FK bez indeksów oraz ostrzeżenia wydajności starych RLS (po migracji powtórzyć audyt, nie oznaczać jako rozwiązane teraz).

## 2. Poprawki zapisane w kodzie DEV po tej kontroli

- `sql/004_minimal_operational_migration.sql`: Storage `objects.owner` (deprecated) zamienione na `objects.owner_id=(SELECT auth.uid()::text)`, zgodnie z kolumną `owner_id text` obecną w aktualnej tabeli storage.objects i dokumentacją Supabase: https://supabase.com/docs/guides/storage/security/ownership
- `netlify/functions/api.js`: limit edycji `instructions` zmieniony z 3000 na **2500**, zgodnie z bieżącym ograniczeniem kolumny `akp_jobs.instructions`; tworzenie było już ograniczone do 2500.
- `tests/sql004.static.test.js`: testy pilnujące nowej polityki `owner_id` i limitu 2500 znaków.
- Dokumentacja: ten plik i wcześniejsze `docs/SQL004_UNIFIED_REVIEW_20261011.md`.
- **Nadal nie dokonano żadnych modyfikacji w `public/*`.**

## 3. Backup — ręczna kontrola w Supabase (NIE wykonuje migracji)

1. Zaloguj się do Supabase → projekt **AKP COMMANDER staging** → **Database → Backups** (nazwa i opcje mogą się zmieniać).
2. Sprawdź, czy istnieje aktualny backup lub PITR obejmujący czas sprzed planowanej migracji. Odczytaj datę, retencję i rodzaj kopii.
3. Potwierdź możliwość **odtworzenia całej bazy** (schemat + dane; auth, audyt, zlecenia, profile), a nie tylko eksportu pojedynczych tabel. Osobno uwzględnij pliki Storage, gdy zostaną utworzone: sam dump DB nie kopiuje automatycznie binariów zdjęć.
4. Gdy dashboard nie oferuje backupu, wstrzymaj migrację i przygotuj dedykowany `pg_dump` (schemat+dane) oraz plan odtworzenia, **dopiero po jawnej zgodzie na wykonanie operacji backupu**.
5. Udokumentuj dowód: data/godzina, lokalizacja zabezpieczonego backupu, odpowiedzialny, sprawdzony sposób odtworzenia. Nie umieszczaj dumpa, haseł ani danych klientów w publicznym GitHubie.

**Kryterium PASS backup:** zweryfikowany punkt odzyskiwania i procedura odtworzenia **tego konkretnego staging**. W przeciwnym razie FAIL / UNKNOWN.

## 4. Izolacja produkcji (READ-ONLY)

1. Netlify → projekt publikujący `akp.wtf` (wcześniej `koordynator-a`) → Site / Project configuration → Environment variables. Odczytaj **nazwę zmiennej** `SUPABASE_URL` i tylko fragment nazwy hosta projektu, np. `https://<project-ref>.supabase.co`. **NIE kopiuj kluczy API, refresh tokenów ani haseł.**
2. Porównaj project-ref w środowisku PROD z `ttectcuirgdakjhpkkll`. **Identyczne = natychmiastowe NO-GO:** staging i prod mogą korzystać z tej samej bazy.
3. Zidentyfikuj oddzielny Netlify deploy preview lub osobną witrynę DEV i jej `APP_ORIGIN`. Nie pozwalaj staging deploy używać aktywnego prod DB, nie ustawiaj `APP_ORIGIN` globalnie wbrew pochodzeniu żądań.
4. Sprawdź aktywny branch i commit deploymentu Netlify. Repozytorium `coordinator-app` ma publiczną gałąź `akp-commander-staging-20261010`, ale to **nie dowodzi**, że jest obecnie wdrożona.
5. Udokumentuj wynik (wyłącznie niewrażliwe identyfikatory i statusy, bez wartości sekretów).

**PASS izolacji:** prod wskazuje inną bazę niż `ttectcuirgdakjhpkkll`, staging preview wskazuje wyłącznie ten staging, obie konfiguracje potwierdzone na faktycznych projektach Netlify.

## 5. GitHub CI — potwierdzenie

Otwórz:
https://github.com/akpvisione-del/akp-commander-hybrid-pro-dev/actions/workflows/dev-check.yml

Filtr: branch `fix/sql004-unified-20261011`. Sprawdź **najnowszy commit SHA**, cztery kroki: instalacja, syntax, `npm test`, `pglast`.
Wynik zielony dla **innego commita lub dla samego main** nie jest PASS dla obecnej gałęzi.
Przy FAIL wgraj log błędu (bez sekretów); przy PASS zachowaj link do runa, identyfikator commita i zrzut z wynikami.

## 6. Dodatkowa niepotwierdzona luka do kontroli po backupie

`POST /google/sync` wywołuje funkcję PostgREST `akp_import_google`. API sprawdza aktywną sesję koordynatora, jednak bez odczytu definicji funkcji i jej przywilejów **nie wiemy**, czy bezpośrednie wywołanie RPC przez nieaktywnego koordynatora jest dostatecznie blokowane. Nie wykonano SQL weryfikującego funkcję. Konieczna kontrola przed produkcją.

## 7. Twarda bramka GO/NO-GO

| Kontrola | Stan |
|---|---|
| API+SQL statyczna zgodność `owner_id`, max 2500 | Zapisano poprawki DEV; pełny CI PENDING |
| GitHub Actions `npm run check`/`npm test`/`pglast` na ostatnim SHA | NIEPOTWIERDZONE |
| SQL004 niewykonany; środowisko staging aktywne | POTWIERDZONE |
| Aktualny, możliwy do odtworzenia backup | NIEPOTWIERDZONE |
| `akp.wtf` i staging nie współdzielą projektu Supabase | NIEPOTWIERDZONE |
| Przegląd RPC `akp_import_google` i post-migration RLS | PENDING |
| Jawne zatwierdzenie wykonania SQL004 na staging | NIEUDZIELONE |

**Wynik: NO-GO dla SQL004, Netlify PROD i `akp.wtf`. GO dla dalszego audytu/CI i kontrolowanego scalania F01 dopiero po zakończeniu prac Gemini.**
