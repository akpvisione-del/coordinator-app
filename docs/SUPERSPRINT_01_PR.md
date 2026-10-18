## Wynik

SUPERSPRINT 01 kontynuuje Draft PR #13 w tej samej aplikacji: uzupełnia Zespół i przydziały, dodaje harmonogram oraz prywatny komunikator z backendem Supabase RPC/RLS. Refs #14; pełna macierz 28 wymagań i bramki aktywacji w docs/SUPERSPRINT_01_MATRIX.md.

- Konta: wyszukiwanie/status, zaproszenie bez generowania hasła, zachowane recovery/edycja/dezaktywacja/reaktywacja, historia kont.
- Przydziały: wielu monterów, soft-unassign po konkretnym UUID, widoki ekipy i pracownika, kalendarz z CAS/409, historia.
- Chat: ogólne i job rozmowy, tylko uczestnicy, aktywny profil i przydział, trwała historia, wyszukiwanie, read/unread, powiadomienia, link do zlecenia, idempotentne retry. Oryginały PL/RU/UK/EN, gotowy kontrakt przyszłych tłumaczeń.
- UX: Android >=48px, desktop, native keyboard, strict CSP, bez trwałego cache danych rozmów, odrzucanie odpowiedzi starej sesji.

## Bezpieczeństwo i SQL

**DRAFT, nie scalać i nie wdrażać bez osobnego zatwierdzenia.** Nowy chat i audyt wymagają oddzielnej akceptacji SQL REVIEW_ONLY poza supabase/migrations. Rollbacki odcinają dostęp/zbieranie audytu bez usuwania historii. Migracji 20261017181541 i assignments PK nie zmieniano ani nie powtarzano. Nie wykonano zapisów produkcyjnych.
Zaproszenia wymagają skonfigurowanego Edge AKP_APP_ORIGIN + Auth redirect/email. Brak konfiguracji nie uruchamia fallbacku; historyczny actor_id usługi jest jawnie nullable i audyt nie fabrykuje zdarzeń sprzed uruchomienia.

## Testy

- npm run check && npm run build && npm test: **324/324 PASS**, 0 skipów.
- Izolowany PostgreSQL16 bez sieci: **71 asercji RLS PASS**, w tym cudze rozmowy, stare JWT, dezaktywacja, odebranie job, monotoniczne read i rollback zachowujący dane.
- Chromium actual coordinator/worker, Unified/V19 preview CSP PASS; chat i sprint/Zespół obie role × 390/1280px PASS, w tym Enter, retry, wyszukiwanie, odczyt i job-link.
- To lokalna walidacja z fikcyjnymi kontami; nie zastępuje izolowanego HTTP E2E prawdziwego Supabase ani GitHub Actions.

Dokumenty: SUPERSPRINT_01_STATUS.md, MATRIX.md, API.md, CHANGELOG.md i DEPLOYMENT.md w docs/.
Docelowa baza: fix/worker-assign-and-manage-20261017-v01 (stos nad PR #13). Bez automatycznego merge do main.
