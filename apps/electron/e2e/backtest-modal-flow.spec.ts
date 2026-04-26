import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { getTrpcHitCount, installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';
import { emitSocketEvent, setWsConnected, waitForSocket } from './helpers/socketBridge';

const FAKE_BACKTEST_ID = 'bt-e2e';
const FAKE_RESULT = {
  id: FAKE_BACKTEST_ID,
  status: 'COMPLETED',
  config: {
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    initialCapital: 10_000,
    marketType: 'FUTURES',
  },
  trades: [
    {
      id: 't1', symbol: 'BTCUSDT', side: 'LONG', entryPrice: 50000, exitPrice: 51000,
      quantity: 0.1, pnl: 100, pnlPercent: 2,
      entryTime: Date.now() - 3_600_000, exitTime: Date.now(),
      setupType: 'breakout-retest', exitReason: 'TAKE_PROFIT',
    },
  ],
  metrics: {
    totalTrades: 42,
    winningTrades: 28,
    losingTrades: 14,
    winRate: 66.7,
    totalPnl: 3_250,
    totalPnlPercent: 32.5,
    grossWinRate: 66.7,
    grossProfitFactor: 2.4,
    totalGrossPnl: 3_250,
    avgWin: 180,
    avgLoss: -85,
    largestWin: 600,
    largestLoss: -250,
    profitFactor: 2.4,
    maxDrawdown: 450,
    maxDrawdownPercent: 4.5,
    sharpeRatio: 1.85,
    sortinoRatio: 2.1,
    totalCommission: 36.5,
    avgPnl: 77.4,
    avgPnlPercent: 0.77,
    avgTradeDuration: 180,
    avgWinDuration: 240,
    avgLossDuration: 90,
  },
  equityCurve: [],
  startTime: '2026-01-01T00:00:00.000Z',
  endTime: '2026-01-01T00:00:01.234Z',
  duration: 1234,
};

const STRATEGY_FIXTURE = [
  {
    id: 'breakout-retest',
    name: 'Breakout Retest',
    version: '1.0',
    description: 'Detects breakout-and-retest setups',
    author: 'mm',
    tags: ['breakout', 'trend'],
    status: 'active',
    enabled: true,
    recommendedTimeframes: { primary: '1h', secondary: ['4h'] },
  },
  {
    id: 'liquidity-sweep',
    name: 'Liquidity Sweep',
    version: '1.0',
    description: 'Stop-hunt reversal',
    author: 'mm',
    tags: ['reversal'],
    status: 'active',
    enabled: true,
    recommendedTimeframes: { primary: '1h' },
  },
];

const installModalMock = async (page: Page, opts: { resultOverride?: Record<string, unknown> } = {}) => {
  const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
  await installTrpcMock(page, {
    klines,
    overrides: {
      'setupDetection.listStrategies': () => STRATEGY_FIXTURE,
      'backtest.run': () => ({ backtestId: FAKE_BACKTEST_ID }),
      'backtest.getResult': () => ({ ...FAKE_RESULT, ...(opts.resultOverride ?? {}) }),
      'backtest.list': () => [
        {
          id: FAKE_BACKTEST_ID,
          symbol: 'BTCUSDT',
          interval: '1h',
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          initialCapital: 10_000,
          finalEquity: 13_250,
          totalPnl: 3_250,
          totalPnlPercent: 32.5,
          winRate: 66.7,
          totalTrades: 42,
          maxDrawdown: 450,
          createdAt: '2026-04-25T00:00:00.000Z',
          status: 'COMPLETED',
        },
      ],
    },
  });
};

const openModal = async (page: Page) => {
  await page.getByRole('button', { name: 'Backtest', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Backtest' })).toBeVisible();
};

test.describe('Backtest modal — full flow coverage', () => {
  test.beforeEach(async ({ page }) => {
    await installModalMock(page);
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('all four tabs are reachable and render their content', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });

    // Basic tab content
    await expect(dialog.getByText('Initial capital', { exact: true })).toBeVisible();

    await dialog.getByRole('tab', { name: 'Strategies' }).click();
    await expect(dialog.getByText('Breakout Retest', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Liquidity Sweep', { exact: true })).toBeVisible();

    await dialog.getByRole('tab', { name: 'Filters' }).click();
    // Group headers are buttons with title + summary
    await expect(dialog.getByRole('button', { name: /^Trend\b/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Momentum\b/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^Volume\b/ })).toBeVisible();

    await dialog.getByRole('tab', { name: 'Risk' }).click();
    await expect(dialog.getByText('Position size %', { exact: true })).toBeVisible();
  });

  test('strategies tab — bulk actions + per-row toggle', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await dialog.getByRole('tab', { name: 'Strategies' }).click();

    await expect(dialog.getByText('Breakout Retest', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Clear' }).click();
    await dialog.getByRole('button', { name: 'Select all' }).click();
    // No throw — both still rendered
    await expect(dialog.getByText('Breakout Retest', { exact: true })).toBeVisible();
  });

  test('filters tab — choppiness sub-params visible when enabled', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await dialog.getByRole('tab', { name: 'Filters' }).click();
    // Open Volatility group (has choppiness)
    await dialog.getByRole('button', { name: /^Volatility\b/ }).click();
    await expect(dialog.getByText('High threshold', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Low threshold', { exact: true })).toBeVisible();
  });

  test('full success loop: submit -> progress events -> result panel -> run another', async ({ page }) => {
    await waitForSocket(page);
    await setWsConnected(page, true);

    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });

    await dialog.getByRole('button', { name: 'Run backtest' }).click();

    // Initial running state shows starting placeholder (no progress events yet)
    await expect(dialog.getByText('Starting backtest…', { exact: true })).toBeVisible({ timeout: 5_000 });

    // Wait for the modal's useSocketEvent subscriptions to register before emitting
    await waitForSocket(page, { event: 'backtest:progress', minListeners: 1 });

    // Drive events
    await emitSocketEvent(page, 'backtest:progress', {
      backtestId: FAKE_BACKTEST_ID,
      phase: 'simulating',
      processed: 25,
      total: 100,
      etaMs: null,
      startedAt: Date.now() - 2_000,
    });
    await expect(dialog.getByText('Simulating trades', { exact: true })).toBeVisible();
    await expect(dialog.getByText('25%', { exact: true })).toBeVisible();

    await emitSocketEvent(page, 'backtest:progress', {
      backtestId: FAKE_BACKTEST_ID,
      phase: 'simulating',
      processed: 75,
      total: 100,
      etaMs: 4_000,
      startedAt: Date.now() - 8_000,
    });
    await expect(dialog.getByText('75%', { exact: true })).toBeVisible();

    await emitSocketEvent(page, 'backtest:complete', {
      backtestId: FAKE_BACKTEST_ID,
      resultId: FAKE_BACKTEST_ID,
      durationMs: 9_500,
    });

    // Results panel
    await expect(dialog.getByText('Backtest results', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Trades', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Win rate', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Total PnL', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Max drawdown', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Profit factor', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Final equity', { exact: true })).toBeVisible();

    // Run another resets to idle
    await dialog.getByRole('button', { name: 'Run another' }).click();
    await expect(dialog.getByRole('button', { name: 'Run backtest' })).toBeVisible();
  });

  test('failure path: backtest:failed event surfaces error alert', async ({ page }) => {
    await waitForSocket(page);
    await setWsConnected(page, true);

    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await dialog.getByRole('button', { name: 'Run backtest' }).click();

    await expect(dialog.getByText('Starting backtest…', { exact: true })).toBeVisible({ timeout: 5_000 });
    await waitForSocket(page, { event: 'backtest:failed', minListeners: 1 });

    await emitSocketEvent(page, 'backtest:failed', {
      backtestId: FAKE_BACKTEST_ID,
      error: 'Engine ran out of klines for the requested range',
    });

    await expect(dialog.getByText('Backtest failed', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(dialog.getByText('Engine ran out of klines for the requested range')).toBeVisible();
  });

  test('cancel during running returns to idle (form re-rendered)', async ({ page }) => {
    await waitForSocket(page);
    await setWsConnected(page, true);

    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await dialog.getByRole('button', { name: 'Run backtest' }).click();

    await expect(dialog.getByText('Starting backtest…', { exact: true })).toBeVisible({ timeout: 5_000 });

    // Cancel button uses common.cancel key — translation in EN is 'Cancel'
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog.getByRole('button', { name: 'Run backtest' })).toBeVisible({ timeout: 5_000 });
  });

  test('recent runs list — clicking opens cached result via getResult', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });

    await expect(dialog.getByText('RECENT RUNS', { exact: false })).toBeVisible({ timeout: 5_000 });
    const recentRow = dialog.getByTestId('recent-run-item').first();
    await expect(recentRow).toBeVisible();

    await recentRow.click();

    await expect(dialog.getByText('Backtest results', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('form validation — clearing initial capital disables submit', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });

    const submit = dialog.getByRole('button', { name: 'Run backtest' });
    await expect(submit).toBeEnabled();

    // Initial capital must be > 0; setting to 0 violates schema
    const capital = dialog.locator('input[type="number"]').first();
    await capital.fill('0');
    await expect(submit).toBeDisabled();

    // Restore valid value
    await capital.fill('5000');
    await expect(submit).toBeEnabled();
  });

  test('form validation — invalid leverage (>125) disables submit', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });

    const submit = dialog.getByRole('button', { name: 'Run backtest' });
    await expect(submit).toBeEnabled();

    // Leverage field is the second numeric input on the Basic tab (after initialCapital)
    const numbers = dialog.locator('input[type="number"]');
    const leverage = numbers.nth(1);
    await leverage.fill('500');
    await expect(submit).toBeDisabled();

    await leverage.fill('10');
    await expect(submit).toBeEnabled();
  });

  test('Risk tab — useAlgorithmicLevels disables stopLoss/takeProfit inputs', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await dialog.getByRole('tab', { name: 'Risk' }).click();

    // Open the Stops collapsible
    await dialog.getByText('Stop loss / take profit', { exact: true }).click();

    // The "Use strategy SL/TP" row contains exactly one switch
    const algoRow = dialog.getByText('Use strategy SL/TP', { exact: true }).locator('xpath=..');
    await algoRow.locator('input[type="checkbox"]').click({ force: true });

    // The two number inputs that follow should now be disabled
    const stopInputs = dialog.locator('input[type="number"][disabled]');
    await expect(stopInputs).not.toHaveCount(0);
  });

  test('Strategies tab — Show experimental triggers a new listStrategies call', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await dialog.getByRole('tab', { name: 'Strategies' }).click();

    // Wait for the initial listStrategies request to land
    await expect.poll(
      () => getTrpcHitCount(page, 'setupDetection.listStrategies'),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(1);

    const before = await getTrpcHitCount(page, 'setupDetection.listStrategies');

    // Toggle Show experimental — query input changes -> new request
    const showExpRow = dialog.getByText('Show experimental', { exact: true }).locator('xpath=..');
    await showExpRow.locator('input[type="checkbox"]').click({ force: true });

    await expect.poll(
      () => getTrpcHitCount(page, 'setupDetection.listStrategies'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('hook ignores progress events bound to a different backtestId', async ({ page }) => {
    await waitForSocket(page);
    await setWsConnected(page, true);

    await openModal(page);
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await dialog.getByRole('button', { name: 'Run backtest' }).click();

    await expect(dialog.getByText('Starting backtest…', { exact: true })).toBeVisible({ timeout: 5_000 });
    await waitForSocket(page, { event: 'backtest:progress', minListeners: 1 });

    // Emit progress for a DIFFERENT backtestId
    await emitSocketEvent(page, 'backtest:progress', {
      backtestId: 'someone-elses-bt',
      phase: 'simulating',
      processed: 90,
      total: 100,
      etaMs: 100,
      startedAt: Date.now() - 5_000,
    });

    // Modal should NOT update — still shows the starting placeholder
    await expect(dialog.getByText('Starting backtest…', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Simulating trades', { exact: true })).toHaveCount(0);

    // Emit progress for the correct backtestId — should update
    await emitSocketEvent(page, 'backtest:progress', {
      backtestId: FAKE_BACKTEST_ID,
      phase: 'simulating',
      processed: 50,
      total: 100,
      etaMs: 1_000,
      startedAt: Date.now() - 5_000,
    });
    await expect(dialog.getByText('Simulating trades', { exact: true })).toBeVisible();
  });
});
