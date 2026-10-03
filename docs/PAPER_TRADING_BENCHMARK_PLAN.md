# Paper Trading Benchmark Plan

> **One sentence:** what comparable apps deliver for simulated trading, which of it is table stakes, and which differentiators are worth building after [`APP_REVIEW_PLAN.md`](APP_REVIEW_PLAN.md) phase 1.
>
> **Authored:** 2026-10-03. Sources are vendor docs for TradingView, Binance, Bybit, Altrady and 3Commas, plus third-party guides and forum threads for the rest. Several cells were not confirmed hands-on; do not reuse this as a public comparison.

## Table stakes

These are tracked in `APP_REVIEW_PLAN.md` phase 1 and listed here only as the bar.

1. Market, limit, stop and stop-limit orders.
2. SL/TP attached at entry.
3. Trailing stop.
4. Live prices driving fills.
5. Maker/taker fees deducted.
6. Leverage with isolated and cross margin on futures.
7. Liquidation price shown and enforced.
8. One-click balance reset.
9. Custom starting balance.
10. On-chart position line with live PnL and draggable SL/TP.

## Differentiators to evaluate

| # | Capability | Best reference | Notes |
|---|---|---|---|
| 1 | Conservative limit fills (fill only when price trades through) | Altrady | Cheap; mostly a rule in the fill monitor. |
| 2 | Funding simulated on held positions | Binance Demo (reported) | Depends on phase 1.4. |
| 3 | Order-book or queue-aware fills, partial fills, delays | NinjaTrader | Depth stream already exists. |
| 4 | Replay with order placement on the same fill engine | NinjaTrader Playback, thinkorswim OnDemand | Largest item; reuses the paper engine. |
| 5 | Persisted replay sessions with a journal | FX Replay | TradingView loses the session. |
| 6 | Journal with calendar, expectancy and drawdown stats | FX Replay, TraderSync | Analytics dialog already has part of it. |
| 7 | Prop-firm challenge mode (daily loss and drawdown rules) | FX Replay | Reuses risk-manager limits. |
| 8 | Multiple named paper accounts, reset without wiping history | NinjaTrader | Multiple wallets exist; reset is phase 1.6. |
| 9 | Edit any balance at any time | Altrady | Phase 1.6 covers deposit and reset. |
| 10 | Multi-target scale-out brackets from the chart | TradingView (4 exits), NinjaTrader ATM | Needs partial close from phase 1.6. |

## Complaints about competitors (what to avoid)

- TradingView: fills at the exact price with no slippage or rejections; commissions off by default; reset deletes history.
- Altrady: no cross margin, liquidation or funding.
- Bybit: order history kept 7 days.
- 3Commas: no fees simulated.
- Cryptohopper: infinite-volume fills.
- NinjaTrader: simulation and playback fill differently.

## Next step

Rank items 1–10 by effort against value once phase 1 is merged, and turn the chosen ones into a version plan.
