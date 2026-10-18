# AKP Commander — START JUTRO — stan 2026-10-11

## Sprawdzone i zapisane
- Gemini F01 + F02 przekazane ZIP i wprowadzone na **odrębną gałąź DEV** `merge/f01-f02-20261011`.
- Draft PR: https://github.com/akpvisione-del/akp-commander-hybrid-pro-dev/pull/1 (niezscalony).
- Przegląd i konflikty: `docs/F01_F02_ZIP_REVIEW_20261011.md`.
- Ostatni potwierdzony PASS GitHub Actions #34: https://github.com/akpvisione-del/akp-commander-hybrid-pro-dev/actions/runs/38171990205; commit `7a13d14b0c71f9ea7d68d2a2d5b06e8565b25130`, testy 48/48 PASS i parser SQL004 93 instrukcje PASS. Późniejsze commity dokumentacyjne nie są automatycznie objęte tym samym potwierdzeniem.
- Zachowano backend/SQL004 z `fix/sql004-unified-20261011`; w F02 poprawiono pełny UUID w ścieżkach zdjęć oraz limit instrukcji 2500.
- Ręczny eksport staging `ttectcuirgdakjhpkkll` jako CSV: akp_jobs (16), akp_audit (16), akp_job_sources (16), akp_profiles (1); inne cztery tabele bez danych. CSV to **częściowy eksport**, a NIE pełna kopia/restore bazy.
- Termux na Androidzie: PostgreSQL 18.6 działa. Hasło bazy PostgreSQL jest nieznane; **nie resetować go bez oddzielnej zgody i analizy połączeń**.
- Gemini F02 w AI Studio zachować bez synchronizacji Pull/Push do czasu decyzji integracyjnej.

## Zakazy i stan
**SQL 004: NO-GO.** Brak pełnego, sprawdzonego backupu i testu odtworzenia na odrębnej instancji.
Nie uruchamiać SQL, nie tworzyć Storage bucket, nie dotykać Supabase, Netlify, `akp.wtf` ani nie publikować.
Nie scalać automatycznie Draft PR do backend branch/main/produkcji.

## Jutro — tylko następne, kontrolowane działania
1. Potwierdzić świeży CI review branch oraz stan Draft PR i sprawdzić zgodność F02/UI↔API.
2. Zaproponować **izolowany podgląd DEV bez danych klientów**; nie publikować bez zgody.
3. Zaplanować kompletny backup+restore staging (schemat, Auth, role, migracje) lub bezpieczną alternatywę bez hasła; oddzielić częściowe CSV od backupu.
4. Dopiero po potwierdzonym backupie, zabezpieczeniach oraz osobnej decyzji właściciela rozważać SQL004 na staging.
5. Poprosić o zgodę na każdą zmianę zewnętrzną, produkcyjną, publikację lub migrację.

**Nie trzeba dziś nic wklejać do Google AI Studio.**
