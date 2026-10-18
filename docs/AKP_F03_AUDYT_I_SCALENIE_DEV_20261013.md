# AKP Commander Hybrid Pro — audyt F03 i przekazanie DEV

Data: 2026-10-13. **Tylko gałąź DEV** `merge/f03-ui-20261013`; baza Supabase, Netlify i produkcyjny `akp.wtf` nietknięte.

## Źródło F03

- ZIP przekazany przez właściciela: `akp-commander-hybrid-pro (1).zip`, 77 757 bajtów, SHA-256 `48e84fae3c347130aba221a4718da693f33fc34a3d55064163fc15e35fa24c90`.
- 19 plików w ZIP, w porównaniu z pierwotnym ZIP F02 zmieniły się tylko `public/app.js` i `public/styles.css` oraz niepotrzebnie brak kilku plików `.*` (np. workflow, .gitignore). **Nie importowano brakujących/archiwalnych plików.**
- Importowano wyłącznie `public/app.js` i `public/styles.css`; obecny `public/index.html`, backend, testy F02 i SQL004 pozostały z gałęzi bazowej `merge/f01-f02-20261011`.

## Funkcje

- Nowe duże karty zleceń z priorytetem, terminem, klientem i ekipą.
- Filtr tekstowy dla LM/AKP/iProc/klienta/adresu i chipy statusów i terminów.
- Szczegóły zlecenia z pięcioma sekcjami: Informacje, Ekipa, Zadania, Zdjęcia, Wycena (tylko koordynator).
- Responsywny interfejs mobilny, dostępy dopasowane do koordynatora i montera.

## Usterki F03 wykryte i naprawione

1. Przywrócenie uciętego ośmioznakowego identyfikatora autora zdjęcia. Naprawa: pełny UUID użytkownika + walidacja i błąd PL/UK/RU/EN. Backend SQL004 wymaga pełnego UUID.
2. Edycja instrukcji ponownie dopuszczała 3000 znaków, a API/DB zezwala najwyżej 2500. Poprawiono `maxlength` na 2500.
3. `jobCard()` była zdefiniowana dwa razy; usunięto starszą zasłoniętą definicję.
4. Zmiana zlecenia mogła zachować zakładkę z poprzedniego zlecenia (np. Wycena przy innym panelu). Teraz reset do Informacje przy zmianie zlecenia / roli.
5. Raport Gemini deklarował kompletne tłumaczenia filtrów, lecz nowe chipy/statusy były sztywno po polsku. Uzupełniono tłumaczenia filtrów na PL/UA/RU/EN.

## Testy

- Sam ZIP F03: `npm run check` PASS, `npm test` 32/32 PASS (ze starszym backendem zawartym w ZIP).
- Po naprawach F03 lokalnie: `npm run check` PASS, `npm test` 40/40 PASS na plikach ZIP (32 istniejące + 8 testów F03).
- **Na docelowej gałęzi DEV** musi przejść `.github/workflows/dev-check.yml`: syntax, pełne `npm test` (wcześniej 48 + 8 = co najmniej 56), parser PostgreSQL `pglast`. Wyniku CI nie ogłaszać przed potwierdzeniem w GitHub Actions.
- Nowe testy `tests/frontend-f03.static.test.js` weryfikują karty, filtr statusów, filtr terminów, zakładki, ukrywanie wyceny dla pracownika, wielojęzyczność, pełny UUID i escaping HTML.

## Granice bezpieczeństwa i kolejne kroki

- F03 zawiera jedynie FRONTEND. Właściwa baza staging nadal nie ma migracji SQL004; realna integracja wymaga backupu i oddzielnej zgody na migrację.
- Zdjęcia w aplikacji mają jedynie **podgląd lokalny i zapis metadanych**, bez przesyłania binarnego pliku do Supabase Storage. UI mówi o tym wprost.
- Plik frontendu i testy nie zawierają danych klientów. Prawdziwe zlecenia nie były używane w testach F03.
- PR z `merge/f03-ui-20261013` do `merge/f01-f02-20261011` zostawić jako **DRAFT**, bez merge do `main` lub publikacji.
- Uruchomienie produkcyjne i SQL 004 wymagają osobnego, jawnego zatwierdzenia; backup tabel CSV nie jest kompletną kopią PostgreSQL.
