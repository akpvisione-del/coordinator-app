# SUPERSPRINT 01 — uruchomienie, review i wdrożenie

**Nie jest to zgoda na deploy/merge/migracje produkcyjne.** Kod jest na osobnej gałęzi feat/akp-supersprint-01-v01 ponad PR #13. Nie uruchamiano nowych migracji w Supabase, nie dotykano prawdziwych kont/zleceń.

## Kontynuacja i szybka walidacja

Przeczytaj SUPERSPRINT_01_STATUS.md, MATRIX.md i API.md. Użyj istniejącego checkoutu; zadania chmurowe są izolowane, bez dodatkowego worktree. Sprawdź git status i ostatnie SHA, nie przepisuj gotowych funkcji.

```bash
cd /workspace/akp-commander-hybrid-pro-dev
npm install --package-lock=false --ignore-scripts --no-audit --no-fund
npm run check
npm run build
npm test
node scripts/qa-preview-csp.mjs
node scripts/qa-real-panels.mjs
node scripts/qa-supersprint.mjs
node scripts/qa-chat.mjs
bash scripts/test-supersprint-rls.sh
```

Node >=20 (lokalnie Node 24.19.0), Chrome/Chromium (opcjonalnie CHROME_BIN), zarządzany lokalny Docker i obraz postgres:16-alpine. Repo nie ma lockfile, skrypt nie generuje go. Browser używa CDP pipe i tymczasowych profili /tmp; HTTP jest lokalne, ruch HTTPS w QA blokowany; mock konta/zlecenia. Screenshoty actual UI są ignorowane w Git i archiwizowane przez CI.

Skrypt RLS tworzy JEDEN nowy kontener PostgreSQL z `--network none`, montuje repo read-only, używa fikcyjnego hasła i psql wewnątrz kontenera. Uruchamia historyczne scenariusze bezpieczeństwa oraz nowe SQL WYŁĄCZNIE w tej fikcyjnej bazie, po czym usuwa kontener także po błędzie. Nie używa PGHOST/URL z produkcji. Nie uruchamiaj plików testowych lub historycznych propozycji w Supabase.

## Konfiguracja bieżącej aplikacji

Lokalny serwer: `npm run dev` w repo, port 3000. Potrzebne istniejące SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY i APP_ORIGIN; sprawdzaj tylko obecność/nazwy, nie wypisuj wartości. server.js ładuje istniejący .env i nadpisuje nim zmienne; nie nadpisuj użytkownikowi pliku .env. Przeglądarkowe sesje wymagają zgodnego HTTPS/origin i Secure cookies; lokalne HTTP QA ma wyłącznie mock autoryzacji.

Bez nowego zatwierdzonego schematu chat/audit zwracają jawne 503 i nie pozorują zapisu. Sam /health potwierdza kształt konfiguracji, nie gotowość nowego modelu ani połączenia DB.

## Nowy SQL tylko do przeglądu

1. docs/sql_proposals/supersprint01_chat_v01.REVIEW_ONLY.sql — osobne threads/members/messages, indeksy, oryginalny język, RLS i minimalne RPC. Wymaga PostgreSQL >=15; nie modyfikuje legacy akp_messages.
2. docs/sql_proposals/supersprint01_team_history_v01.REVIEW_ONLY.sql — audit kont i przydziałów (forward-only), sanitizowane zdarzenia z triggerów oraz odczyt wyłącznie aktywnego koordynatora.
3. Odpowiednie *.ROLLBACK_REVIEW_ONLY.sql — odcięcie dostępu bez usuwania danych; audit rollback odłącza triggery, a zdarzenia pozostają.

Pliki nie są w supabase/migrations i nie wykonują się przy build/deploy. CREATE bez IF NOT EXISTS celowo zatrzymuje ponowne zastosowanie/kolizję zamiast nadpisywać nieznany schemat. Przed osobną decyzją trzeba odczytać stan docelowej bazy i porównać zależności (akp_profiles z preferred_lang/is_active, akp_jobs, akp_assignments) oraz polityki/granty. Migracja właściciela musi uruchamiać jako zaufany właściciel funkcji security-definer; nie dawać tych uprawnień klientowi.

