# F04A — feedback właściciela v05, 2026-10-13
Status: TESTOWA / DEV, PR #3; bez merge i deploymentu.
Źródło: raport Gemini przesłany przez Kamila w rozmowie. Audio nie odsłuchane niezależnie w tej sesji. Transkrypcja zawiera zniekształcenia; opis Gemini nie jest dowodem działania integracji.

ZMIENIONO: kompaktowy nagłówek, większe etykiety i cele dotykowe dolnego menu; jasny/ciemny motyw z zapisem preferencji; kafelki ikona po lewej, liczba po prawej; Dziś/Jutro i plan dzienny także montera; dwa filtry montera Nowe/Obecne; archiwum koordynatora w opcjach dodatkowych.
USUNIĘTO Z UI: analityka pulpitu, filtr Pilne, raporty w głównej nawigacji i sekcja Ekipa u montera. Dane priorytetów i dziennik prac zachowane; koordynator otwiera dziennik w System/Zaawansowane.
DODANO: obsługa kategorii z jawnego pola category/work_type, bez klasyfikacji po tytule. Obecne API nie dostarcza tych pól; branże nieaktywne do uzupełnienia kontraktu w następnym etapie. Nie dodano backendu ani migracji.
ZACHOWANO: wariant A lekkiej listy, pobranie danych klienta ze szczegółów, selektywne unassign UUID, role, draft finansów, checklisty, zdjęcia, formularze.

TESTY: 54/54 testy Node (API na mockach + frontend/static). node --check public/app.js. Testy dopasowane do jawnej zmiany wymagań: zamknięte ukryte, brak ekipy u montera, odbiór zamiast raportów KPI. Dodano testy braku klasyfikacji po tytule, planu bez fikcyjnych godzin i ukrycia zamkniętych nawet po wymuszeniu filtra montera.
BLOKADA QA: brak binarnego Chromium; pobranie przeglądarki odrzucone przez ograniczenia sieci (niepoprawne archiwum). Nie wykonano testów wizualnych 360/390/430, kontrastu ani pełnego WCAG. Nie deklarować AAA ani czytelności w słońcu bez pomiarów i telefonu.

F04B: rzeczywiste start/end/timezone dla wizyt (due_date jest datą dnia, NIE terminem płatności); ryczałt na przydziale, dwa niezależne stany płatności, tylko własne finanse montera; czat przy zleceniu i zadania; zaproszenia Auth bez przechowywania haseł; meldunek GPS tylko świadomym kliknięciem; Drive z rzeczywistymi uprawnieniami backend/Drive, nie samym ukrywaniem folderów; tłumaczenia wiadomości/dokumentów i AI głos wymagają zweryfikowanych połączeń. Tryb terenowy/zaawansowany nadal projektowy.
Decyzje robocze bez blokowania UI: daty bez godzin wyświetlamy jako Godzina nieustalona; czat projektujemy najpierw przy zleceniu. Nie udajemy integracji.

Uruchomienie testów: node --test tests/api.test.js tests/frontend-f03.static.test.js tests/f04a-v04.static.test.js
Uruchomienie całości: checkout gałęzi DEV oraz npm install / npm run dev w pełnym repo. Ta paczka lokalna jest nakładką, nie pełnym backupem.
Rollback: przywrócić pliki z bazowego HEAD b7f2f8acf13b5c53355e42d743e83feebbef8335 w nowym commicie DEV; nigdy automatycznie nie resetować cudzych zmian.
Kandydat do Złotego Łańcucha: karta planu dziennego + wzorzec motywu; bez publikacji klocka do czasu wizualnej weryfikacji.
