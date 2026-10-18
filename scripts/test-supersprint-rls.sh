#!/usr/bin/env bash
# Disposable PostgreSQL, no network, synthetic identities. Never connects to Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
name="akp-sprint-ci-$$-$RANDOM"
cleanup(){ "${docker_cmd[@]}" rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${docker_cmd[@]}" run -d --rm --name "$name" --network none --mount "type=bind,src=$PWD,dst=/src,readonly" -w /src -e POSTGRES_PASSWORD=synthetic-ci-only -e POSTGRES_DB=akp_sprint_ci postgres:16-alpine >/dev/null
ready=0
for attempt in {1..60}; do
 if "${docker_cmd[@]}" exec "$name" pg_isready -h 127.0.0.1 -U postgres -d akp_sprint_ci >/dev/null 2>&1; then ready=1; break; fi
 sleep 0.5
done
if [[ "$ready" != 1 ]]; then "${docker_cmd[@]}" logs "$name"; exit 1; fi
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/10_run.sql
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/20_chat.sql
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/30_team_history.sql
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/40_quotes.sql
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/50_materials.sql
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/60_media.sql
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/70_drawing.sql
"${docker_cmd[@]}" exec "$name" psql -X -U postgres -d akp_sprint_ci -v ON_ERROR_STOP=1 -f tests/rls_isolated/90_sprint03_rollback.sql
