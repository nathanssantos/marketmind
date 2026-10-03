# App Review Plan

> **One sentence:** walk through every feature and answer five questions — is it reachable from the UI, does it work, is it documented for the user, does it work well, and can it be improved against what comparable apps deliver.
>
> **Authored:** 2026-10-03, from a code-reading audit (backend paper path, trading UI, feature inventory, user docs, live path) plus a competitor benchmark. Nothing in the audit was executed; every finding below is confirmed again when its item is worked.

## Rules

- One branch at a time off `develop`, one item per branch.
- Paper trading first. Live trading is investigated early but validated last.
- Every item is tested and seen through Playwright: a spec under `apps/electron/e2e/` that stays in the repo, plus a run against the real backend that checks the effect on screen (position, PnL, balance, chart lines). Specs that mock tRPC prove the screen only, so they never count as the backend check.
- Competitor differentiators live in [`PAPER_TRADING_BENCHMARK_PLAN.md`](PAPER_TRADING_BENCHMARK_PLAN.md), not here.
- Binance values over our own math: when the exchange reports a value (break-even, liquidation price, fees paid, leverage, funding), show and use that value and never a local estimate. A local formula is only a fallback for the moment before the exchange value arrives. Paper has no exchange position, so it is fed with real Binance data instead: live prices, symbol filters, leverage brackets, funding rates and the published fee rates.
- Paper trading mirrors live trading: whatever a live position shows (break-even line, fees, liquidation, funding, margin) a paper position shows too, computed from what the paper engine actually charges.
- The plan ends with a docs and site update that reflects what shipped.

## Decisions

| Topic | Decision |
|---|---|
| Paper engine model | Single model on `trade_executions`. The legacy `positions` table is retired. |
| Live trading in the installer | Explicit opt-in control in Settings. Every live path, including `createOrder`, honours the same switch. |
| Benchmark differentiators | Separate plan, after the table-stakes items. |

## Phase 1 — Paper trading

Scope: futures LONG and SHORT, spot LONG. Spot SHORT must be impossible.

| # | Item | Finding it closes |
|---|---|---|
| 1.1 | Manual paper orders run on one engine | A manual order only wrote an `orders` row: no position, no PnL, no balance change. |
| 1.2 | Spot wallets | No way to create a SPOT paper wallet; no client sends `marketType`; spot short is accepted by `trading.createPosition`, the whole `futures-trading` router, `autoTrading.executeSetup` and watchers; Sell and Alt+click are never hidden on spot. |
| 1.3 | SL/TP at entry, OCO toggle, ticket redesign ([`TRADE_TICKET_SPEC.md`](TRADE_TICKET_SPEC.md)) | The ticket sends `stopLoss` / `takeProfit` and the input schema drops them, while the confirm dialog shows them. Add an OCO toggle to the ticket that decides whether SL and TP created with the entry cancel each other. Review how the Long Position and Short Position drawing tools hand their entry, SL and TP to the ticket. Redesign the ticket per the spec: side selector, single action button, asset-type matrix (spot, futures, stocks), real account fees, shared panel height for default layouts and marketing screenshots. Also found: the wallet dialog never sends `exchange`, so IB wallets cannot be created; `trading.createOrder` always uses the Binance client; IB market hours, shortability and commission have no tRPC exposure; `MarketStatusBar` and `ShortabilityBadge` are unmounted. Stocks stay unvalidated on screen until an IB Gateway is available. |
| 1.4 | Futures realism | Leverage stuck at 1x on paper; no margin check; liquidation only alerts; funding only on the legacy table. |
| 1.5 | Accounting and live parity | Entry fee skipped on SL/TP exits; exits fill at the observed price instead of the trigger; no min notional, lot, tick or balance validation; auto-trading paper entries store neither the entry fee nor the break-even price; the break-even line is off by default. |
| 1.6 | Trading UI | Closing a position from the ticket fails while the SL/TP switches are still on, because the SL/TP are validated against the closing side; the orders panel under the positions list says "No orders found" while pending orders exist; spot pending orders never reach `getOpenOrders` (it filters FUTURES); check that independent SL/TP orders are drawn on the chart; no wallet reset or deposit; no partial close; no margin type control; no paper/live marker on the confirm dialog; raw English rejection messages; conflicting badge colours. |
| 1.7 | MCP paper gate | `close_position` and `set_sl_tp` check the supplied `walletId` but act on an id from any wallet. |
| 1.8 | On-screen validation | Run futures LONG, futures SHORT, spot LONG and the spot-short attempt in the app; check position, PnL, balance, chart lines; measure ticket and chart performance. |
| 1.9 | Table stakes | Close whatever is left of the ten table-stakes capabilities listed in the benchmark plan. |

