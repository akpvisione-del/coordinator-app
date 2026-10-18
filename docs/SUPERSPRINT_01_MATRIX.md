# SUPERSPRINT 01 — macierz 28 wymagań

Źródło: pełna treść Issue #14 dostarczona przez właściciela w rozmowie. Baza PR #13 `aba9186`, kontynuacja na `feat/akp-supersprint-01-v01`. Wszystkie wiersze opisują **kod i lokalną walidację**, nie wdrożenie produkcyjne.

**Zależności:** CHAT = zatwierdzona nowa migracja chat; AUDIT = zatwierdzona nowa migracja historii; INVITE = zatwierdzony Edge + AKP_APP_ORIGIN + Supabase Auth email/redirect. Migracje są REVIEW_ONLY. RLS `20261017181541` i PK `(job_id,worker_id)` już istnieją i nie są powtarzane.

| ID | Funkcja | Kod / dowód / warunek aktywacji |
|---|---|---|
| A1 | Lista i wyszukiwanie pracowników | teamPage, teamSearch, filtr aktywności; testy team + Chromium |
| A2 | Tworzenie kont i zaproszeń | zachowany provisioning PR13 + /team/invite; bez hasła przy zaproszeniu, testy Edge/API/browser; INVITE |
| A3 | Edycja imienia, nazwiska i języka | istniejące display_name (imię i nazwisko) i preferred_lang; whitelist API/Edge, testy worker-management |
| A4 | Odzyskiwanie i zmiana hasła | zachowany /recovery/request/complete, link w Koncie; 17 testów recovery/consistency + security tests |
| A5 | Dezaktywacja bez usuwania historii | profile is_active, backend/aktywny profil/RLS, brak DELETE; test starego JWT PostgreSQL |
| A6 | Ponowna aktywacja | PATCH /team/:id, zachowane przydziały; test real handlers + mock Auth/PostgREST |
| A7 | Status i liczba przydzielonych zleceń | aktywne/nieaktywne konto, liczba przydziałów na pobranej liście; teamPage/browser |
| A8 | Historia zmian konta | sanitizowane akp_team_events, /team/:id/history, UI i paginacja; AUDIT, forward-only |
| B1 | Wielu monterów na zleceniu | zachowany upsert po (job_id,worker_id), dwa konta w regresji API |
| B2 | Odpięcie konkretnego montera | soft active=false, nigdy całej ekipy przez brak UUID; API + PostgreSQL |
| B3 | Zlecenie → ekipa | crewSection, nieaktywne konto nadal widoczne w historii, odpinanie; browser actual |
| B4 | Monter → jego zlecenia | przycisk Zlecenia montera, workerFilter i wyczyszczenie; team/browser |
| B5 | Ostrzeżenia konfliktów terminów | tydzień, filtr montera i ostrzeżenia wielu zleceń/dnia; bez wymyślania godzin; schedule tests |
| B6 | Historia przydziałów | eventy ASSIGNED/UNASSIGNED, /jobs/:id/assignment-history i historia pracownika; AUDIT |
| C1 | Prywatne rozmowy koordynator–monter | para dwóch uczestników, role sprawdzane z aktualnym profilem/JWT, RLS/API/Chromium; CHAT |
| C2 | Rozmowy ogólne bez zlecenia | thread job_id NULL, UNIQUE NULLS NOT DISTINCT; PostgreSQL/browser; CHAT |
| C3 | Opcjonalne job_id rozmowy/wiadomości | oba konteksty, worker musi mieć aktywny przydział; odebrany przydział ukrywa również wiadomości job w wątku ogólnym; CHAT |
| C4 | Historia wiadomości | trwałe, nieedytowalne oryginały, keyset pagination bigint jako tekst; API/SQL/browser; CHAT |
| C5 | Nieprzeczytane i oznaczanie | last_read_seq rośnie monotonicznie, read RPC wskazuje realną wiadomość; test PostgreSQL; CHAT |
| C6 | Powiadomienia wewnętrzne | plakietka unread, odświeżenie po wejściu i polling 30s na widocznej karcie; test browser; CHAT |
| C7 | Wyszukiwanie własnych wiadomości | pełnotekstowy indeks simple (PL/RU/UK), własny wątek, paginacja; Enter i test RLS; CHAT |
| C8 | Przejście wiadomość → zlecenie | przycisk Job, istniejący jobOpen + kontrola backend/RLS; Chromium obu ról; CHAT |
| D1 | Spójny panel Zespół | dotychczasowe komponenty, filtrowanie, zaproszenia, edycja, status i historia; browser |
| D2 | Duże pola Android | nowe kontrolki >=48px, test 390px; bez overflow |
| D3 | Czytelne zapisy i błędy | 409/CAS, 422, 503, zachowany szkic, idempotentny retry; API/UI/browser |
| D4 | Dopracowane puste listy | brak kont, brak wyników, brak historii/rozmów/wiadomości/dat; bez demonstracyjnych danych |
| D5 | Spójne statusy i premium | zachowane tokens/motywy/Unified/V19, nowe style używają istniejących zmiennych; preview + actual browser PASS |
| D6 | Dostępność i klawiatura | natywne formularze, etykiety, focus-visible, log/alert/aria-busy; Enter-search Chromium, oba rozmiary |

## Granice potwierdzenia
- 324/324 testy Node PASS; wszystkie check/build PASS. PostgreSQL16: 71 asercji RLS PASS w kontenerze --network none, po czym usunięcie kontenera.
- Browser: actual koordynator/worker i preview strict CSP PASS; chat i sprint/Zespół obie role × 390/1280px PASS; PWA manifest/cache regresje w npm test PASS.
- **Nie wykonano** live Supabase HTTP E2E, prawdziwego maila zaproszenia, wdrożenia ani nowych migracji produkcyjnych. Samo RLS w PostgreSQL nie dowodzi ustawień gateway/Auth/SMTP w docelowym projekcie.
- Audit gromadzi przyszłe zdarzenia od zatwierdzonego uruchomienia, nie wymyśla starej historii. Dla aktualizacji przez service-role actor_id może być null; UI pokazuje to jawnie. Stare akp_audit pozostaje dostępne w dotychczasowym panelu.
- Katalog zleceń dziedziczy limit 500 obecnego API; liczby i harmonogram odnoszą się do pobranej listy, nie do gwarantowanego globalnego agregatu dowolnie dużej bazy.
- Wyszukiwanie komunikatora działa w wybranej własnej rozmowie; brak globalnego indeksu cudzych wiadomości. Oryginał językowy jest przechowywany, tłumaczenia przyszłe nie są automatycznie generowane. Kod języka uk odpowiada UA.
