import { expect, test } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock, getTrpcHitCount } from './helpers/trpcMock';
import { waitForChartReady, waitForE2EBridge } from './helpers/chartTestSetup';
import { emitSocketEvent, setWsConnected, waitForSocket } from './helpers/socketBridge';

test.describe('sync — SL fills propagate to Portfolio via WS invalidation (Bug A regression)', () => {
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
    await waitForSocket(page, { event: 'position:closed' });
  });

  test('position:closed emit triggers refetch of active trading queries', async ({ page }) => {
    // Only assert on queries with live observers in the E2E render tree.
    // analytics.getSetupStats/getEquityCurve get invalidated too but refetch is
    // gated on a mounted consumer — covered by frontend unit tests, not E2E.
    const baseline = {
      tradeExecs: await getTrpcHitCount(page, 'trading.getTradeExecutions'),
      wallet: await getTrpcHitCount(page, 'wallet.list'),
    };

    await emitSocketEvent(page, 'position:closed', {
      positionId: 'exec-1',
      symbol: 'BTCUSDT',
      side: 'LONG',
      exitReason: 'STOP_LOSS',
      pnl: -15.5,
      pnlPercent: -0.3,
    });

    await expect
      .poll(async () => (await getTrpcHitCount(page, 'trading.getTradeExecutions')) > baseline.tradeExecs, { timeout: 2_000 })
      .toBe(true);
    await expect
      .poll(async () => (await getTrpcHitCount(page, 'wallet.list')) > baseline.wallet, { timeout: 2_000 })
      .toBe(true);
  });

  test('position:update emit triggers trading + wallet refetch', async ({ page }) => {
    const baseline = {
      tradeExecs: await getTrpcHitCount(page, 'trading.getTradeExecutions'),
      wallet: await getTrpcHitCount(page, 'wallet.list'),
    };

    await emitSocketEvent(page, 'position:update', {
      id: 'exec-1',
      status: 'open',
      entryPrice: '50000',
      pnl: '12.34',
      pnlPercent: '0.25',
    });

    await expect
      .poll(async () => (await getTrpcHitCount(page, 'trading.getTradeExecutions')) > baseline.tradeExecs, { timeout: 2_000 })
      .toBe(true);
    await expect
      .poll(async () => (await getTrpcHitCount(page, 'wallet.list')) > baseline.wallet, { timeout: 2_000 })
      .toBe(true);
  });

  test('socket disconnect → reconnect triggers full trading-query refetch (recovery path)', async ({ page }) => {
    // Flush initial query wave
    await page.waitForTimeout(300);
    const baseline = {
      tradeExecs: await getTrpcHitCount(page, 'trading.getTradeExecutions'),
      orders: await getTrpcHitCount(page, 'trading.getOrders'),
      wallet: await getTrpcHitCount(page, 'wallet.list'),
    };

    // Fire the actual 'disconnect' socket event so handleDisconnect flips hasDisconnectedRef
    await setWsConnected(page, false);
    await emitSocketEvent(page, 'disconnect', 'transport close');
    await page.waitForTimeout(100);
    // Fire the actual 'connect' socket event so handleConnect detects the reconnect
    await setWsConnected(page, true);
    await emitSocketEvent(page, 'connect', null);

    await expect
      .poll(async () => (await getTrpcHitCount(page, 'trading.getTradeExecutions')) > baseline.tradeExecs, {
        timeout: 3_000,
        message: 'getTradeExecutions should refetch after reconnect',
      })
      .toBe(true);
  });
});
