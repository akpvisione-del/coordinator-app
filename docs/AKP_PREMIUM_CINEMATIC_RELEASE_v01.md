# AKP Premium Cinematic v01 + Commander v11.1

Data: 2026-10-14. Status: KANDYDAT_RELEASE / GOTOWY LOKALNIE, NIE OPUBLIKOWANY NA AKP.WTF.

## Co jest nowe
- Osobna, responsywna strona AKP Premium Cinematic `public/landing.html`.
- Metaliczne logo renderowane w WebP, biała/czarna/czerwona kolorystyka, przestrzenny pulpit i telefon, światła/cienie, delikatna paralaksa, 3D CSS.
- Zawsze widoczny przycisk „Zaloguj się” i CTA prowadzące do `/login`.
- Tło dźwiękowe Web Audio: autorska syntetyczna tekstura — bas jaskiniowy, smyczkowo-dęty nastrój — uruchamiana i zatrzymywana wyłącznie po kliknięciu. Nie ma autoplay ani licencjonowanych nagrań.
- `netlify.toml`: tylko nowa reguła `/ -> /landing.html` i `/login -> /index.html`; API i wcześniejsze role/ścieżki bez zmian.
- Zachowane oryginalne `public/index.html`, `public/app.js`, `netlify/functions/api.js`, `server.js`, pozostałe pliki v11.1. Uwaga: źródłowy ZIP v11.1 nie zawierał `sql/004_minimal_operational_migration.sql` — należy wdrażać ze zweryfikowanego repo PR #3, gdzie on istnieje.

## Gdzie otworzyć
- Podgląd strony: `public/landing.html` (obsługuje `file://`, ale strony logowania wymagają serwera).
- Aplikacja: `public/index.html` w istniejącym systemie API.
- Po wdrożeniu Netlify: `https://akp.wtf/` = strona główna, `https://akp.wtf/login` = logowanie.
- Po lokalnym uruchomieniu `python3 -m http.server 8080 -d public` otwieraj `/landing.html` oraz `/index.html`; zwykły serwer Python nie emuluje reguł Netlify.
- Po uruchomieniu `npm start` (jeśli skonfigurowano środowisko i wykonano instalację): `/landing.html`, `/index.html`, `/api/health`.

## Bezpieczne opublikowanie
1. Ustal przypisany do `akp.wtf` konkretny Netlify Site ID i obecny deploy ID.
2. Zrób kopię obecnego deploy i potwierdź możliwość rollback.
3. Ustal źródłowe repo i branch Netlify oraz wymaganą gałąź v11.1. PR #3 ma STATUS DRAFT; nie scalać do main automatycznie.
4. Ustaw `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `APP_ORIGIN=https://akp.wtf` w Netlify Variables tylko po potwierdzeniu właściwego środowiska. Bez sekretów w repo.
5. Opublikuj jako Site deploy ze źródeł PR #3 + nowe pliki. Potwierdź `GET /api/health` i zalogowanie. API musi działać — przeciągnięcie samych statycznych plików do Netlify nie wystarczy.
6. Przejdź szybki smoke: `/`, `/login`, logowanie, odczyt i zapis testowego zlecenia w staging, test dwóch ról (monter nie widzi finansów), działanie `akp.wtf` i rollback.
7. Nigdy nie przenoś niezależnej bazy staging do produkcji bez osobnej decyzji, nie uruchamiaj SQL004 samodzielnie.

## Testy
- `node --check` (landing.js, app.js, API) — zaliczone.
- QA Chromium: przeglądarka 360/390/430/768/1280/1440 px, 0 JS exceptions, 0 overflow; przycisk muzyki włącza się i wyłącza w 390px. Szczegóły: `docs/QA_CHROMIUM.json`.
- Test prawdziwego Netlify deploy, logowania, bazy Supabase i urządzenia Android: NIEMOŻLIWY BEZ WERYFIKOWALNEGO DEPLOY — DO WYKONANIA.

## Known issues / tradeoffs
- 3D na stronie to animacja i kompozycja CSS, a nie prawdziwy engine WebGL. Działa lekko na telefonach; respektuje `prefers-reduced-motion`.
- Tożsamość znaku AKP w WebP — stylizacja wygenerowanego logo, nie potwierdzony plik wektorowy 1:1 z księgi znaku.
- Audio jest generowane proceduralnie; przeglądarki mogą blokować syntezę lub urządzenie może nie wspierać Web Audio; przycisk domyślnie wyłączony.
- Ekrany pokazują przykładowe etapy i NIE prezentują prawdziwych klientów ani danych.
- Produkcja `akp.wtf` oraz host Netlify nie zostały zmienione w tej paczce.

## Złoty Łańcuch
KANDYDAT: uniwersalny moduł Landing Cinematic (`akp-cinematic.css/.js` + SEO/CTA/sound), lecz nie dodawać do katalogu bez weryfikacji powtarzalności.
