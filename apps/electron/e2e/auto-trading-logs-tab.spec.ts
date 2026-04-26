import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
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

// Active watchers required so useAutoTradingLogs enables the socket listener.
const WATCHER_FIXTURE = [
  { watcherId: 'w-btc', symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' },
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
      }),
      'autoTrading.getWatcherStatus': () => ({
        activeWatchers: WATCHER_FIXTURE,
        persistedWatchers: 1,
      }),
      'autoTrading.getActiveExecutions': () => [],
      'autoTrading.getExecutionHistory': () => [],
      'autoTrading.getRotationStatus': () => null,
      'autoTrading.getRecentLogs': () => [],
    },
  });

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    window.__uiStore?.getState().setActiveWalletId(id);
  }, 'w1');
};

const openLogsTab = async (page: Page) => {
  await page.getByRole('button', { name: 'Auto Trading', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'Scalping' })).toBeVisible();
  await page.getByRole('tab', { name: 'Logs' }).first().click();
};

const buildLogEntry = (overrides: Partial<{ level: string; message: string; symbol: string; emoji: string; timestamp: number }> = {}) => ({
  level: 'info',
  message: 'Test log line',
  symbol: 'BTCUSDT',
  emoji: '✅',
  timestamp: Date.now(),
  ...overrides,
});

test.describe('LogsTab — socket-driven log rendering', () => {
  test.beforeEach(async ({ page }) => {
    await installAutoTradingMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
    await waitForSocket(page);
    await setWsConnected(page, true);
  });

  test('default empty state renders the waiting line', async ({ page }) => {
    await openLogsTab(page);
    await expect(page.getByText('Waiting for logs...', { exact: true })).toBeVisible();
  });

  test('emitting autoTrading:log appends a line to the LogsTab', async ({ page }) => {
    await openLogsTab(page);
    await waitForSocket(page, { event: 'autoTrading:log', minListeners: 1 });

    await emitSocketEvent(page, 'autoTrading:log', buildLogEntry({ message: 'First log line' }));

    await expect(page.getByText('First log line', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('emitting multiple lines preserves order', async ({ page }) => {
    await openLogsTab(page);
    await waitForSocket(page, { event: 'autoTrading:log', minListeners: 1 });

    for (let i = 1; i <= 3; i += 1) {
      await emitSocketEvent(page, 'autoTrading:log', buildLogEntry({ message: `Line ${i}` }));
    }

    await expect(page.getByText('Line 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Line 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Line 3', { exact: true })).toBeVisible();
  });

  test('clicking Clear logs removes all lines', async ({ page }) => {
    await openLogsTab(page);
    await waitForSocket(page, { event: 'autoTrading:log', minListeners: 1 });

    await emitSocketEvent(page, 'autoTrading:log', buildLogEntry({ message: 'About to clear' }));
    await expect(page.getByText('About to clear', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Clear logs' }).click();
    await expect(page.getByText('About to clear', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Waiting for logs...', { exact: true })).toBeVisible();
  });

  test('font-size buttons + decrease the font size step', async ({ page }) => {
    await openLogsTab(page);
    await waitForSocket(page, { event: 'autoTrading:log', minListeners: 1 });

    await emitSocketEvent(page, 'autoTrading:log', buildLogEntry({ message: 'Sizing test' }));
    const line = page.getByText('Sizing test', { exact: true });

    const startSize = await line.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));

    await page.getByRole('button', { name: 'Increase font size' }).click();
    const biggerSize = await line.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
    expect(biggerSize).toBeGreaterThan(startSize);

    await page.getByRole('button', { name: 'Decrease font size' }).click();
    const sameSize = await line.evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize));
    expect(sameSize).toBeCloseTo(startSize);
  });

  test('error level renders in red', async ({ page }) => {
    await openLogsTab(page);
    await waitForSocket(page, { event: 'autoTrading:log', minListeners: 1 });

    await emitSocketEvent(page, 'autoTrading:log', buildLogEntry({ level: 'error', message: 'Critical failure' }));
    const errorLine = page.getByText('Critical failure', { exact: true });
    await expect(errorLine).toBeVisible();

    const color = await errorLine.evaluate((el) => window.getComputedStyle(el).color);
    // red.400 in Chakra is roughly rgb(248, 113, 113)
    expect(color).toMatch(/^rgb\(248,\s*113,\s*113\)|^rgb\(252,\s*129,\s*129\)|^rgba\(.*\)$/);
  });
});
