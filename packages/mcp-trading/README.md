# @marketmind/mcp-trading

MCP server that exposes the MarketMind trading surface to any MCP-connected agent (Claude Code, ChatGPT desktop, custom agents).

**Current scope:** read tools + paper-only write tools (`place_order`, `cancel_order`, `close_position`). Live unlock + `set_sl_tp` land in follow-up PRs.

> **Hard gate for write tools (follow-up PRs):** the backend trading routers themselves must check `wallet.agentTradingEnabled === true` before executing any order/position mutation initiated by an MCP client. If the flag is off, return `FORBIDDEN` and write a `denied` audit row — never reach the exchange. Default is `false` on every wallet (including newly-imported live ones); the toggle is per-wallet so paper can be enabled while live stays off. This is a deliberate accident-prevention gate, not a UI nicety.

Every tool invocation writes a row to `mcp_trading_audit` via the backend `mcp.recordAudit` endpoint. The user can review the audit trail in Settings → Security → AI Agent Activity (UI ships with the write tools).

## Tools

| Tool | Description | Underlying tRPC |
|---|---|---|
| `trading.list_orders` | Spot or futures orders for a wallet | `futuresTrading.getOpenOrders` / `trading.getOrders` |
| `trading.list_positions` | Open futures positions | `futuresTrading.getPositions` |
| `trading.list_executions` | Trade executions (auto-trading-managed positions + history) | `trading.getTradeExecutions` |
| `trading.get_wallet_status` | Wallet metadata + balances | `wallet.getById` |
| `trading.place_order` | **Write.** Place an order on a paper wallet | `mcp.assertWriteAllowed` → `trading.createOrder` |
| `trading.cancel_order` | **Write.** Cancel an open order on a paper wallet | `mcp.assertWriteAllowed` → `trading.cancelOrder` |
| `trading.close_position` | **Write.** Close an open position on a paper wallet | `mcp.assertWriteAllowed` → `trading.closePosition` |
| `health.check` | Confirm tRPC reachability | — |
| `__health` | Heartbeat | — |

## Configuration

Set in `~/.claude.json` after `pnpm mcp:install`:

```json
{
  "mcpServers": {
    "mm-mcp-trading": {
      "command": "node",
      "args": ["/path/to/marketmind/packages/mcp-trading/dist/index.js"],
      "env": {
        "MM_MCP_TRPC_URL": "http://localhost:3001/trpc",
        "MM_MCP_SESSION_COOKIE": "session=..."
      }
    }
  }
}
```

`MM_MCP_SESSION_COOKIE` is the value of the `session` cookie in your authenticated MarketMind session (read from DevTools → Application → Cookies). Required so audit rows are tied to the right user.

## Security

- **Dev-only.** No write surface in this package; mutations land in follow-up PRs.
- **Audited.** Every call writes one row to `mcp_trading_audit` (status: `success` or `failure`, plus duration, optional input/result JSON).
- **User-scoped.** All read tools route through tRPC's `protectedProcedure`; the session cookie identifies the user.
- **No DB access.** Unlike `@marketmind/mcp-backend`, this package never touches the DB directly — every operation goes through tRPC so backend-side authorization is enforced.

See [`docs/MCP_TRADING_CONCEPT.md`](../../docs/MCP_TRADING_CONCEPT.md) for the full threat model and write-tool design.
