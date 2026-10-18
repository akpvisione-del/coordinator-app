# AKP SUPERSPRINT 03 — status

Gałąź: `feat/akp-supersprint-03-v01`. Baza: `9a49edd0e6b17552bafa28c64ac2ab2e9d63af07`.

## Punkt kontrolny 1 — Wyceny PRO

Zaimplementowano: edycję pozycji i jednostek, ilości, stawki, rabaty, VAT, sumy PLN, do 6 wariantów, niezmienne wersje, odczyt historii i nową wersję na podstawie starej. PDF jest generowany na backendzie z osadzoną czcionką DejaVu (PL/UK/RU), stronicowaniem, danymi stron i warunkami. Dane firmowe i PDF tylko dla koordynatora; autoryzacja aktualnego profilu oraz RLS/RPC. CAS + idempotentny zapis, szkic zachowany po błędzie, czyszczenie szkiców przy zmianie sesji.

Walidacja: `npm run check && npm test` 329/329 PASS; `bash scripts/test-supersprint-rls.sh` PASS (stare pakiety i nowy 40_quotes.sql); `node scripts/qa-pro.mjs` PASS: 390/1280, light/dark, zapis, warianty, brak wycen w panelu montera. Wyłącznie fikcyjne dane / lokalny PostgreSQL bez sieci.

Obliczenia: dziesiętne ciągi znaków, ilość do 3 miejsc, stawki i procenty do 2; baza pozycji do grosza → rabat → VAT do grosza (half up). Limity: ilość ≤ 1 000 000, stawka ≤ 100 000 PLN, 100 pozycji łącznie, 80 na wariant. Nie jest to faktura ani automatyczny zapis do finansów zlecenia.

SQL: `docs/sql_proposals/supersprint03_quotes_v01.REVIEW_ONLY.sql` + rollback odbierający dostęp, zachowujący dane. NIE wykonano zmian w Supabase. Migracji 20261017181541 nie powtarzano. Produkcyjnie nowe endpointy zwrócą 503 do zatwierdzenia konfiguracji.

Ostatni ukończony kod: commit zawierający ten punkt kontrolny (`git log -1 -- docs/SUPERSPRINT_03_STATUS.md`). Zdalny push będzie zweryfikowany osobno.

Problemy / źródła: brak narzędzi dostępu do Drive; przeczytano jedynie dostępny adapter `integrations/v19/preview-exchange.cjs`, bez oryginalnego archiwum V19. Nie przypisujemy mu brakujących funkcji. GitHub API wcześniej blokowane polityką; transport Git HTTPS dostępny.

Dokładny następny krok: pakiet 2 — lista zakupów przypisana do zlecenia, statusy, dostawca i notatki; odnośnik do niezmiennej wersji/pozycji wyceny, projekcja operacyjna dla przypisanego aktywnego montera bez cen i firmowych danych.

## Punkt kontrolny 2 — Materiały

Ukończono listę materiałów: ręczne pozycje, jednostki i ilości, do kupienia / zamówione / zakupione, edycja dostawcy i notatek operacyjnych. Materiał z wyceny przechowuje wyłącznie odnośnik (job, wersja, wariant, pozycja); nazwa / ilość / jednostka są odczytywane ze źródła. Unikalność odnośnika zabezpiecza przed powtórnym dodaniem tej samej pozycji. Wycena pozostaje niezmienna i nie aktualizuje listy zakupów bez decyzji koordynatora.

Monter ma operacyjny widok przypisanego zlecenia i może zmienić tylko status istniejącej pozycji. Osobny RPC, CAS, idempotencja, sprawdzenie aktywnego profilu i roli JWT; brak cen/VAT/danych firmy w projekcji. Brak bezpośrednich zapisów REST. Limit 500 materiałów / zlecenie, bez usuwania historii zlecenia.

Testy: `npm run check && npm test` 332/332 PASS; izolowany RLS (50_materials.sql: własne/obce zlecenie, projekcja bez finansów, brak duplikowania danych, retry, CAS, nieaktywne konto / stary JWT) PASS; `node scripts/qa-materials.mjs` PASS przy 390/1280 i obu motywach, koordynator + monter.

Ostatni potwierdzony push poprzedniego pakietu: `00ce008a194978b1fd08295ed11cddbe64cc1c4e`. Ten pakiet: commit zawierający ten status. SQL materiałów i rollback są REVIEW_ONLY, niewykonane w Supabase.

Następny krok: pakiet 3 — prywatny upload plików do Storage przez sesję użytkownika, podgląd oryginałów, miniatury, kategorie i opisy bez naruszania istniejących rekordów oraz metadanych fotografii.

## Punkt kontrolny 3 — Zdjęcia

Ukończono prywatny upload oryginałów JPEG/PNG/WebP ≤ 3 MB, kontrolę SHA-256, sygnatury formatu i rezerwacji, bez nadpisywania plików. Retry potwierdza zgodność istniejących bajtów, zanim potwierdzi zapis. Sesja użytkownika i RLS obowiązują również przy odczycie pliku przez API; brak publicznych i podpisanych URL. Nowy bucket `akp-job-media` jest osobny od istniejącego `job-photos`. Każda nowa fotografia trafia do istniejącej tabeli `akp_photos`.

