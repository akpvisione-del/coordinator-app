# AKP F04A v10 — Polecenia terenowe i roadmap głosowy

**Status:** DEV-only, proof of concept (read-only client UX). Nie jest agentem AI ani integracją Gemini/OpenAI. Nie nagrywa ani nie przechowuje audio w backendzie AKP.

## Działanie

- Zalogowany użytkownik otwiera przycisk 🎙 w górnym pasku albo używa `Ctrl/Cmd+K`; przy nieaktywnym polu formularza działa również `/`.
- Wpisuje komendę lub świadomie uruchamia opcjonalne rozpoznawanie mowy przeglądarki. W przypadku braku wsparcia używa tekstu.
- Aplikacja pokazuje **interpretację przed wykonaniem**. Nieznana lub destrukcyjna komenda nie uruchamia operacji.
- Dopiero przycisk **Wykonaj** zmienia lokalną nawigację, filtr, motyw lub gęstość. Nie wysyła żadnego POST/PATCH/DELETE.
- Przy opuszczaniu niezapisanego formularza obowiązują dotychczasowe zabezpieczenia `checkUnsavedEdit` oraz ostrzeżenie finansowe.
- Role: monter nie może użyć komendy otwierającej zespół, pulpit koordynatora, archiwum ani branżowy filtr koordynatora.
- Kategoria Pomiary/Kuchnie/Remonty działa tylko z potwierdzonych danych `category/work_type`; brak metadanych kończy się ostrzeżeniem (bez zgadywania po tytule).
- Tłumaczenia interfejsu i podstawowych komend: PL, UA, RU, EN; Web Speech API otrzymuje locale właściwe dla profilu.
- Dwa dodatkowe lokalne tryby gęstości: **Terenowy** (większe pola i karty) oraz **Kompaktowy**. Preferencja wizualna jest zachowana w `localStorage`, bez zapisania żadnych danych klienta.

## Granice prywatności i bezpieczeństwa

Nie wolno reklamować tego modułu jako „głosowego agenta AI”. Przeglądarka może przekazywać próbkę audio swojemu zewnętrznemu dostawcy SpeechRecognition — użytkownik widzi ostrzeżenie przed kliknięciem. Funkcja jest opcjonalna, dostępność zależy od przeglądarki i zgody na mikrofon. Audio/transkrypcje nie są zapisane przez ten kod do Supabase ani Drive.

## Model docelowy F04B/F05 (BEZ WDROŻENIA)

1. Zaufany backend uwierzytelnia użytkownika i wydaje wyłącznie krótkotrwały token sesji dla głosu; **nigdy** stały klucz API w JavaScript.
2. STT/Live API zwraca transkrypcję/intent z ograniczonym schematem `contracts/field-intent.v01.schema.json`.
3. Warstwa backendowa weryfikuje rolę, zlecenie, ACL, potrzebne pola, spójność bazy i idempotencję.
4. Każdy zamiar zapisu jest przedstawiany użytkownikowi w formie podglądu zmian; wymagane jest jednoznaczne zatwierdzenie. Komenda głosowa **nie** omija uprawnień.
5. Po zatwierdzeniu serwer wykonuje pojedynczą autoryzowaną akcję, zapisuje audyt i zgłasza rezultat; brak zapisu nie może wyświetlać sukcesu.
6. Zdjęcia, wyceny, przypisanie montera, finansowanie i Dysk wymagają osobnych, zatwierdzonych kontraktów API/RLS i testów end-to-end.

## QA / ograniczenia

- Testy jednostkowe: `npm test` (wymaga w repo pliku SQL004 do statycznego testu; artefakt CI nie dołącza go).
- `node --test $(find tests -name '*.test.js' ! -name 'sql004.static.test.js')` dla lokalnych paczek CI.
- Symulacja Playwright: 64 konfiguracje ekranu/motywu/roli/języka na fikcyjnych danych, bez połączenia z backendem.
- Testy wymagające rzeczywistego Androida, dostępu do mikrofonu, zewnętrznej usługi SpeechRecognition, łączności i Supabase pozostają **NIEPRZETESTOWANE**.

**Kandydat na Złoty Łańcuch:** `field-assistant.js` + `field-assistant.css` + kontrakt intents po odizolowaniu adaptera aplikacji AKP i teście w drugim projekcie. Nie przenosić bez decyzji właściciela.
