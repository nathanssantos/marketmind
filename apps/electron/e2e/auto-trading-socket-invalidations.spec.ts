import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { getTrpcHitCount, installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';
import { emitSocketEvent, setWsConnected, waitForSocket } from './helpers/socketBridge';

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
      }),
      'autoTrading.getWatcherStatus': () => ({
        activeWatchers: [{ watcherId: 'w-btc', symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' }],
        persistedWatchers: 1,
      }),
      'autoTrading.getActiveExecutions': () => [],
      'autoTrading.getExecutionHistory': () => [],
      'autoTrading.getRotationStatus': () => null,
    },
  });

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    window.__uiStore?.getState().setActiveWalletId(id);
  }, 'w1');
};

test.describe('Auto-trading — socket invalidations', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
    await waitForSocket(page);
    await setWsConnected(page, true);
  });

  test('order:update triggers a trading.getOrders re-fetch', async ({ page }) => {
    await waitForSocket(page, { event: 'order:update', minListeners: 1 });

    const before = await getTrpcHitCount(page, 'trading.getOrders');
    await emitSocketEvent(page, 'order:update', { orderId: 'o1', symbol: 'BTCUSDT', status: 'NEW' });

    await expect.poll(
      () => getTrpcHitCount(page, 'trading.getOrders'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('order:created triggers both orders and wallet re-fetches', async ({ page }) => {
    await waitForSocket(page, { event: 'order:created', minListeners: 1 });

    const ordersBefore = await getTrpcHitCount(page, 'trading.getOrders');
    const walletBefore = await getTrpcHitCount(page, 'wallet.list');

    await emitSocketEvent(page, 'order:created', { orderId: 'o2', symbol: 'BTCUSDT' });

    await expect.poll(
      () => getTrpcHitCount(page, 'trading.getOrders'),
      { timeout: 5_000 },
    ).toBeGreaterThan(ordersBefore);
    await expect.poll(
      () => getTrpcHitCount(page, 'wallet.list'),
      { timeout: 5_000 },
    ).toBeGreaterThan(walletBefore);
  });

  test('position:update triggers tradeExecutions + autoTrading executions invalidation', async ({ page }) => {
    await waitForSocket(page, { event: 'position:update', minListeners: 1 });

    const before = await getTrpcHitCount(page, 'autoTrading.getActiveExecutions');
    await emitSocketEvent(page, 'position:update', { symbol: 'BTCUSDT' });

    await expect.poll(
      () => getTrpcHitCount(page, 'autoTrading.getActiveExecutions'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('wallet:update triggers wallet.list re-fetch', async ({ page }) => {
    await waitForSocket(page, { event: 'wallet:update', minListeners: 1 });

    const before = await getTrpcHitCount(page, 'wallet.list');
    await emitSocketEvent(page, 'wallet:update', { walletId: 'w1' });

    await expect.poll(
      () => getTrpcHitCount(page, 'wallet.list'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('emitting an unrelated event with no listeners does not throw', async ({ page }) => {
    // Sanity: we can call emitSocketEvent for any string, even if no handler listens.
    await emitSocketEvent(page, 'totally:made:up', { foo: 'bar' });
    // Page still alive
    await expect(page.getByRole('button', { name: 'Auto Trading', exact: true })).toBeVisible();
  });
});
