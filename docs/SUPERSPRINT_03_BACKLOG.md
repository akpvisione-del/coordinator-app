# SUPERSPRINT 03 — braki i dalsza praca

## Przed publikacją

1. Osobno zatwierdzić audyt aktualnego schematu Supabase i nowe SQL; staging z fikcyjnymi kontami i dwoma monterami. Sprawdzić realne Auth, Storage binary event Netlify, RLS, cookies i cofnięcie dostępu. Nie stosować ponownie migracji `20261017181541` ani historycznych draftów.
2. Test na fizycznym Androidzie: file picker / aparat, Pointer Events, powiększenie 2×/3× i przesuwanie, pobieranie PNG/PDF, klawiatura ekranowa, instalacja / aktualizacja PWA. Chrome emuluje dotyk, nie sprzęt.
3. Utworzyć Draft PR, jeśli blokada GitHub API uniemożliwia to w środowisku. Body i instrukcja są przygotowane w repozytorium.

## Uzupełnienia produktu

- Pełne tłumaczenia nowych etykiet PL/UK/RU/EN; dotychczasowe tłumaczenia zachowane, nowe panele są PL.
- Dane firmy jako zatwierdzony profil organizacji zamiast każdorazowej edycji snapshotu. Logo / numeracja ofert / terminy ważności, eksport porównania wariantów, stawki zwolnione z VAT i waluty inne niż PLN. Obecny PDF i kwoty PLN nie są fakturą.
- Zatwierdzanie ofert i wybór wariantu jako podstawa rozliczenia; obecna wycena nie nadpisuje finansów zlecenia.
- Historia ponad 100 wersji w paginowanym UI (wszystkie zapisane wersje pozostają; API odczytuje konkretny numer). Filtrowanie i zaawansowana wyszukiwarka listy materiałów, rezerwacje magazynowe, częściowe zakupy.
- HEIC i duże historyczne pliki: zachowane oryginały, ale podgląd proxy obecnie JPEG/PNG/WebP ≤4 MB, nowe uploady ≤3 MB. Przetwarzanie miniatur na serwerze, transfer wznawiany i limity organizacji. Obecne miniatury korzystają z przeglądarkowego skalowania oryginału.
- Panel odzyskania / obsługi porzuconych rezerwacji: limit 20 PENDING na monter/zlecenie, brak automatycznego kasowania. Nie usuwać niezweryfikowanych plików ani ich metadanych.
- DrawingCanvas: edycja/przesuwanie istniejących elementów, kalibracja do wzorca, polilinie/rysowanie odręczne, warstwy, grupowanie, pinch-to-zoom, import edytowalnego JSON i weryfikowany SVG. Obecnie: linie/strzałki/wymiary/podpisy, cofanie, usuwanie, powiększenie i PNG/JSON; brak automatycznej konwersji pikseli na metry.
- Pełne testy dostępności z czytnikiem ekranu; kontrolki i alternatywa klawiaturowa są dostępne, canvas ma opis i listę elementów.

## Brakujące źródła i odzysk starszych funkcji

Drive nie jest dostępny przez narzędzia tej sesji. Nie odczytano folderu instrukcji projektu, dokumentu wznowienia, APP-BRD-021, archiwum wydań/V19, folderu Design Systemu ani Złotego Łańcucha. Nie odczytano oryginalnego ZIP Claude UI v07. Nie zgadywano ich treści. Wykorzystano aktualne repozytorium, Premium v02 i dostępny adapter `integrations/v19/preview-exchange.cjs`; adapter nie zawiera implementacji wycen ani DrawingCanvas.

Po uzyskaniu źródeł porównać moduły V19, Gemini NEXT i Wyceny PRO ze stabilnymi kontraktami nowych modułów. Importować wybrane funkcje do istniejących kontrolerów / RPC po audycie, z identyfikacją źródła i testami; nie tworzyć kolejnej aplikacji i nie przenosić nieizolowanego globalnego CSS. Złoty Łańcuch i tablica wymagają uzgodnienia przez uprawnioną osobę; niczego nie zapisano na Drive.
