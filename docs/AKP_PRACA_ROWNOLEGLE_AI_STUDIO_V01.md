# AKP COMMANDER — PRACA RÓWNOLEGŁA CHATGPT + GOOGLE AI STUDIO v01

Data: 2026-10-11
Repozytorium: akpvisione-del/akp-commander-hybrid-pro-dev
Backend SQL/API — gałąź: fix/sql004-unified-20261011
Google AI Studio — projekt akp-commander-ai-studio, połączenie GitHub z main (nie jest tym samym co gałąź fix).

## Zasada podziału

**CHATGPT**: wyłącznie `sql/**`, `netlify/functions/**`, `tests/**`, `.github/workflows/**`, dokumentacja podsumowań. Nie aktualizować `public/**` w trakcie sesji Gemini bez uzgodnienia.

**GEMINI w AI Studio**: wyłącznie `public/app.js`, `public/styles.css`, `public/index.html` — rozwój interfejsu istniejącej aplikacji.
**Nie synchronizować ani nie pushować zmian do GitHub** z AI Studio do czasu ręcznego scalenia. AI Studio jest na main, backend gałęzi fix/sql004 ma nowszy kontrakt, dlatego po wykonaniu Gemini przesłać listę zmian/diff do ChatGPT i przeprowadzić porównanie. Nie wywoływać `Przywróć` starszy snapshot.

Żadna strona nie może bez osobnej zgody: uruchamiać migracji SQL, tworzyć użytkowników lub bucketów Supabase, wysyłać wiadomości do klientów, modyfikować `akp.wtf`, ustawiać zmiennych Netlify prod lub publikować nowego deploymentu.

## Zadanie Gemini ETAP FRONTEND F01 — 1 kontrolowany pakiet

Pracuj NA ISTNIEJĄCYM KODZIE projektu; nie twórz nowej aplikacji, nowego frameworka ani nowej wersji DEMO. Zmień wyłącznie `public/app.js`, `public/styles.css`, `public/index.html`. Zachowaj wygląd i mobilny panel montera, języki PL/UK/RU/EN, finanse wyłącznie dla koordynatora, existing login, backend endpoints. Nie ruszaj `netlify/functions/api.js`, `sql/**`, `tests/**`, GitHub, Supabase, Netlify, `akp.wtf`.

Wykonaj dokładnie 3 funkcje:

1. **Edycja istniejącego zlecenia** dla koordynatora: przycisk „Edytuj” na karcie zlecenia, formularz z polami: nazwa, referencja, AKP ID, LM, iProc, nazwa klienta, telefon, adres, e-mail, lokalizacja, termin, priorytet, status, instrukcje. Wysyłaj wyłącznie do istniejącego `PATCH /jobs/:id`. Odczyt bazuj na `GET /jobs/:id` i `STATE.detail`. Zapis: wyraźny feedback, obsługa 409/422, kontrola pól; nie zgaduj nowych endpointów. Gdy brak danych, pokaż puste pola zamiast fikcyjnych.
2. **Kilku monterów na jednym zleceniu**: widok przypisanych członków ekipy i osobne przyciski „Dodaj montera” oraz „Odepnij [osobę]”. Endpointy `POST /jobs/:id/assign` z `{worker:uuid}` i `{action:'unassign',worker:uuid}`. Aktywne przydziały z `GET /jobs/:id` pole `assignees`; lista pracowników z `GET /team`. Koordynator może podejrzeć obu; nie pokazuj tylko jednego `assignee` jeśli ma więcej. Nie usuwaj historii przydziałów lokalnie ani w bazie.
3. **Usuń fikcyjne logowania**: `fillCoord`, `fillWorker`, `coord@firma.pl`, `monter@firma.pl`, `haslo123`, komunikat `DEMO_IN_MEMORY` z UI. Zostaw normalny formularz Auth Supabase. Brak działającej konfiguracji => czytelny komunikat, bez danych DEMO.

**Nie modyfikuj przepływu zdjęć** — ChatGPT na gałęzi fix/sql004 już dopasował pełne UUID i ostrzeżenie o wyłącznie lokalnym podglądzie. Gdy scalamy gałęzie, zachowamy te poprawki. Nie udawaj trwałego uploadu, dopóki Storage nie zostanie wdrożony.

Wymagania: responsywność 360/390/430/768, min 44 px elementy dotykowe, brak h-scroll, formularz można w całości obsłużyć na Androidzie, bez zmiany architektury. Nie zmieniaj całego motywu. Jeden prosty test interakcji edycja → zapisz → odśwież; dodaj → odepnij; brak demo login. Nie wykonuj wielu kosztownych iteracji/previews i nie deklaruj powodzenia bez weryfikacji.

**Wyjście Gemini:** lista plików i fragmentów, trzy krótkie scenariusze manualne, błędy/blokady i gotowy diff/lista zmian do późniejszego scalenia. NIE klikaj `Prześlij zmiany do GitHub`, nie publikuj.

## Zadania ChatGPT podczas pracy Gemini

1. Sprawdzić GitHub Actions dla gałęzi fix/sql004 i odczytać logi (przy ograniczeniach narzędzi poprosić o zrzut).
2. Sprawdzić stan Supabase staging wyłącznie GET/SELECT. Projekt staging `ttectcuirgdakjhpkkll` istnieje, ACTIVE_HEALTHY, 3 dotychczasowe migracje, bez Supabase branch i bez bucketów Storage. Drugi widoczny projekt `hhudjjrvvpzwjghijrft` ma status INACTIVE. NIE oznacza to dowodu, że staging jest niezależny od Netlify prod.
3. Przygotować checklistę backupu: schemat, dane, auth.users, storage schema i możliwość odtworzenia; obecne narzędzia nie potwierdzają wykonania backupu.
4. Doprowadzić migrację SQL004 do finalnego PASS na wskazanej gałęzi bez wykonywania DDL/SQL na staging.
5. Po wyniku Gemini: zebrać zmiany frontendu i scalić na jednym commicie DEV po sprawdzeniu konfliktów. Nie pushować z AI Studio samodzielnie.

## Bramki

- Kod frontend: formularze działają z REALNYMI endpointami /jobs/:id, /assign; brak test kont/login; worker nic nie widzi z finansów.
- Kod backend: CI `npm run check` + `npm test` + parser PostgreSQL potwierdzone na ostatnim SHA.
- Staging: backup + izolacja prod potwierdzone **przed** SQL.
- Produkcja: testy E2E, zdjęcia fizycznie przechowywane, osobna zgoda.

**GO do pracy równoległej; NO-GO do migracji i publikacji.**