Galeria ma miniatury, podgląd, pobranie oryginału, stronicowanie po 50, opisy, kategorie i etapy. Edycje metadanych tworzą niezmienne wersje z CAS; pierwotny opis i rekord pozostają bez zmian. Dotychczasowa dokumentacja oraz wcześniejszy zapis metadanych nadal dostępne w rozwijanej sekcji. Plik wybrany do uploadu pozostaje w pamięci tej sesji po błędzie i znika przy wylogowaniu. Właściciel / koordynator może zmienić metadane; pozostali przypisani monterzy mogą oglądać zdjęcia swojego zlecenia.

Testy: `npm run check && npm test` 336/336 PASS. `node scripts/qa-media.mjs`: 8 kombinacji (2 role × 2 szerokości × 2 motywy), rzeczywisty PNG 640×480, binarny upload do lokalnej atrapy, podgląd i zmiana opisu PASS. PostgreSQL 60_media.sql PASS: zachowanie historycznych metadanych, retry, brak fikcyjnego potwierdzenia bez obiektu, izolacja monterów, stare JWT i szerokie historyczne polityki Storage. RESTRICTIVE guard blokuje usuwanie / podmianę nowych oryginałów także przy permissive polityce koordynatora. Nie zmieniono produkcyjnej bazy.

Ostatni potwierdzony wcześniejszy push: `df8bdfcbbcc513fcf384486033797c0b15da121d`. Commit tego punktu kontrolnego zawiera pakiet zdjęć.

Ograniczenia: nowe SQL wymaga istniejącego kontraktu `akp_photos.storage_path` i blokuje wykonanie, jeśli jest inny; nie uruchamia automatycznie SQL004. Historyczne linki zewnętrzne nie są pobierane przez backend. Historyczne pliki > 4 MB lub HEIC zachowane, ale ten proxy nie generuje dla nich podglądu. Pending uploady limitowane do 20 na monter/zlecenie; brak automatycznego usuwania porzuconych plików. RLS Storage sprawdzone w izolowanym PostgreSQL, rzeczywiste SDK Storage wymaga osobnego środowiska testowego po zatwierdzeniu SQL.

Dokładny następny krok: pakiet 4 — DrawingCanvas na oryginale zdjęcia, wektorowe wersje pomiarów, strzałki / linie / wymiary / podpisy, undo, Android Pointer Events i eksport bez zmieniania oryginału.

## Punkt kontrolny 4 — DrawingCanvas

Zaimplementowano rysowanie na oryginale: strzałki, linie, wymiary opisowe z pomiaru w terenie i podpisy, kolory AKP / AI, undo/redo (50 operacji), usuwanie wybranego elementu, wariant klawiaturowy z normalizowanymi współrzędnymi 0–100%, dotyk przez Pointer Events i pointer capture. Canvas zatrzymuje gest przewijania tylko w obszarze zdjęcia. Adnotacje są wektorowe i responsywne, niezależne od skali wyświetlania.

Każdy zapis tworzy wersję powiązaną z `photo_id` i SHA-256 oryginału; CAS + idempotencja, historia i przywrócenie jako podstawa następnej wersji. Oryginały są niezmienione. Nowe pliki mają hash weryfikowany także w SQL; nie nakładamy rysunku na inny oryginał. Uprawnienia: tylko aktywny koordynator lub aktualnie przypisany monter, brak finansów. Eksport PNG do 4096 px i JSON z wektorami działa także dla jawnie oznaczonego niezapisanego szkicu.

Testy: `npm run check && npm test` 339/339 PASS; izolowany PostgreSQL 70_drawing.sql PASS, w tym dwóch monterów jednego zlecenia, odpięcie autora, inny job, stary JWT, brak nadpisywania, zły hash i CAS. `node scripts/qa-drawing.mjs` PASS: 8 kombinacji role × 390/1280 × light/dark, rzeczywiste zdarzenia touch Chrome, cztery narzędzia, undo/redo, alternatywa klawiaturowa, zachowany szkic i ten sam UUID przy retry po 503, dwie wersje / odczyt starej, rzeczywiste bajty PNG oraz JSON.

Ostatni wcześniejszy potwierdzony push: `b0d1e24e01a1dbd90c3319ba6365c8d17d9e8e37`. Pakiet 4 znajduje się w commicie tego punktu kontrolnego.

Następny krok: pełna regresja dotychczasowych paneli / komunikatora / harmonogramu i PWA, końcowy przegląd autoryzacji, test rollbacków w lokalnym PostgreSQL, changelog / instrukcja uruchomienia / raport i braki, archiwum ZIP podglądu oraz próba utworzenia Draft PR do gałęzi bazowej sprintu 02. Żadnego wdrożenia ani produkcyjnego SQL.

## Punkt kontrolny 5 — finalizacja i przegląd

