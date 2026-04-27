# @marketmind/mcp-backend

MCP server that exposes a **read-only** view into the MarketMind backend — direct DB queries against an allowlisted set of tables, a SELECT-only escape hatch, and a tRPC bridge for invoking running-server procedures. Designed for agents that need to answer questions about state ("what's the P&L on wallet X?", "did the screener actually fire on these symbols?") without touching the UI.

## Tools

### Per-table queries (read-only)
- `db.query.wallets` — `wallets`
- `db.query.executions` — `trade_executions`
- `db.query.orders` — `orders`
- `db.query.klines` — `klines`
- `db.query.users` — `users`
- `db.query.sessions` — `sessions`
- `db.query.watchers` — `active_watchers`
- `db.query.setups` — `setup_detections`
- `db.query.autoTradingConfig` — `auto_trading_config`

Common shape:
```json
{
  "where": { "wallet_id": "wallet-123", "status": "open" },
  "since": "2026-04-01T00:00:00Z",
  "sinceColumn": "created_at",
  "limit": 100,
  "orderBy": "created_at desc"
}
```

### Raw SQL escape hatch
- `db.exec` — accepts only `SELECT`/`WITH`. Multi-statement, INSERT/UPDATE/DELETE/DDL, SET, NOTIFY, COPY, etc. are all rejected at the JS layer.

### tRPC bridge
- `trpc.call` — invokes an arbitrary tRPC procedure on the running backend. Authenticated via `MM_MCP_SESSION_COOKIE` (set to a dev session cookie value).

### Audit / health
- `audit.tail` — read recent MCP audit entries (JSONL file). Filters: `event`, `since`, `limit`.
- `health.check` — DB ping + tRPC reachability.
- `__health` — server heartbeat.

## Audit log

Every successful `db.query.*`, `db.exec`, and `trpc.call` invocation appends a JSONL line to `MM_MCP_AUDIT_LOG_PATH` (default `apps/backend/logs/mcp-audit.jsonl`). Errors are also logged with `result: 'error'`.

```jsonl
{"ts":"2026-04-27T14:00:00.000Z","event":"db.query","tool":"db.query.executions","args":{"where":{"wallet_id":"w1"}},"result":"ok","durationMs":12}
```

Use `audit.tail` to retrieve recent entries. The log is local to this server's filesystem and is never sent off-machine.

## Prerequisites

1. Backend Postgres running and reachable via `DATABASE_URL` (or `MM_MCP_DATABASE_URL`).
2. (Optional) Backend Fastify server running on `MM_MCP_TRPC_URL` (default `http://localhost:3001/trpc`) for `trpc.call`.
3. (Optional) Dev session cookie copied from your browser into `MM_MCP_SESSION_COOKIE` — required for `trpc.call` against authenticated procedures.

## Local usage

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/marketmind \
  pnpm --filter @marketmind/mcp-backend dev
```

Build + run:
```bash
pnpm --filter @marketmind/mcp-backend build
pnpm --filter @marketmind/mcp-backend start
```

## Wire into Claude Code

```json
{
  "mcpServers": {
    "marketmind-backend": {
      "command": "node",
      "args": ["/abs/path/to/marketmind/packages/mcp-backend/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://user:pass@localhost:5432/marketmind",
        "MM_MCP_TRPC_URL": "http://localhost:3001/trpc",
        "MM_MCP_SESSION_COOKIE": "session=...",
        "MM_MCP_AUDIT_LOG_PATH": "/abs/path/to/marketmind/apps/backend/logs/mcp-audit.jsonl"
      }
    }
  }
}
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` / `MM_MCP_DATABASE_URL` | _(required)_ | Postgres connection string |
| `MM_MCP_TRPC_URL` | `http://localhost:3001/trpc` | Backend tRPC base URL |
| `MM_MCP_SESSION_COOKIE` | _(empty)_ | Cookie header for authenticated tRPC calls |
| `MM_MCP_AUDIT_LOG_PATH` | `apps/backend/logs/mcp-audit.jsonl` | Where audit entries are appended |

## Security model

- **Read-only by construction.** `db.exec` SQL is regex-validated to reject any non-SELECT statement, multi-statement, or session-state-modifying token.
- **Allowlisted tables.** Per-table query tools use a hardcoded `TABLE_ALLOWLIST` keyed by friendly id; agents cannot query tables not on the list.
- **No mutations via tRPC.** The bridge is documented as read/idempotent only. Proper trade-execution / write paths are deferred to `mcp-trading` (v1.2) where they will require per-call confirmation, wallet whitelisting, and monetary caps.
- **Audit trail.** All invocations are logged with timestamps, args (truncated for raw SQL), result status, and duration.

## Known limitations (v1.1)

- DB connection runs as the regular `marketmind` Postgres user — there is no `marketmind_ro` role yet. SELECT-only enforcement is at the JS layer.
- `trpc.call` performs no input/output schema validation; you get whatever shape the procedure returns.
- Audit log is unbounded — manually rotate `apps/backend/logs/mcp-audit.jsonl` if it grows large.
