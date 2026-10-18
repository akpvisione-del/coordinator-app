# AKP Voice Commander — architektura docelowa po F04A v11

## Obecny stan
- Głos przez Web Speech API dostawcy przeglądarki (po kliknięciu); może korzystać z usługi zewnętrznej dostawcy przeglądarki.
- Lokalne komendy odczytowe i nawigacja. Propozycje operacji zapisowych jako nie wykonywane szkice.
- Brak kluczy/API OpenAI lub Google w przeglądarce. Brak automatycznego przesyłania audio lub transkryptów na backend AKP.

## Docelowy przepływ
1. Użytkownik mówi. Aplikacja prosi o pozwolenie na mikrofon; jasno komunikuje, kto przetwarza audio.
2. Moduł STT zwraca roboczą transkrypcję; UI umożliwia poprawienie.
3. Adapter AI na **serwerze** (nie w JS klienta) proponuje ustrukturyzowany FieldIntent, z linkami do konkretnych rekordów i źródeł.
4. Walidacja schematu i uprawnień po stronie API (coordinator vs worker), sprawdzenie zgodności pól, identyfikatorów i aktualnej wersji rekordów.
5. Preview/diff operacji + wymagane jawne potwierdzenie; koszty, wysyłki wiadomości i zmiany pracowników wymagają dodatkowego potwierdzenia.
6. Dopiero wtedy zapis z idempotency-key; log audytu, nowa wersja rekordu, czytelny wynik i ewentualnie undo gdzie bezpieczne.

## Dalszy zakres etapów
- Wyceny i pomiary: szkic robót i materiałów, brak automatycznego zatwierdzania kwot.
- Zlecenia: identyfikacja klienta, planowanie i montaż — bez dopasowywania na podstawie podobnych nazw bez weryfikacji.
- Harmonogram godzinowy: wymaga wiarygodnego źródła godzin, obecna baza ma tylko datę.
- Zdjęcia: prywatny Storage, kontrola dostępu, retencja i przydział po stronie API.
- Google Drive: identyfikator folderu zlecenia, minimalne podfoldery, ochrona danych montera.
- Tryb rozmowy: sekwencje pytań o brakujące parametry, bez samodzielnego wykonywania akcji.
- Zabezpieczenia: testy prompt injection, dwukrotne wykonanie tej samej komendy, odmowa po utracie sesji, nieujawnianie cudzych zleceń.

## Wymagana walidacja przed przyszłą integracją
- Staging z odizolowanymi fikcyjnymi danymi, backup + restore dry-run.
- E2E 360/390/430/768 w jasnym i ciemnym oraz PL/UA/RU/EN.
- Bramka produkcji **NO-GO** bez testów logowania, autoryzacji, storage, integracji, audytu i zgody właściciela.

## Kandydat Złoty Łańcuch
`field-intent.v02.schema.json` wraz z parserem read-only stanowi kandydata do wielokrotnego użycia, ale nie został przeniesiony do wspólnej biblioteki ani zatwierdzony jako uniwersalny klocek.
