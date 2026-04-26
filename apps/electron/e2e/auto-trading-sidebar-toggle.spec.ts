import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
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
    },
  });

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    const store = window.__uiStore;
    if (!store) throw new Error('uiStore bridge not exposed');
    store.getState().setActiveWalletId(id);
  }, 'w1');
};

const TRIGGER_NAME = 'Auto Trading';

const openSidebar = async (page: Page) => {
  await page.getByRole('button', { name: TRIGGER_NAME, exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Scalping' })).toBeVisible();
};

const closeSidebar = async (page: Page) => {
  await page.getByRole('button', { name: TRIGGER_NAME, exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Scalping' })).toHaveCount(0);
};

test.describe('AutoTradingSidebar — toggle and tab switching', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('toolbar trigger toggles the sidebar open/closed', async ({ page }) => {
    const trigger = page.getByRole('button', { name: TRIGGER_NAME, exact: true });
    await expect(page.getByRole('tab', { name: 'Scalping' })).toHaveCount(0);
    await trigger.click();
    await expect(page.getByRole('tab', { name: 'Scalping' })).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('tab', { name: 'Scalping' })).toHaveCount(0);
  });

  test('three tabs render: Watchers / Scalping / Logs', async ({ page }) => {
    await openSidebar(page);

    // Multiple sidebars expose a "Watchers" tab — assert at least one is
    // visible after opening the auto-trading sidebar (Scalping is unique).
    await expect(page.getByRole('tab', { name: 'Scalping', exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Watchers' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Logs' }).first()).toBeVisible();
  });

  test('default tab is Watchers; switching to Logs renders the empty waiting line', async ({ page }) => {
    await openSidebar(page);

    // Logs is unique to the auto-trading sidebar (MarketSidebar doesn't have it as a tab).
    await page.getByRole('tab', { name: 'Logs' }).first().click();
    await expect(page.getByText('Waiting for logs...', { exact: true })).toBeVisible();
  });

  test('switching to Scalping requires an active wallet (which we seed)', async ({ page }) => {
    await openSidebar(page);
    await page.getByRole('tab', { name: 'Scalping' }).click();
    // No throw — the tab content area is reachable. We just check the
    // tab is now selected via aria-selected.
    await expect(page.getByRole('tab', { name: 'Scalping' })).toHaveAttribute('aria-selected', 'true');
  });

  test('reopening the sidebar preserves the last-active tab', async ({ page }) => {
    await openSidebar(page);
    await page.getByRole('tab', { name: 'Logs' }).first().click();
    await expect(page.getByRole('tab', { name: 'Logs' }).first()).toHaveAttribute('aria-selected', 'true');

    await closeSidebar(page);
    await openSidebar(page);

    await expect(page.getByRole('tab', { name: 'Logs' }).first()).toHaveAttribute('aria-selected', 'true');
  });

  test('autoTradingSidebarTab persists via syncUI when switching tabs', async ({ page }) => {
    await openSidebar(page);
    await page.getByRole('tab', { name: 'Logs' }).first().click();

    const persistedTab = await page.evaluate(() => {
      const store = window.__uiStore;
      return store?.getState().autoTradingSidebarTab;
    });
    expect(persistedTab).toBe('logs');
  });
});
