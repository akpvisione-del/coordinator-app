# AKP SUPERSPRINT 01 — punkty kontrolne

## Bieżący stan (przeczytaj najpierw)
Kod dla pełnych 28 wymagań z treści właściciela jest przygotowany w tej samej aplikacji, ponad PR #13. Szczegóły i ograniczenia: `SUPERSPRINT_01_MATRIX.md`. Nie jest to deklaracja aktywacji produkcyjnej.

Ostatni commit kodu: **b2484cd** (Zespół/zaproszenia/historia); wcześniej **ea7c85f** (UI chat), **b5ab622** (backend/RLS chat). Push każdego modułu potwierdzono. Ostatni commit statusu/dokumentacji: `git log -1 -- docs/SUPERSPRINT_01_STATUS.md` (plik nie może zawierać własnego SHA).

Końcowe check/build i **324/324 testy PASS, 0 skipów**. Izolowany PostgreSQL16: **71 asercji RLS PASS**. Chromium actual koordynator/worker, preview strict CSP PASS; chat i Zespół/harmonogram dla obu ról na **390px/1280px PASS**, w tym Enter-search, retry, read i job-link. Regresje PWA w npm test PASS.

**Pozostałe bramki:** nowy chat i audit SQL są WYŁĄCZNIE REVIEW_ONLY, nie w supabase/migrations; wymagają osobnej zgody i izolowanego HTTP UAT Supabase. Zaproszenia wymagają Edge AKP_APP_ORIGIN i konfiguracji Auth email/redirect. Bez SQL chat/audit zwracają jawne 503. Nie testowano prawdziwych maili/gateway; niczego nie wdrażano, nie scalano, nie uruchamiano nowych migracji produkcyjnych ani zapisów realnych kont.

**PR:** GitHub API pozostaje blokowane; nie ma potwierdzenia utworzonego PR ani wyniku GitHub Actions. Opis gotowy: SUPERSPRINT_01_PR.md; baza stosu: fix/worker-assign-and-manage-20261017-v01. Kod jest na zdalnej gałęzi.

**Dokładny następny krok:** po odblokowaniu api.github.com sprawdzić istniejący PR po head i utworzyć/uzupełnić Draft według runbooka. Review dwóch nowych propozycji SQL i dwóch rollbacków, a następnie osobno zatwierdzone UAT na odizolowanym Supabase z fikcyjnymi kontami. Nie powtarzać 20261017181541 ani nie scalać/deployować bez zgody. Przed nową implementacją czytać macierz i ostatnie commity.

Dostarczone: STATUS, MATRIX, API, CHANGELOG, DEPLOYMENT i PR w docs/. Historyczne „następne kroki” poniżej są dziennikiem checkpointów, a nie poleceniem ponownego pisania działających funkcji.

Gałąź: `feat/akp-supersprint-01-v01`. Baza: PR #13 `aba9186` (pełny kod zachowany).
Issue: https://github.com/akpvisione-del/akp-commander-hybrid-pro-dev/issues/14

## Zasady kontynuacji
Najpierw przeczytaj ten plik i ostatnie commity. Nie przepisuj ukończonych funkcji.
Każdy pakiet: implementacja → testy na fikcyjnych danych → commit → push → aktualizacja statusu.
Nie wdrażaj na akp.wtf, nie scalaj aktywnej gałęzi, nie zapisuj danych produkcyjnych.
Migracja `20261017181541` i PK `(job_id,worker_id)` są już wykonane według dokumentacji PR #13 i potwierdzenia właściciela. Nie wykonywać ponownie.

## Pakiety
1. Konta monterów: zachować istniejący provisioning/edycję/dezaktywację; dodać regresję przepływu Netlify → Edge → atrapa Supabase i poprawić wykryte błędy.
2. Przydziały: zachować przydziały wielu monterów i historię; wzmocnić walidację i obsługę nieaktywnych kont.
3. Komunikator: ustalić wymagania Issue i istniejący kontrakt trwałości/RLS przed implementacją. Bez wymyślania tabel produkcyjnych.
4. Harmonogram: oprzeć na istniejącym due_date i uprawnieniach; zakres doprecyzować z Issue.
5. UX: obsługa błędów, ochrona sesji i mobilność na bazie PR #13; zachować moduły V19 / field-assistant i integracje.

