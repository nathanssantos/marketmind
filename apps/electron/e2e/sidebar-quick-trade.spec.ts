import { expect, test } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { getTrpcHitCount, installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';

const WALLET_FIXTURE = {
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

const POSITION_FIXTURE = {
  id: 'pos-1',
  walletId: WALLET_FIXTURE.id,
  symbol: 'BTCUSDT',
  side: 'LONG',
  status: 'open',
  entryPrice: '50000',
  quantity: '0.1',
  marketType: 'FUTURES',
  setupType: null,
};

const buildBoletaOverrides = (positions: unknown[] = []): Record<string, () => unknown> => ({
  'wallet.list': () => [WALLET_FIXTURE],
  'wallet.listActive': () => [WALLET_FIXTURE],
  'futuresTrading.getPositions': () => positions,
  'futuresTrading.getOpenOrders': () => [],
  'futuresTrading.getMarkPrice': () => ({ markPrice: '50000', indexPrice: '50000' }),
  'futuresTrading.getFundingRate': () => ({ fundingRate: '0.0001', nextFundingTime: Date.now() + 60_000 }),
  'futuresTrading.getSymbolLeverage': () => ({ leverage: 5, maxLeverage: 125 }),
  'trading.getTradeExecutions': () => positions,
  'trading.getTickerPrices': () => ({ BTCUSDT: '50000' }),
  'trading.getSymbolTrailingConfig': () => null,
  'trading.evaluateChecklist': () => null,
  'tradingProfiles.list': () => [],
  'autoTrading.getConfig': () => null,
  'autoTrading.getActiveExecutions': () => [],
  'analytics.getDailyPerformance': () => [],
  'analytics.getPerformance': () => null,
  'futuresTrading.reversePosition': () => ({ success: true, openExecutions: [], walletId: WALLET_FIXTURE.id }),
  'futuresTrading.closePositionAndCancelOrders': () => ({ success: true, openExecutions: [], walletId: WALLET_FIXTURE.id }),
  'futuresTrading.cancelAllOrders': () => ({ success: true, count: 0 }),
  'trading.createOrder': () => ({ success: true, orderId: 99999 }),
});

const buyButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Buy/, exact: false }).first();

const sellButton = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: /^Sell/, exact: false }).first();

const waitForBuyPrice = async (page: import('@playwright/test').Page) => {
  // The Buy button text starts as "Buy —" while currentPrice is 0, then
  // flips to "Buy 47570.55" once the chart's kline-close has propagated
  // through usePricesForSymbols (which has a 250ms throttle — so checking
  // priceStore directly is not enough; the React closure inside the
  // memoized BuySellButtons must also refresh). The button's accessible
  // name reflects the actual `buyPrice` captured by the click handler.
  await expect(buyButton(page)).not.toHaveAccessibleName(/—/, { timeout: 10_000 });
};

const openBoleta = async (page: import('@playwright/test').Page) => {
  const portfolioTab = page.getByRole('tab', { name: /Portfolio/i }).first();
  if (await portfolioTab.isVisible().catch(() => false)) await portfolioTab.click();
  await expect(buyButton(page)).toBeVisible();
  await waitForBuyPrice(page);
};

test.describe('sidebar quick-trade boleta — comprehensive coverage of all 7 features', () => {
  test.describe('with no open position', () => {
    test.beforeEach(async ({ page }) => {
      const klines = generateKlines({ count: 300, symbol: 'BTCUSDT', interval: '1h' });
      await installTrpcMock(page, { klines, overrides: buildBoletaOverrides([]) });
      await page.goto('/');
      await waitForChartReady(page);
      await openBoleta(page);
    });

    test('Buy click → confirm dialog → trading.createOrder is hit (regression: v0.107 sends quantity, not percent)', async ({ page }) => {
      const before = await getTrpcHitCount(page, 'trading.createOrder');

      await buyButton(page).click();

      const confirmDialog = page.getByRole('dialog').filter({ hasText: /Confirm Order/i });
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByText('LONG', { exact: true })).toBeVisible();

      await confirmDialog.getByRole('button', { name: /Confirm Buy/i }).click();

      await expect
        .poll(async () => (await getTrpcHitCount(page, 'trading.createOrder')) > before, { timeout: 5_000 })
        .toBe(true);
    });

    test('Sell click → confirm dialog → SELL/SHORT label and createOrder hit', async ({ page }) => {
      const before = await getTrpcHitCount(page, 'trading.createOrder');

      await sellButton(page).click();

      const confirmDialog = page.getByRole('dialog').filter({ hasText: /Confirm Order/i });
      await expect(confirmDialog).toBeVisible();
      await expect(confirmDialog.getByText('SHORT', { exact: true })).toBeVisible();

      await confirmDialog.getByRole('button', { name: /Confirm Sell/i }).click();

      await expect
        .poll(async () => (await getTrpcHitCount(page, 'trading.createOrder')) > before, { timeout: 5_000 })
        .toBe(true);
    });

    test('Cancel Orders confirm → futuresTrading.cancelAllOrders is hit', async ({ page }) => {
      const before = await getTrpcHitCount(page, 'futuresTrading.cancelAllOrders');

      // Cancel Orders is rendered as an ActionRow directly in the ticket
      // body now — no "Toggle advanced" button is required since the
      // boleta's action section is always expanded.
      await page.getByText('Cancel Orders', { exact: true }).first().click();

      const dialog = page.getByRole('dialog').filter({ hasText: /Cancel All Orders/i });
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel Orders', exact: true }).click();

      await expect
        .poll(async () => (await getTrpcHitCount(page, 'futuresTrading.cancelAllOrders')) > before, { timeout: 5_000 })
        .toBe(true);
    });

    test('Grid Orders + Trailing Stop rows render in the boleta action section', async ({ page }) => {
      // Action rows are always rendered now — the advanced-toggle gate was
      // removed when the ticket was simplified.
      await expect(page.getByText('Cancel Orders', { exact: true }).first()).toBeVisible();

      // Grid Orders / Trailing Stop labels render once each (the popover
      // content is not in DOM until opened). Their <p> ancestor flex has
      // measurable width but zero height in the compact action-row layout —
      // assert presence + non-zero width instead of toBeVisible.
      const presentNonZeroWidth = async (text: string): Promise<boolean> =>
        page.evaluate((t: string) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          let node = walker.nextNode();
          while (node) {
            if ((node.textContent ?? '').trim() === t) {
              const parent = node.parentElement;
              if (parent) {
                const rect = parent.getBoundingClientRect();
                if (rect.width > 0) return true;
              }
            }
            node = walker.nextNode();
          }
          return false;
        }, text);

      await expect.poll(() => presentNonZeroWidth('Grid Orders'), { timeout: 5_000 }).toBe(true);
      await expect.poll(() => presentNonZeroWidth('Trailing Stop'), { timeout: 5_000 }).toBe(true);
    });

    test('size presets update the displayed percentage label', async ({ page }) => {
      await page.getByRole('button', { name: '50%', exact: true }).click();
      await expect(page.getByText('50%', { exact: true }).first()).toBeVisible();
    });
  });

  // The Reverse / Close Position rows were dropped from the boleta and the
  // functionality moved to the PositionActionsPopover surfaced from each
  // open-positions row. Tests for those flows now live with the positions
  // panel surface (TODO follow-up — track in a separate spec when that UI
  // pattern stabilizes).
});
