#!/bin/bash

set -u

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$BACKEND_DIR/../.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
COMPOSE_PROJECT=marketmind
CONTAINER=marketmind-postgres
MAX_WAIT=90
WAIT_INTERVAL=2

if [ ! -f "$ENV_FILE" ]; then
  echo "⚠️  $ENV_FILE not found, skipping database bootstrap"
  exit 0
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL missing in $ENV_FILE, skipping database bootstrap"
  exit 0
fi

url_part() {
  node -e '
    const url = new URL(process.argv[1]);
    const parts = {
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
    };
    process.stdout.write(parts[process.argv[2]] ?? "");
  ' "$DATABASE_URL" "$1"
}

DB_HOST=$(url_part host)
DB_PORT=$(url_part port)

is_accepting_connections() {
  node -e '
    const socket = require("net").connect(Number(process.argv[2]), process.argv[1]);
    socket.setTimeout(1500);
    socket.on("connect", () => { socket.end(); process.exit(0); });
    socket.on("error", () => process.exit(1));
    socket.on("timeout", () => process.exit(1));
  ' "$DB_HOST" "$DB_PORT"
}

compose() {
  docker compose -p "$COMPOSE_PROJECT" -f "$REPO_ROOT/docker-compose.yml" --project-directory "$REPO_ROOT" "$@"
}

if is_accepting_connections; then
  echo "✅ PostgreSQL is accepting connections at $DB_HOST:$DB_PORT"
  exit 0
fi

case "$DB_HOST" in
  localhost|127.0.0.1|::1) ;;
  *)
    echo "❌ PostgreSQL at $DB_HOST:$DB_PORT is not reachable and is not local, nothing to start here"
    exit 1
    ;;
esac

bash "$BACKEND_DIR/scripts/ensure-docker.sh" || exit 1

echo "🐘 Starting PostgreSQL ($CONTAINER) via docker compose..."
DATABASE_USER=$(url_part user) \
DATABASE_PASSWORD=$(url_part password) \
DATABASE_NAME=$(url_part database) \
DATABASE_PORT=$DB_PORT \
compose up -d postgres 2>&1 | grep -v 'variable is not set'
if [ "${PIPESTATUS[0]}" -ne 0 ]; then
  echo "❌ docker compose could not start postgres"
  exit 1
fi

echo "⏳ Waiting for PostgreSQL to become healthy (max ${MAX_WAIT}s)..."
elapsed=0
until is_accepting_connections && [ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null)" = "healthy" ]; do
  if [ $elapsed -ge $MAX_WAIT ]; then
    echo "❌ PostgreSQL did not become healthy within ${MAX_WAIT}s"
    compose logs --tail 30 postgres
    exit 1
  fi
  sleep $WAIT_INTERVAL
  elapsed=$((elapsed + WAIT_INTERVAL))
  echo "   ... waiting ($elapsed/${MAX_WAIT}s)"
done

echo "✅ PostgreSQL is ready at $DB_HOST:$DB_PORT (started in ${elapsed}s)"
exit 0
