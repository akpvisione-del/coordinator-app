## Problem i rezultat

Karta zlecenia nie miała wersjonowanych wycen, listy zakupów połączonej z pozycjami, rzeczywistego prywatnego uploadu ani adnotacji zdjęć. SUPERSPRINT 03 dodaje te cztery moduły do istniejącej aplikacji Premium v02.

Wyceny i PDF są dostępne tylko aktywnemu koordynatorowi. Przypisany aktywny monter widzi operacyjną projekcję materiałów bez cen, prywatne zdjęcia i rysunki. Zapis używa JWT użytkownika, RLS, CAS oraz idempotencji. Oryginały zdjęć i wcześniejsze wersje pozostają niezmienione. Nie zmieniono PK przydziałów ani działania kont, komunikatora i harmonogramu.

## Walidacja

- 340/340 testów JS, check/build, 128 izolowanych asercji PostgreSQL RLS i rollbacków.
- Nowe panele w Chrome: 390/1280, oba motywy i role; binarny PNG, rzeczywiste zdarzenia dotykowe, undo/redo, wersje i eksport.
- Regresja wcześniejszych paneli, kont, harmonogramu, komunikatora, ścisłego CSP oraz macierzy Premium.
- PDF z przeniesionego bundle'a funkcji Netlify, osadzony font PL i sprawdzony tekst PDF.

Szczegóły: `docs/SUPERSPRINT_03_TEST_REPORT.md`. Telefon fizyczny i realny staging Auth/Storage nie były testowane. Zdalnego CI nie potwierdzono.

## Wdrożenie i ograniczenia

**Draft, bez merge / publikacji / produkcyjnego SQL.** Nowe SQL i zachowujące dane rollbacki są wyłącznie REVIEW_ONLY. Migracja `20261017181541` jest wykonana i nie była powtarzana. Nowe endpointy zwracają 503 przed zatwierdzeniem konfiguracji; brak sztucznego zapisu. Osobny audyt schematu i staging wymagane przed publikacją. Baza PR: `feat/akp-visual-supersprint-02-v01`, nie gałąź produkcyjna.

Instrukcja: `docs/SUPERSPRINT_03_DEPLOY.md`; changelog i backlog w `docs/SUPERSPRINT_03_*`. Źródła Drive niedostępne, nie przypisujemy im nieodczytanej zawartości. Oryginalne moduły V19 / Gemini NEXT zachowane do późniejszego porównania.
