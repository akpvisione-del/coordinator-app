# SUPERSPRINT 01 — kontrakty Netlify / Supabase

API jest częścią istniejącego `netlify/functions/api.js`, lokalnie obsługiwanego przez server.js. Sesja: HttpOnly/Secure/SameSite=Strict cookies. Mutacje: skonfigurowany Origin + `X-Akp-Request: commander-v10`. Każde żądanie sprawdza Auth i aktualny aktywny profil zgodny z podpisaną rolą. Brak service_role w przeglądarce lub komunikatorze. Netlify queryStringParameters i Express originalUrl są obsługiwane.

## Komunikator (public/chat.js, netlify/functions/chat.js)

| Metoda / ścieżka | Kontrakt |
|---|---|
| GET /chat/recipients | {items:[{id,display}]}; aktywni odbiorcy przeciwnej roli |
| POST /chat/threads | {other_user_id,job_id?:UUID/null} → {thread:{id,job_id}}; powtórzenie pary/kontekstu zwraca ten sam wątek |
| GET /chat/threads?offset=0&limit=50 | {items:[{id,job_id,peer_id,peer_display,unread,created_at}],unread_total,next_offset} |
| GET /chat/threads/:id/messages?before=SEQ&q=TEXT&limit=50 | {items:[message],next_before}; DESC seq, frontend odwraca chronologicznie; q do 100 znaków |
| POST /chat/threads/:id/messages | {body,client_id:UUID,language?:pl/ru/uk/en,job_id?:UUID/null} → {message}; tekst 1–4000 znaków |
| POST /chat/threads/:id/read | {message_id:UUID} → {ok:true}; nie przyjmuje czasu ani dowolnego watermark klienta |
| GET /chat/notifications | {unread_total}; licznik wszystkich dostępnych, nieodczytanych wiadomości innych nadawców |

Message: `{id,seq:string,body,sender_id,job_id,source_language,created_at}`. bigint kursory pozostają tekstem, również powyżej 2^53. Limit strony 1–100. Nowe wpisy są serializowane per-thread przed nadaniem seq, aby watermark nie pomijał starszej niezatwierdzonej transakcji.

Wysyłka: unikalne `(thread_id,sender_id,client_id)`; ten sam klucz i payload zwraca poprzedni wynik, inny payload daje 409. Nadawca pochodzi z auth.uid(), nie z klienta. Formularz zachowuje szkic i klucz po niepewnym wyniku, nie zapisuje danych w localStorage/IndexedDB. Reset sesji usuwa pamięć i odrzuca wcześniejsze odpowiedzi.

RPC: `akp_chat_recipients`, `akp_chat_create_thread`, `akp_chat_threads_list`, `akp_chat_messages_list`, `akp_chat_send`, `akp_chat_mark_read`. Schemat akp_chat_private zawiera wyłącznie minimalne helpery RLS z ustalonym search_path. Surowe tabele mają SELECT przez RLS, bez INSERT/UPDATE/DELETE/TRUNCATE dla authenticated/anon. Zmiana członkostwa i edycja/usuwanie wiadomości nie są wystawione.

RLS/RPC wymagają członkostwa i aktywnego własnego profilu. Worker musi nadal posiadać przydział do kontekstu job. Koordynator będący uczestnikiem zachowuje historię dezaktywowanego odbiorcy, lecz wysyłka do niego jest blokowana. Ogólna rozmowa może pozostać dostępna po odpięciu job, ale powiązane wiadomości job są wtedy ukryte.

Błędy: 401 nieaktywna sesja; 403 odmowa RLS; 409 konflikt client_id; 422 walidacja; 503 brak zatwierdzonego schematu lub dostępności. Brak automatycznego fallbacku do pamięci.

## Zespół / historia

- Zachowane GET/POST /team i PATCH /team/:id z PR #13, stała rola worker, edycja wyłącznie name/language/is_active.
- POST /team/invite: `{name,email,language,confirm_access:true}`. Nie przyjmuje hasła, roli lub callback URL. Edge action=invite_worker tworzy konto bez hasła, profil worker i wysyła Supabase Auth recover do skonfigurowanego `AKP_APP_ORIGIN/reset-password.html`. Korzysta z istniejącego, przetestowanego flow recovery. Błąd po utworzeniu wymaga sprawdzenia listy, nie automatycznego ponowienia.
- GET /team/:id/history?before=SEQ i GET /jobs/:id/assignment-history?before=SEQ: `{items:[{id:string,worker_id,job_id,actor_id,action,before,after,created_at}],next_before}`. Koordynator + aktualny aktywny profil; 50 rekordów/strona.
- Historię generują triggery zatwierdzonej nowej migracji, nie frontend. Zmiana no-op nie generuje zdarzenia. Pola ograniczone do display_name/preferred_lang/is_active/active; bez haseł, tokenów, emaili, finansów. actor_id=null przy operacji usługi nie jest zastępowane zgadywaną osobą.
- Aplikacja nie usuwa kont, przydziałów ani historii. Nieukończony provisioning zostawia konto bez roli AKP, z wymaganiem interwencji administratora.