## Phase 2 — Every other area

Same five questions per area, in this order: chart and drawings; indicators and patterns; wallets and account; order flow; market panels and screener; strategies and setups; auto-trading; scalping; backtesting; analytics and fees; custom symbols; layouts and preferences; MCP; updates and embedded stack.

Known starting points from the inventory:

- **Duplicate auto-trading router:** `routers/auto-trading.ts` and `routers/auto-trading/` export the same 37 procedures. Confirm which is live and delete the other.
- **Backend with no UI:** fees router, order sync and orphan orders, multi-watcher backtest, server-side API key store, `wallet.testConnection`, `wallet.getPortfolio`.
- **Dead components (no importer):** `ChartContextMenu`, `ChartControls`, `ControlPanelGroup`, `SetupTogglePopover`, `SettingsSection`, `FuturesPositionInfo`, `MarginTypeToggle`, `MarketStatusBar`, `ShortabilityBadge`, `AutoTradeConsole`, `OrphanOrders`, `SetupStatsTable`, `StockPresetsSection`. Wire up or remove.
- **Half-finished:** Notifications tab (sound toggle plus "coming soon"); drawing properties dialog (horizontal line only).
- **Dev-only:** Settings → Data.
- **Routers with no dedicated test:** scalping, screener, custom-symbol, drawing, heatmap, economic-calendar, order-sync, signal-suggestions, ticker, user-patterns. No MCP package has tests.

## Phase 3 — Live trading (last)

1. Fix in code, with mocked-exchange tests:
   - `ENABLE_LIVE_TRADING` is unset in the installer, and `createOrder` ignores it while close, SL/TP edit and fallback exit honour it.
   - A manual LIMIT entry with SL never gets its SL placed on fill (`setupId` gate).
   - A failed SL placement after a MARKET fill is only logged.
   - No `clientOrderId`, so a timeout plus retry duplicates the position.
   - Margin type is forced to CROSSED; the input is ignored.
   - Manual close cancels protection before sending an unrounded MARKET quantity.
   - Spot: short is not blocked server-side; no asset balance check; no reconciliation.
   - No API key permission check and no manual-path kill switch or limits.
2. Validate on Binance testnet in the installed app: open, close, LIMIT with SL, SL failure, quitting before the fill.
3. Validate with real money at minimum notional, with explicit confirmation at each step.

## Phase 4 — Docs and site

1. User guide in `docs/user-guide/` (about eight short pages) covering what phases 1–3 delivered.
2. Fix the Documentation and Changelog links in Settings → About; register the missing shortcuts in the `?` dialog.
3. Update `README.md`, `CHANGELOG.md`, `QUICK_START.md` and `docs/MCP_SERVERS.md` where they are stale.
4. Update the marketing site copy: paper trading, spot and futures, and the live-trading wording, to match what actually works.

## Phase 5 — AI instructions and markdown cleanup

Goal: one source of truth for AI instructions, and no markdown file without a concrete use.

1. **Single generic source for AI instructions.**
   - Inventory every AI instruction file in the monorepo: `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.gemini/instructions.md`, `.cursorrules`, `.github/copilot-instructions.md`, `.claude/project-instructions.md`, `.windsurfrules`, `.clinerules`, and any per-package copy.
   - Move all instructions into one tool-neutral agents file (`AGENTS.md`) and make it the source of truth. Today the source is `CLAUDE.md` and the others are symlinks to it.
   - For each AI that needs its own file or folder structure, create only that file and make it point to the generic one (symlink or a one-line reference), with no duplicated content.
   - Remove tool-specific wording from the generic file; keep tool-specific notes, if any are needed, in that tool's own file.
2. **Review every markdown file.** For each `.md` in the repo, classify it:
   - **Current** — keep, and fix what is stale.
   - **Obsolete** — delete, or move to `docs/archive/` when it has historical value.
   - **Incomplete** — finish it, or cut it down to what is true.
   - **Queue** — it describes work not done yet; turn it into an item of an active plan, so nothing sits without a concrete use.
3. **Output:** a table with file, classification and action taken, plus the list of items added to the queue.
