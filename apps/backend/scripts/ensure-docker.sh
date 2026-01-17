#!/bin/bash

MAX_WAIT=60
WAIT_INTERVAL=2

check_docker() {
  docker info > /dev/null 2>&1
  return $?
}

if check_docker; then
  echo "✅ Docker is already running"
  exit 0
fi

echo "🐳 Docker is not running. Starting Docker Desktop..."

if [[ "$OSTYPE" == "darwin"* ]]; then
  open -a Docker
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  sudo systemctl start docker 2>/dev/null || sudo service docker start 2>/dev/null
else
  echo "❌ Unsupported OS: $OSTYPE"
  exit 1
fi

echo "⏳ Waiting for Docker to start (max ${MAX_WAIT}s)..."

elapsed=0
while ! check_docker; do
  if [ $elapsed -ge $MAX_WAIT ]; then
    echo "❌ Docker failed to start within ${MAX_WAIT} seconds"
    exit 1
  fi
  sleep $WAIT_INTERVAL
  elapsed=$((elapsed + WAIT_INTERVAL))
  echo "   ... waiting ($elapsed/${MAX_WAIT}s)"
done

echo "✅ Docker is now running (started in ${elapsed}s)"
exit 0
