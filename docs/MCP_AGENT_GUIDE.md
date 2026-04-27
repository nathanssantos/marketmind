# MCP Agent Guide — common flows

Recipes for getting useful work done via the MarketMind MCP servers. Each recipe assumes you've installed all four servers via `pnpm mcp:install` and have the dev stack running:

```bash
# Terminal 1 — backend
pnpm dev:backend

# Terminal 2 — renderer with the e2e bridge
VITE_E2E_BYPASS_AUTH=true pnpm dev:web
```

For tools that hit authenticated tRPC procedures (`trpc.call`, `strategy.run`, etc.), copy your dev session cookie (Chrome devtools → Application → Cookies → `session=...`) into `MM_MCP_SESSION_COOKIE` and re-run `pnpm mcp:install` (or edit `~/.claude.json` directly).

---

## "Screenshot every modal in dark and light"

```
screenshot.gallery {
  modals: "all",
  themes: ["dark", "light"]
}
```

Returns:
```json
{
  "sessionDir": ".../apps/electron/screenshots/2026-04-27T...",
  "galleryHtmlPath": ".../gallery.html",
  "captureCount": 10
}
```

Open `gallery.html` in a browser for a side-by-side review grid grouped by surface.

For a full QA sweep:
```
screenshot.gallery {
  tabs: "all",
  modals: "all",
  sidebars: "all",
  themes: ["dark", "light"]
}
```

Expect ~80 captures and a few minutes of runtime.

---

## "Open Settings on Security and show me"

```
app.openSettings { tab: "security" }
screenshot.fullPage { label: "settings-security-review" }
```

The capture lands in `apps/electron/screenshots/`. Pair with theme switching:
```
app.applyTheme { theme: "light" }
screenshot.fullPage { label: "settings-security-light" }
app.applyTheme { theme: "dark" }
screenshot.fullPage { label: "settings-security-dark" }
```

---

## "Show me the P&L on wallet X over the last 30 days"

Direct DB:
```
db.query.executions {
  where: { wallet_id: "wallet-id-here", status: "closed" },
  since: "2026-03-27T00:00:00Z",
  orderBy: "exit_time desc",
  limit: 200
}
```

Or via the analytics tRPC if you want the aggregated shape the UI uses:
```
trpc.call {
  path: "analytics.performance.get",
  input: { walletId: "wallet-id-here", period: "month" }
}
```

---

## "Compare two parameter sets for the same strategy"

```
strategy.diff {
  strategyId: "breakout-retest",
  fixture: {
    symbol: "BTCUSDT",
    interval: "1h",
    startTime: "2026-01-01T00:00:00Z",
    endTime: "2026-04-01T00:00:00Z",
    exchange: "BINANCE",
    assetClass: "CRYPTO"
  },
  paramsA: { lookbackPeriod: 30, emaPeriod: 20 },
  paramsB: { lookbackPeriod: 50, emaPeriod: 30 }
}
```

Returns both BacktestResults with a flat `metrics` summary per side — feed those into a chart or just print the deltas.

---

## "Navigate to BTCUSDT futures, switch to 5m candles, open the screener"

```
app.navigateToSymbol { symbol: "BTCUSDT", marketType: "FUTURES" }
app.setTimeframe { timeframe: "5m" }
app.setChartType { chartType: "candle" }
app.openModal { modalId: "screener" }
```

Each call returns `{ ok: true, ... }` with the resolved value, so you can chain them and the agent stays in sync with the dev app.

---

## "What's currently in the indicator store?"

```
app.inspectStore { storeId: "indicatorStore" }
```

Returns the serializable subset of state (functions/Maps/Sets are stripped). Useful for "did the indicator panel actually persist my last layout" debugging.

To toggle a specific indicator visibility:
```
app.toggleIndicator { instanceId: "indicator-uuid-here" }
```

---

## "Audit recent MCP calls"

```
audit.tail { limit: 20 }
```

