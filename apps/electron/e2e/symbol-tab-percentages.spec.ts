import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady, waitForE2EBridge, waitForFrames } from './helpers/chartTestSetup';
import { emitSocketEvent, setWsConnected, waitForSocket } from './helpers/socketBridge';

interface SymbolTabSeed {
  symbol: string;
  marketType: 'SPOT' | 'FUTURES';
  open: number;
  lastPrice: number;
}

const SEEDS: SymbolTabSeed[] = [
  { symbol: 'BTCUSDT', marketType: 'FUTURES', open: 50_000, lastPrice: 49_500 },
  { symbol: 'ETHUSDT', marketType: 'FUTURES', open: 3_000, lastPrice: 3_030 },
  { symbol: 'SOLUSDT', marketType: 'FUTURES', open: 100, lastPrice: 100.5 },
];

const seedSymbolTabs = async (page: Page, seeds: SymbolTabSeed[]): Promise<void> => {
  await page.waitForFunction(() => typeof window.__layoutStore !== 'undefined', { timeout: 10_000 });
  await page.evaluate((tabs) => {
    const store = window.__layoutStore;
    if (!store) throw new Error('__layoutStore not exposed');
    store.setState({
      symbolTabs: tabs.map((t, i) => ({
        id: i === 0 ? 'default' : `tab-${i}`,
        symbol: t.symbol,
        marketType: t.marketType,
        activeLayoutId: 'single',
        order: i,
      })),
      activeSymbolTabId: 'default',
    });
  }, seeds.map((s) => ({ symbol: s.symbol, marketType: s.marketType })));
};

const readBadgeText = async (page: Page, symbol: string): Promise<string> => {
  return page.getByTestId(`tab-pct-${symbol}`).innerText();
};

const expectBadgePctClose = async (page: Page, symbol: string, expectedPct: number): Promise<void> => {
  await expect.poll(
    async () => parseFloat((await readBadgeText(page, symbol)).replace('%', '').replace('+', '')),
    { timeout: 5_000, intervals: [100, 200, 400] },
  ).toBeCloseTo(expectedPct, 1);
};

test.describe('SymbolTabBar — daily-change badges update from socket price:update events', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: 'BTCUSDT', interval: '1h' });

    await installTrpcMock(page, {
      klines,
      overrides: {
        'wallet.list': () => [
          {
            id: 'e2e-wallet',
            userId: 'e2e-user',
            name: 'E2E Wallet',
            walletType: 'live',
            marketType: 'FUTURES',
            currentBalance: '1000',
            totalDeposits: '1000',
            totalWithdrawals: '0',
            isActive: true,
            currency: 'USDT',
            exchange: 'BINANCE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        'wallet.listActive': () => [
          {
            id: 'e2e-wallet',
            userId: 'e2e-user',
            name: 'E2E Wallet',
            walletType: 'live',
            marketType: 'FUTURES',
            currentBalance: '1000',
            totalDeposits: '1000',
            totalWithdrawals: '0',
            isActive: true,
            currency: 'USDT',
            exchange: 'BINANCE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        'ticker.getDailyBatch': (input: unknown) => {
          const requested = (input as { symbols?: string[] })?.symbols ?? [];
          return SEEDS
            .filter((s) => requested.includes(s.symbol))
            .map((s) => ({
              symbol: s.symbol,
              dailyOpen: s.open,
              lastPrice: s.lastPrice,
              openTime: Date.now() - 6 * 60 * 60 * 1000,
            }));
        },
      },
    });

    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
    await seedSymbolTabs(page, SEEDS);
    await setWsConnected(page, true);
    await waitForSocket(page, { event: 'price:update' });
    await waitForFrames(page, 5);
  });

  test('initial percentages render from REST snapshot for non-active tabs', async ({ page }) => {
    // BTCUSDT is the active tab — its priceStore entry gets written by the chart's
    // useChartCanvas effect using the kline-close value, which in this fixture is
    // randomized (generateKlines), so it deliberately diverges from REST lastPrice.
    // Production behavior matches: chart-source price wins for the active symbol.
    await expectBadgePctClose(page, 'ETHUSDT', 1.0);
    await expectBadgePctClose(page, 'SOLUSDT', 0.5);
  });

  test('non-active tab badges update when price:update arrives via socket', async ({ page }) => {
    await expectBadgePctClose(page, 'ETHUSDT', 1.0);
    await expectBadgePctClose(page, 'SOLUSDT', 0.5);

    await emitSocketEvent(page, 'price:update', { symbol: 'ETHUSDT', price: 3_060, timestamp: Date.now() });
    await emitSocketEvent(page, 'price:update', { symbol: 'SOLUSDT', price: 95, timestamp: Date.now() });

    await expectBadgePctClose(page, 'ETHUSDT', 2.0);
    await expectBadgePctClose(page, 'SOLUSDT', -5.0);
  });

  // The active tab's priceStore entry is written by the chart's useChartCanvas effect
  // using the kline-close value. In production, kline-close === latest trade tick === the
  // value our WS price:update would set, so both flows agree. In E2E with random kline
  // fixtures (generateKlines), the chart's value deliberately diverges from REST
  // lastPrice — so we don't assert on the active tab's pct here. The user's reported
  // regression was that non-active tabs froze; those are exhaustively covered above
  // and below.

  test('non-active tabs in a multi-symbol price:update burst all update independently', async ({ page }) => {
    await expectBadgePctClose(page, 'ETHUSDT', 1.0);
    await expectBadgePctClose(page, 'SOLUSDT', 0.5);

    await emitSocketEvent(page, 'price:update', { symbol: 'BTCUSDT', price: 50_500, timestamp: Date.now() });
    await emitSocketEvent(page, 'price:update', { symbol: 'ETHUSDT', price: 3_090, timestamp: Date.now() });
    await emitSocketEvent(page, 'price:update', { symbol: 'SOLUSDT', price: 102, timestamp: Date.now() });

    await expectBadgePctClose(page, 'ETHUSDT', 3.0);
    await expectBadgePctClose(page, 'SOLUSDT', 2.0);
  });

  test('subsequent price:update events keep updating the badge over time', async ({ page }) => {
    await emitSocketEvent(page, 'price:update', { symbol: 'ETHUSDT', price: 3_060, timestamp: Date.now() });
    await expectBadgePctClose(page, 'ETHUSDT', 2.0);

    await emitSocketEvent(page, 'price:update', { symbol: 'ETHUSDT', price: 3_090, timestamp: Date.now() });
    await expectBadgePctClose(page, 'ETHUSDT', 3.0);

    await emitSocketEvent(page, 'price:update', { symbol: 'ETHUSDT', price: 2_970, timestamp: Date.now() });
    await expectBadgePctClose(page, 'ETHUSDT', -1.0);
  });
});
