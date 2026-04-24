import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady, waitForE2EBridge, waitForFrames } from './helpers/chartTestSetup';
import { emitSocketEvent, setWsConnected, waitForSocket } from './helpers/socketBridge';

const SYMBOL = 'BTCUSDT';
const INTERVAL = '1h';

const mkStreamHealthPayload = (status: 'healthy' | 'degraded', reason?: string) => ({
  symbol: SYMBOL,
  interval: INTERVAL,
  marketType: 'FUTURES' as const,
  status,
  ...(reason ? { reason } : {}),
  lastMessageAt: Date.now(),
});

const mkKlineUpdatePayload = () => ({
  symbol: SYMBOL,
  interval: INTERVAL,
  openTime: Date.now(),
  closeTime: Date.now() + 60_000,
  open: '50000',
  high: '50500',
  low: '49500',
  close: '50200',
  volume: '10',
  isClosed: false,
  timestamp: Date.now(),
});

test.describe('Stream health dot — backend degradation surfaces in chart header', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
    await setWsConnected(page, true);
    await waitForSocket(page, { event: 'stream:health' });
  });

  test('dot appears when stream:health degraded arrives and disappears on recovery', async ({ page }) => {
    const dot = page.getByTestId('stream-health-dot');
    await expect(dot).toHaveCount(0);

    await emitSocketEvent(page, 'stream:health', mkStreamHealthPayload('degraded', 'binance-stream-silent'));
    await waitForFrames(page, 2);
    await expect(dot).toBeVisible();

    await emitSocketEvent(page, 'stream:health', mkStreamHealthPayload('healthy'));
    await expect(dot).toBeVisible();

    await expect(dot).toHaveCount(0, { timeout: 10_000 });
  });

  test('dot stays visible while synthesized kline frames arrive — backend remains authoritative', async ({ page }) => {
    const dot = page.getByTestId('stream-health-dot');

    await emitSocketEvent(page, 'stream:health', mkStreamHealthPayload('degraded'));
    await waitForFrames(page, 2);
    await expect(dot).toBeVisible();

    for (let i = 0; i < 5; i++) {
      await emitSocketEvent(page, 'kline:update', mkKlineUpdatePayload());
      await page.waitForTimeout(200);
    }
    await expect(dot).toBeVisible();

    await emitSocketEvent(page, 'stream:health', mkStreamHealthPayload('healthy'));
    await expect(dot).toHaveCount(0, { timeout: 10_000 });
  });

  test('dot stays visible during a flicker between degraded and healthy', async ({ page }) => {
    const dot = page.getByTestId('stream-health-dot');

    await emitSocketEvent(page, 'stream:health', mkStreamHealthPayload('degraded'));
    await waitForFrames(page, 2);
    await expect(dot).toBeVisible();

    await emitSocketEvent(page, 'kline:update', mkKlineUpdatePayload());
    await page.waitForTimeout(800);
    await expect(dot).toBeVisible();

    await emitSocketEvent(page, 'stream:health', mkStreamHealthPayload('degraded'));
    await page.waitForTimeout(2_500);
    await expect(dot).toBeVisible();
  });

  test('ignores stream:health for a different symbol', async ({ page }) => {
    const dot = page.getByTestId('stream-health-dot');

    await emitSocketEvent(page, 'stream:health', {
      symbol: 'ETHUSDT',
      interval: INTERVAL,
      marketType: 'FUTURES' as const,
      status: 'degraded',
      lastMessageAt: Date.now(),
    });
    await waitForFrames(page, 2);
    await expect(dot).toHaveCount(0);
  });
});
