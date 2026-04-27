# @marketmind/mcp-app

MCP server that drives the live MarketMind dev app via Playwright. Lets agents open settings/modals, navigate to symbols, change timeframe/chart type/market type, toggle sidebars, inspect Zustand stores, and dispatch allowlisted store actions — all without you having to click anything yourself.

This is the **renderer-control** layer of the MCP architecture (Phase 5.3). For pixel-level verification use `@marketmind/mcp-screenshot`; for DB/tRPC access use `@marketmind/mcp-backend`.

## Tools

### Navigation
- `app.openSettings({ tab? })`
- `app.closeSettings()`
- `app.closeAll()` — closes settings, modals, dialogs, all sidebars
- `app.openModal({ modalId })` — `settings | orders | backtest | screener | analytics`

### Symbol / chart
- `app.navigateToSymbol({ symbol, marketType? })`
- `app.setTimeframe({ timeframe })`
- `app.setChartType({ chartType })`
- `app.setMarketType({ marketType })` — `SPOT` or `FUTURES`

### UI state
- `app.applyTheme({ theme })` — `light` or `dark`
- `app.toggleSidebar({ sidebarId, open? })` — pass `open` to force a value
- `app.toggleIndicator({ instanceId })`
- `app.dispatchToolbar({ action })` — allowlisted toolbar actions

### Escape hatches
- `app.click({ selector })`
- `app.fill({ selector, value })`
- `app.waitFor({ selector? | text?, timeoutMs? })`
- `app.takeScreenshot({ label })`

### Store
- `app.inspectStore({ storeId })` — read-only state dump (functions/Maps/Sets stripped)
- `app.dispatchStore({ storeId, action, payload? })` — allowlisted only (see `STORE_DISPATCH_ALLOWLIST`)

### Health
- `__health` — returns `{ ok, baseUrl, tools }`

## Allowlists

`dispatchToolbar` accepts:
```
toggleTrading, toggleAutoTrading,
toggleMarketSidebar, toggleOrderFlowSidebar,
openScreener, openBacktest, openAnalytics, openOrders, openSettings
```

`dispatchStore` accepts only the {store, action} pairs in `STORE_DISPATCH_ALLOWLIST` (see `src/types.ts`):
- `uiStore`: `setOrdersDialogOpen`, `setAnalyticsOpen`, `setMarketSidebarOpen`, `setOrderFlowSidebarOpen`
- `screenerStore`: `setScreenerOpen`, `toggleScreener`, `setActivePresetId`
- `backtestModalStore`: `openBacktest`, `closeBacktest`, `toggleBacktest`
- `preferencesStore`: `set` (any category/key — preferences are user-controlled anyway)

Anything else is rejected with a structured error.

## Prerequisites

1. The Electron renderer dev server must be running with the e2e bridge:
   ```bash
   VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron dev:web
   ```
2. The renderer is reachable at `http://localhost:5174` (override via `MM_MCP_BASE_URL`).
3. Playwright Chromium is installed:
   ```bash
   pnpm --filter @marketmind/mcp-app exec playwright install chromium
   ```

## Local usage

```bash
pnpm --filter @marketmind/mcp-app build
pnpm --filter @marketmind/mcp-app start
```

Or in dev:
```bash
pnpm --filter @marketmind/mcp-app dev
```

## Wire into Claude Code

```json
{
  "mcpServers": {
    "marketmind-app": {
      "command": "node",
      "args": ["/abs/path/to/marketmind/packages/mcp-app/dist/index.js"],
      "env": { "MM_MCP_BASE_URL": "http://localhost:5174" }
    }
  }
}
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MM_MCP_BASE_URL` | `http://localhost:5174` | Dev server URL the browser opens |
| `MM_MCP_APP_SCREENSHOT_DIR` | `apps/electron/screenshots` | Where `takeScreenshot` writes |

## Browser lifecycle

Single Chromium instance per server lifetime, restarted after **200 dispatches** or **30 minutes** idle. The browser keeps state across dispatches, so a sequence like
```
app.navigateToSymbol BTCUSDT FUTURES
app.applyTheme dark
app.openModal analytics
```
behaves the way a human would experience it.

## Security model

This server is **dev-only**. It refuses to connect if `__globalActions` is not exposed (which only happens with `VITE_E2E_BYPASS_AUTH=true`). It does not touch production builds, does not make network calls beyond loading the dev URL, and does not place trades — `mcp-trading` is deferred to v1.2 with a per-call confirmation flow.

`dispatchStore` is allowlisted to keep agent actions predictable. The escape hatches (`click`/`fill`) operate on the same browser as everything else; they cannot reach beyond the renderer.
