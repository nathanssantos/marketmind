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

const PROFILE_FIXTURE = [
  { id: 'p1', name: 'Aggressive', isDefault: false, enabledSetupTypes: [], maxPositionSize: null, dailyLossLimit: null, positionSizing: 'percentage' },
  { id: 'p2', name: 'Default Profile', isDefault: true, enabledSetupTypes: [], maxPositionSize: null, dailyLossLimit: null, positionSizing: 'percentage' },
];

const installAutoTradingMock = (page: Page) =>
  installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => WALLET_FIXTURE,
      'wallet.listActive': () => WALLET_FIXTURE,
      'autoTrading.getConfig': () => ({
        walletId: 'w1',
        tradingMode: 'auto',
        directionMode: 'auto',
        positionSizePercent: '10',
        leverage: 1,
        enableAutoRotation: true,
        trailingStopEnabled: true,
      }),
      'autoTrading.getWatcherStatus': () => ({ activeWatchers: [], persistedWatchers: 0 }),
      'autoTrading.getActiveExecutions': () => [],
      'autoTrading.getExecutionHistory': () => [],
      'autoTrading.getRotationStatus': () => null,
      'autoTrading.getFilteredSymbolsForQuickStart': () => ({
        symbols: [], maxAffordableWatchers: 20, btcTrend: null, skippedTrend: [],
        skippedInsufficientCapital: [], skippedInsufficientKlines: [], capitalPerWatcher: 500,
      }),
      'tradingProfiles.list': () => PROFILE_FIXTURE,
      'autoTrading.startWatcher': () => ({ success: true }),
      'autoTrading.startWatchersBulk': () => ({ startedCount: 1 }),
      'symbols.list': () => ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    },
  });

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    window.__uiStore?.getState().setActiveWalletId(id);
  }, 'w1');
};

const openAddWatcherDialog = async (page: Page) => {
  // Wait for the global-actions bridge to be exposed
  await page.waitForFunction(() => typeof window.__globalActions !== 'undefined');
  await page.evaluate(() => window.__globalActions?.openSettings());

  // Settings dialog opens — match by the Auto-Trading tab being visible
  // (since the dialog may not have a single "Settings" accessible name).
  await expect(page.getByRole('tab', { name: 'Auto-Trading' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('tab', { name: 'Auto-Trading' }).click();
  const settingsDialog = page.getByRole('dialog').first();

  // After v1: Active Watchers section is variant="static" (always visible).
  // Click the always-visible "Add Watcher" button directly.
  await settingsDialog.getByRole('button', { name: 'Add Watcher', exact: true }).click();

  // The new dialog opens
  const addDialog = page.getByRole('dialog', { name: 'Add New Watcher' });
  await expect(addDialog).toBeVisible({ timeout: 5_000 });
  return addDialog;
};

test.describe('AddWatcherDialog — single mode', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('default mode is single; symbol + interval inputs are visible', async ({ page }) => {
    const dialog = await openAddWatcherDialog(page);

    await expect(dialog.getByText('Symbol', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Interval', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Use wallet default configuration', { exact: true })).toBeVisible();
  });

  test('toggling Bulk mode reveals bulk selector and changes submit label', async ({ page }) => {
    const dialog = await openAddWatcherDialog(page);

    await dialog.getByRole('button', { name: 'Bulk', exact: true }).click();

    // Submit label changes to "Start {count} Watchers" — count starts at 0
    await expect(dialog.getByRole('button', { name: /Start \d+ Watcher/ })).toBeVisible();
  });

  test('submitting in single mode fires startWatcher mutation', async ({ page }) => {
    const dialog = await openAddWatcherDialog(page);

    const before = await getTrpcHitCount(page, 'autoTrading.startWatcher');
    // Default symbol BTCUSDT is pre-filled. Submit.
    await dialog.getByRole('button', { name: 'Start', exact: true }).click();

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.startWatcher'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });
});
