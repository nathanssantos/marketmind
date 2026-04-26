import { test, expect } from '@playwright/test';
import { launchApp, closeApp, type LaunchedApp } from './app-launch';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMockOnContext } from '../helpers/trpcMock';

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

let launched: LaunchedApp;

test.describe('Auto-Trading sidebar — inside packaged Electron app', () => {
  test.beforeAll(async () => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    launched = await launchApp({
      // installTrpcMockOnContext serializes function source — pass plain values
      // so the renderer-side resolvers don't try to capture node-side closures.
      setupContext: (ctx) => installTrpcMockOnContext(ctx, {
        klines,
        overrides: {
          'wallet.list': WALLET_FIXTURE,
          'wallet.listActive': WALLET_FIXTURE,
          'autoTrading.getConfig': {
            walletId: 'w1',
            tradingMode: 'auto',
            directionMode: 'auto',
            positionSizePercent: '10',
            leverage: 1,
          },
          'autoTrading.getWatcherStatus': { activeWatchers: [], persistedWatchers: 0 },
          'autoTrading.getActiveExecutions': [],
          'autoTrading.getExecutionHistory': [],
          'autoTrading.getRotationStatus': null,
        },
      }),
    });
    await launched.window.reload();
    await launched.window.waitForLoadState('domcontentloaded');
  });

  test.afterAll(async () => {
    if (launched) await closeApp(launched);
  });

  test('toolbar trigger opens the sidebar; three tabs visible; switching to Logs and back works', async () => {
    const trigger = launched.window.getByRole('button', { name: 'Auto Trading', exact: true });
    await expect(trigger).toBeVisible({ timeout: 15_000 });

    // Open
    await trigger.click();
    await expect(launched.window.getByRole('tab', { name: 'Scalping' })).toBeVisible();
    await expect(launched.window.getByRole('tab', { name: 'Watchers' }).first()).toBeVisible();
    await expect(launched.window.getByRole('tab', { name: 'Logs' }).first()).toBeVisible();

    // Switch to Logs tab
    await launched.window.getByRole('tab', { name: 'Logs' }).first().click();
    await expect(launched.window.getByText('Waiting for logs...', { exact: true })).toBeVisible();

    // Toggle closed
    await trigger.click();
    await expect(launched.window.getByRole('tab', { name: 'Scalping' })).toHaveCount(0);
  });
});
