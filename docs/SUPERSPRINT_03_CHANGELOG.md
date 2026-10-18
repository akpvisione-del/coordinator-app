# SUPERSPRINT 03 — changelog

Baza: Premium v02 `9a49edd0e6b17552bafa28c64ac2ab2e9d63af07`. Gałąź: `feat/akp-supersprint-03-v01`.

- `00ce008`: Wyceny PRO w istniejącej karcie zlecenia. Pozycje, jednostki, ilości, stawki, rabaty, VAT, sumy PLN, 6 wariantów, edycja i niezmienne wersje. PDF koordynatora z polską czcionką i stronicowaniem. Kwoty nie trafiają do montera ani automatycznie do finansów zlecenia.
- `df8bdfc`: Materiały: ręczne pozycje lub odnośnik do zapisanej pozycji wyceny, ilość / jednostka, statusy, dostawca i notatki. Monter widzi operacyjną projekcję i zmienia wyłącznie status. Nie kopiujemy cen ani danych wyceny.
- `b0d1e24`: Prywatne pliki w osobnym buckecie, rezerwacja / SHA-256 / retry bez nadpisania, binarny most Express–Netlify, miniatury, podgląd, pobranie, kategorie i etapy. Oryginalne metadane pozostają; ich edycja dopisuje wersję. Dotychczasowa dokumentacja dostępna bez usuwania danych.
- `73a2fb6`: DrawingCanvas: cztery narzędzia, dotyk, współrzędne do obsługi klawiaturą, undo/redo, wersje z CAS i idempotencją, sprawdzenie oryginału, eksport PNG i JSON.
- Końcowe dopracowanie: powiększenie 2×/3× i przesuwanie rysunku na Androidzie, guard anonimowego dostępu do nowego Storage, zachowanie danych przy rollbackach, odporny na przeniesienie bundle PDF, testy późnych odpowiedzi po zmianie sesji, CI i podgląd offline. Poprawiono oczekiwanie testu komunikatora na odblokowanie przycisku po zapisie; kod komunikatora pozostaje bez zmian.

Nie wykonano produkcyjnego SQL, wdrożenia ani merge. Migracja `20261017181541` nie była powtarzana. Wszystkie nowe propozycje SQL i rollbacki znajdują się w `docs/sql_proposals/supersprint03_*`.
