# MCP Security Model — MarketMind v1.1

The MCP servers ship with the assumption that they run on a **developer's local machine** against a **dev/local backend**. They are not hardened for shared/multi-tenant use. This document records what we explicitly trust, what we explicitly distrust, and the gates each server enforces.

## Threat model

We assume:
- The agent connecting via stdio is **cooperative-but-fallible** (e.g. Claude Code with prompt-injection-bearing input).
- The renderer + backend run as the developer (no exposed network surface beyond `localhost`).
- The Postgres instance is a **dev DB**, possibly with throwaway data; loss/corruption is recoverable from migrations + backups.

We do not assume:
- That the agent will never send malicious tool calls.
- That tool calls will arrive in a sensible order.
- That `~/.claude.json` is private (it can be read by any local process).

## Threats considered

| Threat | Mitigation |
| --- | --- |
| Agent attempts to mutate prod data via `db.exec` | `db.exec` rejects every statement that isn't `SELECT`/`WITH`. Forbidden tokens (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `ALTER`, `GRANT`, `REVOKE`, `CREATE`, `COPY`, `VACUUM`, `SET`, `DISCARD`, `LISTEN`, `NOTIFY`, multi-statement `;`) are rejected at the JS layer. |
| Agent attempts to query a non-allowlisted table | Per-table `db.query.*` tools accept only the `TABLE_ALLOWLIST` keys; everything else returns `unknown table id`. |
| Agent attempts to dispatch arbitrary store actions | `app.dispatchStore` rejects any pair not in `STORE_DISPATCH_ALLOWLIST`. |
| Agent triggers trade execution via prompt injection | **No execution tools exist in v1.1.** `mcp-trading` is deferred to v1.2 with mandatory per-call confirmation, wallet whitelist, monetary cap, and dedicated audit channel. |
| Agent reads or exfiltrates session cookies | `MM_MCP_SESSION_COOKIE` is read from env; never logged in audit entries. |
| Agent triggers DoS via long-running queries | Postgres `statement_timeout` is set to 15s on the connection pool; Playwright tools have per-call waits (3–30s) and the browser restarts after a fixed call count or idle window. |
| Agent runs `app.click` against an off-screen surface to escape allowlist | The escape hatches (`app.click`, `app.fill`) operate inside the same Playwright browser as everything else. They cannot reach beyond the renderer process — they cannot, e.g., call OS-level APIs or read files. |
| Server logs pollute long-term storage | Audit log is JSONL at `MM_MCP_AUDIT_LOG_PATH`, default under `apps/backend/logs/`. Manual rotation is the operator's responsibility in v1.1. |

## Env-gated activation

Each server has an explicit precondition that gates harmful actions:

| Server | Gate | Failure mode |
| --- | --- | --- |
| `mcp-screenshot` / `mcp-app` | Renderer must expose `__globalActions` (which only happens with `VITE_E2E_BYPASS_AUTH=true`). | Capture/dispatch tools throw immediately. |
| `mcp-backend` | `DATABASE_URL` (or `MM_MCP_DATABASE_URL`) must resolve to a reachable Postgres. | DB tools throw on first query; `health.check` reports `db.ok: false`. |
| `mcp-strategy` (backtest tools) | `MM_MCP_TRPC_URL` must resolve to a reachable backend. Authenticated procedures need `MM_MCP_SESSION_COOKIE`. | tRPC tools throw with the upstream error. |

In production builds none of these env vars are set, and `VITE_E2E_BYPASS_AUTH` defaults to `false`. The bridge that mcp-app/mcp-screenshot need to function simply does not exist.

## Audit log

Every successful invocation of `db.query.*`, `db.exec`, and `trpc.call` writes one JSONL line:

```json
{
  "ts": "2026-04-27T14:00:00.000Z",
  "event": "db.query",
  "tool": "db.query.executions",
  "args": { "where": { "wallet_id": "w-1" } },
  "result": "ok",
  "durationMs": 12
}
```

Errors are logged with `result: "error"` and a sanitized message. For `db.exec` the SQL is truncated to the first 200 characters. Cookies, passwords, and `MM_MCP_SESSION_COOKIE` are never serialized into audit entries.

The log is **append-only and local-only**. There is no rotation, no remote shipping, and no PII redaction beyond what the args themselves contain. Treat it as you would a `.bash_history` file.

To inspect audit entries from an agent:
```
audit.tail { event: "db.exec", since: "2026-04-27T00:00:00Z", limit: 100 }
```

## Telemetry

Telemetry is **opt-in** and **local-only**. Setting `MM_MCP_TELEMETRY=true` (when implemented) will log tool invocations to stdout for debugging. There is no remote telemetry endpoint in v1.1; we do not want to be in the business of collecting agent traces over the network.

## RBAC for DB

Today, `mcp-backend` connects to Postgres as the regular `marketmind` user. SELECT-only is enforced at the JS layer via:
1. Statement type check (`SELECT`/`WITH` only).
2. Forbidden-token regex on the query string.
3. Per-table allowlist for the typed `db.query.*` tools.

For v1.2, we plan a dedicated `marketmind_ro` Postgres role with `SELECT` privileges and explicit `REVOKE` on every other action. `mcp-backend` would then use a separate `MM_MCP_RO_DATABASE_URL`. Until that lands, the JS layer is the only line of defense.

## Threat model diff vs. `mcp-trading`

The reason `mcp-trading` is **not** part of v1.1:

| Concern | v1.1 servers | mcp-trading (v1.2) |
| --- | --- | --- |
| Mutates external state | No (DB is dev-only, render is dev-only) | Yes — places real Binance/IB orders |
| Per-call confirmation needed | No | Yes (signed challenge per trade) |
| Audit beyond JSONL | Acceptable | Required (separate per-trade audit table) |
| Wallet allowlist | N/A | Required (per-session) |
| Monetary cap | N/A | Required (per-session) |
| Prompt-injection blast radius | Reads/UI navigation only | Funds at risk |

Trading via MCP is a feature, not a v1 hardening problem — but until each of those rows has a checked box, we keep the surface intentionally narrow.

## Reporting

If you find a way past these gates, please file an issue privately to the maintainer rather than opening a public PR. Pre-disclosure window: 30 days for any finding that affects audit-log integrity or query allowlisting.
