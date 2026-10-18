# AKP DUO AI — Gemini: oddzielne zadanie read-only po F04A v11

**WAŻNE:** Gemini nie edytuje kodu PR #3. ChatGPT odpowiada za implementację, Gemini za niezależną ocenę, scenariusze, pomysły i bezpieczeństwo. Brak dostępu do najnowszego GitHub HEAD = status NIEZWERYFIKOWANE, nie wolno używać F03/v07 jako obecnego źródła.

## Źródła
Repo: `akpvisione-del/akp-commander-hybrid-pro-dev`, gałąź `feat/f04a-ux-20261013`, PR #3. Dokładny HEAD znajdziesz w `VERSION_STATUS.json` i źródłach dołączonego ZIP-a. Materiał właściciela z nagrania 13.10.2026 (13:26) stanowi podstawę UX, nie automatyczny stenogram. Wymagany kod: `public/app.js`, `public/field-assistant.js`, `public/field-assistant.css`, `public/styles.css`, `netlify/functions/api.js`, `contracts/field-intent.v01.schema.json`, `contracts/field-intent.v02.schema.json`, testy.

## Misja A — badanie głosowych intencji: minimum 240 przypadków
- 4 języki × 40 prawidłowych wypowiedzi = 160.
- 4 języki × 10 niejednoznacznych próśb = 40.
- 4 języki × 10 wrogich/ryzykownych prób = 40.
- Oznacz każdą: PREVIEW/READ_ONLY/DRAFT/UNKNOWN/BLOCKED; podaj oczekiwaną odpowiedź i ewentualny błąd parsera. Bez zgadywania faktycznych dat, nazwisk i numerów.
- Testuj literówki, przestawioną kolejność słów, akcent, skróty budowlane, nazwy LM/iProc, gwary monterów, zdania łączone.
- Użytkownik ma móc rozmawiać po polsku, rosyjsku, ukraińsku i angielsku; wyniki weryfikuj oddzielnie.

## Misja B — architektura voice-first, zespół agentów
Zaproponuj diagram stanu, z wyraźnymi rolami: STT, Intent Parser, Resolver zleceń, RBAC/Policy Guard, Plan Builder, Confirmation UI, Executor API, Audit/Undo, TTS. Rozdziel wymagane API od frontend demo, nie wyprowadzaj kluczy do JS. Zaprojektuj identyfikację wielu podobnych klientów, brak godziny w polu daty, awaryjną pracę bez sieci, idempotency i kontrolę kosztów modeli.

## Misja C — adversarial safety i uprawnienia: minimum 80 przypadków
- Przydział/odpięcie UUID; potwierdzenie dotyczy dokładnie jednego pracownika.
- Finansowe dane koordynatora ukryte przed monterem także w narzędziach AI i STT.
- Próby prompt injection w tytule zlecenia, w raporcie, w OCR zdjęcia, w załączniku Drive.
- Wielokrotne kliknięcie, przerwane nagranie, wygaśnięcie tokenu, utrata sieci, wiadomość zewnętrzna bez zgody, próby publikacji i usuwania danych.
- Rozróżnij blokadę lokalnej logiki od prawdziwej autoryzacji backendu.

## Misja D — UX i wygląd, bez kolizji z implementacją
Opracuj 3 niekodowe makiety opisowe: Field Minimal / Hybrid Pro / Command Center, ekran 360 i 390, ciemny i jasny. Jak działa jednozdaniowe pytanie uzupełniające i szybkie zatwierdzanie? Przedstaw testy użytkowników ze słabym internetem i w rękawiczkach.

## Wyjście obowiązkowe
1. Rzeczywista weryfikacja źródeł z hashami/linijkami i statusami TESTOWANO/NIEZWERYFIKOWANE.
2. Macierz 240 wypowiedzi, 80 przypadków bezpieczeństwa i 64 widoków (jeśli brak przeglądarki – nie deklaruj wykonania).
3. Maksymalnie 20 istotnych, udowodnionych problemów plus 20 innowacji o wysokiej użyteczności.
4. Lista wymaganych backendów, integracji Drive, kalendarza i wycen – bez zmian po stronie Gemini.
5. Priorytetowy backlog trzech większych paczek dla ChatGPT i dokładny handoff, z kryteriami odbioru oraz znanymi blokadami.

**TRYB:** ściśle read-only. Bez modyfikacji kodu, Netlify, Supabase, SQL, wiadomości, klientów, integracji lub akcji kosztowych. Zero produkcyjnego GO.
