# SUPERSPRINT 03 — uruchomienie i wdrożenie do przeglądu

## Lokalnie

Node ≥20. Korzystaj z istniejącego checkoutu i gałęzi `feat/akp-supersprint-03-v01`. Nie resetuj zmian użytkownika.

```sh
npm ci --ignore-scripts --no-audit --no-fund --cache /tmp/akp-npm-cache
npm run check && npm test
npm run dev
```

Express nasłuchuje na porcie 3000. Lokalny GET `/api/health` sprawdza konfigurację, a `/koordynator` i `/teren` udostępniają istniejący interfejs. Testy przeglądarkowe same uruchamiają serwery z fikcyjnym API i nie wymagają Supabase. Nie testuj zapisu na rzeczywistych kontach / zleceniach. Serwer deweloperski nie odwzorowuje nagłówków Netlify; skrypty QA stosują CSP z `netlify.toml`.

Nie publikuj automatycznie tej gałęzi ani podglądu Netlify połączonego z produkcyjnym Supabase. Sesyjne cookies pozostają HttpOnly/Secure/SameSite; UI nie otrzymuje JWT. Nie kopiuj service-role do aplikacji.

## Warunki uruchomienia nowych zapisów

Nowe endpointy wymagają zatwierdzonej konfiguracji SQL. Bez niej pokazują błąd 503 i zachowują szkic w bieżącej sesji; nie ma fikcyjnego zapisu ani lokalnego zamiennika bazy. Oryginalne moduły zleceń, finansów, kont, przydziałów i komunikatora korzystają z dotychczasowych kontraktów.

Zmiany SQL są wyłącznie REVIEW_ONLY. Po osobnym zatwierdzeniu należy najpierw użyć **oddzielnego Supabase staging** z fikcyjnymi kontami i aktualnym schematem, nie produkcji. Kolejność przeglądu / późniejszego zastosowania:

1. `supersprint03_quotes_v01.REVIEW_ONLY.sql` — wersje wycen i współdzielony, sprawdzający aktywny profil helper.
2. `supersprint03_materials_v01.REVIEW_ONLY.sql` — operacyjny RPC dla montera i referencje do wersji wyceny.
3. `supersprint03_media_v01.REVIEW_ONLY.sql` — istniejąca tabela `akp_photos`, osobny bucket `akp-job-media`, wersje metadanych i Storage RLS. Preflight odmawia działania bez `akp_photos.storage_path`; rozbieżność wymaga audytu schematu. **Nie uruchamiaj z tego powodu SQL004 ani wykonanej już migracji 20261017181541.**
4. `supersprint03_drawing_v01.REVIEW_ONLY.sql` — wektorowe wersje rysunków powiązane z istniejącym zdjęciem.

Przed zatwierdzeniem porównaj rzeczywisty katalog tabel / funkcji / grantów / polityk, zrób kopię i sprawdź brak kolizji nazw nowych obiektów. Propozycje nie są poleceniem wdrożenia i nie są automatycznie uruchamiane przez build. Test staging powinien obejmować dwóch monterów, wspólne i rozłączne zlecenia, dezaktywację i odpięcie po wystawieniu JWT, upload / retry / pobranie oryginału oraz brak dostępu do wycen przez REST i RPC. Izolowany PostgreSQL nie zastępuje tej próby rzeczywistych usług Auth/Storage.

## Kontrakty

Wszystkie trasy mają prefiks `/api/jobs/:job` i wymagają aktywnej sesji. Mutacje wymagają zgodnego Origin i `X-AKP-Request: commander-v10`. API przekazuje wyłącznie JWT użytkownika, nigdy uprzywilejowany klucz.

| Trasa | Działanie |
| --- | --- |
| `GET/POST /quote` | Odczyt / dopisanie wersji; `expected_version`, `client_id`, `document`; wyłącznie koordynator |
| `GET /quote?version=N`, `/quote/pdf?version=N&variant=UUID` | Historia / prawdziwy PDF zapisanej wersji |
| `GET/POST /materials` | Lista / CAS `expected_revision`; koordynator edytuje materiał, monter wysyła tylko ID, status i identyfikator operacji |
| `GET /media?before=UUID` | Galeria w stronach po 50, obejmuje wcześniejsze fotografie |
| `POST /media/uploads` | Rezerwacja UUID, MIME, rozmiaru, SHA-256 i metadanych |
| `PUT /media/uploads/:id/file` | Surowe bajty JPEG/PNG/WebP; Netlify `isBase64Encoded`, do 3 MB; brak upsert |
| `GET /media/photos/:id/file` | Prywatny odczyt poprzez bieżącą sesję i RLS; bez publicznego URL |
| `POST /media/photos/:id` | Nowa wersja opisu, kategorii i etapu; właściciel lub koordynator |
| `GET/POST /drawings/:photo` | Historia / dopisanie wektorowej wersji z `expected_version`, `client_id` i hashem oryginału |

Wszystkie pliki/PDF mają `Cache-Control: no-store, private`. SW nie cache'uje API, fotografii ani danych klientów. Robocze szkice żyją w pamięci i są kasowane przy zmianie sesji.

PDFKit jest zablokowany wersją i lockfile; Netlify pozostawia go jako moduł zewnętrzny oraz dołącza jego dane i font z licencją. `node scripts/qa-function-bundle.cjs` sprawdza przeniesiony bundle, pobierając wyłącznie przypięte narzędzie esbuild z npm. Skonfigurowane hosty do testów syntetycznych: npm/Git proxy; brak potrzeby produkcyjnego Supabase.

## Rollback po osobnej zgodzie

Wycofaj frontend/API do zatwierdzonego poprzedniego wydania, następnie rozpatrz rollbacki REVIEW_ONLY w odwrotnej kolejności: drawing → media → materials → quotes. Odbierają wykonanie RPC i odczyt nowych tabel, zachowując pliki, wszystkie wersje, materiały i wyceny. Nie usuwaj RESTRICTIVE guardów nowego bucketu: historyczne szerokie polityki mogłyby odsłonić pozostawione pliki. Rollback media ustawia helper dostępu do nowego bucketu na `false`. Pozostawia bucket prywatny. Wszystkie cztery rollbacki wykonano i sprawdzono wyłącznie w lokalnym kontenerze PostgreSQL.

Przy ponownym włączeniu nie uruchamiaj propozycji CREATE drugi raz. Po audycie przywróć przejrzane granty i helper/polityki na istniejących obiektach. Ponowne stosowanie wymaga osobnego skryptu zgodnego ze stanem katalogu.

## Odtworzenie ZIP podglądu

Po uruchomieniu czterech `qa-*.mjs` sprintu 03 i `qa-function-bundle.cjs`:

```sh
node scripts/build-sprint03-preview.mjs
node scripts/qa-sprint03-preview.mjs
cd artifacts/supersprint-03
zip -q AKP_SUPERSPRINT_03_PREVIEW.zip PREVIEW.html *.png *.json *.pdf *.md
unzip -t AKP_SUPERSPRINT_03_PREVIEW.zip
```

Archiwum nie zawiera sekretów, rzeczywistych klientów ani aktywnej aplikacji z danymi; zawiera podgląd offline i dokumentację. Kod znajduje się na gałęzi Git. Artefakty lokalne są ignorowane przez Git, a workflow CI odtwarza podgląd i archiwizuje pliki wynikowe; zdalny wynik CI wymaga osobnego odczytu.
