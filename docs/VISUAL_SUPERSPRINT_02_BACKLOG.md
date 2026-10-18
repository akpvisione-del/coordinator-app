# Backlog źródeł i przyszłych modułów

Nie wykonano tych rozszerzeń w sprincie wizualnym. Zachowano istniejącą logikę, pliki i integracje; niczego nie przenoszono do drugiej aplikacji.

| Priorytet | Element | Kolejny bezpieczny krok / granica |
|---|---|---|
| P1 | Claude UI v07 — oryginalny audyt i ZIP | Pozyskać przez autoryzowany dostęp, porównać komponent po komponencie. W tej sesji plików NIE odczytano. Nie importować globalnego CSS ani zastępować Auth/API. |
| P1 | Gemini NEXT v02 | Po uzyskaniu źródeł wybrać komponenty prezentacyjne; mapować do tokenów v02 i istniejących kontraktów. W tej sesji brak odczytu tych źródeł. |
| P1 | Wyceny PRO | Osobny moduł koordynatora, istniejące źródło danych/kontrakty finansów, wymagane testy RLS. Nigdy nie udostępniać firmowych kwot monterowi. |
| P1 | DrawingCanvas | Izolowany komponent i model zapisu/wersji; osobno gesty Android, klawiatura i eksport. Bez zapisu do produkcji do czasu zatwierdzenia modelu. |
| P2 | V19 — dalsze odzyskanie funkcji | Zachować integrations/v19 i istniejący preview design systemu. Osobno audyt cache/zdjęć/migracji danych, bez czyszczenia pamięci użytkownika. |
| P2 | Plan godzinowy / drag-and-drop | Obecny kontrakt ma datę dzienną. Najpierw zatwierdzony model godzin i dostępności; nie wnioskować godzin z dat ani nie udawać kolizji. |
| P2 | Globalna wyszukiwarka rozmów | Po zatwierdzeniu nowego zakresu API; obecne wyszukiwanie własnej rozmowy zachować. RLS i indeksy pozostają obowiązkowe. |
| P2 | Awatary i obecność online | Dopiero po rzeczywistym źródle danych. W tym sprincie nie wymyślamy osób online ani nie dodajemy fałszywych statusów. |
| P2 | Asystent AI jako pełny panel Premium | Zachowano aktualny field-assistant, nie zmieniano jego zachowania. Osobny audyt ruchu, disclosure i źródeł odpowiedzi. |
| P3 | Biblioteka ikon SVG | Stopniowo zamieniać odziedziczone emoji z zachowaniem etykiet i data-*; testy CSP/keyboard. Obecne funkcjonalne ikony pozostają. |
| P3 | Pełny audyt WCAG i fizyczny Android | Obecna walidacja to Chromium 390/1280, reprezentatywne kontrasty, klawiatura i reduced-motion. Potrzebne TalkBack, powiększenie i klawiatura ekranowa na urządzeniu. |

Źródła dostępne w sesji: repo, Design40 PR #8 (4ce7937), Unified v02, tokeny Design40, integracja V19. Niedostępne: zewnętrzne dokumenty Drive/ZIP Claude oraz Gemini NEXT. Nie stosowano obejścia polityki sieciowej.
