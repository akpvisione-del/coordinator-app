# F04A v11 — pakiet 30 usprawnień (DEV, 2026-10-13)

**Stan źródłowy:** PR #3, branch `feat/f04a-ux-20261013`, bazowy commit v10 `90744a311b07791e9234e177cde0add800c06c02`.
**Granice:** kod DEV, brak merge, produkcji, API write, SQL, Google Drive/Netlify produkcja i przesyłania audio. Wersja nie jest pełnym agentem AI.

## Polecenia i planowanie (1–13)

1. Rozpoznanie planu umówienia pomiaru/spotkania (`planKindAppointment`).
2. Rozpoznanie propozycji przydziału montera (`planKindAssignment`).
3. Rozpoznanie potrzeby wyceny (`planKindQuote`).
4. Rozpoznanie listy materiałów (`planKindMaterials`).
5. Rozpoznanie protokołu odbioru (`planKindProtocol`).
6. Rozpoznanie utworzenia zlecenia (`planKindJob`).
7. Rozpoznanie projektu wiadomości (`planKindMessage`).
8. Oddzielenie *planów* od wykonalnych odczytowych komend — zero zmian serwerowych.
9. Szkic z nazwą działania i oryginalną wypowiedzią bez zgadywania klienta, daty ani numeru.
10. Lista trzech warunków przed przyszłym wykonaniem: tożsamość, szczegóły, zatwierdzenie.
11. Osobny przycisk „Kopiuj szkic” uruchamiany dopiero gestem użytkownika.
12. Czytelny komunikat, gdy schowek jest niedostępny — brak ukrytej wysyłki.
13. Każda propozycja ma `confirmation_required: true`, `write_allowed: false`.

## Nawigacja terenowa i statusy (14–20)

14. Dodatkowa komenda „Do odbioru” (odczyt `ACCEPT`).
15. Dodatkowa komenda „Do wyceny” (odczyt `QUOTE`).
16. Dodatkowa komenda „Do rozliczeń” (odczyt `SETTLE`).
17. Ograniczenie tych trzech filtrów do roli koordynatora.
18. Weryfikacja dostępności kategorii **przed** zmianą stanu widoku — brak pustego widoku po błędnym wyborze.
19. Wyszukiwanie przez montera zachowuje filtr jego bieżących zleceń (`CURRENT`).
20. Cztery przyciski gotowych przykładów: Dziś, Jutro, Zlecenia, Przygotuj wycenę.

## Dostępność, mobilność, prywatność (21–28)

21. Kompletne nowe etykiety i ostrzeżenia planowania w PL/UA/RU/EN.
22. Tytuł grupy przykładów tłumaczony na język profilu.
23. `aria-expanded` zgodny z faktycznym otwarciem/zamknięciem okna.
24. Status mikrofonu przez `aria-pressed` po kliknięciu użytkownika.
25. Anulowanie dyktowania również w zdarzeniu `pagehide`.
26. `aria-describedby` łączy pole z informacją o prywatności i podglądem; `aria-atomic` dla wyniku.
27. Wyraźnie nieaktywny przycisk „Wykonaj” przy szkicach zapisu.
28. Responsywne chipy i przewijalny podgląd tekstowy na telefonach 360–390 px, z trybem ograniczenia animacji.

## Kontrakt i jakość (29–30)

29. Nowy, niekompatybilny z wykonaniem zapisów, kontrakt `field-intent.v02.schema.json`; **v01 nie nadpisano**.
30. Regresja w Node oraz macierz przeglądarkowa 64 wariantów (4 szerokości × 2 motywy × 2 role × 4 języki); scenariusze adwersarialne i demo offline z fikcyjnymi danymi.

## Materiały i status

- `public/field-assistant.js`, `public/field-assistant.css` — kod v11.
- `contracts/field-intent.v02.schema.json` — struktura propozycji przyszłego agenta.
- `tests/f04a-v11-voice-workflows.test.js`, `tests/f04a-v11-contract.test.js` — testy.
- Plan wdrożenia serwerowego voice-first: **osobny etap** z uprawnieniami, tokenami, zabezpieczeniem przed prompt injection, zdarzeniem potwierdzenia, logiem audytowym i możliwością cofania.

**UWAGA:** Liczba 30 oznacza 30 konkretnych elementów tej serii. Nie oznacza 30 nowych modułów lub gotowej automatyzacji w bazie.
