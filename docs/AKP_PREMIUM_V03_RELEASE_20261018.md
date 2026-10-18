# AKP Premium Operations v03 — wydanie 18.10.2026

## Zakres

Warstwa wizualna istniejącej aplikacji została przebudowana bez zmiany kontraktów Auth, API i RLS. Nowy wygląd obejmuje stronę główną, logowanie, pulpit, listę i kartę zlecenia, Zespół, harmonogram, komunikator, Wyceny PRO, materiały, zdjęcia oraz DrawingCanvas. Zachowano role koordynatora i montera, ukrywanie finansów po stronie backendu, motyw jasny/ciemny i `prefers-reduced-motion`.

Najważniejsze zmiany:

- spójny system powierzchni, odstępów, typografii i akcentów czerwieni AKP / błękitu operacyjnego;
- trzy kolumny kart zleceń na dużym ekranie i dwie zwarte kolumny na telefonie;
- czytelniejszy pulpit z hierarchią priorytetów i planem dnia;
- przyklejone szybkie akcje i nawigacja sekcji karty zlecenia;
- profesjonalne prezentacje formularzy, wycen, materiałów, galerii, canvasu i wiadomości;
- krótsze etykiety dolnej nawigacji mobilnej, bez nakładania tekstu przy 390 px;
- nowa prezentacja publicznej strony AKP Commander i ekranu logowania.

## Kontrola wydania

- `npm run check` — PASS.
- `node scripts/qa-visual-sprint.mjs` — PASS: 40 widoków aplikacji, role koordynator/monter, 390/1280 px, jasny/ciemny motyw, dostępność kontrastu, pola dotykowe i ograniczenie animacji.
- `git diff --check` — PASS.
- Po wypchnięciu `main`: `npm test` — 340/340 PASS.
- Po wypchnięciu `main`: rzeczywiste panele z syntetycznym API, SUPERSPRINT, komunikator i Netlify CSP — PASS.
- Po wypchnięciu `main`: Wyceny PRO, materiały, prywatne zdjęcia i DrawingCanvas w przeglądarce — PASS.
- Po wypchnięciu `main`: izolowany PostgreSQL RLS oraz rollback — PASS, 128 asercji.

Testy użyły wyłącznie danych fikcyjnych i lokalnego PostgreSQL. Fizyczny Android oraz produkcyjne Auth/Storage pozostają do sprawdzenia. Publikacja kodu nie wykonuje migracji SQL.

## Wdrożenie i rollback

Punkt rollbacku repozytorium przed wydaniem: `origin/main` = `277e06d17ea869f85bbea6878bbbe22a13ea529b`. Gałąź źródłowa SUPERSPRINT 03 przed warstwą v03: `bad3974666b805a3d04a051664943b91eb4f0725`.

Wydanie jest publikowane przez fast-forward gałęzi `main` po zapisaniu osobnej gałęzi `release/akp-premium-v03-production-20261018`. Cofnięcie prezentacji należy wykonać nowym commitem usuwającym odnośniki do `akp-premium-v03.css` i `akp-cinematic-v02.css`; nie cofać ani nie kasować danych Supabase.

## Ograniczenia środowiska

To środowisko nie posiada poświadczeń administracyjnych Netlify ani Supabase. Bezpośredni odczyt `https://akp.wtf` jest blokowany przez bramę sieciową, dlatego wynik automatycznego deployu Netlify musi zostać potwierdzony po stronie hostingu lub przez późniejszy odczyt strony. Propozycje SQL SUPERSPRINT 03 pozostają REVIEW_ONLY i nie są wykonywane przez build; bez ich osobno kontrolowanego zastosowania nowe moduły trwałego zapisu mogą zwracać `503`, zachowując szkic w sesji.