## Weryfikacja bazy — 2026-10-17
- Odczytano kod PR #13 przez `refs/pull/13/head` i dokumentację wykonanej migracji `docs/sql_applied/20261017_akp_worker_security_v01_APPLIED.sql`.
- 275/275 testów PASS (`npm test`), bez skipów. Są to testy lokalne/mock/static; nie dowodzą live RLS.
- Nie wykonywano odczytu ani zapisu produkcyjnej bazy; stan migracji przyjęty z dokumentacji i instrukcji właściciela.
- GitHub API: CONNECT 403 dla api.github.com; gh issue/pr view zablokowane. Dodanie domeny zapisano w szkicu ustawień środowiska. Oczekiwanie na treść Issue lub zastosowanie dostępu; analiza i znane pakiety kontynuowane.
- Ostatni ukończony commit bazowy: `aba9186`. Hash tego checkpointu: `git log -1 -- docs/SUPERSPRINT_01_STATUS.md` (plik nie może zawierać własnego hasha).

## Dokładny następny krok
Dodać test izolowanego przepływu Netlify API → rzeczywisty handler Edge → mock Auth/PostgREST, wykonać create/edit/deactivate/reactivate, sprawdzić stare JWT i brak ujawnienia finansów. Poprawić błędy wykryte testami, commit i push.

## Checkpoint 1 — konta monterów
- Zakończono test integracyjny rzeczywistych handlerów Netlify i Edge z izolowaną atrapą Auth/PostgREST (bez sieci i realnych kont).
- Zweryfikowano: create, edit, deactivate/reactivate przy niezmienionym JWT, przydział/odpięcie, historia, brak finansów, CSRF, odmowa zmiany roli/loginu/hasła.
- Poprawiono: opaque `sb_secret_` nie trafia do Bearer w starszej ścieżce Netlify; malformed formularze zwracają 422; odpowiedź Edge wymaga poprawnego UUID.
- Testy: `npm run check`, `npm run build`, `npm test` — 280/280 PASS, bez skipów. Live Supabase / RLS nie testowano.
- Poprzedni checkpoint: `a7e8f91`, push potwierdzony. Bieżący commit: `git log -1 -- tests/supersprint-worker-flow.test.js`.
- Następny krok: pakiet przydziałów — odrzucać nieznane i sprzeczne operacje, ukryć nieaktywne konta w selektorze nowych przydziałów, zachować możliwość odpięcia i historię; testy i push.

## Checkpoint 2 — przydziały
- API odrzuca nieznane, źle typowane i sprzeczne operacje przydziału; błędny formularz JSON (null/tablica/skalar) daje 422, bez zapisów.
- Selektor nowych przydziałów pomija nieaktywne konta. Istniejący nieaktywny członek ekipy pozostaje widoczny i możliwy do odpięcia. Historia zostaje zachowana.
- Testy: `npm run check`, `npm test` — 284/284 PASS; `git diff --check` PASS.
- Browser runner PR #13: uruchomienie wymaga zapisywalnego XDG_CONFIG_HOME/XDG_CACHE_HOME w /tmp. Po tej korekcie Chrome wykonał coordinator PATCH, ale przekroczył 23s limit runnera i nie zwrócił dump-dom. Wynik browser QA: FAIL (timeout runnera), nie PASS; wymaga dalszej diagnozy w pakiecie UX.
- Ostatni ukończony moduł: `d10b66b` (konta), push potwierdzony; hash przydziałów: `git log -1 -- tests/supersprint-assignment-ui.test.js`.
- Następny krok: harmonogram tygodniowy na bazie due_date i istniejącego PATCH z expected_updated_at, bez SQL; testy praw dostępu, dat i kolizji. Po tym naprawić/zweryfikować browser runner.

