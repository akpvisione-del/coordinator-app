# AKP Commander Unified v02 — Design System & adapter V19
**Data:** 2026-10-16 | **Status:** TESTOWA/DEV | **PR:** #7 | **Publiczna produkcja:** BEZ ZMIAN.

## Rozdzielenie źródeł prawdy
- GitHub (ten PR) = jedyny aktualnie rozwijany kod Commander.
- Supabase Auth/PostgREST = konto i dane runtime, zabezpieczenie RLS; bez migracji.
- Google Drive / projekt Zlecenia = źródło ustaleń operacyjnych. Dwustronny stały most NIE jest jeszcze uruchomiony.
- AKP V19 ZIP = historyczna referencja funkcji i grafiki; lokalny IndexedDB nie może zastąpić serwerowych rekordów Commandera.

## Warstwa Premium Design System
Nowy `public/akp-unified.css`, dołączony po dotychczasowych arkuszach wyłącznie do zalogowanego `#appView`. Paleta AKP czerwony/biel/grafit, tokeny Light i Dark, konsekwentne odstępy i promienie, jednolita nawigacja mobilna, karty, formularze, dashboard i informacje systemowe. Wszystko CSS — brak zmian zapisu i autoryzacji.

| Ekran | Zmiana | Limit |
|---|---|---|
| Pulpit | równe KPI, hierarchia liczb, kontrast | liczby wyłącznie z istniejącego API |
| Zlecenia | 2 kolumny 350–660px, długie numery nie rozpychają kart | szczegóły pozostają odrębną stroną |
| Szczegóły | ujednolicony panel, akcje, nawigacja sekcji | zapis przez stary bezpieczny PATCH |
| Edycja | kontrast, focus, inputy, siatka jednokolumnowa w telefonie | nie dotyka walidacji |
| Monter | kontakt/nawigacja, cel 48px dla podstawowych akcji | bez dostępu do kwot klienta |
| Zespół | ujednolicona lista kart | tworzenie kont wyłącznie admin/Auth |
| Raporty | karty, akcje akceptacji, czytelna typografia | brak nowego storage |
| System | formularze, kontrast, źródła i historię w starej logice | Google OAuth nadal niedokończony |

**Uwaga QA:** statyczny podgląd `/unified-design-system.html` używa wyłącznie danych DEMO. Nie stanowi dowodu rzeczywistego działania tych ekranów. Live UAT na Androidzie oraz test przydziałów i zapisów są wymagane.

## Kontrolowana integracja AKP V19: mapa modułów
| Źródło V19 | Kategoria | Bezpieczne podejście | Status |
|---|---|---|---|
| `src/completeness-guard-v2.js` | kontrola kompletności wycen | odseparowana logika bez podpinania do API; porównać cenniki i VAT | PLAN |
| `src/decision-map-domain.js` | ścieżka zakres/ilości/stawki | bez danych klienta, adapter formularza i walidacja | PLAN |
| `src/focus-documents.js` | PDF i dokumenty | generowanie z wersjonowanych snapshotów, bez zapisu przy preview | PLAN |
| `src/v19-workflow.js` | kalendarz/kolizje/obsada | adapter dat, konfliktów, grup ekip; wymaga nowego serwerowego kontraktu | PLAN |
| `src/v19-domain.js` i schemat AKP Exchange | snapshot/delta, rewizje i konflikty | adapter dry-run `integrations/v19/preview-exchange.cjs` | **GOTOWY DO TESTÓW** |
| `src/storage.js` | IndexedDB lokalny | archiwum offline; NIE łączyć automatycznie z Supabase | WYŁĄCZONE |
| `src/v19-app.js` | UI v19 | referencja wzorców, zakaz kopiowania klienta, danych i całego runtime | REFERENCE |

## Adapter V19 — kontrakt pilotowy
`prepareReview(packet)` akceptuje tylko `AKP-Exchange` schemaVersion=1 z maks. 10 000 operacji i maks. 4 MB JSON. Nie interpretuje nazwy klienta jako tożsamości zlecenia.
- `orders`: wymaga zgodności id/uid; manualne mapowanie do `akp_jobs` z potwierdzonymi identyfikatorami.
- `events`: przygotowuje nieszkodliwy kandydat (tytuł, data, źródłowe ID), ale przypisania wymagają sprawdzenia.
- `tasks`: review schematu i właściciela zadania; brak zapisu.
- `workers`: nie tworzy użytkownika Supabase Auth.
- `archive` i duplikaty: blokada, żadnego usuwania.
- Zwraca `writes:0`, `requiresApproval:true`; nie ma fetch/DB/SQL.

**Warunek uruchomienia rzeczywistych zapisów V19 w przyszłości:** zatwierdzony kontrakt API, klucz UUID z mapą źródłową, snapshot/backup, porównanie pól i kosztów, obsługa 409, izolacja uprawnień, osobna zgoda na pilot i rollback. Nie wolno importować całej kopii IndexedDB jako bazy Commander.

## Kontrola jakości i release gate
1. JS syntax + wszystkie testy Node oraz SQL static.
2. Netlify Preview PR #7 PASS (nie gwarantuje działania prywatnego API).
3. Manualnie Android 350/360/390/430/660 px: brak poziomego przewijania, karta dotykowa 48px, czytelne stany, Light/Dark.
4. Zalogowany koordynator i odrębny worker (bez finansów).
5. `edit -> refresh -> readback`, 409 stale edits, zgłoszenie i akceptacja raportu.
6. Dopiero po osobnej zgodzie i zapisaniu bieżącego deploy ID/rollback publikacja akp.wtf.

## Zmiany względem Unified v01
**DODANO:** `public/akp-unified.css`, `public/unified-design-system.html`, adapter V19, testy i plan integracji.
**ZMIENIONO:** `public/index.html` (wyłącznie link CSS).
**NAPRAWIONO:** wspólna paleta i wygląd wielu ekranów.
**USUNIĘTO:** nic.
**MIGRACJE:** brak.
**NIEZROBIONE:** rzeczywista integracja wycen/kalendarza/PDF z backendem, produkcyjny deploy, odbiór na Androidzie, konta monterów, prawdziwe zdjęcia w Storage, ciągła synchronizacja Google.
**ROLLBACK:** wyłączyć link akp-unified.css albo cofnąć PR/commit (bez zmian bazy).
