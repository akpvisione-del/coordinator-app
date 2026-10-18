AKP COMMANDER UNIFIED v02.2 — CSP HOTFIX
Data: 2026-10-16 | Status TESTOWA / DEV | PR #7 | NIE PRODUKCJA

INCYDENT
Właściciel przesłał zrzuty ekranów z Androida: biała strona bez stylów, domyślne czcionki, brak kart i układu. Wcześniejszy lokalny Chromium renderował dobrze, bo badano zawartość HTML bez rzeczywistych nagłówków HTTP Netlify.

POTWIERDZONA PRZYCZYNA
netlify.toml nakłada Content-Security-Policy: style-src 'self'; script-src 'self' bez unsafe-inline. Preview v02.1 zawierało własny osadzony element style, skrypt bez src oraz 7 atrybutów style. Przeglądarka blokowała je na hostingu.

POPRAWKA v02.2
1. public/unified-design-system.html — wyłącznie struktura, bez osadzonych styli, skryptów lub atrybutów style.
2. public/unified-preview.css i public/unified-preview.js — osobne pliki własnego hosta; linki z numerem wersji v=20261016-022.
3. public/app.js — usunięto 14 niedozwolonych atrybutów style z rzeczywistej aplikacji: edycja zlecenia, ekipa, raport montera, zdjęcia, finanse, filtry. Tylko klasy CSS, bez zmiany API, logiki biznesowej, kont i ról.
4. public/akp-unified.css — reguły #appView .akp-u-* zastępujące niedozwolone style dla prawdziwych formularzy.
5. scripts/qa-preview-csp.mjs — test Chrome wykonujący HTTP serwer pod identycznym nagłówkiem CSP, sprawdzający rzeczywistą obecność kolorów, czcionki, nawigacji, wyszukiwarki i motywu.
6. tests/unified-v02-and-v19-review.test.js — regresje braku inline styles.

TESTY
GitHub Actions dla wprowadzenia QA-browser #38828537098 SUCCESS; w logach AKP CSP browser smoke: PASS; Chrome exit 0.
Końcowa kontrola pełnego zakresu będzie potwierdzona osobno z ostatniego commitu przed release.
Poprzednie testy page.set_content nie wystarczały, ponieważ nie weryfikowały nagłówka Netlify.
Nie poluzowano CSP ani nie dodano unsafe-inline.

GRANICE
Test przeglądarkowy potwierdza poprawne załadowanie DEMO na tym samym poziomie CSP co Netlify, NIE zalogowany panel na fizycznym Androidzie.
Do potwierdzenia: operacyjny koordynator + worker, logowanie, karty, zdjęcia, edycja -> odświeżenie -> odczyt, RLS, rzeczywiste wymiary i ergonomia.
Nie publikowano akp.wtf, nie wykonywano SQL, nie zmieniano Supabase, nie wysyłano danych.

ROLLBACK
Cofnięcie commitów PR #7. Pakiety v02 i v02.1 zachowane bez nadpisywania. Nowe wydanie v02.2 osobnym folderem TESTOWA.

LINKI
PR #7: https://github.com/akpvisione-del/akp-commander-hybrid-pro-dev/pull/7
DEV preview: https://deploy-preview-7--coordinator-a.netlify.app/unified-design-system.html?v=20261016-022
Dokument poprzedniego audytu: https://docs.google.com/document/d/1AdA_eIeRxQyH7izBFzu-EILmzbsV9QSPdq6fkeofFJk/edit
