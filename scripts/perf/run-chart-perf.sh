#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
ELECTRON_PKG="@marketmind/electron"

cd "$ROOT"

echo "==> Ensuring Playwright Chromium is installed"
pnpm --filter "$ELECTRON_PKG" exec playwright install chromium --with-deps

echo "==> Running chart-perf harness"
pnpm --filter "$ELECTRON_PKG" exec playwright test --project=perf --reporter=list

echo "==> Comparing against baseline"
pnpm exec tsx "$HERE/compare-baseline.ts"