Cztery pakiety ukończone i potwierdzone zdalnie: `00ce008` (wyceny), `df8bdfc` (materiały), `b0d1e24` (zdjęcia), `73a2fb6f093dff5b7e062cb17360424f7e52b807` (DrawingCanvas). Końcowy przegląd dołożył powiększenie / przesuwanie canvas, guard anonimowego Storage, sprawdzenie przeniesionego bundle'a PDF i nieusuwające danych rollbacki. Wszystkie cztery nowe kontrolery odrzucają późne odpowiedzi po zakończeniu sesji.

Wyniki: 340/340 testów JS PASS, build / check / diff-check PASS; 128 asercji izolowanego PostgreSQL RLS + rollbacky PASS. Wszystkie nowe panele: Chrome 390/1280, oba motywy i role, PASS. Testy wcześniejszych paneli, kont, harmonogramu, komunikatora, CSP oraz macierz Premium 40 widoków / 80 obrazów PASS. Poprawiono wyścig w samym teście komunikatora: czeka na odblokowany przycisk. Zdalnego CI i fizycznego Androida nie potwierdzono.

Dostarczono: `SUPERSPRINT_03_CHANGELOG.md`, `SUPERSPRINT_03_DEPLOY.md`, `SUPERSPRINT_03_TEST_REPORT.md`, `SUPERSPRINT_03_BACKLOG.md`, `SUPERSPRINT_03_PR_BODY.md`. Skrypty generują 20 zdjęć podglądu, PDF demonstracyjny, PNG/JSON rysunków i galerię `artifacts/supersprint-03/PREVIEW.html`. ZIP podglądu: `artifacts/supersprint-03/AKP_SUPERSPRINT_03_PREVIEW.zip` (artefakt lokalny, ignorowany przez Git; odtwarzalny po QA i build galerii).

Draft PR: próba `gh pr create --draft --base feat/akp-visual-supersprint-02-v01 --head feat/akp-supersprint-03-v01 --body-file docs/SUPERSPRINT_03_PR_BODY.md` zwróciła `Post https://api.github.com/graphql: Forbidden`. PR NIE został utworzony. Nie obchodzono polityki i nie żądano tokenu. Można utworzyć go z przygotowanego body przez interfejs GitHub, do gałęzi sprintu 02. Native git push działa; kolejne SHA wymagają potwierdzenia w `git ls-remote`.

Środowisko: Node 24, `npm ci` z lockfile, start serwera / health / zasoby potwierdzone lokalnie. Zapisano draft pól `install_script` i `start_skill` w konfiguracji środowiska (`status: saved`, requires_publish=true). To nie uruchamia skryptów ani nie publikuje konfiguracji. Użytkownik może przejrzeć i zapisać ustawienia, potem opublikować środowisko; nie jest to wdrożenie akp.wtf. Nie zmieniono polityki sieci ani sekretów.

Dokładny następny krok: po zapewnieniu dostępu GitHub API utworzyć Draft PR z istniejącej gałęzi i body. Następnie po osobnym zatwierdzeniu audyt schematu oraz staging Supabase z fikcyjnymi kontami / plikami; sprawdzić realne Auth/Storage/Netlify i fizyczny Android. Nie rozpoczynać ponownej implementacji działających pakietów, nie powtarzać migracji 20261017181541, nie wykonywać produkcyjnego SQL ani publikacji bez osobnej zgody. Braki i nieodczytane źródła Drive są jawnie wymienione w backlogu.

## Ostatni potwierdzony stan do wznowienia

Ostatni commit kompletnego kodu / weryfikacji: `9d9ebc762db53bd3d32d97cbe1d9d15774c5e132`; zawiera też referencję do finalnego kodu `18354ce12528a90f6649eb3bff3b84361722d67d`. Push i pełny SHA z `git ls-remote origin refs/heads/feat/akp-supersprint-03-v01` są zgodne. Ten końcowy wpis statusu jest osobnym commitem; jego SHA odczytaj przez `git log -1 --format=%H -- docs/SUPERSPRINT_03_STATUS.md` (plik nie może zawierać własnego wynikowego SHA).

Finalne wyniki: 340 testów JS i **128 asercji RLS** (liczone jako `NOTICE: ... RLS PASS [`; nagłówki pakietów nie są asercjami). Galeria 20 osadzonych obrazów sprawdzona offline przy zablokowanym HTTP(S), PDF jest prawdziwym plikiem z polskimi znakami. ZIP obejmuje galerię, 20 zrzutów, 8 eksportów PNG + 8 JSON, PDF i 6 dokumentów. Artefakty są lokalne / odtwarzalne w CI; nie deklarujemy zdalnego wyniku CI ani zdalnego przechowywania ZIP.

PR pozostaje NIEUTWORZONY wskutek potwierdzonego `Forbidden` z GitHub GraphQL. Gotowy body: `docs/SUPERSPRINT_03_PR_BODY.md`; baza PR: `feat/akp-visual-supersprint-02-v01`. Wszystkie cztery pakiety i dokumenty są zachowane na osobnej gałęzi; gałąź wydania nie była modyfikowana. Następny krok nie jest implementacją od nowa: utworzyć Draft PR przy dostępnym API / UI, następnie osobno zatwierdzony staging i test telefonu według instrukcji. Żadnych eksperymentalnych zapisów ani nowych migracji produkcyjnych.
