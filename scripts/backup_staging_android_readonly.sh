#!/data/data/com.termux/files/usr/bin/bash
# AKP VISIONE — Android/Termux, read-only logical backup of staging.
# Not executed. Review before use; never upload resulting data to GitHub.
set -Eeuo pipefail
umask 077

PROJECT_REF='ttectcuirgdakjhpkkll'
USERNAME="postgres.${PROJECT_REF}"
DEST="$HOME/AKP_BACKUPS_PRIVATE/STAGING_${PROJECT_REF}_$(date -u +%Y%m%dT%H%M%SZ)"
cleanup() { unset PGPASSWORD PGHOST PGUSER PGDATABASE PGPORT PGSSLMODE PGSSLROOTCERT || true; }
trap cleanup EXIT

for tool in pg_dump pg_restore psql sha256sum; do
  command -v "$tool" >/dev/null || { echo "Brak: $tool. Uruchom: pkg install postgresql coreutils"; exit 1; }
done

echo "AKP STAGING — tylko odczyt, bez migracji i bez jakichkolwiek zapisow."
echo "Supabase Dashboard → Connect → Session pooler → port 5432."
read -r -p 'Host Session pooler (sam host, bez URL i hasla): ' pooler_host
if [[ ! "$pooler_host" =~ ^[A-Za-z0-9-]+([.][A-Za-z0-9-]+)*[.]pooler[.]supabase[.]com$ ]]; then
  echo 'Nieprawidlowy host poolera Supabase.' >&2; exit 1
fi
read -r -p 'Potwierdz project-ref staging: ' typed_ref
if [[ "$typed_ref" != "$PROJECT_REF" ]]; then
  echo 'Niezgodny projekt — przerwano.' >&2; exit 1
fi
echo 'Haslo bazy wprowadz TYLKO lokalnie. Nie udostepniaj go w czacie.'
read -r -s -p 'Haslo bazy staging: ' PGPASSWORD
echo
if [[ -z "$PGPASSWORD" ]]; then echo 'Brak hasla.' >&2; exit 1; fi

export PGPASSWORD
export PGHOST="$pooler_host" PGUSER="$USERNAME" PGDATABASE='postgres' PGPORT='5432'
export PGSSLMODE='verify-full' PGSSLROOTCERT='system'

echo 'Kontrola polaczenia: tylko SELECT...'
psql -X -v ON_ERROR_STOP=1 -A -t -c "SELECT current_database(),current_setting('server_version'),current_user;"

mkdir -p "$DEST"
echo 'INCOMPLETE - DO NOT RESTORE' > "$DEST/STATUS.txt"
echo "Eksport: $DEST"
# One consistent PostgreSQL database snapshot; does not cover cluster-wide
# roles, cloud settings, or binary objects in Supabase Storage.
pg_dump --format=custom --no-owner --no-acl --file "$DEST/staging.logical.dump" --verbose
test -s "$DEST/staging.logical.dump" || { echo 'Archiwum jest puste.' >&2; exit 1; }
pg_restore --list "$DEST/staging.logical.dump" > "$DEST/archive.list"

for pattern in 'TABLE DATA public akp_jobs' 'TABLE DATA public akp_profiles' 'TABLE DATA public akp_audit' 'TABLE DATA public akp_job_sources' 'TABLE DATA auth users' 'TABLE DATA supabase_migrations schema_migrations' 'FUNCTION akp_internal log_change'; do
  if ! grep -Fq "$pattern" "$DEST/archive.list"; then
    echo "Brakuje obiektu w archiwum: $pattern" >&2
    echo 'Archiwum wymaga dalszej kontroli; status INCOMPLETE.' >&2
    exit 2
  fi
done
sha256sum "$DEST/staging.logical.dump" > "$DEST/sha256.txt"
echo 'EXPORT CREATED; RESTORE NOT TESTED' > "$DEST/STATUS.txt"
chmod 600 "$DEST/staging.logical.dump" "$DEST/archive.list" "$DEST/sha256.txt" "$DEST/STATUS.txt"
echo "ARCHIWUM ZAPISANE: $DEST"
echo 'UWAGA: nie testowano odtworzenia na osobnej bazie.'
echo 'Nie przesylaj dumpa do GitHub, Gemini ani ChatGPT — zawiera dane klientow i kont.'
