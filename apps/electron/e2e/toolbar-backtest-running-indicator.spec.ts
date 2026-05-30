import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';

const WALLET_FIXTURE = [{
  id: 'w1', name: 'T', exchange: 'BINANCE', marketType: 'FUTURES',
  isActive: true, walletBalance: '10000', initialBalance: '10000',
  currentBalance: '10000', totalDeposits: '0', totalWithdrawals: '0',
  currency: 'USDT', apiKeyEncrypted: 'enc', apiSecretEncrypted: 'enc',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}];

const ACTIVE_RUN_FIXTURE = [{
  id: 'bt-running-1',
  symbol: 'BTCUSDT',
  interval: '1h',
  startTime: '2026-04-30T10:00:00.000Z',
}];

const setupPage = async (page: Page, getActiveRuns: () => unknown) => {
  await installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => WALLET_FIXTURE,
      'wallet.listActive': () => WALLET_FIXTURE,
      'backtest.getActiveRuns': getActiveRuns,
    },
  });
  await page.goto('/');
  await waitForChartReady(page);
};

// Backtest moved into the "Tools" toolbar popover (ToolsPopover.tsx). The
// running indicator is a trailing dot on the Backtest action item, so it is
// only in the DOM while the popover is open. Open Tools, then assert.
const openTools = async (page: Page): Promise<void> => {
  await page.getByTestId('toolbar-tools-button').click();
  await expect(page.getByTestId('tools-open-backtest')).toBeVisible();
};

test.describe('Tools popover — Backtest running indicator (V1_5 E.7)', () => {
  test('hides the indicator when no backtests are running', async ({ page }) => {
    await setupPage(page, () => []);
    await openTools(page);
    await expect(page.getByTestId('tools-backtest-running-indicator')).toHaveCount(0);
  });

  test('shows the indicator dot on the Backtest item when getActiveRuns returns a run', async ({ page }) => {
    await setupPage(page, () => ACTIVE_RUN_FIXTURE);
    await openTools(page);
    await expect(page.getByTestId('tools-backtest-running-indicator')).toBeVisible();
  });

  test('survives a page reload — indicator re-renders from the server query', async ({ page }) => {
    await setupPage(page, () => ACTIVE_RUN_FIXTURE);
    await openTools(page);
    await expect(page.getByTestId('tools-backtest-running-indicator')).toBeVisible();

    await page.reload();
    await waitForChartReady(page);

    await openTools(page);
    await expect(page.getByTestId('tools-backtest-running-indicator')).toBeVisible();
  });
});
