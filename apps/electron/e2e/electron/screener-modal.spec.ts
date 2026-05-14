import { test, expect } from '@playwright/test';
import { launchApp, closeApp, type LaunchedApp } from './app-launch';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMockOnContext } from '../helpers/trpcMock';
import { openToolsItem } from '../helpers/toolsMenu';

const PRESET_FIXTURE = [
  {
    id: 'top-gainers',
    name: 'Top Gainers',
    description: 'Biggest 24h gainers',
    icon: 'TrendingUp',
    category: 'momentum',
    config: { filters: [] },
  },
  {
    id: 'volume-spike',
    name: 'Volume Spike',
    description: 'Unusual volume',
    icon: 'Zap',
    category: 'volume',
    config: { filters: [] },
  },
];

const RESULTS_FIXTURE = {
  results: [
    {
      symbol: 'BTCUSDT',
      displayName: 'Bitcoin',
      price: 51234.5,
      priceChange24h: 250.0,
      priceChangePercent24h: 0.49,
      volume24h: 2_400_000_000,
      quoteVolume24h: 1_500_000_000,
      marketCapRank: 1,
      indicators: { RSI: 58, ADX: 28, ATR_PERCENT: 1.2, VOLUME_RATIO: 1.6 },
      matchedFilters: 0,
      totalFilters: 0,
      compositeScore: 92,
    },
  ],
  totalSymbolsScanned: 200,
  totalMatched: 1,
  executionTimeMs: 100,
  cachedAt: null,
  config: {
    assetClass: 'CRYPTO',
    marketType: 'FUTURES',
    interval: '30m',
    filters: [],
    sortBy: 'compositeScore',
    sortDirection: 'desc',
  },
};

let launched: LaunchedApp;

test.describe('Screener modal — inside packaged Electron app', () => {
  test.beforeAll(async () => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    launched = await launchApp({
      setupContext: (ctx) => installTrpcMockOnContext(ctx, {
        klines,
        // installTrpcMockOnContext serializes function source via .toString().
        // Closures over outer fixtures don't survive the script-boundary, so
        // pass plain values — the helper wraps them in `() => value` on the
        // browser side.
        overrides: {
          'screener.run': RESULTS_FIXTURE,
          'screener.runPreset': RESULTS_FIXTURE,
          'screener.getPresets': PRESET_FIXTURE,
          'screener.getAvailableIndicators': [],
          'screener.getSavedScreeners': [],
        },
      }),
    });
    await launched.window.reload();
    await launched.window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (launched) await closeApp(launched);
  });

  test('toolbar trigger opens the modal with header Selects visible', async () => {
    const toolsBtn = launched.window.locator('[data-testid="toolbar-tools-button"]');
    await expect(toolsBtn).toBeVisible({ timeout: 15_000 });
    await openToolsItem(launched.window, 'screener');

    const dialog = launched.window.getByRole('dialog', { name: 'Market Screener' });
    await expect(dialog).toBeVisible();

    // Header Selects render the current store defaults
    await expect(dialog.locator('button').filter({ hasText: 'Crypto' }).first()).toBeVisible();
    await expect(dialog.locator('button').filter({ hasText: 'Futures' }).first()).toBeVisible();
    await expect(dialog.locator('button').filter({ hasText: '30m' }).first()).toBeVisible();

    // Close before next test in the suite
    await launched.window.keyboard.press('Escape');
    await expect(launched.window.getByRole('dialog', { name: 'Market Screener' })).toHaveCount(0);
  });

  test('opening the modal triggers screener.run; clicking a preset triggers runPreset', async () => {
    await openToolsItem(launched.window, 'screener');
    const dialog = launched.window.getByRole('dialog', { name: 'Market Screener' });
    await expect(dialog).toBeVisible();

    // Wait for the initial screener.run from the open
    await expect.poll(
      () => launched.window.evaluate(() => {
        const counters = (window as unknown as { __mmTrpcCounters?: Map<string, number> }).__mmTrpcCounters;
        return counters?.get('screener.run') ?? 0;
      }),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(1);

    // Click a preset chip → switches the active query to runPreset
    await dialog.getByRole('button', { name: 'Top Gainers', exact: true }).click();
    await expect.poll(
      () => launched.window.evaluate(() => {
        const counters = (window as unknown as { __mmTrpcCounters?: Map<string, number> }).__mmTrpcCounters;
        return counters?.get('screener.runPreset') ?? 0;
      }),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(1);

    await launched.window.keyboard.press('Escape');
    await expect(launched.window.getByRole('dialog', { name: 'Market Screener' })).toHaveCount(0);
  });

  test('Escape closes; toolbar trigger reopens with the same dialog', async () => {
    await openToolsItem(launched.window, 'screener');
    const dialog = launched.window.getByRole('dialog', { name: 'Market Screener' });
    await expect(dialog).toBeVisible();

    // Header is wired (Selects + close are interactive in the packaged app)
    await expect(dialog.locator('button').filter({ hasText: 'Crypto' }).first()).toBeVisible();

    await launched.window.keyboard.press('Escape');
    await expect(launched.window.getByRole('dialog', { name: 'Market Screener' })).toHaveCount(0);
  });
});
