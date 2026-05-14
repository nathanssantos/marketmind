import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { getTrpcHitCount, installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';
import { openToolsItem } from './helpers/toolsMenu';

const WALLET_FIXTURE = [{
  id: 'w1',
  name: 'Test Wallet',
  exchange: 'BINANCE',
  marketType: 'FUTURES',
  isActive: true,
  walletBalance: '10000',
  initialBalance: '10000',
  currentBalance: '10500',
  totalDeposits: '0',
  totalWithdrawals: '0',
  currency: 'USDT',
  apiKeyEncrypted: 'enc',
  apiSecretEncrypted: 'enc',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}];

const buildPerformance = (overrides: Partial<{
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  grossPnL: number;
  totalFees: number;
  totalFunding: number;
  netPnL: number;
  totalReturn: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
}> = {}) => ({
  totalTrades: 21,
  winningTrades: 13,
  losingTrades: 8,
  winRate: 61.9,
  grossPnL: 877.86,
  totalFees: 459.10,
  totalFunding: -42.55,
  netPnL: 418.76,
  avgWin: 59.10,
  avgLoss: -43.68,
  profitFactor: 2.20,
  totalReturn: 4.19,
  largestWin: 181.94,
  largestLoss: -140.93,
  maxDrawdown: 2.36,
  effectiveCapital: 10000,
  totalDeposits: 0,
  totalWithdrawals: 0,
  ...overrides,
});

interface InstallOpts {
  perfByPeriod?: Partial<Record<'day' | 'week' | 'month' | 'all', ReturnType<typeof buildPerformance>>>;
}

const installAnalyticsMock = (page: Page, opts: InstallOpts = {}) =>
  installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => WALLET_FIXTURE,
      'wallet.listActive': () => WALLET_FIXTURE,
      'analytics.getPerformance': (input: unknown) => {
        const period = (input as { period?: 'day' | 'week' | 'month' | 'all' }).period ?? 'all';
        return opts.perfByPeriod?.[period] ?? buildPerformance();
      },
      'analytics.getEquityCurve': () => [],
      'analytics.getDailyPerformance': () => [],
      'analytics.getSetupStats': () => [],
      'analytics.getTradeHistory': () => [],
    },
  });

const seedActiveWallet = async (page: Page) => {
  await page.evaluate((id) => {
    window.__uiStore?.getState().setActiveWalletId(id);
  }, 'w1');
};

const openModal = async (page: Page) => {
  await openToolsItem(page, 'analytics');
  await expect(page.getByRole('dialog', { name: /^Analytics/ })).toBeVisible();
};

test.describe('Analytics modal — full flow', () => {
  test.beforeEach(async ({ page }) => {
    await installAnalyticsMock(page);
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);
  });

  test('toolbar trigger opens and Escape closes the dialog', async ({ page }) => {
    await expect(page.getByRole('dialog', { name: /^Analytics/ })).toHaveCount(0);
    await openToolsItem(page, 'analytics');
    await expect(page.getByRole('dialog', { name: /^Analytics/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /^Analytics/ })).toHaveCount(0);
  });

  test('renders all 9 metric cards from the performance fixture', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: /^Analytics/ });

    for (const label of [
      'Total Return', 'Net PnL', 'Win Rate',
      'Profit Factor', 'Avg Win', 'Avg Loss',
      'Max Drawdown', 'Largest Win', 'Largest Loss',
    ]) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
  });

  test('switching period buttons triggers a new getPerformance request per period', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: /^Analytics/ });

    await expect.poll(
      () => getTrpcHitCount(page, 'analytics.getPerformance'),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(1);

    // Day button
    let before = await getTrpcHitCount(page, 'analytics.getPerformance');
    await dialog.getByRole('button', { name: 'Day', exact: true }).click();
    await expect.poll(
      () => getTrpcHitCount(page, 'analytics.getPerformance'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);

    // Week button
    before = await getTrpcHitCount(page, 'analytics.getPerformance');
    await dialog.getByRole('button', { name: 'Week', exact: true }).click();
    await expect.poll(
      () => getTrpcHitCount(page, 'analytics.getPerformance'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);

    // Month button
    before = await getTrpcHitCount(page, 'analytics.getPerformance');
    await dialog.getByRole('button', { name: 'Month', exact: true }).click();
    await expect.poll(
      () => getTrpcHitCount(page, 'analytics.getPerformance'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('Net PnL subtext shows Gross / Fees / Funding when funding is non-zero', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: /^Analytics/ });
    const subtext = dialog.getByText(/Gross:/).first();
    await expect(subtext).toContainText('Gross:');
    await expect(subtext).toContainText('Fees:');
    await expect(subtext).toContainText('Funding:');
  });

  test('Win Rate card shows the W/L breakdown', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: /^Analytics/ });
    await expect(dialog.getByText('13W / 8L', { exact: true })).toBeVisible();
  });

});

test.describe('Analytics modal — period-aware totalReturn (regression for the Apr 26 bug)', () => {
  test('totalReturn and netPnL share the same sign within a period', async ({ page }) => {
    await installAnalyticsMock(page, {
      perfByPeriod: {
        week: buildPerformance({ netPnL: 615.85, totalReturn: 6.16, grossPnL: 1074.95, totalFees: 459.10, totalFunding: 0 }),
        all: buildPerformance({
          netPnL: -3786,
          totalReturn: -37.86,
          grossPnL: -3326,
          totalFees: 460,
          totalFunding: 0,
          winningTrades: 50,
          losingTrades: 80,
          winRate: 38.5,
        }),
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await seedActiveWallet(page);

    await openToolsItem(page, 'analytics');
    const dialog = page.getByRole('dialog', { name: /^Analytics/ });
    await expect(dialog).toBeVisible();

    // Default period is "All Time" — totalReturn is the negative all-time figure
    await expect(dialog.getByText('-37.86%', { exact: true })).toBeVisible();
    // Switch to Week — totalReturn flips sign because the fix made it period-aware
    await dialog.getByRole('button', { name: 'Week', exact: true }).click();
    await expect(dialog.getByText('+6.16%', { exact: true })).toBeVisible();
  });
});

test.describe('Analytics modal — no wallet', () => {
  test('renders the noWalletSelected text when wallets array is empty', async ({ page }) => {
    await installTrpcMock(page, {
      klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
      overrides: {
        'wallet.list': () => [],
        'wallet.listActive': () => [],
        'analytics.getPerformance': () => buildPerformance(),
        'analytics.getEquityCurve': () => [],
        'analytics.getDailyPerformance': () => [],
        'analytics.getSetupStats': () => [],
        'analytics.getTradeHistory': () => [],
      },
    });
    await page.goto('/');
    await waitForChartReady(page);

    await openToolsItem(page, 'analytics');
    const dialog = page.getByRole('dialog', { name: /^Analytics/ });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('No wallet selected. Please create or select a wallet first.', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });
});
