import AxeBuilder from '@axe-core/playwright';
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

const PERFORMANCE_FIXTURE = {
  totalTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  winRate: 0,
  grossPnL: 0,
  totalFees: 0,
  totalFunding: 0,
  netPnL: 0,
  totalReturn: 0,
  avgWin: 0,
  avgLoss: 0,
  profitFactor: 0,
  largestWin: 0,
  largestLoss: 0,
  maxDrawdown: 0,
};

const installCommonMocks = (page: Page) =>
  installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
    overrides: {
      'wallet.list': () => WALLET_FIXTURE,
      'wallet.listActive': () => WALLET_FIXTURE,
      'analytics.getPerformance': () => PERFORMANCE_FIXTURE,
      'analytics.getEquityCurve': () => [],
      'analytics.getDailyPerformance': () => [],
      'analytics.getMonthlyPerformance': () => [],
      'analytics.getStrategyPerformance': () => [],
      'analytics.getRecentRuns': () => [],
      'analytics.getOpenPositionsCount': () => 0,
      'autoTrading.getRotationStatus': () => null,
      'autoTrading.getRecentLogs': () => [],
      'autoTrading.getActiveExecutions': () => [],
      'autoTrading.getExecutionHistory': () => [],
      'autoTrading.getWatcherStatus': () => ({ activeWatchers: [], persistedWatchers: 0 }),
      'tradingProfiles.list': () => [],
      'auth.me': () => ({
        id: 'u1',
        email: 'a@test.com',
        name: 'Test',
        emailVerified: true,
        twoFactorEnabled: false,
        avatarColor: null,
        hasAvatar: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
      'auth.listSessions': () => [],
      'layout.listSnapshots': () => [],
      'kline.getMaintenanceStatus': () => [],
      'kline.getCooldowns': () => ({ gapCheckMs: 7_200_000, corruptionCheckMs: 7_200_000 }),
      'kline.getDbSize': () => ({ bytes: 0 }),
      'heatmap.getAlwaysCollectSymbols': () => [],
    },
  });

// Rules disabled for known framework artifacts. Keep this list short and
// documented — every entry is a regression we're not catching automatically.
//
// - aria-valid-attr-value: Chakra/Ark UI auto-generates IDs via React's
//   useId() (e.g. ":r_2a_:") which are valid HTML5 but axe-core's strict
//   check flags them. Screen readers handle them correctly. Tracked as D.2.d.
const SKIPPED_RULES = ['aria-valid-attr-value'];

const auditDialog = async (page: Page, dialogSelector: string) => {
  const results = await new AxeBuilder({ page })
    .include(dialogSelector)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .disableRules(SKIPPED_RULES)
    .analyze();

  const criticalOrSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  if (criticalOrSerious.length > 0) {
    const breakdown = criticalOrSerious
      .map((v) => {
        const nodeSummaries = v.nodes
          .slice(0, 3)
          .map((n) => `      target=${JSON.stringify(n.target)}\n      html=${n.html.slice(0, 200)}\n      summary=${n.failureSummary?.slice(0, 240) ?? ''}`)
          .join('\n');
        return `  • ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} nodes\n${nodeSummaries}`;
      })
      .join('\n');
    throw new Error(`axe found ${criticalOrSerious.length} critical/serious violations:\n${breakdown}`);
  }

  expect(criticalOrSerious).toEqual([]);
};

test.describe('Dialog accessibility — axe-core', () => {
  test.beforeEach(async ({ page }) => {
    await installCommonMocks(page);
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('Settings dialog has no critical/serious axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await auditDialog(page, '[role="dialog"]');
  });

  test('Backtest modal has no critical/serious axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Backtest', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await expect(dialog).toBeVisible();
    await auditDialog(page, '[role="dialog"]');
  });

  test('Analytics modal has no critical/serious axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: /^Analytics/ });
    await expect(dialog).toBeVisible();
    await auditDialog(page, '[role="dialog"]');
  });

  test('Keyboard shortcut help modal has no critical/serious axe violations', async ({ page }) => {
    await page.keyboard.press('Shift+/');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await auditDialog(page, '[role="dialog"]');
  });
});
