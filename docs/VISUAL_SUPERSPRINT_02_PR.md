## Wynik

Istniejący Commander otrzymuje spójny Premium Dark/Light: nową hierarchię Pulpitu, karty zleceń, Zespół, komunikator, kalendarz i uproszczony terenowy układ. Referencja #16. Gałąź bazuje dokładnie na SUPERSPRINT 01 / 32a51e1; nie zmienia jego logiki.

Warstwa jest odizolowana w public/akp-premium-v02.css, ładowana po istniejących stylach. Auth, public/app.js, public/chat.js, backend, API i SQL pozostają bez zmian. Nie ukrywamy finansów CSS; dotychczasowe role/backend/RLS pozostają granicą dostępu.

## Dowody i walidacja

- npm run check/build/test: 324/324 PASS, 0 skipów.
- Zachowane browser smoke: actual panele, komunikator i SUPERSPRINT 01 — PASS.
- 8 kombinacji obu ról, obu motywów i 390/1280px: 40 widoków, 80 screenshotów przed/po; brak overflow i finansów u workera. Kontrast reprezentatywnych tekstów min. 4.79:1, kontrolki, reduced-motion, empty i error PASS.
- Porównanie używa identycznych fikcyjnych danych w rzeczywistym app.js; przed wyłącza wyłącznie nowy arkusz. To test Chromium viewport, nie test fizycznego Androida ani pełna certyfikacja WCAG.
- Offline galeria z filtrami: generowana przez scripts/build-visual-gallery.mjs, CI artifact AKP_VISUAL_SUPERSPRINT_02_BEFORE_AFTER. Wybrane screenshoty w docs/visual-sprint-02/.

## Źródła i granice

Wykorzystano kod Design40 PR #8 (4ce7937) i istniejące Unified/V19/tokeny. Dokumentów Drive/ZIP Claude UI v07 ani Gemini NEXT nie odczytano. Nie importowano zewnętrznego globalnego CSS. Backlog obejmuje Claude/Gemini, Wyceny PRO, DrawingCanvas i dalsze moduły V19.

Dokumenty: VISUAL_SUPERSPRINT_02_STATUS.md, CHANGELOG.md, README.md i BACKLOG.md. DRAFT: bez deploy akp.wtf, bez merge i bez migracji. Docelowa baza PR: feat/akp-supersprint-01-v01.
