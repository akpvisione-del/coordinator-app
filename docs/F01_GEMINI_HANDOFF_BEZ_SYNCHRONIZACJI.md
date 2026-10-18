# AKP Commander — odbiór F01 z Google AI Studio (do scalenia)

**Źródło:** raport Gemini 3.8 Flash przekazany przez właściciela w rozmowie, 2026-10-11. Opis deklaruje wykonanie FRONTEND F01 w **lokalnym projekcie AI Studio**. Nie jest to potwierdzenie zawartości repozytorium GitHub.

## Deklarowane zmiany (NIE POTWIERDZONE PRZEZ DIFF)
- Tylko `public/app.js`, `public/styles.css`, `public/index.html`.
- Edycja zlecenia w UI: formularz, PATCH /jobs/:id, walidacja oraz anulowanie.
- Przypisanie kilku monterów: lista, dodanie/odpięcie pojedynczej osoby z potwierdzeniem.
- Usunięcie skrótów DEMO logowania i próbnych kont.
- Gemini raportuje "32 tests passed", `npm run check`, `compile_applet` — wyniki **niezweryfikowane** na obecnym commicie backendowej gałęzi `fix/sql004-unified-20261011`.

## Ważne: zachować świeże zmiany AI Studio
- **NIE uruchamiać Pull/Pobierz zmiany z GitHuba i NIE używać Push/Prześlij zmiany ani Przywróć snapshot** przed przygotowaniem kopii F01.
- W pierwszej kolejności wykonać eksport/download lokalnej wersji AI Studio do ZIP albo inne jawne wydzielenie 3 zmienionych plików.
- Zapisana gałąź SQL/backend NIE ZAWIERA nowych zmian F01, dopóki nie dostaniemy źródeł.
- Zachować też różnice frontendu dotyczące pełnego UUID w ścieżce zdjęć i komunikatu "podgląd lokalny", które wcześniej naprawiono w `fix/sql004-unified-20261011`. Po scaleniu F01 sprawdzić obydwa fragmenty.

## Kontrakt API zweryfikowany z kodu backend gałęzi fix/sql004-unified-20261011
- `GET /team` — lista `items` z `id` i `display`; **NIE /zespół**.
- `GET /jobs/:id` — `job.assignees` (tablica UUID aktywnych przypisań), `job.assignee` legacy.
- `POST /jobs/:id/assign`, body `{"worker":"<uuid>"}` — przypisanie.
- `POST /jobs/:id/assign`, body `{"action":"unassign","worker":"<uuid>"}` — odpięcie bez usuwania historii.
- `PATCH /jobs/:id` — pola `title,reference,akp_id,lm_number,iproc_number,client_name,client_phone,client_email,client_address,location,due_date,status,priority,instructions`. `due_date` oznacza termin zlecenia, nie termin płatności. Instrukcje maks. 2500 znaków.
- `akp.wtf`, Supabase staging, Netlify NIE podlegały pracom F01.

**Uwaga o tłumaczeniu raportu:** w przekazanym raporcie część nazw endpointów, właściwości i wartości została automatycznie przetłumaczona na polski. Weryfikować **surowy kod F01**, a nie nazwy występujące w tłumaczonym raporcie.

## Następna bramka
1. Zabezpieczyć kopię 3 plików F01 (bez GitHub Push/Pull).
2. Porównać `public/*` F01 z backend gałęzi fix; scalić ostrożnie, sprawdzić pełne UUID zdjęć i wszystkie 4 języki.
3. Uruchomić `npm run check`, `npm test`, parser `pglast` dla scalonego HEAD.
4. Potwierdzić backup staging, izolację prod Netlify i zgodę na migrację SQL004.

**Stan: GO dla bezpiecznego przejęcia i weryfikacji F01. NO-GO dla SQL004 i wdrożenia.**
