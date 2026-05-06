#!/usr/bin/env node
/**
 * Curated marketing-screenshot pass: 7 specific scenes at 4K (3840×2160),
 * dark theme, optimized for the landing site at marketmind-site.
 *
 * Output goes to marketmind-site/public/images/screenshot-N.png so the
 * site picks them up on the next build.
 *
 * Run order:
 *   1. Boot the renderer dev server: `pnpm --filter @marketmind/electron dev:web`
 *      (must answer on http://localhost:5174 — auth bypass not required, fixtures
 *       inject mock data via Playwright addInitScript).
 *   2. Build the screenshot package: `pnpm --filter @marketmind/mcp-screenshot build`
 *   3. Run this script: `node scripts/marketing-screenshots.mjs`
 *
 * Env vars honored (defaults match site asset dimensions):
 *   MM_MCP_BASE_URL       — dev server URL (default http://localhost:5174)
 *   MM_MCP_VIEWPORT       — viewport (default 1920x1080 → 3840x2160 @ DPR 2)
 *   MM_MCP_SCALE          — DPR (default 2)
 *   MM_MARKETING_OUT_DIR  — output dir (default ../marketmind-site/public/images)
 */
import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import { captureFullPage, captureModal } from '../packages/mcp-screenshot/dist/capture.js';
import { closeBrowser, getPage, setTheme } from '../packages/mcp-screenshot/dist/browser.js';

process.env.MM_MCP_BASE_URL ??= 'http://localhost:5174';
process.env.MM_MCP_VIEWPORT ??= '1920x1080';
process.env.MM_MCP_SCALE ??= '2';
process.env.MM_MCP_SCREENSHOT_DIR ??= '/tmp/marketing-screenshots-session';

const OUT_DIR = process.env.MM_MARKETING_OUT_DIR
  ?? path.resolve(import.meta.dirname, '..', '..', 'marketmind-site', 'public', 'images');

// Layout switches re-mount every chart panel from scratch (canvas
// recreate, kline fetch, indicator recompute on the worker pool, drawing
// re-resolve from time anchors). 1.2s was too aggressive — the volume
// profile and order line tags were still streaming in when the shutter
// fired. 2.5s puts us safely past the populated state.
const switchLayout = async (presetName) => {
  const page = await getPage();
  await page.evaluate((name) => {
    const store = window.__layoutStore?.getState?.();
    if (!store) return;
    const preset = store.layoutPresets?.find((p) => p.name === name);
    const tabId = store.activeSymbolTabId;
    if (preset && tabId) store.setActiveLayout?.(tabId, preset.id);
  }, presetName);
  await page.waitForTimeout(2500);
  await seedLivePrices();
};

// Add a chart instance for one of the seeded user-indicators. Stable
// IDs (set in fixtures.ts USER_INDICATORS) let us add a chart pane
// instance directly — no clicking through the IndicatorLibrary needed.
// The renderer reads `instances` from `useIndicatorStore` to mount panes
// + render series, so a single addInstance call paints the indicator
// on every chart panel after the next compute tick.
const enableIndicator = async ({ userIndicatorId, catalogType, params }) => {
  const page = await getPage();
  await page.evaluate(({ userIndicatorId, catalogType, params }) => {
    const indStore = window.__indicatorStore?.getState?.();
    indStore?.addInstance?.({
      userIndicatorId,
      catalogType,
      params,
      visible: true,
    });
  }, { userIndicatorId, catalogType, params });
  await page.waitForTimeout(2000);
};

const clearIndicators = async () => {
  const page = await getPage();
  await page.evaluate(() => {
    const indStore = window.__indicatorStore?.getState?.();
    const instances = indStore?.instances ?? [];
    for (const inst of instances) {
      indStore?.removeInstance?.(inst.id);
    }
  });
  await page.waitForTimeout(500);
};

