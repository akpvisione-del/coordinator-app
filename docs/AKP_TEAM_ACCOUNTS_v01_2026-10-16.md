# Konta monterów v01 — gotowe do konfiguracji, jeszcze nieopublikowane

Cel: koordynator w Zespole tworzy konto montera z imieniem, adresem e-mail, hasłem początkowym i językiem PL/RU/UK/EN. Następnie w szczegółach zlecenia korzysta z istniejącego przycisku Dodaj montera. Hasło wprowadzane w aplikacji, nie w rozmowie. Nie ma automatycznej wysyłki do pracownika.

## Gotowy zakres
- POST /api/team: istniejąca sesja aktywnego koordynatora + istniejące Origin/CSRF, zawsze stała rola worker.
- Moduł worker-admin.js wymaga SUPABASE_SECRET_KEY tylko na serwerze. Zmienna nie występuje w public/ ani odpowiedziach HTTP. Dotychczasowy klucz publishable i ścieżki danych użytkowników pozostają bez zmian.
- Początkowe konto Auth bez roli AKP; utworzenie profilu worker; dopiero po udanym profilu nadanie worker w app_metadata. Błąd pośredni blokuje wejście do aplikacji, nie usuwa konta i nie zmienia hasła istniejącego konta.
- Duplikat e-mail / odrzucone hasło: bez aktualizacji istniejącego konta.
- Operator potwierdza tożsamość/adres i nadanie dostępu. email_confirm=true dotyczy tworzonego konta wewnętrznego; operator bierze odpowiedzialność za zweryfikowanie adresu. Nie ma publicznej rejestracji ani omijania uprawnień istniejących użytkowników.
- GET /api/team zgłasza can_create; formularz dostępny tylko przy skonfigurowanej usłudze. Bez klucza 503 i brak prób tworzenia kont.
- Po sukcesie wyczyszczenie haseł, odświeżenie zespołu i wskazanie istniejącej akcji przydzielania. Konta nie otrzymują automatycznie zleceń.
- Skrócono techniczny komunikat w interfejsie.

## Potrzebna konfiguracja i akceptacja
W istniejącym projekcie Supabase AKP COMMANDER staging przygotować osobny serwerowy secret key i przekazać go bezpośrednio do zmiennej Netlify SUPABASE_SECRET_KEY, scope Functions, context Production. Nie przekazywać klucza w czacie i nie zapisywać go w repo/Drive. Jest to nowe uprawnienie administracyjne aplikacji do tworzenia kont; wymaga akceptacji właściciela na etapie podłączenia. Klucz umożliwia szerokie operacje na poziomie dostawcy; kod ogranicza korzystanie z niego do opisanego tworzenia kont worker i profili. Dotychczasowa produkcja nie ma tego klucza w odczytanej liście zmiennych.

Nie utworzono żadnego prawdziwego konta i nie przypisano klienta na potrzeby testów. Po konfiguracji pełny test wymaga konkretnego, zaakceptowanego konta pracownika oraz kontrolowanego przydziału. Nie tworzyć fikcyjnego konta na przypadkowy e-mail.

## Testy i ograniczenia
Testy syntetyczne: uprawnienia, walidacja, brak klucza, stała rola, kolejność provisioning, brak wycieku kluczy/haseł, błąd profilu, ochrona istniejącego konta i brak finansów workera. Testy API nie są prawdziwym testem Auth/workera.
Nie testowano tworzenia kont na produkcji; nie wywoływano admin endpointów prawdziwej bazy. Nie wykonano migracji SQL ani zmiany RLS.
Jeśli profil/finalizacja nie uda się po utworzeniu Auth: stan częściowy bez roli AKP, ręczna kontrola administratora. Brak automatycznego kasowania i odzyskiwania niepowiązanych kont.

Rollback: obecny stabilny Netlify deploy 6ad1e0fd20fb74d95ecdaf4f / commit 2ae53de1b38e31148b9b0fc37c006741c8b15f05. Po ewentualnym wdrożeniu cofnięcie kodu nie usuwa utworzonych kont; zablokowanie funkcji przez usunięcie/rotację dedykowanego klucza. Nie resetować konta Kamila.
