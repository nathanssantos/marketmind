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
 *   3. Run this script: `node scripts/visual/marketing-screenshots.mjs`
 *
 * Env vars honored (defaults match site asset dimensions):
 *   MM_MCP_BASE_URL       — dev server URL (default http://localhost:5174)
 *   MM_MCP_VIEWPORT       — viewport (default 1920x1080 → 3840x2160 @ DPR 2)
 *   MM_MCP_SCALE          — DPR (default 2)
 *   MM_MARKETING_OUT_DIR  — output dir (default ../marketmind-site/public/images)
 */
import path from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import { captureFullPage, captureModal } from '../../packages/mcp-screenshot/dist/capture.js';
import { closeBrowser, getPage, setTheme } from '../../packages/mcp-screenshot/dist/browser.js';

process.env.MM_MCP_BASE_URL ??= 'http://localhost:5174';
process.env.MM_MCP_VIEWPORT ??= '1920x1080';
process.env.MM_MCP_SCALE ??= '2';
process.env.MM_MCP_SCREENSHOT_DIR ??= '/tmp/marketing-screenshots-session';

const OUT_DIR = process.env.MM_MARKETING_OUT_DIR
  ?? path.resolve(import.meta.dirname, '..', '..', '..', 'marketmind-site', 'public', 'images');

const switchLayout = async (presetName) => {
  const page = await getPage();
  const switched = await page.evaluate((name) => {
    const store = window.__layoutStore?.getState?.();
    if (!store) return false;
    const preset = store.layoutPresets?.find((p) => p.name === name);
    if (!preset) return false;
    // v1.6+ signature: setActiveLayout(layoutId) — global, not
    // per-symbol-tab. Earlier versions took (tabId, layoutId).
    store.setActiveLayout?.(preset.id);
    return true;
  }, presetName);
  if (!switched) {
    throw new Error(`switchLayout: preset "${presetName}" not found in layoutPresets`);
  }
  // Give the canvas time to mount, hydrate kline data via the trpc
  // mock, and run rAF frames so candles actually render.
  await page.waitForTimeout(3500);
  await pinTickerPrices();
  await emitLiveData();
};

// Order-book ladder and order-flow metrics are fed by socket streams
// (`depth:update` / `scalpingMetrics:update`), not tRPC — so the fixture
// fetch-patch can't populate them and the panels render empty/zero. Push a
// realistic snapshot through the e2e socket bridge for the active symbol.
const emitLiveData = async () => {
  const page = await getPage();
  await page.evaluate(() => {
    const bridge = window.__socketTestBridge;
    if (!bridge?.emit) return;
    const symbol = window.__layoutStore?.getState?.().getActiveTab?.()?.symbol ?? 'BTCUSDT';
    const mid = window.__priceStore?.getState?.().getPrice?.(symbol) ?? 67450;
    const tick = mid > 1000 ? 5 : mid > 10 ? 0.05 : 0.001;
    const rng = (seed) => { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; };
    const r = rng(Math.round(mid));
    const bids = Array.from({ length: 14 }, (_, i) => ({ price: +(mid - tick * (i + 1)).toFixed(2), quantity: +(0.4 + r() * 4).toFixed(3) }));
    const asks = Array.from({ length: 14 }, (_, i) => ({ price: +(mid + tick * (i + 1)).toFixed(2), quantity: +(0.4 + r() * 4).toFixed(3) }));
    bridge.emit('depth:update', { symbol, bids, asks, lastUpdateId: 1, timestamp: 0 });
    bridge.emit('scalpingMetrics:update', {
      cvd: 1240.5, imbalanceRatio: 1.18, microprice: +(mid + tick * 0.3).toFixed(2),
      spread: tick * 1.6, spreadPercent: 0.012, largeBuyVol: 32.4, largeSellVol: 27.1,
      absorptionScore: 0.62, exhaustionScore: 0.34, timestamp: 0,
    });
  });
  await page.waitForTimeout(700);
};

// The chart emits its price into the priceStore as candles load; the shape-
// preserving kline fixtures can briefly surface a non-final mid-series price,
// which the throttled position-price hook can latch — inflating open-position
// unrealized P&L. Pin the position symbols to their ticker values right
// before capture so the portfolio mark is always the symbol's current price.
const pinTickerPrices = async () => {
  const page = await getPage();
  await page.evaluate(() => {
    const ps = window.__priceStore?.getState?.();
    if (!ps?.updatePriceBatch) return;
    ps.updatePriceBatch(new Map([
      ['BTCUSDT', 67450.5],
      ['ETHUSDT', 3478.2],
      ['SOLUSDT', 171.4],
      ['BNBUSDT', 618.9],
    ]));
  });
  await page.waitForTimeout(1200);
};

// Apply a chart color palette through the Settings dialog (Chart tab), the
// same path a real user takes — the modal's swatch click triggers the chart
// canvas repaint that a bare store write doesn't. Palette affects the chart
// only; the rest of the UI keeps the active light/dark theme.
const setChartPalette = async (paletteId) => {
  const page = await getPage();
  await page.evaluate(() => window.__globalActions?.openSettings?.('chart'));
  await page.waitForTimeout(1500);
  await page.click(`[data-testid="chart-palette-${paletteId}"]`, { timeout: 5000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__globalActions?.closeAll?.());
  await page.waitForTimeout(1800);
};

const closeAll = async () => {
  const page = await getPage();
  await page.evaluate(() => {
    window.__globalActions?.closeAll?.();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
  await page.waitForTimeout(200);
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
    capture: async () => captureFullPage('screenshot-0', 'dark'),
  },
  {
    name: 'screenshot-1',
    title: 'Scalping (1m / 5m / 15min)',
    setup: async () => {
      await closeAll();
      await switchLayout('1m / 5m / 15min');
      await setTheme('dark');
    },
    capture: async () => captureFullPage('screenshot-1', 'dark'),
  },
  {
    name: 'screenshot-2',
    title: 'Swing (1h / 4h / 1d)',
    setup: async () => {
      await closeAll();
      await switchLayout('1h / 4h / 1d');
      await setTheme('dark');
    },
    capture: async () => captureFullPage('screenshot-2', 'dark'),
  },
  {
    name: 'screenshot-3',
    title: 'Auto-Trading layout',
    setup: async () => {
      await closeAll();
      await switchLayout('Auto-Trading');
      await setTheme('dark');
    },
    capture: async () => captureFullPage('screenshot-3', 'dark'),
  },
  {
    name: 'screenshot-4',
    title: 'Auto-Scalping layout',
    setup: async () => {
      await closeAll();
      await switchLayout('Auto-Scalping');
      await setTheme('dark');
    },
    capture: async () => captureFullPage('screenshot-4', 'dark'),
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
    capture: async () => captureFullPage('screenshot-5', 'dark'),
  },
  {
    name: 'screenshot-6',
    title: 'Market Indicators layout',
    setup: async () => {
      await closeAll();
      await switchLayout('Market Indicators');
      await setTheme('dark');
    },
    capture: async () => captureFullPage('screenshot-6', 'dark'),
  },
  // screenshot-7 (Fibonacci retracement overlay) was dropped from the
  // automation because the Fibo drawing tool needs two mouse anchors
  // on the canvas — programming that via Playwright is brittle
  // (depends on chart pan/zoom state + kline density at capture
  // time). The placeholder we used was visually identical to scene 2
  // (swing layout), which produced a duplicate on the site. If you
  // want a Fibo-overlay scene back, capture manually and drop it in
  // as screenshot-7.png, then re-add it to Screenshots.tsx.
  {
    name: 'screenshot-8',
    title: 'Wallets dialog',
    setup: async () => {
      await closeAll();
      await switchLayout('15m / 1h / 4h');
      await setTheme('dark');
      const page = await getPage();
      await page.evaluate(() => {
        window.__uiStore?.getState?.().setWalletsDialogOpen?.(true);
      });
      await page.waitForTimeout(1200);
    },
    capture: async () => captureFullPage('screenshot-8', 'dark'),
  },
  {
    name: 'screenshot-9',
    title: 'Trading dashboard — light theme',
    setup: async () => {
      await closeAll();
      // Set the theme before switching layout so the chart canvas mounts in
      // light mode — the price-scale gutter/axis paints light too (a post-mount
      // theme switch leaves the gutter dark).
      await setTheme('light');
      await switchLayout('15m / 1h / 4h');
    },
    capture: async () => captureFullPage('screenshot-9', 'light'),
  },
  {
    name: 'screenshot-10',
    title: 'Market Indicators — light theme',
    setup: async () => {
      await closeAll();
      await setTheme('light');
      await switchLayout('Market Indicators');
    },
    capture: async () => captureFullPage('screenshot-10', 'light'),
  },
  {
    name: 'screenshot-12',
    title: 'Settings — Chart palette config',
    setup: async () => {
      await closeAll();
      await switchLayout('15m / 1h / 4h');
      await setTheme('dark');
      const page = await getPage();
      await page.evaluate(() => window.__globalActions?.openSettings?.('chart'));
      await page.waitForTimeout(1500);
    },
    capture: async () => captureFullPage('screenshot-12', 'dark'),
  },
  // Kept last so the Classic B&W chart palette doesn't bleed into other scenes.
  {
    name: 'screenshot-11',
    title: 'Swing layout — Classic B&W chart palette',
    setup: async () => {
      await closeAll();
      await setTheme('dark');
      // Set the palette BEFORE switching layout so the chart canvas mounts
      // already reading the Classic B&W palette (setting it post-mount
      // doesn't force a repaint).
      await setChartPalette('classic');
      await switchLayout('1h / 4h / 1d');
    },
    capture: async () => captureFullPage('screenshot-11', 'dark'),
  },
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
