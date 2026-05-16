# Backtest System

End-to-end reference for the Pine-strategy backtest pipeline — what's where, how to run it from the CLI and the UI, how to write multi-timeframe strategies, and which tests cover what.

## Mental model

```
┌─ BacktestConfig ─────────────────────────────────────────────────┐
│ symbol, interval, startDate, endDate, setupTypes[],              │
│ strategyParams{}, filters{}, fibonacciTargetLevel, marketType…   │
└────────────────────────┬─────────────────────────────────────────┘
                         │
          ┌──────────────┴──────────────────┐
          ▼                                 ▼
   BacktestEngine                   MultiWatcherBacktestEngine
   (single watcher, legacy)         (portfolio model, UI path)
          │                                 │
          ▼                                 ▼
              SetupDetectionService (shared)
                         │
                         ▼
              PineStrategyRunner
                ├─ array-form PineTS  (single-TF, fast)
                └─ Provider-form PineTS + PineMarketProvider
                                       (multi-TF, slower)
                         │
                         ▼
                     TradeExecutor
                         │
                         ▼
                  Metrics, trades, equity curve
```

## Two engines, two semantics

Both engines consume the same `BacktestConfig` and run strategies through the same `SetupDetectionService` / `PineStrategyRunner` / `TradeExecutor` chain. They diverge on **orchestration**:

| Aspect | `BacktestEngine` (CLI) | `MultiWatcherBacktestEngine` (UI) |
|---|---|---|
| Watchers | one (symbol, interval) | many; portfolio shared across |
| Concurrent positions | `maxConcurrentPositions` config (default 10) | always `maxConcurrentPositions = watchers.length` |
| Default filter values | `FILTER_DEFAULTS` applied (trend/adx/vwap/choppiness = true) | undefined → false |
| Used by | `rank-strategies.ts`, `run-optimization.ts`, `validate-pipeline.ts` | tRPC `backtest.multiWatcher`, BacktestDialog UI |

**Parity verified**: pass the same `maxConcurrentPositions` value + identical filter flags to both, and they produce identical trade counts + win rates (within ±1 trade for synthetic edge-bar effects). Set `pineStrategiesDir` in `BacktestConfig` to override the strategies folder (useful for inline test strategies).

P&L can still drift slightly because BacktestEngine uses a fixed
`positionSizePercent × initialCapital`-style sizer while MultiWatcher's
`SharedPortfolioManager` sizes against current equity (compounding-aware).
Same trade shapes, different notional. This is a position-sizing
semantic, not a pipeline bug — see `validate-pipeline.ts` for the
side-by-side comparison and `backtest-engine-parity.test.ts` for the
CI regression guard.

## CLI scripts

| Script | Purpose | When |
|---|---|---|
| `validate-pipeline.ts` | Smoke test — runs one strategy through both engines, compares setup count | Before any optimization, after refactors |
| `rank-strategies.ts` | Run every builtin strategy on BTC/ETH/SOL × 1h × 3y, output ranking | Strategy discovery |
| `rank-strategies-with-filters.ts` | Same, × 6 filter presets | Filter ablation |
| `run-optimization.ts` | 3-stage param sweep (Fib levels → filters → trailing stop) | After picking a strategy |

Run any of them with:
```bash
pnpm --filter @marketmind/backend exec tsx scripts/backtest/<script>.ts
```

Multi-TF smoke:
```bash
MULTI_TF=true pnpm --filter @marketmind/backend exec tsx scripts/backtest/validate-pipeline.ts
```

## Writing a multi-timeframe Pine strategy

Pine's `request.security(tickerid, 'TF', expression)` reads HTF data. Our runtime resolves it via `PineMarketProvider` against pre-loaded klines.

**1. Declare the HTF dependency in the strategy header:**

```pine
// @id htf-extreme-ltf-reversal
// @name HTF Extreme LTF Reversal
// @requires-tf 4h
// @param ...
```

The loader parses `@requires-tf` (comma-separated for multiple) and surfaces a stderr warning if the source uses `request.security` for a TF that isn't declared. Backtest + live runtime will throw `PineMarketProvider: no klines registered for timeframe='4h'` at run time without the header.

**2. Use `lookahead=barmerge.lookahead_off` in every `request.security` call:**

```pine
htfRsi = request.security(syminfo.tickerid, '4h', ta.rsi(close, 2), lookahead=barmerge.lookahead_off)
```

Without `lookahead_off`, the LTF bar inside an in-progress HTF candle sees the HTF candle's future close — the #1 bug in multi-TF Pine. PineTS internally honors `lookahead_off`, but it must be explicit.

**3. Strategy declares its inputs as `input.int/float/bool/string`:**

```pine
rsiOversold = input.int(25, 'rsiOversold', minval=5, maxval=40)
```

These can be overridden at run time via `BacktestConfig.strategyParams = { rsiOversold: 10 }`. Used by the optimizer for param sweeps.

## Test surface

| File | Covers |
|---|---|
| `services/pine/__tests__/PineMarketProvider.test.ts` | TF label normalization (1h↔60, 4h↔240), error path, getSymbolInfo shape |
| `services/pine/__tests__/PineStrategyLoader.test.ts` (`@requires-tf parsing` block) | Single + comma-separated TF parsing, hyphenated regex, undeclared-`request.security` warning |
| `services/pine/__tests__/PineStrategyRunner.test.ts` (`multi-timeframe` block) | End-to-end `request.security` resolution against secondaryKlines |
| `services/pine/__tests__/PineStrategyGolden.test.ts` | Stable snapshot per builtin strategy. Multi-TF strategies (with `@requires-tf`) are skipped — they need provider injection. |
| `scripts/backtest/validate-pipeline.ts` | Smoke: parity check between BacktestEngine and MultiWatcherBacktestEngine on the same config |

The full backend suite (`pnpm --filter @marketmind/backend test`) runs everything except `validate-pipeline.ts` (it's a CLI script — see TODO below to wire as integration test).

## Known divergence + follow-up

- **`FILTER_DEFAULTS` only applied in `BacktestEngine.buildEffectiveConfig`** — MultiWatcher leaves missing filter flags as `undefined` (treated as false). User passing a minimal config gets a more permissive run via UI than CLI. Workaround: be explicit in CLI configs. Long-term: route both engines through the same effective-config builder.
- **Position-sizing P&L drift** — BacktestEngine sizes against a static `positionSizePercent`, MultiWatcher's `SharedPortfolioManager` compounds against current equity. Trade outcomes match exactly; cumulative P&L diverges. Acceptable for parity validation; should be unified when porting CLI scripts to the portfolio model.
- **Live HTF cache TTL** uses one HTF interval (e.g. 4h cache, refresh once per 4h candle). If the cached klines miss the most recent close, the strategy reads a slightly stale HTF; consider tightening to last-closed-HTF-detect when this matters.

## Resolved (was open before v1.22.13)

- ~~Trade-count divergence between engines~~ — both engines now respect the same `maxConcurrentPositions` setting. Pass identical values → identical trade counts. Validated by `backtest-engine-parity.test.ts` in CI.
- ~~Walk-forward optimization missing~~ — `WalkForwardOptimizer.run(klines, config, params, wfConfig)` exists with a test suite. `FullSystemOptimizer` wires it via the `walkForward: true` preset flag.
- ~~validate-pipeline.ts not in CI~~ — covered by `backtest-engine-parity.test.ts` (synthetic-klines integration test that asserts the same parity invariant the manual script does, without DB/network).
