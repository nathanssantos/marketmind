import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { getTrpcHitCount, installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';

const WALLET_FIXTURE = [{
  id: 'w1',
  name: 'Test Wallet',
  exchange: 'BINANCE',
  marketType: 'FUTURES',
  isActive: true,
  walletBalance: '10000',
  apiKeyEncrypted: 'enc',
  apiSecretEncrypted: 'enc',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}];

const installAutoTradingMock = (page: Page, opts: { filteredSymbols?: string[] } = {}) => {
  const config = {
    walletId: 'w1',
    tradingMode: 'auto',
    directionMode: 'auto',
    positionSizePercent: '10',
    leverage: 1,
    enableAutoRotation: true,
    trailingStopEnabled: true,
    useTrendFilter: true,
    useBtcCorrelationFilter: false,
    useFundingFilter: false,
  };
  const watcherStatus: { activeWatchers: { watcherId: string; symbol: string; interval: string; marketType: string }[]; persistedWatchers: number } = {
    activeWatchers: [],
    persistedWatchers: 0,
  };
  return installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => WALLET_FIXTURE,
      'wallet.listActive': () => WALLET_FIXTURE,
      'autoTrading.getConfig': () => config,
      'autoTrading.getWatcherStatus': () => watcherStatus,
      'autoTrading.getActiveExecutions': () => [],
      'autoTrading.getExecutionHistory': () => [],
      'autoTrading.getRotationStatus': () => null,
      'autoTrading.getFilteredSymbolsForQuickStart': () => ({
        symbols: opts.filteredSymbols ?? ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
        maxAffordableWatchers: 20,
        btcTrend: null,
        skippedTrend: [],
        skippedInsufficientCapital: [],
        skippedInsufficientKlines: [],
        capitalPerWatcher: 500,
      }),
      'autoTrading.getBtcTrendStatus': () => ({ trend: 'neutral', interval: '30m' }),
      'autoTrading.getBatchFundingRates': () => [],
      'autoTrading.updateConfig': (input: unknown) => {
        Object.assign(config, input);
        return config;
      },
      'autoTrading.startWatchersBulk': (input: { symbols: string[]; interval: string; marketType?: string; targetCount?: number }) => {
        for (const symbol of input.symbols) {
          watcherStatus.activeWatchers.push({
            watcherId: `w-${symbol}-${Date.now()}`,
            symbol,
            interval: input.interval,
            marketType: input.marketType ?? 'FUTURES',
          });
        }
        return { startedCount: input.symbols.length };
      },
    },
  });
};

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    window.__uiStore?.getState().setActiveWalletId(id);
  }, 'w1');
};

const openStartWatchersDialog = async (page: Page) => {
  await page.getByRole('button', { name: 'Auto Trading', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Scalping' })).toBeVisible();
  await page.getByRole('button', { name: 'Start Watchers' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Start Watchers' })).toBeVisible();
};

test.describe('StartWatchersDialog — full flow', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('Escape closes the modal', async ({ page }) => {
    await openStartWatchersDialog(page);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Start Watchers' })).toHaveCount(0);
  });

  test('default header shows Quick Start title + market/timeframe/count controls', async ({ page }) => {
    await openStartWatchersDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Start Watchers' });
    await expect(dialog.getByText('Quick Start from Rankings', { exact: true })).toBeVisible();
    // Spot/Futures buttons
    await expect(dialog.getByRole('button', { name: 'Spot', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Futures', exact: true })).toBeVisible();
  });

  test('switching market type SPOT triggers a new getFilteredSymbolsForQuickStart fetch', async ({ page }) => {
    await openStartWatchersDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Start Watchers' });

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.getFilteredSymbolsForQuickStart'),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(1);

    const before = await getTrpcHitCount(page, 'autoTrading.getFilteredSymbolsForQuickStart');
    await dialog.getByRole('button', { name: 'Spot', exact: true }).click();

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.getFilteredSymbolsForQuickStart'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('changing direction mode fires updateConfig', async ({ page }) => {
    await openStartWatchersDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Start Watchers' });

    const before = await getTrpcHitCount(page, 'autoTrading.updateConfig');
    await dialog.getByRole('button', { name: 'Long Only', exact: true }).click();
    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.updateConfig'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('clicking Start Top N fires startWatchersBulk; modal closes', async ({ page }) => {
    await openStartWatchersDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Start Watchers' });

    // The button label includes "Start Top {count}" with count clamped to effectiveMax.
    const startBtn = dialog.getByRole('button', { name: /^Start Top \d+/ });
    await expect(startBtn).toBeEnabled();

    const before = await getTrpcHitCount(page, 'autoTrading.startWatchersBulk');
    await startBtn.click();

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.startWatchersBulk'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
    await expect(page.getByRole('dialog', { name: 'Start Watchers' })).toHaveCount(0, { timeout: 5_000 });
  });

});

test.describe('StartWatchersDialog — empty filtered symbols', () => {
  test('Start Top button is disabled', async ({ page }) => {
    await installAutoTradingMock(page, { filteredSymbols: [] });
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);

    await openStartWatchersDialog(page);
    const dialog = page.getByRole('dialog', { name: 'Start Watchers' });
    const startBtn = dialog.getByRole('button', { name: /^Start Top \d+/ });
    await expect(startBtn).toBeDisabled();
  });
});