## Checkpoint 3 — harmonogram
- Dodano tygodniowy plan (poniedziałek–niedziela), poprzedni/następny tydzień, wybór tygodnia, filtr ekipy i zlecenia bez daty.
- Koordynator zmienia/usuwa termin przez istniejący PATCH /jobs/:id + expected_updated_at. Konflikt 409 zachowuje wpisany termin. Brak nowego SQL.
- Ostrzeżenia o wielu zleceniach tego samego montera/dnia nie twierdzą, że godziny się pokrywają. Nie wymyślamy godzin ani czasu trwania.
- Monter: harmonogram własnych zleceń, bez edycji, listy ekipy i finansów; etykiety PL/UK/RU/EN. Zamknięte zlecenia poza planem.
- Walidacja kalendarza w API odrzuca m.in. 2026-02-29 i 2026-02-31; dopuszcza prawidłowy rok przestępny i wyczyszczenie daty.
- `npm run check`, `npm run build`, `npm test`: 291/291 PASS. `git diff --check`: PASS.
- NOWY browser QA: `node scripts/qa-supersprint.mjs` — coordinator PASS, worker PASS (rzeczywisty app.js, Chromium, 390px, strict CSP, wyłącznie fikcyjne API). Potwierdzony konflikt 409/zachowanie formularza, udany zapis, brak przepełnienia mobilnego, formularz kont, brak uprzywilejowanych requestów workera.
- Nowy driver używa CDP pipe i izolowanego profilu /tmp; usuwa zależność od dump-dom i virtual-time poprzedniego runnera.
- Poprzedni checkpoint: `29712c9`; hash harmonogramu: `git log -1 -- tests/supersprint-schedule.test.js`.
- Następny krok: pakiet UX — przenieść istniejący runner regresji PR #13 na sprawdzony driver i dodać CI dla gałęzi sprintu. Komunikator czeka na potwierdzony kontrakt Issue #14 / schemat RLS; nie tworzyć tabel produkcyjnych na podstawie domysłów.

## Checkpoint 4 — UX / regresja / CI
- Usunięto timeout starszych runnerów: oba korzystają ze sprawdzonego CDP pipe i tymczasowych profili; zachowano testy oraz screenshoty rzeczywistych paneli.
- `node scripts/qa-real-panels.mjs`: coordinator PASS (PATCH 1), worker PASS (PATCH 0); `node scripts/qa-preview-csp.mjs`: PASS. Rygorystyczny CSP pozostaje bez zmian.
- Włączono 17 istniejących testów `.test.cjs` (recovery + optimistic locking), wcześniej pomijanych przez npm test. Obecnie **308/308 PASS, 0 skipów**; check/build/diff-check PASS.
- CI uruchamia walidację pushów gałęzi sprintu i nowy test `qa-supersprint.mjs`; nie dodano automatycznego wdrożenia.
- Przeglądarkowe pliki wynikowe wyłączono z Git; CI nadal archiwizuje screenshoty.
- Ostatni moduł: `1ad92fa`, push potwierdzony; hash UX/CI: `git log -1 -- scripts/qa-real-panels.mjs`.
- Następny krok: zapisać changelog, runbook wdrożenia i opis Draft PR; spróbować utworzenia Draft PR, zabezpieczyć status ograniczeń dostępu do Issue/PR API. Nie zaczynać komunikatora bez prawdziwego kontraktu danych i wymagań.

## Checkpoint 5 — wznowienie z pełnym Issue i backend komunikatora
- Właściciel dostarczył pełne 28 wymagań; wcześniejsza blokada zakresu NIE OBOWIĄZUJE. API GitHub nadal nie jest potrzebne do implementacji.
- Dodano router /chat i transakcyjne kontrakty RPC: prywatne/generalne rozmowy, opcjonalne job_id, historia/paginacja/szukanie, unread/read oraz powiadomienia.
- Nowy model akp_chat_threads/members/messages unika kolizji z historycznym projektem akp_messages; SQL WYŁĄCZNIE DO PRZEGLĄDU w docs/sql_proposals, poza supabase/migrations.
- RLS i RPC egzekwują aktualny aktywny profil zgodny z JWT, uczestnictwo oraz aktywny przydział powiązanego job_id. Brak bezpośrednich praw zapisu tabel, brak finansów. Odczyt koordynatora zachowuje historię dezaktywowanego konta; wysyłka wymaga aktywnego odbiorcy.
- Idempotencja (thread,sender,client_id), monotoniczne read watermark, indeksy, oryginalny język PL/RU/UK/EN i osobna przyszła projekcja tłumaczeń. Rollback odcina chat bez usuwania danych i bez cofania ochrony 20261017181541.
- Testy API: 5/5 PASS; pełne npm test: 313/313 PASS. Izolowany PostgreSQL16: dawna regresja RLS/TRUNCATE oraz nowa regresja prywatności chat PASS (dwa konta monterów, obcy wątek, stare JWT, dezaktywacja, utrata przydziału, unread, idempotencja, rollback). Kontener bez sieci, brak połączeń z Supabase.
- Poprzedni SHA: 88f5334. SHA checkpointu: git log -1 -- netlify/functions/chat.js. Następny krok: UI komunikatora, powiadomienia, wyszukiwanie, odczyty i przejście do zlecenia; testy browser 390px i desktop, commit/push.

