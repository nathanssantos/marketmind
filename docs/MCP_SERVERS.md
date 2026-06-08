# MCP Servers — MarketMind v1.1

MarketMind ships four Model Context Protocol servers that expose its dev surface to any MCP-compatible agent (Claude Code, ChatGPT desktop, custom). Each is independently installable and runs as its own stdio process.

| Server | Package | Surface |
| --- | --- | --- |
| `marketmind-screenshot` | `@marketmind/mcp-screenshot` | Capture any tab/modal/sidebar in light + dark via headless Chromium. |
| `marketmind-app` | `@marketmind/mcp-app` | Drive the live dev app — open settings/modals, navigate symbols, toggle sidebars, inspect Zustand stores, dispatch allowlisted store actions. |
| `marketmind-backend` | `@marketmind/mcp-backend` | Read-only DB access (per-table query tools + SELECT-only escape hatch) and tRPC bridge against the running backend. |
| `marketmind-strategy` | `@marketmind/mcp-strategy` | List/export/create Pine strategies and run backtests through the live backend. |

All four are dev-only by design — they require either the renderer running with `VITE_E2E_BYPASS_AUTH=true`, the backend Postgres reachable, or both.

## Project config (`.mcp.json`) — recommended

The repo ships a versioned `.mcp.json` at the root declaring all five servers with **relative paths** and `${VAR:-default}` env expansion. Any MCP-aware client (Claude Code, Cursor, Windsurf) launched from the project root picks them up automatically — no global config, no per-machine paths. Real secrets (`DATABASE_URL`, `MM_MCP_SESSION_COOKIE`) come from your environment; the committed defaults only cover local dev. You only need to build the servers once:

```bash
pnpm install
pnpm mcp:build
```

## Global install (legacy / per-user)

```bash
pnpm install
pnpm mcp:build
pnpm mcp:install
```

This auto-detects every `packages/mcp-*` workspace, builds them, and registers them in `~/.claude.json` under the `mcpServers` map with absolute paths. Restart your MCP client to pick them up. Prefer the project `.mcp.json` above unless you specifically want a user-global registration.

To preview what would change:
```bash
pnpm mcp:install:dry-run
```

To remove all MarketMind entries:
```bash
pnpm mcp:uninstall
```

The script preserves any unrelated `mcpServers` entries (other tools you've installed). Override the target config path with `MM_MCP_CLAUDE_CONFIG_PATH=/path/to/config.json`.

## Per-server reference

Per-tool input/output schemas live in each package's README:
- [`packages/mcp-screenshot/README.md`](../packages/mcp-screenshot/README.md)
- [`packages/mcp-app/README.md`](../packages/mcp-app/README.md)
- [`packages/mcp-backend/README.md`](../packages/mcp-backend/README.md)
- [`packages/mcp-strategy/README.md`](../packages/mcp-strategy/README.md)

### marketmind-screenshot — 6 tools

| Tool | Description |
| --- | --- |
| `screenshot.tab` | Capture a Settings tab |
| `screenshot.modal` | Capture a modal (settings/orders/backtest/screener/analytics) |
| `screenshot.sidebar` | Capture a sidebar (trading/autoTrading/market/orderFlow) |
| `screenshot.fullPage` | Capture the current page state |
| `screenshot.gallery` | Batch capture across surfaces × themes; emits an HTML index |
| `__health` | Server heartbeat |

### marketmind-app — 19 tools

| Group | Tools |
| --- | --- |
| Navigation | `app.openSettings`, `app.closeSettings`, `app.closeAll`, `app.openModal` |
| Symbol/chart | `app.navigateToSymbol`, `app.setTimeframe`, `app.setChartType`, `app.setMarketType` |
| UI state | `app.applyTheme`, `app.toggleSidebar`, `app.toggleIndicator` |
| Dispatch | `app.dispatchToolbar` (allowlisted), `app.dispatchStore` (allowlisted) |
| Escape | `app.click`, `app.fill`, `app.waitFor`, `app.takeScreenshot` |
| Inspection | `app.inspectStore` |
| Health | `__health` |

### marketmind-backend — 14 tools

| Group | Tools |
| --- | --- |
| Per-table read | `db.query.{wallets, executions, orders, klines, users, sessions, watchers, setups, autoTradingConfig}` |
| Raw SQL | `db.exec` (SELECT/CTE only) |
| tRPC | `trpc.call` |
| Audit | `audit.tail` |
| Health | `health.check`, `__health` |

### marketmind-strategy — 8 tools

| Group | Tools |
| --- | --- |
| CRUD | `strategy.list`, `strategy.export`, `strategy.create` |
| Backtest | `strategy.run`, `strategy.diff`, `strategy.getResult`, `strategy.listBacktests` |
| Health | `__health` |

## Architecture summary

```
┌─────────────────────┐       Playwright          ┌────────────────────┐
│ marketmind-screenshot├──── headless Chromium ──→│ Vite dev (5174)    │
└─────────────────────┘                            │  + Electron        │
                                                   │   renderer         │
┌─────────────────────┐       Playwright          │  (E2E_BYPASS=true) │
│ marketmind-app      ├──── headless Chromium ──→│                    │
└─────────────────────┘                            └────────────────────┘
                                                          │
                                                          │ tRPC over HTTP
                                                          ▼
┌─────────────────────┐         pg                 ┌────────────────────┐
│ marketmind-backend  ├──────────────────────────→│ Backend (3001)     │
└─────────────────────┘    + tRPC HTTP            │  + Postgres        │
                                                   │   + TimescaleDB    │
┌─────────────────────┐                            │                    │
│ marketmind-strategy ├──────── tRPC HTTP ───────→│                    │
└─────────────────────┘                            └────────────────────┘
                  │
                  │ filesystem
                  ▼
        apps/backend/strategies/{builtin,user}/*.pine
```

Each server is a separate Node process; they don't talk to each other. An agent using multiple servers in a single conversation gets the union of their tools.

## Out of scope for v1.1

- **`mcp-trading`** — trade execution via MCP. Deferred to v1.2 with mandatory per-call confirmation, wallet whitelist, monetary cap, and dedicated audit channel.
- **`mcp-strategy.optimize`** — long-running grid search with task polling. Skeleton only in v1.1.
- **`marketmind_ro` Postgres role** — `mcp-backend` enforces SELECT-only at the JS layer; a true read-only role is a v1.2 hardening.
- **Cross-machine deployment** — every server is local-only, audit logs do not leave the machine.

## Related docs

- [`docs/MCP_AGENT_GUIDE.md`](MCP_AGENT_GUIDE.md) — common-flow recipes
- [`docs/MCP_SECURITY.md`](MCP_SECURITY.md) — threat model, env gates, data flow
- [`docs/V1_POST_RELEASE_PLAN.md`](V1_POST_RELEASE_PLAN.md) — Phase 5 spec this implements
