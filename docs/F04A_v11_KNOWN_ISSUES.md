# AKP F04A v11 — znane ograniczenia / status

- Pełny agent AI **NIE** jest podłączony; plany są lokalnymi szablonami, niewykonywalnymi bez osobnej przyszłej integracji.
- Rozpoznawanie głosu korzysta z Web Speech API przeglądarki; dostępność zależy od dostawcy, zgód i jakości sieci, a dostawca przeglądarki może zdalnie przetwarzać audio.
- Żadna informacja wypowiedziana w nowym komponencie nie jest wysyłana przez AKP do serwera; operacja „Kopiuj” na życzenie trafia do systemowego schowka.
- Brak wiarygodnego `category/work_type` w lekkiej liście `GET /api/jobs` — komendy branżowe działają tylko dla pozycji o jawnej metadanej; UI nie zgaduje typu.
- Terminy w aktualnym API są datą, nie porą dnia. Żądanie „jutro o 10” jest szkicem, bez zapisu godziny.
- Finanse i role wymagają egzekwowania w API; UI-only preview nie jest autoryzacją.
- SQL004 oraz binarne zdjęcia Supabase Storage wciąż NIE wdrożone; niedozwolone wdrożenie produkcyjne.
- Wersja offline bazuje na danych przykładowych, nie sprawdza prawdziwego logowania, RBAC, API, Supabase czy poczty.
- Macierz Playwright to emulacja rozmiaru w Chromium, **nie** rzeczywisty test na fizycznym Androidzie ani audyt WCAG.
- Testy statyczne SQL004 z artefaktu CI bez SQL nie działają lokalnie; pełny pipeline GitHub ma dostęp do pliku. Brak migracji SQL w tym etapie.
- Komponent zapisuje preferencję gęstości lokalnie (`localStorage`), nie przechowuje wypowiedzi ani nagrań. Użytkownik może wyczyścić preferencję przeglądarki.

**Status:** DEV/QA, DRAFT PR #3, NO-GO na akp.wtf. Kolejny etap F04B wymaga niezależnej zgody i procedury backup/restore.
