# @marketmind/mcp-strategy

MCP server for power-user strategy work — list/export/create Pine strategies and run backtests through the live backend. Pairs with `@marketmind/mcp-backend` (DB inspection) and `@marketmind/mcp-app` (UI control) but stands alone for pure strategy development.

## Tools

### Strategy CRUD
- `strategy.list` — every Pine file in `builtin/` + `user/`, with parsed header metadata (id, name, version, description, tags, strategyType, momentumType).
- `strategy.export({ id })` — full Pine source for one strategy.
- `strategy.create({ id, pine, overwrite? })` — write a new strategy to `user/`. Validates `// @id`, `// @name`, and `//@version=5`.

### Backtests (proxied via tRPC)
- `strategy.run({ strategyId, symbol, interval, startTime, endTime, initialBalance?, exchange?, assetClass?, params? })` — invoke `backtest.run` and return the BacktestResult.
- `strategy.diff({ strategyId, fixture, paramsA, paramsB })` — run twice in parallel; returns both results plus a flat `metrics` object per side for quick comparison.
- `strategy.getResult({ id })` — proxy `backtest.getResult`.
- `strategy.listBacktests` — proxy `backtest.list`.

### Health
- `__health` — heartbeat with strategy dirs + tRPC URL.

## Pine header contract

The server treats the leading `// @key value` lines of each Pine file as header metadata. Recognized keys:
```
@id              — required for create
@name            — required for create
@version         — semver string
@description     — single line
@author          — free-form
@tags            — comma-separated
@strategyType    — TREND_FOLLOWING | MEAN_REVERSION | BREAKOUT | ...
@momentumType    — BREAKOUT | PULLBACK | REVERSAL | ...
```
Plus the Pine v5 directive itself:
```
//@version=5
```

Anything past the first non-header non-blank line is treated as code and not scanned for metadata.

## Prerequisites

For `strategy.run` / `strategy.diff` / `strategy.getResult` / `strategy.listBacktests`:
1. Backend Fastify server running on `MM_MCP_TRPC_URL` (default `http://localhost:3001/trpc`).
2. Dev session cookie copied into `MM_MCP_SESSION_COOKIE` — required for `backtest.*` (protected procedures).

For `strategy.list` / `strategy.export` / `strategy.create`: no backend required, just filesystem access.

## Local usage

```bash
# From repo root so the default builtin/user paths resolve:
pnpm --filter @marketmind/mcp-strategy build
pnpm --filter @marketmind/mcp-strategy start
```

Or in dev:
```bash
pnpm --filter @marketmind/mcp-strategy dev
```

## Wire into Claude Code

```json
{
  "mcpServers": {
    "marketmind-strategy": {
      "command": "node",
      "args": ["/abs/path/to/marketmind/packages/mcp-strategy/dist/index.js"],
      "env": {
        "MM_MCP_STRATEGY_BUILTIN_DIR": "/abs/path/to/marketmind/apps/backend/strategies/builtin",
        "MM_MCP_STRATEGY_USER_DIR": "/abs/path/to/marketmind/apps/backend/strategies/user",
        "MM_MCP_TRPC_URL": "http://localhost:3001/trpc",
        "MM_MCP_SESSION_COOKIE": "session=..."
      }
    }
  }
}
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MM_MCP_STRATEGY_BUILTIN_DIR` | `apps/backend/strategies/builtin` | Builtin Pine files |
| `MM_MCP_STRATEGY_USER_DIR` | `apps/backend/strategies/user` | User Pine files |
| `MM_MCP_TRPC_URL` | `http://localhost:3001/trpc` | tRPC base for backtests |
| `MM_MCP_SESSION_COOKIE` | _(empty)_ | Cookie header for authenticated calls |

## Known limitations (v1.1)

- `strategy.optimize` (grid search runner) is **deferred to v1.2** — Phase 5.5 in the plan calls it out but the long-running task model needs `audit.tail`-style polling and a job table on the backend; scope-creep risk for v1.1.
- `strategy.create` only validates the header — Pine compilation is not run server-side. Bad Pine code will fail at backtest time.
- No diff visualization — `strategy.diff` returns raw metrics; rendering is the agent's responsibility.
