import { expect, test } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock, getTrpcHitCount } from './helpers/trpcMock';
import { waitForChartReady, waitForE2EBridge } from './helpers/chartTestSetup';
import { emitSocketEvent, setWsConnected, waitForSocket } from './helpers/socketBridge';

test.describe('sync — manual boleta order reaches Portfolio via WS invalidation (Bug B regression)', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: 'BTCUSDT', interval: '1h' });
    const walletFixture = {
      id: 'wallet-e2e',
      userId: 'e2e-user',
      name: 'E2E Wallet',
      exchange: 'binance',
      marketType: 'FUTURES',
      walletType: 'paper',
      isActive: true,
      currentBalance: '10000',
      initialBalance: '10000',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    await installTrpcMock(page, {
      klines,
      overrides: {
        'wallet.list': () => [walletFixture],
        'wallet.listActive': () => [walletFixture],
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
    await setWsConnected(page, true);
    await waitForSocket(page, { event: 'position:update' });
  });

  test('position:update emit invalidates getTradeExecutions + autoTrading.getActiveExecutions', async ({ page }) => {
    const execHitsBefore = await getTrpcHitCount(page, 'trading.getTradeExecutions');
    const activeHitsBefore = await getTrpcHitCount(page, 'autoTrading.getActiveExecutions');

    await emitSocketEvent(page, 'position:update', {
      id: 'new-execution-id',
      symbol: 'BTCUSDT',
      side: 'LONG',
      status: 'open',
      entryPrice: '50000',
      quantity: '0.1',
    });

    await expect
      .poll(async () => (await getTrpcHitCount(page, 'trading.getTradeExecutions')) > execHitsBefore, {
        timeout: 2_000,
        message: 'trading.getTradeExecutions should refetch after position:update emit',
      })
      .toBe(true);

    await expect
      .poll(async () => (await getTrpcHitCount(page, 'autoTrading.getActiveExecutions')) > activeHitsBefore, {
        timeout: 2_000,
      })
      .toBe(true);
  });

  test('order:update emit invalidates getOrders', async ({ page }) => {
    const ordersHitsBefore = await getTrpcHitCount(page, 'trading.getOrders');

    await emitSocketEvent(page, 'order:update', {
      id: 'exec-1',
      orderId: 12345,
      status: 'open',
      symbol: 'BTCUSDT',
    });

    await expect
      .poll(async () => (await getTrpcHitCount(page, 'trading.getOrders')) > ordersHitsBefore, {
        timeout: 2_000,
        message: 'trading.getOrders should refetch after order:update emit',
      })
      .toBe(true);
  });

  test('order:created emit invalidates orders + wallet', async ({ page }) => {
    const ordersHitsBefore = await getTrpcHitCount(page, 'trading.getOrders');
    const walletHitsBefore = await getTrpcHitCount(page, 'wallet.list');

    await emitSocketEvent(page, 'order:created', {
      orderId: 99999,
      symbol: 'BTCUSDT',
      side: 'BUY',
      status: 'FILLED',
    });

    await expect
      .poll(async () => (await getTrpcHitCount(page, 'trading.getOrders')) > ordersHitsBefore, { timeout: 2_000 })
      .toBe(true);
    await expect
      .poll(async () => (await getTrpcHitCount(page, 'wallet.list')) > walletHitsBefore, { timeout: 2_000 })
      .toBe(true);
  });
});
