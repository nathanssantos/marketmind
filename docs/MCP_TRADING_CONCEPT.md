# mcp-trading — concept doc (early-stage exploration)

> Status: **concept / not yet implemented**. This doc captures the design
> space before any code lands. The threat model already lives in
> `docs/MCP_SECURITY.md`; this doc focuses on the user-facing UX and
> the safety toggle the user explicitly asked for.

The user's note (April 2026):

> "para o mcp trading, precisamos de um toggle ou switch para habilitar.
>  mas vamos explorar esse conceito em um plano separado, com calma."

So a trading MCP would let an external agent (Claude Code, ChatGPT
desktop, custom agents) place / cancel / modify orders on the user's
behalf. This is the **highest-blast-radius MCP capability** — moving
real money — and the user wants a deliberate enablement gesture before
agents can touch order placement.

## What it would expose (sketch)

Tools an agent could call (mirroring the existing tRPC router surface):

| Tool | Maps to | Notes |
|---|---|---|
| `trading.place_order` | `trading.placeOrder` mutation | Spot + Futures |
| `trading.cancel_order` | `trading.cancelOrder` | By order ID |
| `trading.close_position` | `trading.closePosition` | Market close |
| `trading.set_sl_tp` | `trading.updateStopLoss` / `updateTakeProfit` | Modify protection orders |
| `trading.list_orders` | `trading.listOrders` | Read-only |
| `trading.list_positions` | `trading.listPositions` | Read-only |
| `trading.set_leverage` | `futuresTrading.setLeverage` | Futures |

Read-only tools (`list_*`) might ship enabled by default. Write tools
require the toggle.

## The toggle / switch

Per the user's request, mcp-trading needs a **deliberate user opt-in**
that's hard to flip on accidentally. Design space:

### Where it lives
- **Settings → Security** (most likely): a new "MCP Trading Access"
  section, alongside 2FA settings.
- Alternative: **Settings → Account** or its own **Settings → MCP** tab
  if more MCP scopes accumulate.

### What it controls
A single per-user boolean: `mcpTradingEnabled` (defaults `false`). When
off, the MCP tools above either:
- Don't get registered at all (server-side gate), OR
- Are registered but throw `UNAUTHORIZED` on call.

The first option is safer — agents can't even discover the surface.

### How toggling works
Three options, ordered by paranoia:

1. **Plain switch** — like every other setting. Off by default. Click =
   on. Easy to flip on accidentally if user is clicking around.
2. **Switch + password re-prompt** — flipping on requires re-entering
   the user's password (or 2FA code). Aligns with how 2FA enrollment
   works. Stronger than #1.
3. **Switch + per-wallet scoping** — toggle is global on/off, but each
   wallet has its own "allow MCP trading" sub-toggle. Defaults all wallets
   off even when global is on. Granular but more UX surface.

**Recommendation**: start with #2 (password re-prompt). #3 can layer on
later if multi-wallet users want segmentation.

### State persistence
- Backend: column on `users` table (e.g. `mcp_trading_enabled boolean
  default false`).
- Audit log: every flip of the switch should write to `audit_log` (or a
  new `security_audit` table) with timestamp + IP + user agent. Same
  table can log every `trading.place_order` call.
- Session: the switch state is read on tool registration, not cached
  long-term. Flipping off should immediately disable the surface
  without a server restart.

### Visual treatment
- The toggle row in Settings should make the consequences clear.
  Suggestion: `<Callout tone="warning">` above the switch explaining
  what enabling does + linking to `docs/MCP_SECURITY.md`.
- When on, a status badge somewhere (toolbar?) showing "MCP TRADING
  ACTIVE" — small but unmissable.

## Safety layers beyond the toggle

Even with the toggle on, the trading MCP should ship with belt-and-suspenders:

1. **Dry-run mode** — separate flag (`mcpTradingDryRun: boolean`)
   that defaults `true` when the toggle is first enabled. Tool calls
   succeed but no orders actually hit the exchange; the response is
   "would have placed: …". Forces the user to explicitly disable
   dry-run before live execution.
2. **Audit log per call** — every `place_order` / `cancel_order` /
   `close_position` writes to a tamper-evident log with the agent
   identifier, the request payload, and the resulting order ID.
3. **Idempotency keys** — every write tool requires an
   `idempotency_key` parameter so re-tries don't duplicate orders.
4. **Position-size cap** — server-enforced max position size per call
   (configurable, defaults to e.g. 5% of wallet balance) so even a
   misbehaving agent can't drain the account in one call.
5. **Symbol allowlist** — optional per-user list of symbols the agent
   is permitted to trade. Defaults to all if blank.
6. **Rate limit** — N calls per minute, server-side. Defaults
   conservative.
7. **Frontend "live order" banner** — when an MCP call places an order,
   surface a toast + a notification badge so the user *sees* it
   immediately. No silent execution.

## Migration / rollout sequence (proposed)

1. **Settings UI scaffolding** (no actual MCP server yet):
   - Add `users.mcp_trading_enabled` + `users.mcp_trading_dry_run`
     columns + migration.
   - Add Settings → Security → "MCP Trading Access" section with the
     switch (#2 password re-prompt).
   - No-op for now — the switch persists state but nothing reads it.
2. **Read-only tools** in `mcp-trading` package:
   - `list_orders`, `list_positions`, `list_balance`. Wired up with
     the toggle gate. Low risk; lets us prove the registration flow.
3. **Dry-run write tools**:
   - `place_order`, `cancel_order`, etc. — but they short-circuit on
     `mcpTradingDryRun=true` and just return "would have placed …".
4. **Live write tools**:
   - Remove dry-run gate. Activate audit logging + position-size cap +
     rate limit. Add the toolbar "MCP TRADING ACTIVE" badge.
5. **Per-wallet scoping** (#3 above) — only if multi-wallet users
   request it.

## Open questions

- Should the toggle require a 2FA code (not just password) for users
  who have 2FA enabled? Probably yes.
- Should Spot vs Futures be separately toggleable? Futures has higher
  blast radius (leverage); maybe split.
- What's the right default for the position-size cap? 5%? 10%? User
  configurable.
- Should there be a "panic kill switch" — a single hotkey/UI button
  that disables MCP trading + cancels all open orders? Likely yes.
- Audit log retention period?
- Should the agent be required to ack a "I have read MCP_SECURITY.md"
  before its first call, or is that the user's job at toggle time?

## Effort estimate

- Step 1 (UI scaffolding): ~3h
- Step 2 (read-only tools): ~4h
- Step 3 (dry-run writes): ~half-day
- Step 4 (live writes + safety layers): **~1 week** (the bulk of the
  work — audit log infra, idempotency, rate limit, banner)
- Step 5 (per-wallet scoping): ~half-day if/when needed

Total to first live execution: ~10 days of focused engineering.

## What this doc is not

A detailed spec or implementation plan. It captures the design space
the user wants to "explorar com calma" before any code lands. Updating
this doc as the conversation evolves is the right move.
