# AKP P0 — Zarządzanie kontami monterów v01 (ROBOCZA)

> **BIEŻĄCY STATUS 2026-10-17 — ZATWIERDZONE SQL W PRODUKCJI, KOD NADAL DRAFT**
>
> Na podstawie wyraźnej późniejszej zgody właściciela ZASTOSOWANO jedną transakcyjną migrację Supabase `20261017181541 / akp_worker_deactivation_rls_and_truncate_hardening_20261017_v01`: 7 istniejących polityk RLS wzbogacono o aktywny profil workera; `service_role` otrzymał WYŁĄCZNIE kolumnowe `UPDATE(display_name,preferred_lang,is_active)` na `public.akp_profiles` (bez UPDATE role/user_id/phone); roli `authenticated` odebrano `TRUNCATE` na 8 tabelach AKP. **Potwierdzono stan przed/po i brak zmian liczebności**: profile 3, zlecenia 30, przydziały 1, raporty 0, checklisty 0. RLS włączony. Szczegóły migracji: `docs/sql_applied/20261017_akp_worker_security_v01_APPLIED.sql`, snapshot starych polityk: `docs/security_backups/20261017_rls_policy_snapshot_v01.md`.
>
> Pliki `docs/sql_proposals/*NOT_APPLIED.sql` stanowią HISTORYCZNE projekty i wskazówki rollbacku, których samych nie należy ponownie wykonywać. Ich nazwa NIE oznacza, że docelowa poprawka wciąż czeka na SQL. Cofnięcie RLS i TRUNCATE przywróciłoby luki; domyślnie zachować ochronę nawet przy rollbacku UI. Nadal **NIE WDROŻONO** nowej wersji Edge ani Netlify, NIE scalono PR #13; brak rzeczywistego testu dezaktywacji z pełnym PostgREST/Auth. Historyczne instrukcje niżej dotyczą stanu PRZED zatwierdzoną migracją i nie są bieżącym poleceniem.
>
> **JEDEN NASTĘPNY KROK**: zaprojektować/wykonać izolowany test integracyjny Netlify API + Edge + Supabase (bez użycia prawdziwych danych/zmiany profilu produkcyjnego), a następnie osobno zdecydować o aktualizacji Edge, Netlify i realnym UAT. W każdej chwili zachować możliwość rollbacku kodu oraz nie usuwać danych.

Status KODU: **ROBOCZY / BEZ WDROŻENIA**. Aktualne poprawki znajdują się na prywatnej gałęzi `fix/worker-assign-and-manage-20261017-v01`.

## Weryfikowane działające funkcje
- PWA Android: konto montera jest utworzone, logowanie działa, użytkownik widzi tylko swoje przydzielone zlecenia, bez kwot AKP — potwierdził właściciel.
- Supabase realna migracja `akp_assignments_composite_primary_key_only_20261017` została wykonana wcześniej po osobnej zgodzie. PK **już jest** `(job_id,worker_id)`. Nie wykonywać powtórnej migracji.
- API dla zleceń / przydziałów / dokumentów i tabele klientów NIE ZMIENIONE przez tę gałąź.

## Przygotowane elementy (w gałęzi, nie na produkcji)
- API `GET /team` zwraca również nieaktywnych monterów i język; `PATCH /team/:uuid` przyjmuje wyłącznie `name`, `language`, `is_active`, wyłącznie coordinator + CSRF.
- `Edge akp-provision-worker` wspiera `action=update_worker`, weryfikuje podwójnie Auth JWT i aktywny profil koordynatora. Rola profilu worker jest stała, a klient nie może zmieniać e-maila, hasła, roli ani user_id.
- UI Zespół: imię/nazwa, preferowany język, dezaktywacja/przywrócenie z potwierdzeniem. Brak trwałego usuwania kont.
- Testy API/Edge/UI są wykonywane na mockach, nie tworzą ani nie zmieniają prawdziwych kont.

## BRAMKI PRODUKCYJNE — NIE PUBLIKOWAĆ
1. **SQL permission**: w prawdziwym Supabase `has_table_privilege(service_role,public.akp_profiles,UPDATE)=false`. Wdrożenie funkcji wymaga osobnej jawnej zgody na `GRANT UPDATE ON TABLE public.akp_profiles TO service_role;` wraz z rollback `REVOKE UPDATE ON TABLE public.akp_profiles FROM service_role;`. Tych poleceń NIE wykonywano.
2. **Revocation / RLS**: audyt pg_policies pokazał, że `akp_assignments.akp_assignment_ro` dopuszcza SELECT dla aktywnego przydziału worker_id=auth.uid(), nawet gdy jego profil `is_active=false`. `akp_jobs.akp_jobs_ro` analogicznie dopuszcza read przez przydział. API Netlify sprawdza `is_active` dla każdego requestu, ale JWT + publishable key pozwalają ominąć API. **Nie wolno nazywać dezaktywacji natychmiastowym odcięciem od danych, dopóki RLS nie sprawdza aktywnego profilu**. Przygotować i przetestować osobną minimalną migrację RLS dla odczytów/mutacji worker (akp_assignments, akp_jobs i pozostałe tabele / Storage w miarę potrzeb). Wymaga osobnego zatwierdzenia SQL.
3. **Publikacja**: sprawdzić aktualny Netlify deploy ID + rollback; test CI + regresja, Edge zgodne z PR #12 i produkcyjnym `sb_secret_`, dopiero po zgodzie deploy Edge, następnie Netlify.
4. **E2E**: realne UAT: worker po dezaktywacji (stara sesja, nowa sesja, bezpośrednie REST z JWT), po reaktywacji, zlecenia nieprzypisane, brak finansów, zachowana historia przydziałów, dwaj monterzy na jednym zleceniu. NIE tworzyć / dezaktywować żadnego prawdziwego konta do testu bez decyzji właściciela.
5. **Bezpieczeństwo**: nie usuwać danych, nie nadawać uprawnień anon lub authenticated do tabeli profili. Nie zapisywać haseł i kluczy w kodzie/testach.

