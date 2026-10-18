# AKP Commander — handoff F02 i backup Android

Data: 2026-10-11. UWAGA: wnioski z raportu Gemini F02 użytkownika; bez dostępu do źródeł AI Studio nie stanowią weryfikacji kodu.

## F02 (deklaracje Gemini, do sprawdzenia)
- Zmienione tylko `public/app.js`, `public/styles.css` i pozostawiony `public/index.html` z F01.
- Edycja zlecenia: stany ładowania, wykrywanie niezapisanych zmian, zapobieganie utracie, 409 i 422, wyłączenie wielokrotnego zapisu.
- Wielu monterów: niezależny przydział/odpięcie, filtr pracowników, brak duplikatów.
- Stany sieci: loading, retry i puste listy; status trwałego uploadu zdjęć oznaczony jako NIEDOSTĘPNY.
- UI 360–768 px; Gemini raportuje 32/32 testów, ale **niezweryfikowane** w gałęzi backendowej DEV.
- Część raportu była automatycznie tłumaczona i zawiera niepoprawne polskie nazwy `/zespół`, `/sign`, `pracownik`, `akcja`. **Sprawdzić surowy JS**: kontrakt API backendu to `GET /team`, `POST /jobs/:id/assign`, `{worker: uuid}`, `{action: 'unassign', worker: uuid}`, `PATCH /jobs/:id`.
- Nie synchronizować AI Studio → GitHub ani GitHub → AI Studio; **najpierw pobrać ZIP F01/F02 z lokalnego projektu i przekazać do porównania**. Zweryfikować pełny UUID w nazwie zdjęcia, ostrzeżenia o Storage i języki.

## Backup Supabase staging na telefonie
- Cel: `ttectcuirgdakjhpkkll`, PostgreSQL 17. Supabase Free — automatyczny backup niedostępny.
- Android: oficjalny Termux (F-Droid/GitHub), `pkg update && pkg install postgresql coreutils`. Pakiet PostgreSQL w Termux obsługuje pg_dump, nie wymaga Dockera.
- Gotowy skrypt: `scripts/backup_staging_android_readonly.sh`. **Nie uruchomiono**. Nie wpisuje hasła w parametry ani w historię shell; wymaga podania hosta z Supabase Connect → Session pooler (5432), potwierdzenia ref i interaktywnego hasła lokalnie.
- Wykorzystuje `PGSSLMODE=verify-full` + `PGSSLROOTCERT=system` (PostgreSQL 18 libpq), tworzy pojedynczy logiczny snapshot `pg_dump -Fc` w prywatnym katalogu Termux i kontroluje katalog `pg_restore --list` + SHA256.
- Nie jest to backup plików Storage, konfiguracji platformy ani globalnych ról. **Nie testowano odtworzenia**. Procedura ponownego utworzenia środowiska Supabase wymaga oddzielnego planu i testu w osobnej instancji.
- Nie kopiować dumpa na publiczny GitHub, do AI Studio, ani do rozmowy; dump może zawierać hasła zahaszowane, PII klientów i metadane Auth. Zabezpieczyć archiwum lokalnie i szyfrować przed przekazaniem na drugi nośnik.
- Bez działań w staging poza SELECT/pg_dump. Bez migracji SQL 004, tworzenia bucketu i publikacji.

Stan: GO dla przygotowania i eksportu tylko do odczytu. NO-GO dla przywracania, SQL 004 i produkcji bez zgody.
