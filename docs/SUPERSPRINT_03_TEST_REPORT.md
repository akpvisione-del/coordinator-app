# SUPERSPRINT 03 — raport testów

Wyniki lokalne, 2026-10-17. Tylko dane fikcyjne. Nie wykonano prób na kontach klientów ani produkcyjnym Supabase.

| Kontrola | Wynik |
| --- | --- |
| `npm ci --ignore-scripts` | PASS z lockfile, Node 24; CI skonfigurowane na Node 20, nie uruchomiono zdalnego CI |
| `npm run check && npm test` | 340/340 PASS, zero pominiętych |
| `npm run build`, `git diff --check` | PASS |
| `bash scripts/test-supersprint-rls.sh` | 128 asercji PASS, lokalny PostgreSQL 16, `--network none`; stare sprinty + cztery nowe propozycje i rollbacki |
| `node scripts/qa-pro.mjs` | 390/1280, jasny/ciemny, zapis pozycji / wariantów, sumy, brak wycen w UI montera |
| `node scripts/qa-materials.mjs` | 390/1280, oba motywy i role; ręczne pozycje i odnośniki do wyceny, wąski zapis statusu montera, brak stawek |
| `node scripts/qa-media.mjs` | 8 kombinacji rola × szerokość × motyw; PNG 640×480 z canvas, binarny upload do atrapy, podgląd i wersja opisu |
| `node scripts/qa-drawing.mjs` | 8 kombinacji, prawdziwe zdarzenia CDP touch, 4 narzędzia, undo/redo, klawiatura, zachowanie szkicu po 503 i UUID retry, zapis dwóch wersji, odczyt starej, rzeczywisty eksport PNG / JSON |
| `node scripts/qa-function-bundle.cjs` | PASS: przeniesiony bundle esbuild, dołączony font, moduł PDFKit, pełny authenticated handler i prawdziwe bajty PDF |
| `pdftotext` na PDF demo | PASS: polskie znaki, netto 225,00 / VAT 51,75 / brutto 276,75 PLN |
| `qa-real-panels.mjs`, `qa-supersprint.mjs` | PASS: wcześniejsze panele, edycja/readback, przydziały/konta, CAS harmonogramu, brak finansów u montera |
| `qa-chat.mjs`, `qa-preview-csp.mjs` | PASS: komunikator w 4 kombinacjach oraz istniejący podgląd pod ścisłym CSP |
| `qa-visual-sprint.mjs` + gallery | PASS: 40 widoków / 80 obrazów, 2 role / motywy / rozdzielczości, układy, kontrast, dotyk, reduced-motion, galeria bez sieci |
| Start `npm run dev`, health, `/koordynator` | PASS: serwer i zasoby nowego modułu; nie dowodzi autoryzacji rzeczywistego Supabase |

Testy PostgreSQL obejmują: finansowe RPC niedostępne monterowi, zgodność aktualnej roli i aktywności z JWT, operacyjne projekcje materiałów bez dokumentu wyceny, własne/obce i wspólne zlecenia, zablokowane bezpośrednie zapisy, CAS, idempotencję, zachowanie pierwotnych metadanych, zakaz potwierdzania nieistniejącego pliku, guardy Storage przy szerokich politykach koordynatora i anonima, brak nadpisywania/usuwania oryginałów, hash rysunku i zachowanie danych po rollbackach. Testy JS dodatkowo sprawdzają pozostałe po poprzedniej sesji odpowiedzi wszystkich czterech nowych kontrolerów.

Znaleziona niestabilność testu komunikatora: czekał na tekst nowej wiadomości, po czym klikał nadal zablokowany przycisk podczas końcowego odświeżenia. Poprawiono oczekiwanie na aktywny przycisk; nie osłabiono asercji i nie zmieniono logiki komunikatora.

Ograniczenia dowodów: emulacja Chrome nie jest fizycznym Androidem; RLS działa w minimalnym syntetycznym schemacie PostgreSQL, a HTTP Storage/Auth jest atrapą. Osobny staging po zatwierdzeniu SQL oraz test telefonu pozostają wymagane przed publikacją. PWA: aktualny manifest/SW i istniejące testy przechodzą; nie wykonano ponownej instalacji PWA na fizycznym urządzeniu. Zdalnego GitHub Actions nie odczytano. Żadnego produkcyjnego wdrożenia / SQL.
