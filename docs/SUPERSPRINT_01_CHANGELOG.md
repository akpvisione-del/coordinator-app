# SUPERSPRINT 01 — v02, 2026-10-17

Kontynuacja istniejącego PR #13, bez drugiej aplikacji i bez ponowienia migracji 20261017181541. Pełna macierz A1–D6: SUPERSPRINT_01_MATRIX.md. Kontrakty: SUPERSPRINT_01_API.md.

## Dostarczony kod
- Konta: wyszukiwanie, status i przydziały, edycja, zachowane bezpieczne recovery, zaproszenie do samodzielnego ustawienia hasła, dezaktywacja/reaktywacja bez usuwania danych, nowy audyt kont do przeglądu.
- Przydziały: zachowane wielu monterów i klucz (job_id,worker_id), soft-unassign, odrzucanie sprzecznych poleceń, aktywni kandydaci, obie strony widoku ekipy i nowa historia do przeglądu.
- Harmonogram: tydzień, filtr pracownika, prace bez daty, edycja z CAS/409, kalendarzowe daty i ostrzeżenia tego samego dnia bez wymyślonych godzin.
- Komunikator: prywatne ogólne i powiązane z job rozmowy, trwały model threads/members/messages, RLS i transakcyjne RPC, idempotencja, historia/paginacja, wyszukiwanie, unread/read, powiadomienia wewnętrzne, link do zlecenia. Oryginalny język i kontrakt przyszłych tłumaczeń PL/RU/UK.
- UX: istniejące motywy premium/Unified/V19, duże kontrolki, puste stany, zachowanie szkiców po błędzie, role/CSRF, escaping, klawiatura i bezpieczny reset sesji.
- QA/CI: pełny zestaw JS/CJS, stabilny Chromium CDP pipe, izolowany PostgreSQL16 bez sieci. Zachowane integracje V19, field-assistant i moduły źródłowe; nie pobierano ani nie nadpisywano Gemini NEXT/Claude UI z zewnętrznych źródeł.

## Zapisane checkpointy
- d10b66b konta; 29712c9 przydziały; 1ad92fa harmonogram; f773554 browser/CI.
- b5ab622 backend i RLS chat; ea7c85f UI komunikatora; b2484cd Zespół, zaproszenia i historia.
- Finalny status/sha dokumentacji: git log -1 -- docs/SUPERSPRINT_01_STATUS.md.

## Walidacja
324/324 Node PASS, bez skipów; check/build PASS. 71 asercji rzeczywistego PostgreSQL RLS PASS (dwa konta, obcy wątek, stare JWT, dezaktywacja, utrata przydziału, wiadomości job w ogólnym wątku, monotoniczny odczyt, audyt, rollback).
Chromium: actual panele, strict CSP preview, chat i Zespół/harmonogram dla obu ról na 390px i 1280px PASS. Test Enter-search, retry z tym samym client_id, braku overflow i targetów dotykowych >=48px. Regresje PWA/manifestu/cache w npm test PASS.

## Pozostałe bramki
Nowe migracje chat i audit oraz ich rollbacki są wyłącznie REVIEW_ONLY. Nie wykonano live Supabase HTTP E2E, prawdziwej wysyłki maila, nowych migracji produkcyjnych, deploy ani merge. Chat/audit bez zatwierdzonego schematu zwracają jawne 503; zaproszenie wymaga Edge AKP_APP_ORIGIN oraz konfiguracji Auth email/redirect.
Push potwierdzany po każdym module. GitHub API było blokowane, więc nie deklarujemy utworzonego PR ani zielonego GitHub Actions; kompletny opis PR przygotowano w SUPERSPRINT_01_PR.md. Granice historii i limitu list są jawne w macierzy.