const closeAll = async () => {
  const page = await getPage();
  await page.evaluate(() => {
    window.__globalActions?.closeAll?.();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  await page.waitForTimeout(200);
};

// `__socketTestBridge.emit(event, payload)` invokes registered listeners
// synchronously without going through any wire — perfect for fixture-time
// stand-in for the production socket.io stream. Production listeners are
// registered by hooks like `useDepth` / `useScalpingMetrics` once their
// owning panel mounts; we wait briefly so the listeners are in place
// before emitting.
const emitSocket = async (event, payload) => {
  const page = await getPage();
  await page.evaluate(({ event, payload }) => {
    window.__socketTestBridge?.emit(event, payload);
  }, { event, payload });
};

// Synthetic L2 depth — 20 levels each side, geometric spacing so the
// closer levels carry more visual weight in the DOM ladder.
const buildDepth = (midPrice, levels = 20) => {
  const bids = [];
  const asks = [];
  for (let i = 0; i < levels; i++) {
    // Tighter near the spread, wider further out.
    const tickPct = 0.00005 * (i + 1) + 0.00002 * i * i * 0.05;
    const qty = (0.4 + Math.cos(i * 0.7) * 0.3 + Math.random() * 1.6) * (1 + i * 0.03);
    bids.push({
      price: midPrice * (1 - tickPct),
      quantity: Math.max(0.1, qty),
    });
    asks.push({
      price: midPrice * (1 + tickPct),
      quantity: Math.max(0.1, qty),
    });
  }
  return { bids, asks };
};

const seedOrderBookForSymbol = async (symbol, midPrice) => {
  const { bids, asks } = buildDepth(midPrice);
  await emitSocket('depth:update', {
    symbol,
    bids,
    asks,
    lastUpdateId: Date.now(),
    timestamp: Date.now(),
  });
};

const seedScalpingMetricsForSymbol = async (symbol) => {
  // Plausible mid-day scalping snapshot — moderate buy pressure (CVD
  // positive, imbalance > 1), low spread, small absorption. The
  // OrderFlowMetrics panel reads only the latest tick, so a single
  // emission populates the whole panel.
  await emitSocket('scalpingMetrics:update', {
    cvd: 18432.5,
    imbalanceRatio: 1.18,
    microprice: 0,
    spread: 0.5,
    spreadPercent: 0.0006,
    largeBuyVol: 8230,
    largeSellVol: 6940,
    absorptionScore: 0.32,
    exhaustionScore: 0.08,
    timestamp: Date.now(),
  });
};

// The renderer's PnL math (`portfolioPositionMath.buildPortfolioPositions`)
// reads currentPrice from `priceStore.prices[symbol]` (websocket-fed in
// production). Without WS in the fixture, prices is empty and PnL falls
// back to entryPrice → markPrice → 0. To make the screenshots show
// realistic ~+0.8% / +0.6% unrealized PnL on the open positions, push
// canonical prices straight into the store after each layout switch.
// Values match the fixture's `lastCloseOf(symbol, '15m')` × the slight
// favorable drift the entries assume.
const seedLivePrices = async () => {
  const page = await getPage();
  const prices = await page.evaluate(() => {
    const store = window.__priceStore?.getState?.();
    if (!store?.updatePrice) return null;
    // Pull the synthetic last-close from the trpc fixture map. The mock
    // stashes it in `_klineMap`; we reuse the same value the position
    // entry/SL/TP were anchored to.
    const klineMap = window.__klineMapCache;
    const lastClose = (sym) => {
      const series = klineMap?.[`${sym}:15m`];
      return series?.[series.length - 1]?.close;
    };
    const btc = lastClose('BTCUSDT') ?? 85000;
    const eth = lastClose('ETHUSDT') ?? 3500;
    const sol = lastClose('SOLUSDT') ?? 170;
    store.updatePrice('BTCUSDT', btc, 'websocket');
    store.updatePrice('ETHUSDT', eth, 'websocket');
    store.updatePrice('SOLUSDT', sol, 'websocket');
    return { btc, eth, sol };
  });
  await page.waitForTimeout(800);

  // Order book + scalping metrics flow over websocket in production. The
  // socket isn't connected in fixture mode, so the listeners registered by
  // `useDepth` / `useScalpingMetrics` have no source. Push test events
  // through `__socketTestBridge.emit()` — same path the e2e suite uses —
  // so the panels paint instead of staying empty.
  //
  // The DepthLevel listener (`useDepth`) doesn't filter by symbol — it
  // takes the latest emission unconditionally. That means we must emit
  // ONLY for the chart's active symbol, otherwise the depth ladder shows
  // a different symbol's prices on a different chart. Read the active
  // symbol from the layout store and emit just that one.
  if (prices) {
    const activeSymbol = await page.evaluate(() => {
      const tab = window.__layoutStore?.getState?.().getActiveTab?.();
      return tab?.symbol ?? 'BTCUSDT';
    });
    const activePrice = activeSymbol === 'ETHUSDT'
      ? prices.eth
      : activeSymbol === 'SOLUSDT'
        ? prices.sol
        : prices.btc;
    await seedOrderBookForSymbol(activeSymbol, activePrice);
    await seedScalpingMetricsForSymbol(activeSymbol);
    await page.waitForTimeout(500);
  }
};

// (Phase B exploration parked: ORB rendering depends on the chart
// viewport overlapping a session open timestamp. The synthetic klines
// end at 2026-04-27 19:00 UTC and the default viewport shows ~80
// candles, which lands after NYSE close. Resolving requires either
// re-anchoring the synthetic series to today's wall clock or driving
// the chart viewport via Playwright. Tracked as a follow-up.)

// Drop a Fibonacci retracement on the chart's active symbol+interval.
// Anchors swing-low / swing-high to the visible kline range so the
// 0% / 23.6% / 38.2% / 50% / 61.8% / 100% level lines paint cleanly.
const drawFibonacci = async (interval) => {
  const page = await getPage();
  await page.evaluate((intvl) => {
    const drawingStore = window.__drawingStore?.getState?.();
    const klineMap = window.__klineMapCache;
    const layoutTab = window.__layoutStore?.getState?.().getActiveTab?.();
    if (!drawingStore || !klineMap || !layoutTab) return;
    const series = klineMap[`${layoutTab.symbol}:${intvl}`];
    if (!series || series.length < 50) return;
    const tail = series.slice(-80);
    let lowIdx = 0;
    let highIdx = 0;
    let low = Infinity;
    let high = -Infinity;
    tail.forEach((k, i) => {
      if (k.low < low) { low = k.low; lowIdx = i; }
      if (k.high > high) { high = k.high; highIdx = i; }
    });
    const baseIdx = series.length - tail.length;
    const swingLowIdx = baseIdx + lowIdx;
    const swingHighIdx = baseIdx + highIdx;
    const swingLowPrice = low;
    const swingHighPrice = high;
    const direction = swingHighIdx > swingLowIdx ? 'up' : 'down';
    const range = swingHighPrice - swingLowPrice;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((level) => ({
      level,
      label: `${(level * 100).toFixed(1)}%`,
      price: direction === 'up'
        ? swingLowPrice + range * level
        : swingHighPrice - range * level,
    }));
    drawingStore.setDrawingsForSymbol(layoutTab.symbol, intvl, [{
      id: 'demo-fib-001',
      type: 'fibonacci',
      symbol: layoutTab.symbol,
      interval: intvl,
      visible: true,
      locked: false,
      zIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      swingLowIndex: swingLowIdx,
      swingLowPrice,
      swingLowTime: series[swingLowIdx]?.openTime,
      swingHighIndex: swingHighIdx,
      swingHighPrice,
      swingHighTime: series[swingHighIdx]?.openTime,
      direction,
      levels,
    }]);
  }, interval);
  await page.waitForTimeout(800);
};

const clearDrawings = async () => {
  const page = await getPage();
  await page.evaluate(() => {
    window.__drawingStore?.getState?.().clearAll?.();
  });
  await page.waitForTimeout(300);
};

const scenes = [
  {
    name: 'screenshot-0',
    title: 'Trading dashboard (15m / 1h / 4h)',
    setup: async () => {
      await closeAll();
      await switchLayout('15m / 1h / 4h');
      await setTheme('dark');
    },
    capture: async () => captureFullPage({ label: 'screenshot-0', theme: 'dark' }),
  },
  {
    name: 'screenshot-1',
    title: 'Scalping (1m / 5m / 15min)',
    setup: async () => {
      await closeAll();
      await switchLayout('1m / 5m / 15min');
      await setTheme('dark');
    },
    capture: async () => captureFullPage({ label: 'screenshot-1', theme: 'dark' }),
  },
  {
    name: 'screenshot-2',
    title: 'Swing (1h / 4h / 1d)',
    setup: async () => {
      await closeAll();
      await switchLayout('1h / 4h / 1d');
      await setTheme('dark');
    },
    capture: async () => captureFullPage({ label: 'screenshot-2', theme: 'dark' }),
  },
  {
    name: 'screenshot-3',
    title: 'Auto-Trading layout',
    setup: async () => {
      await closeAll();
      await switchLayout('Auto-Trading');
      await setTheme('dark');
    },
    capture: async () => captureFullPage({ label: 'screenshot-3', theme: 'dark' }),
  },
  {
    name: 'screenshot-4',
    title: 'Auto-Scalping layout',
    setup: async () => {
      await closeAll();
      await switchLayout('Auto-Scalping');
      await setTheme('dark');
    },
    capture: async () => captureFullPage({ label: 'screenshot-4', theme: 'dark' }),
  },
  {
    name: 'screenshot-5',
    title: 'Trading profiles dialog',
    setup: async () => {
      await closeAll();
      await switchLayout('15m / 1h / 4h');
      await setTheme('dark');
      const page = await getPage();
      await page.evaluate(() => {
        window.__uiStore?.getState?.().setTradingProfilesDialogOpen?.(true);
      });
      await page.waitForTimeout(1200);
    },
    capture: async () => captureFullPage({ label: 'screenshot-5', theme: 'dark' }),
  },
  {
    name: 'screenshot-6',
    title: 'Market Indicators layout',
    setup: async () => {
      await closeAll();
      await switchLayout('Market Indicators');
      await setTheme('dark');
    },
    capture: async () => captureFullPage({ label: 'screenshot-6', theme: 'dark' }),
  },
  {
    name: 'screenshot-7',
    title: 'Fibonacci retracement (1h)',
    setup: async () => {
      await closeAll();
      await clearDrawings();
      await switchLayout('1h / 4h / 1d');
      await setTheme('dark');
      await drawFibonacci('1h');
    },
    capture: async () => captureFullPage({ label: 'screenshot-7', theme: 'dark' }),
  },
  {
    name: 'screenshot-8',
    title: 'Wallets dialog',
    setup: async () => {
      await closeAll();
      await clearDrawings();
      await switchLayout('15m / 1h / 4h');
      await setTheme('dark');
      const page = await getPage();
      await page.evaluate(() => {
        window.__uiStore?.getState?.().setWalletsDialogOpen?.(true);
      });
      await page.waitForTimeout(1200);
    },
    capture: async () => captureFullPage({ label: 'screenshot-8', theme: 'dark' }),
  },
  // ORB scene was attempted (commit history) but the synthetic kline
  // generator has no session boundary metadata, so the ORB renderer
  // produces no visible output. Keeping the `enableIndicator` /
  // `clearIndicators` helpers wired so a future capture can re-enable
  // ORB once we add session boundary fixtures.
];

await mkdir(OUT_DIR, { recursive: true });

for (const scene of scenes) {
  console.log(`▶ ${scene.title}`);
  await scene.setup();
  const result = await scene.capture();
  const dest = path.join(OUT_DIR, `${scene.name}.png`);
  await copyFile(result.path, dest);
  console.log(`  → ${dest}`);
}

await closeBrowser();
console.log(`\nDone. ${scenes.length} screenshots written to ${OUT_DIR}`);
