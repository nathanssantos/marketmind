# Bundle Audit (V1_3 D.1)

Captured 2026-04-28 from `pnpm --filter @marketmind/electron bundle:analyze`.

## How to reproduce

```bash
pnpm --filter @marketmind/electron bundle:analyze
open apps/electron/dist-web/bundle-stats.html
```

The script sets `ANALYZE=1`, which enables `rollup-plugin-visualizer` in `apps/electron/vite.config.ts`. The `bundle-stats.html` artifact is gitignored (`dist-web/` is the web build output).

## Headline numbers

### Before chunk splitting (baseline)

| Chunk | Raw | Gzipped |
|---|---|---|
| `index.js` (main) | **2,124 KB** | **587 KB** |
| `vendor-chakra` | 519 KB | 139 KB |
| `vendor-react` | 178 KB | 56 KB |
| `AutoTradingTab` (lazy) | 70 KB | 13 KB |
| `vendor-i18n` | 48 KB | 16 KB |
| `vendor-query` | 34 KB | 10 KB |
| `vendor-zustand` | 19 KB | 6 KB |

### After chunk splitting (this PR)

| Chunk | Raw | Gzipped |
|---|---|---|
| `index.js` (main) | **1,121 KB** | **325 KB** (-44%) |
| `vendor-chakra` | 519 KB | 139 KB |
| `vendor-pinets` | 484 KB | 116 KB |
| `vendor-recharts` | 296 KB | 83 KB |
| `vendor-react` | 178 KB | 56 KB |
| `vendor-d3` | 62 KB | 20 KB |
| `vendor-grid` | 56 KB | 17 KB |
| `vendor-i18n` | 48 KB | 16 KB |
| `vendor-trpc` | 42 KB | 11 KB |
| `vendor-socket` | 41 KB | 13 KB |
| `vendor-icons` | 37 KB | 6 KB |
| `vendor-query` | 34 KB | 10 KB |
| `AutoTradingTab` (lazy) | 70 KB | 13 KB |

Total bytes shipped on first load is roughly the same — the win is **caching granularity** (vendor chunks now invalidate independently) and **lazy-load potential** (any callsite that switches to dynamic `import()` will only pull in the relevant vendor chunk).

## What's still in the main bundle (top 10 modules)

| Module | Raw | Gzip |
|---|---|---|
| `locales/fr/translation.json` | 98 KB | 29 KB |
| `locales/es/translation.json` | 96 KB | 29 KB |
| `locales/pt/translation.json` | 95 KB | 29 KB |
| `locales/en/translation.json` | 87 KB | 26 KB |
| `react-router/chunk-EVOBXE3Y.mjs` | 89 KB | 22 KB |
| `packages/trading-core/indicators/catalog.ts` | 31 KB | 4 KB |
| `Layout/QuickTradeToolbar.tsx` | 23 KB | 5 KB |
| `Chart/drawings/useDrawingInteraction.ts` | 22 KB | 4 KB |
| `Chart/ChartCanvas.tsx` | 18 KB | 5 KB |
| `Chart/useChartTradingActions.ts` | 17 KB | 3 KB |

## Recommended next steps

The chunk-splitting in this PR is the easy mechanical win. The genuine size reductions require source changes and are deferred to follow-up PRs (tracked under V1_3 D.x).

### High-impact (pursue next)

1. **Lazy-load locale JSONs** — currently all 4 locales (376 KB raw / 113 KB gz) ship eagerly. `i18next-http-backend` or per-language dynamic `import()` would cut ~85% of locale weight from first load. **Effort:** ~3h.

2. **Lazy-load `pinets` (`vendor-pinets` chunk, 484 KB / 116 KB gz)** — only needed by indicator workers. The static import in `useGenericChartIndicators` keeps it on the critical path. Switch to dynamic `import('pinets')` inside the worker bridge so it loads only when an indicator is computed. **Effort:** ~2h.

3. **Lazy-load `recharts` consumers** — `EquityCurveChart` already lives behind `AnalyticsModal` (lazy via `React.lazy`). Verify the recharts import chain doesn't leak into main. `MarketIndicatorCharts.tsx` is the bigger leak — it's pulled in eagerly by `MarketIndicatorsTab` which the sidebar mounts on render. Consider lazy-loading the indicators panel similar to Settings tabs (V1_3 D.2). **Effort:** ~3h.

### Medium-impact

4. **`react-router` chunk (89 KB / 22 KB gz)** — single-page app; verify whether all router features are needed. The web (PWA) target may not use the same routes as the desktop target. Could be reduced via `react-router/dom` minimal subset import. **Effort:** ~1h investigation.

5. **`packages/trading-core/indicators/catalog.ts` (31 KB / 4 KB gz)** — large catalog metadata in main; only needed when the indicators picker UI opens. **Effort:** ~2h.

6. **`react-icons` icon-set chunking** — `lu/index.mjs` alone was 49 KB; consolidating to a single icon set across renderer (instead of mixed lu/md/pi/bs) would shrink the icons chunk further. **Effort:** ~half day.

### Low-impact / nice-to-have

7. **Audit whether `decimal.js-light` (25 KB / 7 KB gz) and `@reduxjs/toolkit` (26 KB / 7 KB gz)** are actually used in the renderer or just transitively pulled in from a dep that needs only a slice. Possible tree-shaking miss.

8. **`engine.io-client` + `socket.io-client` in `vendor-socket`** — already split. If the WebSocket connection is opened lazily after auth, the chunk could load on demand.

## Out of scope for this PR

- Lazy-loading any of the above (each gets its own PR with regression coverage).
- Replacing libs (e.g. swapping recharts for a lighter chart) — out of scope for v1.3.

## Acceptance check (what this PR shipped)

- `bundle:analyze` script wired in `apps/electron/package.json`.
- `vite.config.ts` `manualChunks` extended with `vendor-pinets`, `vendor-recharts`, `vendor-d3`, `vendor-grid`, `vendor-trpc`, `vendor-socket`, `vendor-icons`.
- Main bundle: 2,124 KB → 1,121 KB raw (587 KB → 325 KB gz). **−44% raw, −45% gz.**
- No source code changes to consumer code; behavior unchanged. PWA precache list grew from 38 → 45 entries (each new vendor chunk).
