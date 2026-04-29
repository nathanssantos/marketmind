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

### After chunk splitting (PR #236)

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

### After lazy-loading locales + pinets (PR #237)

| Chunk | Raw | Gzipped |
|---|---|---|
| `index.js` (main) | **866 KB** | **241 KB** (-59% vs baseline, -23% vs PR #236) |
| `vendor-chakra` | 519 KB | 139 KB |
| `vendor-pinets` (lazy on first indicator) | 484 KB | 117 KB |
| `vendor-recharts` | 296 KB | 83 KB |
| `vendor-react` | 178 KB | 56 KB |
| `translation-pt.js` (lazy on switch) | 87 KB | 29 KB |
| `translation-es.js` (lazy on switch) | 86 KB | 29 KB |
| `translation-fr.js` (lazy on switch) | 84 KB | 29 KB |
| ...rest unchanged | | |

**Cumulative reduction vs baseline**: main bundle 2,124 KB → 866 KB raw (587 KB → 241 KB gz). **−1,258 KB raw / −346 KB gz / −59%.**

The pinets engine no longer ships in the main bundle; it loads when the chart computes its first PineTS indicator. The 3 non-default locale bundles (~28 KB gz each) load only when the user picks that language.

### After lazy-loading recharts consumers (this PR)

| Chunk | Raw | Gzipped |
|---|---|---|
| `index.js` (main) | **850 KB** | **237 KB** (-60% vs baseline) |
| `vendor-recharts` (lazy on first Market sidebar open or Analytics modal) | 296 KB | 83 KB |
| `MarketIndicatorsTab.js` (lazy with sidebar) | 15 KB | 4 KB |
| `EquityCurveChart.js` (lazy with Analytics modal body) | small | small |

`MarketIndicatorsTab` is now `React.lazy`-loaded inside `MarketSidebar` (closed by default). `EquityCurveChart` is lazy-loaded inside `AnalyticsModal`. Both shifted recharts onto the on-demand import graph; `vendor-recharts` no longer downloads on first paint.

**Cumulative reduction vs baseline**: main bundle 2,124 KB → 850 KB raw (587 KB → 237 KB gz). **−1,274 KB raw / −350 KB gz / −60%.**

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

1. ✅ **Lazy-load locale JSONs** (shipped) — i18next now starts with only English; `pt`/`es`/`fr` load via dynamic `import()` registered through `addResourceBundle` when a user switches.

2. ✅ **Lazy-load `pinets`** (shipped) — the `pineWorkerService` runtime now dynamic-imports the engine on first compute. `vendor-pinets` is fetched lazily from the chart's first indicator render.

3. ✅ **Lazy-load `recharts` consumers** (shipped) — `MarketIndicatorsTab` is now `React.lazy`-loaded inside `MarketSidebar` (closed by default). `EquityCurveChart` is also lazy inside `AnalyticsModal`. Recharts is no longer in the eager import graph.

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
