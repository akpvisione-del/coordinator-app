# Wspólna praca aplikacji i wtyczki — 16.10.2026

## Zakres i granice
Właściciel polecił 16.10 połączyć akp.wtf i AKP Commander oraz uaktualnić listę. Ta zgoda zastępuje historyczny zakaz integracji z v0.7/v0.8.1. Nie rozszerza zgody na usuwanie historii, rozliczenia ani wysyłki.
Jedna centralna kartoteka: arkusz Google Sheets ZLECENIA. Supabase jest operacyjnym odwzorowaniem aplikacji. Nie zmieniaj źródła prawdy na Supabase bez decyzji właściciela.
Most wykonuje agent podczas aktywnej rozmowy, przez dostępne połączone narzędzia Drive i Supabase. Sam plik instrukcji NIE uruchamia usługi w tle. Nie ma stałego poświadczenia Google w Netlify; nie obiecuj automatycznej synchronizacji przy zamkniętym czacie. Jeżeli Supabase nie jest dostępne w sesji, zatrzymaj synchronizację, zachowaj wykonane zapisy Drive i jawnie oznacz brak potwierdzenia aplikacji. Nie proś o klucz service_role/token w czacie, nie pobieraj poświadczeń konektora do Netlify.

## Źródła i klucze
- Sheets: 1D23GAhR8O1enh420DnsH7QuigYLa6gkb1FHkcEUaYIw, ZLECENIA, nagłówki A1:AD1, ID_AKP jest trwałym kluczem; NR_LM dodatkowo potwierdza tożsamość. Karta i folder nadal na Drive.
- Supabase project ttectcuirgdakjhpkkll. public.akp_jobs: id UUID, akp_id, reference, lm_number, iproc_number, title, location, client_name/phone/email/address, status, priority, due_date, instructions, updated_at.
- public.akp_job_sources: job_id, source_record (pełny ostatnio uzgodniony wiersz), source_hash, synced_at. Dostęp koordynatora; źródło zawiera dane finansowe, nigdy nie ujawniaj go monterowi.
- 16.10 przeniesiono zweryfikowane 30 rekordów /22 bieżące; zachowano wszystkie 16 wcześniejszych UUID oraz historię. Dane szczegółowe źródła są nowsze niż checkpoint tekstowy: Paweł Jakubowski aktualnie WYCENA_W_TOKU, nie przyjmuj starego DO_WYSYLKI.

## Procedura przed odczytem/zmianą sprawy
1. Odczytaj aktualny wiersz Sheets, odpowiadający rekord akp_jobs i source_record. Dopasuj po akp_id, nie po nazwisku. Nowy/zmieniony LM lub niezgodne ID = wyjaśnij tożsamość, nie twórz dubla.
2. Uruchom scripts/sync_plan.py na JSON {base:source_record,sheet:aktualny_wiersz,app:rekord_aplikacji}. To czysta funkcja: nie czyta sieci i nie wykonuje zapisów. Daje sheet_patch, app_patch, merged_source, expected_updated_at, konflikty.
3. Brak konfliktu: zapisuj wyłącznie zmienione komórki/kolumny. Nigdy całego arkusza, finansów, zadań ani przydziałów przy synchronizacji danych głównych. Ponownie odczytaj komórki bezpośrednio przed zapisem; jeśli nie odpowiadają odczytowi wejściowemu, przelicz plan. Drive nie daje transakcyjnego CAS; nie gwarantuj atomowości dwóch systemów.
4. Zapis Supabase przez uprawniony konektor: transakcja, SELECT rekordu FOR UPDATE, sprawdź id/akp_id i updated_at z planu. Stosuj UPDATE ... WHERE id=... AND updated_at=... RETURNING; brak dokładnie jednego rekordu = konflikt, ROLLBACK. Dane literalne poprawnie koduj/parametryzuj, nie sklejaj niesprawdzonego SQL. Nie podrabiaj sesji/JWT; nie obchodź RLS.
5. Po obu zapisach wykonaj realny readback obu stron. Dopiero przy zgodności zapisz zrekoncyliowany source_record i jego SHA256 (tak samo jak JSON.stringify mapera google-import.js), synced_at; znacznik nie może potwierdzać niewykonanego zapisu. Zanotuj operację w LOG_ZMIAN i akp_audit. Częściowe powodzenie = jawny stan DO_PONOWIENIA, bez oznaczenia synchronizacji jako zakończonej.
6. Zmiana tego samego pola po obu stronach na różne wartości = pokaż wartości i źródła; nie wygrywa automatycznie późniejszy zegar. Nie eksportuj do arkusza dowolnego tytułu/opisu, jeśli nie można pewnie rozdzielić rodzaju, klienta i następnego kroku. Skrypt oznacza to needs_review. Takie teksty wymagają uzgodnienia.
7. Nowe zlecenie z arkusza: sprawdź unikalne ID_AKP i NR_LM w obu stronach, mapuj zgodnie z netlify/functions/google-import.js; importuj pod istniejącym akp_id, nigdy kasuj nieobecnych rekordów. Nowy rekord wyłącznie z aplikacji wymaga uzgodnienia i własnego ID_AKP; nie wymyślaj numeru.

## Mapowanie
status↔STATUS, priority↔PRIORYTET, client_name↔KLIENT, client_phone↔TELEFON, client_email↔EMAIL, iproc_number↔NR_IPROC, lm_number↔NR_LM, location/client_address↔ADRES, due_date↔PLAN_START (DATA_POMIARU tylko fallback odczytu; nie nadpisuj pomiaru terminem realizacji). Konflikt location i client_address = decyzja, nie wybór losowy.
ANULOWANE zachowaj jako ANULOWANE. WYKONANE_ROZLICZONE_DO_ARCHIWIZACJI odwzoruj w aplikacji ZAKONCZONE, dokładny stan archiwizacji zachowaj w źródle. Nie otwieraj ponownie zamkniętych. PRACOWNICY i AKP_PRZYDZIALY nie są kontami Auth; nie twórz kont automatycznie z nazwisk.

## Potwierdzony zakres testów
11 lokalnych testów planera: oba kierunki, niezależne pola, konflikt blokuje cały rekord, tożsamość, aliasy adresu, zachowanie finansów i archiwizacji, zbieżność po eksporcie telefonu. Live porównanie po imporcie: 30 planów, 0 konfliktów, 0 oczekujących zmian. To NIE jest dowód stałej synchronizacji ani test realnej zmiany po obu stronach.