## DRAFT RLS v01 — BEZ WYKONANIA
- Projekt migracji: `docs/sql_proposals/worker_deactivation_rls_20261017_v01.NOT_APPLIED.sql`. Jest poza `supabase/migrations`; nie uruchamia się automatycznie.
- Osobny projekt rollback: `docs/sql_proposals/worker_deactivation_rls_20261017_v01_ROLLBACK.NOT_APPLIED.sql`. Cofnięcie przywraca poprzednie polityki, ale **ponownie otwiera** dostęp przez stare JWT dla nieaktywnych kont — wykonywać wyłącznie po audycie.
- Objęte dokładnie istniejące polityki worker na: akp_assignments SELECT, akp_jobs SELECT, akp_reports SELECT/INSERT, akp_checks SELECT/INSERT/UPDATE. Każda ścieżka worker sprawdza na żywo is_active i role=worker w public.akp_profiles dla auth.uid(). Uprawnienia coordinator w tych siedmiu politykach pozostają bez zmian.
- Polityka akp_photos_read już sprawdza is_active; historyczny profil może nadal być widoczny samemu użytkownikowi jako status konta.
- To jedynie przegląd składni i testy statyczne. Przed jakąkolwiek modyfikacją trzeba zidentyfikować wszystkie pozostałe punkty odczytu (w tym Storage), zapisać kompletny snapshot pg_policies, wykonać test dry-run w odizolowanej bazie i realny UAT ze starym JWT. Testów żywej dezaktywacji tu NIE przeprowadzano.

## Dodatkowa blokada: GRANT TRUNCATE dla authenticated (8 tabel)
- Read-only produkcyjny Supabase 2026-10-17: `has_table_privilege('authenticated',table,'TRUNCATE')=true` na `akp_assignments`, `akp_audit`, `akp_checks`, `akp_job_financials`, `akp_job_sources`, `akp_jobs`, `akp_profiles`, `akp_reports`. Rola `anon` nie posiada `TRUNCATE`; tabela `akp_photos` nie ma tego uprawnienia dla `authenticated`.
- PostgreSQL RLS nie chroni operacji `TRUNCATE`, choć standardowe HTTP API PostgREST nie udostępnia jej jako zwykłej metody. To nie jest dowód na dostępność TRUNCATE w PWA, lecz niepotrzebne uprzywilejowanie roli i ryzyko przy przyszłym endpointcie RPC, kompromitacji aplikacji lub błędzie SQL.
- Projekt WYŁĄCZNIE DO PRZEGLĄDU: `docs/sql_proposals/authenticated_truncate_revoke_20261017_v01.NOT_APPLIED.sql` — `REVOKE TRUNCATE ON TABLE (8 tabel) FROM authenticated`; osobny `..._ROLLBACK.NOT_APPLIED.sql` zawiera `GRANT TRUNCATE` (przywraca podatność; nie stosować automatycznie). Pozostałe granty `SELECT/INSERT/UPDATE` i zasady RLS nie są zmieniane w propozycji.
- CI `AKP — isolated RLS PostgreSQL regression` uruchamia PostgreSQL 16 na fikcyjnych danych, testuje działanie nowej polityki przed/po dezaktywacji z tym samym JWT, raporty/checklisty, koordynatora, finanse, wykonuje regresję dawnych reguł i niezależny test TRUNCATE przed i po REVOKE. To nie jest realne HTTP E2E Supabase.
- **Dodatkowe prawa** `REFERENCES` i `TRIGGER` dla `authenticated` istnieją na tych tabelach — osobny przegląd least privilege przed pełnym audytem, ale nie rozszerzać automatycznie obecnego SQL.
- Do pełnego release wymagane są odrębne zgody na (1) polityki RLS, (2) minimalny GRANT UPDATE dla `service_role`, (3) REVOKE TRUNCATE na ośmiu tabelach i (4) późniejsze wdrożenie Netlify/Edge. Weryfikować uprawnienia przed i po, zachować nieodwracalny rollback bez kasowania danych.

## Rollback
- Kod UI/API/Edge można cofnąć do zatwierdzonej działającej wersji po zapisaniu identyfikatora deploy. Edge v2 poprzedzający tę zmianę odpowiadał GitHub commit `76a0483f001b07f0aa112943140936c1e47ce21f` w PR #12.
- SQL grant UPDATE: `REVOKE UPDATE ... FROM service_role` tylko po sprawdzeniu, że nowa aplikacja już go nie potrzebuje.
- Każdą migrację polityki RLS oddzielnie udokumentować z dokładnymi starymi politykami oraz planem przywrócenia.
- Dotychczasowy PK `(job_id,worker_id)` jest aktywny i NIE powinien być cofany na potrzeby tego release.

## Następny krok
Zakończyć wszystkie testy GitHub CI, rozwiązać bramkę RLS/dezaktywacja i permission po **osobnej zgodzie**. Dopóki oba warunki nie są spełnione, PR pozostaje **DRAFT, NIE DO MERGE/DEPLOY**.
