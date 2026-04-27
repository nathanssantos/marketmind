# @marketmind/mcp-screenshot

MCP server that drives a headless Chromium browser against the MarketMind dev server (`apps/electron` running with `VITE_E2E_BYPASS_AUTH=true`) and exposes screenshot tools to any MCP-compatible client (Claude Code, ChatGPT desktop, custom agents).

It is the runtime backbone for **Phase 6 — Visual Verification** of the v1.1 plan.

## Why

Reviewing every Settings tab, modal, and sidebar in light + dark mode by hand is slow and error-prone. This server gives an agent a simple `screenshot.tab` / `screenshot.modal` / `screenshot.sidebar` / `screenshot.gallery` API so it can:

- Verify that a UI change rendered correctly in both themes
- Build a timestamped HTML gallery for human review (`apps/electron/screenshots/{ts}/gallery.html`)
- Drive batch captures during release QA

Browser is reused across calls (single Chromium process per server lifetime, restarted after **50 captures** or **30 minutes** of idle time) — no per-tool launch cost.

## Tools

| Tool | Description | Required input |
| --- | --- | --- |
| `screenshot.tab` | Open a Settings tab and capture | `tabId` (`account` \| `security` \| ...) |
| `screenshot.modal` | Open a modal via store dispatch and capture | `modalId` (`orders` \| `backtest` \| `screener` \| `analytics` \| `settings`) |
| `screenshot.sidebar` | Toggle a sidebar open and capture | `sidebarId` (`trading` \| `autoTrading` \| `market` \| `orderFlow`) |
| `screenshot.fullPage` | Capture whatever is currently rendered | `label` |
| `screenshot.gallery` | Batch capture across `tabs × modals × sidebars × themes` and emit `gallery.html` | optional filters |
| `__health` | Check the server is alive and which dev URL it points at | — |

All tools accept an optional `theme` (`'dark'` \| `'light'`, default `'dark'`).

`screenshot.gallery` accepts:
- `tabs`: `'all'` or array of tab ids
- `modals`: `'all'` or array of modal ids
- `sidebars`: `'all'` or array of sidebar ids
- `themes`: array, defaults to `['dark', 'light']`

Output:
```json
{
  "sessionDir": ".../apps/electron/screenshots/2026-04-27T...",
  "galleryHtmlPath": ".../gallery.html",
  "captureCount": 26
}
```

## Prerequisites

1. The Electron renderer dev server must be running with the e2e bridge enabled:
   ```bash
   VITE_E2E_BYPASS_AUTH=true pnpm --filter @marketmind/electron dev:web
   ```
   This exposes `window.__globalActions`, `window.__uiStore`, `window.__backtestModalStore`, `window.__screenerStore`, and `window.__preferencesStore` — required by the capture script.
2. The renderer is reachable at `http://localhost:5174` (override via `MM_MCP_BASE_URL`).
3. Playwright Chromium installed:
   ```bash
   pnpm --filter @marketmind/mcp-screenshot exec playwright install chromium
   ```

## Local usage

Build and run:
```bash
pnpm --filter @marketmind/mcp-screenshot build
pnpm --filter @marketmind/mcp-screenshot start
```

Or in dev (no build step):
```bash
pnpm --filter @marketmind/mcp-screenshot dev
```

## Wire into Claude Code

Add to `~/.claude.json` (or any MCP client config):
```json
{
  "mcpServers": {
    "marketmind-screenshot": {
      "command": "node",
      "args": [
        "/absolute/path/to/marketmind/packages/mcp-screenshot/dist/index.js"
      ],
      "env": {
        "MM_MCP_BASE_URL": "http://localhost:5174",
        "MM_MCP_SCREENSHOT_DIR": "/absolute/path/to/marketmind/apps/electron/screenshots"
      }
    }
  }
}
```

Restart the client; the tools will appear under the `marketmind-screenshot` namespace.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MM_MCP_BASE_URL` | `http://localhost:5174` | Dev server URL the browser opens |
| `MM_MCP_SCREENSHOT_DIR` | `apps/electron/screenshots` | Base directory for capture sessions |

## Directory layout

```
apps/electron/screenshots/
  2026-04-27T13-58-12-345Z/
    settings-account__dark.png
    settings-account__light.png
    modal-analytics__dark.png
    sidebar-trading__dark.png
    ...
    gallery.html       # side-by-side dark/light grid, grouped by surface
```

## Known limitations (v1.1)

- Modals that open through specific in-app flows (`startWatchers`, `createWallet`, `addWatcher`, `importProfile`, `tradingProfiles`) are out of scope for direct capture. They will be exposed via per-flow tools in `@marketmind/mcp-app`.
- The browser persists across calls — if you change the dev server URL, the server has to be restarted.
- Headless Chromium only; no full Electron-process screenshot (acceptable for the UI we render in the renderer process).
