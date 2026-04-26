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
  { id: 'p1', name: 'Default', isDefault: true, enabledSetupTypes: [], maxPositionSize: null, dailyLossLimit: null, positionSizing: 'percentage' },
];

interface InstallOpts {
  watchers?: { watcherId: string; symbol: string; interval: string; marketType: string }[];
  isIB?: boolean;
}

const installAutoTradingMock = (page: Page, opts: InstallOpts = {}) => {
  const config = {
    walletId: 'w1',
    tradingMode: 'auto',
    directionMode: 'auto',
    positionSizePercent: '10',
    manualPositionSizePercent: '2.5',
    maxGlobalExposurePercent: '100',
    leverage: 5,
    enableAutoRotation: true,
    trailingStopEnabled: true,
    trailingActivationPercentLong: '0.9',
    trailingActivationPercentShort: '0.8',
    trailingDistancePercentLong: '0.4',
    trailingDistancePercentShort: '0.3',
    useAdaptiveTrailing: true,
    trailingDistanceMode: 'fixed',
    trailingStopOffsetPercent: '0',
    trailingStopIndicatorInterval: '30m',
    trailingActivationModeLong: 'auto',
    trailingActivationModeShort: 'auto',
    tpCalculationMode: 'default',
    fibonacciTargetLevelLong: '3.618',
    fibonacciTargetLevelShort: '1.272',
    fibonacciSwingRange: 'nearest',
    initialStopMode: 'fibo_target',
    maxFibonacciEntryProgressPercentLong: 127.2,
    maxFibonacciEntryProgressPercentShort: 127.2,
    minRiskRewardRatioLong: '1',
    minRiskRewardRatioShort: '1',
    maxDrawdownEnabled: false,
    maxDrawdownPercent: '15',
    maxRiskPerStopEnabled: false,
    maxRiskPerStopPercent: '2',
    marginTopUpEnabled: false,
    marginTopUpThreshold: '30',
    marginTopUpPercent: '10',
    marginTopUpMaxCount: 3,
    autoCancelOrphans: false,
    confluenceMinScore: 60,
  };

  return installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => (opts.isIB ? [{ ...WALLET_FIXTURE[0]!, exchange: 'INTERACTIVE_BROKERS' }] : WALLET_FIXTURE),
      'wallet.listActive': () => (opts.isIB ? [{ ...WALLET_FIXTURE[0]!, exchange: 'INTERACTIVE_BROKERS' }] : WALLET_FIXTURE),
      'autoTrading.getConfig': () => config,
      'autoTrading.getWatcherStatus': () => ({
        activeWatchers: opts.watchers ?? [],
        persistedWatchers: opts.watchers?.length ?? 0,
      }),
      'autoTrading.getActiveExecutions': () => [],
      'autoTrading.getExecutionHistory': () => [],
      'autoTrading.getRotationStatus': () => null,
      'autoTrading.getRotationHistory': () => [],
      'autoTrading.getFilteredSymbolsForQuickStart': () => ({
        symbols: [], maxAffordableWatchers: 20, btcTrend: null, skippedTrend: [],
        skippedInsufficientCapital: [], skippedInsufficientKlines: [], capitalPerWatcher: 500,
      }),
      'autoTrading.getBtcTrendStatus': () => ({ trend: 'neutral', interval: '30m' }),
      'autoTrading.updateConfig': (input: unknown) => {
        Object.assign(config, input);
        return config;
      },
      'autoTrading.emergencyStop': () => ({ success: true }),
      'autoTrading.triggerSymbolRotation': () => ({ success: true }),
      'tradingProfiles.list': () => PROFILE_FIXTURE,
    },
  });
};

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    window.__uiStore?.getState().setActiveWalletId(id);
  }, 'w1');
};

const openWatcherManager = async (page: Page) => {
  await page.waitForFunction(() => typeof window.__globalActions !== 'undefined');
  await page.evaluate(() => window.__globalActions?.openSettings());
  await expect(page.getByRole('tab', { name: 'Auto-Trading' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('tab', { name: 'Auto-Trading' }).click();
  return page.getByRole('dialog').first();
};

test.describe('WatcherManager — open path + trading mode', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('Settings → Auto-Trading tab renders the WatcherManager content', async ({ page }) => {
    const dialog = await openWatcherManager(page);
    // Trading Mode header is rendered unconditionally
    await expect(dialog.getByText('Trading Mode', { exact: true })).toBeVisible();
  });

  test('clicking Semi-Assisted fires updateConfig with tradingMode', async ({ page }) => {
    const dialog = await openWatcherManager(page);

    const before = await getTrpcHitCount(page, 'autoTrading.updateConfig');
    await dialog.getByRole('button', { name: 'Semi-Assisted', exact: true }).click();

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.updateConfig'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('all collapsible section headers render', async ({ page }) => {
    const dialog = await openWatcherManager(page);

    // Active Watchers, Dynamic Selection, Position Size, Risk Management,
    // Trailing Stop, Take Profit, Stop, Entry, Filters, Opportunity Cost,
    // Pyramiding — assert ~5 representative ones.
    await expect(dialog.getByRole('button', { name: /^Active Watchers/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Position Size/i }).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Risk Management/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Trailing Stop/ })).toBeVisible();
  });
});

test.describe('WatcherManager — emergency stop', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page, {
      watchers: [{ watcherId: 'w-btc', symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' }],
    });
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('Emergency Stop button is visible when active watchers exist', async ({ page }) => {
    const dialog = await openWatcherManager(page);
    await expect(dialog.getByRole('button', { name: 'Emergency Stop', exact: true })).toBeVisible();
  });

  test('clicking Emergency Stop reveals the confirm panel', async ({ page }) => {
    const dialog = await openWatcherManager(page);
    await dialog.getByRole('button', { name: 'Emergency Stop', exact: true }).click();

    await expect(dialog.getByText('Confirm Emergency Stop', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Yes, Stop Everything' })).toBeVisible();
  });

  test('confirming Emergency Stop fires the mutation', async ({ page }) => {
    const dialog = await openWatcherManager(page);
    await dialog.getByRole('button', { name: 'Emergency Stop', exact: true }).click();

    const before = await getTrpcHitCount(page, 'autoTrading.emergencyStop');
    await dialog.getByRole('button', { name: 'Yes, Stop Everything' }).click();

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.emergencyStop'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('cancelling the confirm panel hides it again', async ({ page }) => {
    const dialog = await openWatcherManager(page);
    await dialog.getByRole('button', { name: 'Emergency Stop', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(dialog.getByText('Confirm Emergency Stop', { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Emergency Stop', exact: true })).toBeVisible();
  });
});

test.describe('WatcherManager — collapsible sections fire updateConfig', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('expanding Position Size reveals at least one slider', async ({ page }) => {
    const dialog = await openWatcherManager(page);

    await dialog.getByRole('button', { name: /Position Size/i }).first().click();
    await expect(dialog.getByRole('slider').first()).toBeVisible({ timeout: 5_000 });
  });

  test('Risk Management section expands and renders Max Drawdown row', async ({ page }) => {
    const dialog = await openWatcherManager(page);

    await dialog.getByRole('button', { name: /^Risk Management/ }).click();
    await expect(dialog.getByText('Max Drawdown', { exact: true }).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Trailing Stop section expands and renders its content', async ({ page }) => {
    const dialog = await openWatcherManager(page);

    await dialog.getByRole('button', { name: /^Trailing Stop/ }).click();
    // Section description is the most stable expansion check
    await expect(
      dialog.getByText('Automatically adjust stop loss as price moves in your favor', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
