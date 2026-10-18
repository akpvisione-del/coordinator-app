# AKP F04A v10 — pakiet 30 usprawnień, bez publikacji

## Nowe funkcje i ergonomia (30 wdrożonych elementów)

1. Dostępny jednym kliknięciem przycisk poleceń 🎙 w górnym pasku (tylko po zalogowaniu).
2. Otwieranie palety skrótem `Ctrl/Cmd+K`.
3. Otwieranie skrótem `/`, ale nie podczas pisania w polu formularza.
4. Zamykanie Escape bez wykonania akcji.
5. Pułapka fokusu Tab/Shift+Tab w oknie modalnym.
6. Czytelny podgląd interpretacji komendy przed wykonaniem.
7. Oddzielny przycisk zatwierdzenia `Wykonaj` — brak automatycznych operacji po dyktowaniu.
8. Opcjonalne rozpoznawanie głosu przez Web Speech API (gdy wspierane).
9. Wyłączenie mikrofonu i komunikat zastępczy, gdy funkcja jest niedostępna.
10. Przerwanie nasłuchiwania po zamknięciu okna lub ukryciu karty.
11. Ostrzeżenie o potencjalnym zewnętrznym przetwarzaniu audio przez dostawcę przeglądarki.
12. Brak zapisu audio oraz transkrypcji do chmury AKP.
13. Wybór języka rozpoznawania z profilu PL/UA/RU/EN.
14. Pełne lokalizacje interfejsu palety w czterech językach.
15. Bezpieczne otwieranie pulpitu, zleceń, ustawień i zespołu zgodnie z rolą.
16. Rozłączne komendy Nowe / Obecne / Archiwum.
17. Terminy: dziś, jutro, po terminie i bez terminu.
18. Wyszukiwanie z numeru LM/AKP i frazy, maksymalnie 90 znaków.
19. Resetowanie wszystkich lokalnych filtrów i sortowania.
20. Komendy branżowe wyłącznie przy znanych metadanych, bez zgadywania.
21. Włączenie jasnego/ciemnego motywu poleceniem.
22. Tryb terenowy z większymi elementami dotykowymi.
23. Tryb kompaktowy z większą gęstością informacji.
24. Trwałość preferencji gęstości w pamięci urządzenia (bez danych klientów).
25. Podsumowanie aktywnych zleceń wyłącznie na podstawie odczytanej listy.
26. Ochrona niezapisanej edycji zlecenia i szkiców finansowych przed zmianą widoku.
27. Blokada komend wymagających roli koordynatora dla montera.
28. Odmowa rozpoznania poleceń destrukcyjnych („usuń”, „przelej”, „wyślij fakturę”).
29. Nawigacja dotykowa >= 48 px, safe-area i tryb reduced-motion.
30. Testy jednostkowe komend, 64 scenariusze mock Chromium i kontrakt przyszłej integracji AI.

## Nie wdrożono / celowo zablokowano

- Prawdziwa rozmowa z AI i edycja bazy głosem.
- Integracja z Google AI Studio / Gemini Live, OpenAI Realtime, Supabase write, Drive write, GPS.
- Automatyczne wykonywanie poleceń finansowych, wysyłanie wiadomości i zmiany statusów zleceń.
- Produkcyjne Netlify i migracje SQL004.