**Już zastosowane** PK (job_id,worker_id) i 20261017181541 (RLS dezaktywacji, kolumnowy UPDATE service_role, REVOKE TRUNCATE) pozostają bez zmian. Nie powtarzać ich ani nie wykonywać historycznych NOT_APPLIED.sql w produkcji. Nie nadawać szerokiego UPDATE/DELETE profili.

## Zaproszenia i Auth

Edge akp-provision-worker zachowuje gateway JWT verification i własny test Auth + aktywny koordynator. Istniejące serwerowe bindings: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Nowe niesekretne **AKP_APP_ORIGIN** ma zawierać wyłącznie zatwierdzony HTTPS origin środowiska. Nie bierze go od klienta. W Supabase Auth trzeba dopuścić dokładny redirect `${AKP_APP_ORIGIN}/reset-password.html` i skonfigurować email/SMTP oraz limity wysyłek.

Zaproszenie tworzy tożsamość bez hasła, nadaje worker dopiero po zapisie profilu i wysyła link ustawienia hasła istniejącym flow Supabase Auth recovery. Nie zwraca hasła, tokenu ani adresu recovery do aplikacji. Błąd po utworzeniu wymaga sprawdzenia konta przed powtórzeniem; aplikacja go nie kasuje i nie nadpisuje istniejącego hasła. Brak AKP_APP_ORIGIN daje 503 PRZED utworzeniem konta. Email delivery i gateway wymagają osobnego izolowanego HTTP UAT.

## Bramka release po odrębnej zgodzie

- Zweryfikować CI i review Draft PR (baza fix/worker-assign-and-manage-20261017-v01), zapisać obecne Netlify/Edge deploy IDs.
- Uruchomić prawdziwe HTTP UAT na osobnym Supabase i fikcyjnych użytkownikach: Netlify→Edge→Auth/PostgREST, recovery/email, stary JWT, dezaktywacja/reaktywacja, dwóch monterów, brak finansów i cudzych rozmów, odpięcie job, read/notifications, kolizja client_id, audit i ograniczone kolumnowe granty.
- Dopiero po osobnych zatwierdzeniach zastosować nowe SQL, konfigurację i zatwierdzone wersje Edge/Netlify. Właściciel wybiera moment aktywacji i zakres danych testowych; nie testować na prawdziwych kontach.
- Rollback kodu przywraca zapisane deploy IDs. W razie wyłączenia chat/audit użyć zatwierdzonego revoke-only/disable-only rollbacku; zachować dane i RLS 20261017181541. Nie kasować tabel, kont, historii i nie cofać ochrony worker JWT.

## GitHub / PR

Git push jest potwierdzany po checkpointach. api.github.com było blokowane; nie oznacza to braku GitHub tokenu i nie wymaga kopiowania sekretu. Po dopuszczeniu domeny sprawdzić istniejący PR po head, aby go nie zduplikować:

```bash
gh pr list --repo akpvisione-del/akp-commander-hybrid-pro-dev --head feat/akp-supersprint-01-v01
# Jeśli nie istnieje, utworzyć Draft (bez merge/deploy):
gh pr create --repo akpvisione-del/akp-commander-hybrid-pro-dev --draft --base fix/worker-assign-and-manage-20261017-v01 --head feat/akp-supersprint-01-v01 --title 'AKP SUPERSPRINT 01: Zespół, przydziały, komunikator i UX' --body-file docs/SUPERSPRINT_01_PR.md
```

Brak dostępu do Drive nie blokuje kontynuacji: bieżący kontrakt, zakres, testy i historia są w repo. Zewnętrznych wersji V19/Gemini NEXT v02/Claude UI v07 nie nadpisywać ani nie zastępować nową aplikacją.