## Checkpoint 6 — UI komunikatora i CI
- Moduł public/chat.js w istniejącej aplikacji: prywatne/generalne rozmowy, job_id, historia z paginacją, wyszukiwanie, unread/read, wewnętrzna plakietka/polling, otwarcie powiązanego zlecenia, PL/UK/RU/EN.
- Szkice i identyfikator ponowienia wyłącznie w pamięci karty, czyszczone przy zmianie sesji. Niepewny wynik wysyłki zachowuje szkic i ten sam client_id. Brak pozorowania sukcesu przy 503.
- Testy: 318/318 PASS. Browser coordinator/worker × 390px/1280px PASS (CSP, touch>=48px, XSS escaping, retry, wyszukiwanie, read badge, job-link). Backend obsługuje prawdziwe queryStringParameters Netlify, nie tylko Express originalUrl.
- CI dodane: chat browser i izolowane SQL chat. Poprzedni commit b5ab622; bieżący SHA: git log -1 -- public/chat.js. Następny krok zgodnie z bieżącym stanem powyżej.

## Checkpoint 7 — Zespół, zaproszenia i historia
- Wyszukiwanie pracowników, filtr aktywni/nieaktywni, liczba przydziałów i przejście monter → zlecenia z możliwością wyczyszczenia filtra.
- Zaproszenie tworzy konto bez hasła i wysyła przez Supabase Auth link do ustawienia własnego hasła. Wymaga zaufanej konfiguracji Edge AKP_APP_ORIGIN; callback nie pochodzi z formularza. Brak domeny kończy operację PRZED tworzeniem konta.
- Usunięto odziedziczone automatyczne DELETE tożsamości w Edge po błędzie provisioningu, zgodnie z zakazem usuwania kont. Niedokończone konto pozostaje bez roli AKP, z komunikatem weryfikacji przed ponowieniem.
- Historia kont/przydziałów: nowe akp_team_events i triggery wyłącznie w SQL REVIEW_ONLY. Payload wyłącznie display_name/preferred_lang/is_active/active; brak haseł/emaili/finansów. Zdarzenia usługi mają actor_id=null i UI jawnie to opisuje. Brak backfill wcześniejszej historii.
- Check/build i 324/324 testy PASS; 71 asercji RLS w izolowanym PostgreSQL16 PASS, w tym monotoniczne read, wiadomości job_id w ogólnym wątku, ochrona audytu i rollback bez kasowania danych.
- Chromium: actual panele, preview CSP PASS; harmonogram/Zespół/zaproszenia/historia/pracownik→zlecenia oraz chat dla obu ról na 390px/1280px PASS. Chat search Enter testuje rzeczywistą obsługę klawiatury.
- Poprzedni SHA ea7c85f, push potwierdzony. Bieżący SHA: git log -1 -- tests/supersprint-team.test.js. Następny krok: końcowa macierz 28 funkcji, instrukcja konfiguracji/deploy i opis Draft PR, bez publikacji.

## Checkpoint 8 — końcowy handoff zakresu Issue #14
- Macierz wszystkich 28 wymagań, dokumentacja API/RPC, instrukcja konfiguracji i oddzielnych bramek release, changelog i gotowy opis Draft PR.
- Nowe SQL i rollback wyłącznie do przeglądu. Brak live Supabase UAT/SMTP/deploy/merge; historyczne limity list i nullable actor_id wyjaśnione w macierzy.
- Checkpoint kodu b2484cd; finalna dokumentacja: git log -1 -- docs/SUPERSPRINT_01_STATUS.md. Kolejne działanie: review/PR oraz odizolowany HTTP UAT po spełnieniu zewnętrznych bramek, bez powtarzania ukończonych modułów.
