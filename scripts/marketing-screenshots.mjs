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
  // mock, and run a few rAF frames so candles actually render.
  await page.waitForTimeout(3000);
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
    title: 'Chart with Fibonacci retracement',
    setup: async () => {
      await closeAll();
      // Fib drawing comes pre-baked in the fixture's `_drawingMap` for
      // BTCUSDT 1h; the chart picks it up on first hydration via
      // useBackendDrawings. Just need to land on a layout that has a
      // 1h panel showing BTCUSDT.
      await switchLayout('1h / 4h / 1d');
      await setTheme('dark');
      const page = await getPage();
      // Wait for the drawing to actually land in the focused-panel
      // store. Forces a redraw afterwards because the layout switch
      // may have already flushed the renderer's first overlay pass
      // before the backend drawings query resolves at this DPR.
      await page.waitForFunction(() => {
        const ds = window.__drawingStore?.getState?.();
        return ds && ds.getDrawingsForSymbol('BTCUSDT', '1h').length > 0;
      }, undefined, { timeout: 8000 }).catch(() => { /* fall through */ });
      await page.evaluate(() => {
        window.__canvasManager?.markDirty?.('overlays');
        window.__canvasManager?.markDirty?.('base');
      });
      await page.waitForTimeout(2000);
    },
    capture: async () => captureFullPage({ label: 'screenshot-7', theme: 'dark' }),
  },
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
      // Wait for the dialog AND the wallet list to render. The fixture
      // injects two wallets so the empty-state branch shouldn't show.
      await page.waitForSelector('[data-testid="wallet-create-trigger"]', { timeout: 5000 });
      await page.waitForTimeout(1200);
    },
    capture: async () => captureFullPage({ label: 'screenshot-8', theme: 'dark' }),
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