Filter by event type:
```
audit.tail { event: "db.exec", limit: 10 }
```

The log lives at `MM_MCP_AUDIT_LOG_PATH` (default `apps/backend/logs/mcp-audit.jsonl`) and is local-only — it never leaves your machine.

---

## "Verify everything is healthy"

```
__health                      # any server's __health tool
health.check                  # mcp-backend: DB + tRPC ping
```

`mcp-backend.health.check` returns:
```json
{
  "db": { "ok": true },
  "trpc": { "ok": true, "status": 200, "baseUrl": "http://localhost:3001/trpc" },
  "auditLog": "/abs/path/to/mcp-audit.jsonl"
}
```

---

## "Try a hand-crafted SELECT"

```
db.exec {
  sql: "SELECT symbol, COUNT(*) AS executions FROM trade_executions WHERE wallet_id = 'w-1' GROUP BY symbol ORDER BY executions DESC LIMIT 10"
}
```

Anything other than `SELECT`/`WITH` is rejected — see the README for the rejection rules.

---

## Multi-server flows

The MCP servers are independent — when you mix them, you get the union of their tools in one conversation. Common combinations:

- **Visual review of a feature change**: `app.navigateToSymbol` → `app.applyTheme` → `screenshot.fullPage` → repeat for each surface you're verifying.
- **Strategy iteration**: `strategy.list` → `strategy.export` → tweak Pine in your editor → `strategy.create` (with `overwrite: true`) → `strategy.run` → `strategy.diff` against the previous best.
- **Debugging a stuck wallet**: `db.query.executions` (still-open?) → `db.query.orders` (any pending?) → `app.openModal { modalId: "orders" }` → `screenshot.fullPage` → `trpc.call { path: "trading.cancelOrder", ... }` if needed.

---

## Reproducing user bugs — drive the real flow, not fixtures

When a user reports "I clicked X and it didn't work", the only valid repro is the same path the user took: open the app, find the same UI affordance, click it, observe the result. Don't reach in with `dispatchStore` to set state, don't pre-populate fixtures to fake the data — those bypass the very wiring you're trying to test.

Use `mcp-app` (not `mcp-screenshot`) for this — `mcp-screenshot` ships with `installVisualFixtures` baked in, so it short-circuits real tRPC calls. `mcp-app` drives the live renderer against the real backend.

```
# 1. Reset to a known starting point
app.closeAll {}

# 2. Click the affordance the user clicked (header symbol pill, etc.)
app.click { selector: "[data-testid=symbol-selector]" }

# 3. Click the actual list item (mirror what the user sees)
app.click { selector: "text=POLITIFI" }

# 4. Observe what loaded
app.takeScreenshot { label: "after-politifi-click" }
app.inspectStore { store: "indicator" }
```

If the bug repros only when fixtures are off, that's a load-bearing signal — the failure is in the wiring between renderer, tRPC, and backend, not in the renderer alone. Disable fixtures before driving:

```bash
MM_MCP_FIXTURES=false node scripts/visual-gallery.mjs
```

Anything you can do via MCP tools, a real user can also do — and that constraint keeps the repro honest.

---

## Limits and gotchas

- **One browser per Playwright server.** `mcp-screenshot` and `mcp-app` each launch their own Chromium. They don't share session/state — toggling a sidebar in one doesn't affect the other.
- **State persists across calls.** Both Playwright servers reuse their browser instance. If a previous call left a modal open, the next call sees that state. Use `app.closeAll` to reset.
- **Authenticated tRPC needs a cookie.** `trpc.call`, `strategy.run`, etc. need `MM_MCP_SESSION_COOKIE` set. Without it you'll see `UNAUTHORIZED` errors.
- **`db.exec` is regex-validated.** It correctly rejects `INSERT`/`UPDATE`/`DELETE` but doesn't fully parse SQL — extremely creative quoting could in theory smuggle a forbidden token. Don't use it as a security boundary; the `marketmind_ro` Postgres role hardening is on the v1.2 list.
