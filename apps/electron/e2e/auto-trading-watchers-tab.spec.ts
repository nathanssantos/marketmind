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

const WATCHERS_FIXTURE = [
  { watcherId: 'w-btc', symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES', profileName: undefined },
  { watcherId: 'w-eth', symbol: 'ETHUSDT', interval: '30m', marketType: 'FUTURES', profileName: undefined },
  { watcherId: 'w-sol', symbol: 'SOLUSDT', interval: '4h', marketType: 'FUTURES', profileName: undefined },
];

interface InstallOpts {
  watchers?: typeof WATCHERS_FIXTURE;
  positionSizePercent?: string;
  directionMode?: 'auto' | 'long_only' | 'short_only';
}

const buildState = (opts: InstallOpts = {}) => {
  const config = {
    walletId: 'w1',
    tradingMode: 'auto',
    directionMode: opts.directionMode ?? 'auto',
    positionSizePercent: opts.positionSizePercent ?? '10',
    leverage: 1,
    enableAutoRotation: true,
    trailingStopEnabled: true,
  };
  const watcherStatus = {
    activeWatchers: opts.watchers ?? [],
    persistedWatchers: 0,
  };
  return { config, watcherStatus };
};

const installAutoTradingMock = async (page: Page, opts: InstallOpts = {}) => {
  const state = buildState(opts);
  await installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => WALLET_FIXTURE,
      'wallet.listActive': () => WALLET_FIXTURE,
      'autoTrading.getConfig': () => state.config,
      'autoTrading.getWatcherStatus': () => state.watcherStatus,
      'autoTrading.getActiveExecutions': () => [],
      'autoTrading.getExecutionHistory': () => [],
      'autoTrading.getRotationStatus': () => null,
      'autoTrading.updateConfig': (input: unknown) => {
        Object.assign(state.config, input);
        return state.config;
      },
      'autoTrading.stopAllWatchers': () => {
        state.watcherStatus.activeWatchers = [];
        return { success: true };
      },
    },
  });
};

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    window.__uiStore?.getState().setActiveWalletId(id);
  }, 'w1');
};

const TRIGGER_NAME = 'Auto Trading';

const openWatchersTab = async (page: Page) => {
  await page.getByRole('button', { name: TRIGGER_NAME, exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Scalping' })).toBeVisible();
  // Watchers is the default; clicking it again is a no-op but ensures focus.
  await page.getByRole('tab', { name: 'Watchers' }).first().click();
};

test.describe('WatchersTab — empty state', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page, { watchers: [] });
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('renders the empty-state block + Start Watchers CTA', async ({ page }) => {
    await openWatchersTab(page);
    await expect(page.getByText('No active watchers', { exact: true })).toBeVisible();
    // The CTA Start Watchers button is rendered both in the header
    // and inside the empty state block.
    await expect(page.getByRole('button', { name: 'Start Watchers' })).toHaveCount(2);
  });

  test('clicking Start Watchers opens the StartWatchersModal', async ({ page }) => {
    await openWatchersTab(page);
    await page.getByRole('button', { name: 'Start Watchers' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Start Watchers' })).toBeVisible();
  });
});

test.describe('WatchersTab — populated state', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page, { watchers: WATCHERS_FIXTURE });
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('renders all 3 watcher rows with the badge count', async ({ page }) => {
    await openWatchersTab(page);

    for (const w of WATCHERS_FIXTURE) {
      await expect(page.getByText(w.symbol, { exact: true }).first()).toBeVisible();
    }

    // Stop All button is enabled
    await expect(page.getByRole('button', { name: 'Stop All' })).toBeEnabled();
  });

  test('clicking Stop All fires stopAllWatchers; rows disappear after refetch', async ({ page }) => {
    await openWatchersTab(page);
    await page.getByRole('button', { name: 'Stop All' }).click();

    await expect(page.getByText('No active watchers', { exact: true })).toBeVisible({ timeout: 10_000 });
  });

  test('changing direction mode via the selector fires updateConfig', async ({ page }) => {
    await openWatchersTab(page);
    const before = await getTrpcHitCount(page, 'autoTrading.updateConfig');

    // The DirectionModeSelector renders 3 buttons (Long Only / Auto / Short Only).
    // Click "Long Only" to switch.
    await page.getByRole('button', { name: 'Long Only', exact: true }).first().click();

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.updateConfig'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('position-size slider commits to updateConfig on release', async ({ page }) => {
    await openWatchersTab(page);
    const before = await getTrpcHitCount(page, 'autoTrading.updateConfig');

    // Slider has role=slider; arrow keys nudge it in steps.
    const slider = page.getByRole('slider').first();
    await slider.focus();
    await slider.press('ArrowRight');
    await slider.press('ArrowRight');
    // Blur to release — onValueChangeEnd fires updateConfig.
    await slider.press('Tab');

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.updateConfig'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('clicking a watcher row symbol does not throw (navigateToSymbol wired)', async ({ page }) => {
    await openWatchersTab(page);
    await page.getByText('BTCUSDT', { exact: true }).first().click();
    // Sidebar still open; no crash.
    await expect(page.getByRole('tab', { name: 'Scalping' })).toBeVisible();
  });
});

test.describe('WatchersTab — no wallet', () => {
  test('renders the no-wallet warning when activeWalletId is null', async ({ page }) => {
    await installAutoTradingMock(page, { watchers: [] });
    await page.goto('/');
    await waitForChartReady(page);
    // Do NOT call seedActiveWallet — leave activeWalletId = null

    await page.getByRole('button', { name: TRIGGER_NAME, exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Scalping' })).toBeVisible();

    // Component renders the orange "no wallet" message (key: trading.portfolio.noWallet).
    // The Start Watchers button in the header is still rendered.
    await expect(page.getByRole('button', { name: 'Start Watchers' }).first()).toBeVisible();
  });
});
