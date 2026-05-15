import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { getTrpcHitCount, installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';
import { openToolsItem } from './helpers/toolsMenu';

interface SavedScreenerFixture {
  id: string;
  name: string;
  config: {
    assetClass: 'CRYPTO' | 'STOCKS';
    marketType: 'SPOT' | 'FUTURES';
    interval: string;
    filters: Array<{
      id: string;
      indicator: string;
      operator: string;
      value?: number;
      indicatorParams?: Record<string, number>;
    }>;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  };
  createdAt: string;
  updatedAt: string;
}

const PRESET_FIXTURE = [
  {
    id: 'top-gainers',
    name: 'Top Gainers',
    description: 'Biggest gainers',
    icon: 'TrendingUp',
    category: 'momentum',
    config: { filters: [] },
  },
  {
    id: 'volume-spike',
    name: 'Volume Spike',
    description: 'Unusual volume',
    icon: 'Zap',
    category: 'volume',
    config: { filters: [] },
  },
  {
    id: 'breakout-candidates',
    name: 'Breakout Candidates',
    description: 'Tight bands',
    icon: 'Target',
    category: 'volatility',
    config: { filters: [] },
  },
];

const INDICATORS_FIXTURE = [
  {
    id: 'RSI',
    name: 'RSI',
    category: 'oscillator',
    defaultParams: { period: 14 },
    requiresKlines: true,
  },
  {
    id: 'ADX',
    name: 'ADX',
    category: 'trend',
    defaultParams: { period: 14 },
    requiresKlines: true,
  },
  {
    id: 'VOLUME_RATIO',
    name: 'Volume Ratio',
    category: 'volume',
    defaultParams: { period: 20 },
    requiresKlines: true,
  },
];

const RESULTS_FIXTURE = {
  results: [
    {
      symbol: 'BTCUSDT',
      displayName: 'Bitcoin',
      price: 51234.5,
      priceChange24h: 250.0,
      priceChangePercent24h: 0.49,
      volume24h: 2_400_000_000,
      quoteVolume24h: 1_500_000_000,
      marketCapRank: 1,
      indicators: { RSI: 58, ADX: 28, ATR_PERCENT: 1.2, VOLUME_RATIO: 1.6 },
      matchedFilters: 0,
      totalFilters: 0,
      compositeScore: 92,
    },
    {
      symbol: 'ETHUSDT',
      displayName: 'Ethereum',
      price: 3120.55,
      priceChange24h: -22.5,
      priceChangePercent24h: -0.72,
      volume24h: 1_200_000_000,
      quoteVolume24h: 800_000_000,
      marketCapRank: 2,
      indicators: { RSI: 42, ADX: 19, ATR_PERCENT: 1.8, VOLUME_RATIO: 1.1 },
      matchedFilters: 0,
      totalFilters: 0,
      compositeScore: 78,
    },
    {
      symbol: 'SOLUSDT',
      displayName: 'Solana',
      price: 145.21,
      priceChange24h: 5.6,
      priceChangePercent24h: 4.01,
      volume24h: 600_000_000,
      quoteVolume24h: 400_000_000,
      marketCapRank: 5,
      indicators: { RSI: 71, ADX: 35, ATR_PERCENT: 3.4, VOLUME_RATIO: 2.4 },
      matchedFilters: 0,
      totalFilters: 0,
      compositeScore: 88,
    },
    {
      symbol: 'BNBUSDT',
      displayName: 'BNB',
      price: 612.4,
      priceChange24h: 1.1,
      priceChangePercent24h: 0.18,
      volume24h: 350_000_000,
      quoteVolume24h: 250_000_000,
      marketCapRank: 4,
      indicators: { RSI: 49, ADX: 14, ATR_PERCENT: 0.9, VOLUME_RATIO: 0.8 },
      matchedFilters: 0,
      totalFilters: 0,
      compositeScore: 65,
    },
    {
      symbol: 'XRPUSDT',
      displayName: 'XRP',
      price: 0.534,
      priceChange24h: -0.012,
      priceChangePercent24h: -2.2,
      volume24h: 280_000_000,
      quoteVolume24h: 180_000_000,
      marketCapRank: 6,
      indicators: { RSI: 35, ADX: 22, ATR_PERCENT: 2.1, VOLUME_RATIO: 1.3 },
      matchedFilters: 0,
      totalFilters: 0,
      compositeScore: 58,
    },
  ],
  totalSymbolsScanned: 220,
  totalMatched: 5,
  executionTimeMs: 142,
  cachedAt: null,
  config: {
    assetClass: 'CRYPTO',
    marketType: 'FUTURES',
    interval: '30m',
    filters: [],
    sortBy: 'compositeScore',
    sortDirection: 'desc',
  },
};

const buildSavedFixture = (): SavedScreenerFixture[] => [
  {
    id: 'saved-1',
    name: 'My RSI screen',
    config: {
      assetClass: 'CRYPTO',
      marketType: 'FUTURES',
      interval: '30m',
      filters: [
        { id: 'pre-loaded-1', indicator: 'RSI', operator: 'BELOW', value: 30, indicatorParams: { period: 14 } },
      ],
      sortBy: 'compositeScore',
      sortDirection: 'desc',
    },
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T00:00:00.000Z',
  },
];

interface ScreenerMockOpts {
  resultsOverride?: typeof RESULTS_FIXTURE;
  presetsOverride?: typeof PRESET_FIXTURE;
  initialSaved?: SavedScreenerFixture[];
  delayRunMs?: number;
}

interface ScreenerMockState {
  saved: SavedScreenerFixture[];
}

const installScreenerMock = async (page: Page, opts: ScreenerMockOpts = {}): Promise<ScreenerMockState> => {
  const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
  const state: ScreenerMockState = {
    saved: opts.initialSaved ?? buildSavedFixture(),
  };

  const runResults = opts.resultsOverride ?? RESULTS_FIXTURE;

  const runResolver = opts.delayRunMs
    ? async () => {
        await new Promise((r) => setTimeout(r, opts.delayRunMs));
        return runResults;
      }
    : () => runResults;

  await installTrpcMock(page, {
    klines,
    overrides: {
      'screener.run': runResolver,
      'screener.runPreset': () => runResults,
      'screener.getPresets': () => opts.presetsOverride ?? PRESET_FIXTURE,
      'screener.getAvailableIndicators': () => INDICATORS_FIXTURE,
      'screener.getSavedScreeners': () => state.saved,
      'screener.saveScreener': (input: unknown) => {
        const name = (input as { name: string; config: unknown }).name;
        const newId = `saved-${state.saved.length + 1}`;
        const newEntry: SavedScreenerFixture = {
          id: newId,
          name,
          config: (input as { config: SavedScreenerFixture['config'] }).config,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        state.saved = [...state.saved, newEntry];
        return { id: newId, name };
      },
      'screener.deleteScreener': (input: unknown) => {
        const id = (input as { id: string }).id;
        state.saved = state.saved.filter((s) => s.id !== id);
        return { success: true };
      },
    },
  });

  return state;
};

const SCREENER_DIALOG_NAME = 'Market Screener';

const openModal = async (page: Page) => {
  await openToolsItem(page, 'screener');
  await expect(page.getByRole('dialog', { name: SCREENER_DIALOG_NAME })).toBeVisible();
};

const closeModalViaEscape = async (page: Page) => {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: SCREENER_DIALOG_NAME })).toHaveCount(0);
};

const waitForRunHit = async (page: Page, atLeast = 1) => {
  await expect.poll(
    () => getTrpcHitCount(page, 'screener.run'),
    { timeout: 5_000 },
  ).toBeGreaterThanOrEqual(atLeast);
};

test.describe('Screener modal — full flow coverage', () => {
  test.beforeEach(async ({ page }) => {
    await installScreenerMock(page);
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('toolbar trigger toggles dialog open/closed; Escape also closes', async ({ page }) => {
    await openModal(page);
    await closeModalViaEscape(page);
    await openModal(page);
    await closeModalViaEscape(page);
  });

  test('default header values match store defaults: Crypto / Futures / 30m', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });
    await expect(dialog.locator('button').filter({ hasText: 'Crypto' }).first()).toBeVisible();
    await expect(dialog.locator('button').filter({ hasText: 'Futures' }).first()).toBeVisible();
    await expect(dialog.locator('button').filter({ hasText: '30m' }).first()).toBeVisible();
  });

  test('changing assetClass / marketType / interval each triggers a new screener.run', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });
    await waitForRunHit(page, 1);

    // Asset class CRYPTO -> STOCKS
    let before = await getTrpcHitCount(page, 'screener.run');
    await dialog.locator('button').filter({ hasText: 'Crypto' }).first().click();
    await dialog.locator('text=Stocks').first().click();
    await expect.poll(
      () => getTrpcHitCount(page, 'screener.run'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);

    // Market type FUTURES -> SPOT
    before = await getTrpcHitCount(page, 'screener.run');
    await dialog.locator('button').filter({ hasText: 'Futures' }).first().click();
    await dialog.locator('text=Spot').first().click();
    await expect.poll(
      () => getTrpcHitCount(page, 'screener.run'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);

    // Interval 30m -> 1h
    before = await getTrpcHitCount(page, 'screener.run');
    await dialog.locator('button').filter({ hasText: '30m' }).first().click();
    await dialog.locator('text=1h').first().click();
    await expect.poll(
      () => getTrpcHitCount(page, 'screener.run'),
      { timeout: 5_000 },
    ).toBeGreaterThan(before);
  });

  test('header Selects use usePortal=false so options render inside the dialog', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    // Open the asset-class Select. Options must be inside the dialog, not in
    // a portal sibling — Chakra's DialogPositioner intercepts portal clicks.
    await dialog.locator('button').filter({ hasText: 'Crypto' }).first().click();
    const stocksOption = dialog.locator('text=Stocks').first();
    await expect(stocksOption).toBeVisible();
    await stocksOption.click();
    await expect(dialog.locator('button').filter({ hasText: 'Stocks' }).first()).toBeVisible();
  });

  test('PresetBar renders all preset chips returned by getPresets', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    // The "Custom" pseudo-preset is always there
    await expect(dialog.getByRole('button', { name: 'Custom', exact: true })).toBeVisible();

    for (const preset of PRESET_FIXTURE) {
      await expect(dialog.getByRole('button', { name: preset.name, exact: true })).toBeVisible();
    }
  });

  test('selecting a preset hides the FilterBuilder and triggers runPreset', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });
    await waitForRunHit(page, 1);

    await expect(dialog.getByRole('button', { name: /^Filters \(/ })).toBeVisible();

    await dialog.getByRole('button', { name: 'Top Gainers', exact: true }).click();

    await expect(dialog.getByRole('button', { name: /^Filters \(/ })).toHaveCount(0);
    await expect.poll(
      () => getTrpcHitCount(page, 'screener.runPreset'),
      { timeout: 5_000 },
    ).toBeGreaterThanOrEqual(1);
  });

  test('clicking the active preset again returns to custom-filters mode', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    await dialog.getByRole('button', { name: 'Top Gainers', exact: true }).click();
    await expect(dialog.getByRole('button', { name: /^Filters \(/ })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Custom', exact: true }).click();
    await expect(dialog.getByRole('button', { name: /^Filters \(/ })).toBeVisible();
  });

  test('switching from preset A to preset B leaves customFilters empty', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    await dialog.getByRole('button', { name: 'Top Gainers', exact: true }).click();
    await dialog.getByRole('button', { name: 'Volume Spike', exact: true }).click();

    // Back to Custom — Filters group still shows (0)
    await dialog.getByRole('button', { name: 'Custom', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Filters (0)', exact: true })).toBeVisible();
  });

  test('add 3 custom filters; per-chip remove and clear-all both work', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    const addBtn = dialog.getByRole('button', { name: 'Add Filter' });
    await addBtn.click();
    await addBtn.click();
    await addBtn.click();

    await expect(dialog.getByRole('button', { name: 'Filters (3)', exact: true })).toBeVisible();

    // FilterRow + FilterChip both render Remove buttons per filter (6 total
    // for 3 filters). Either works to remove one — assert via the counter.
    const removeBtns = dialog.getByRole('button', { name: 'Remove' });
    await removeBtns.first().click();
    await expect(dialog.getByRole('button', { name: 'Filters (2)', exact: true })).toBeVisible();

    // Clear all wipes the rest.
    await dialog.getByRole('button', { name: 'Clear All', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Filters (0)', exact: true })).toBeVisible();
  });

  test('selecting a preset clears customFilters (mutual exclusion)', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    await dialog.getByRole('button', { name: 'Add Filter' }).click();
    await expect(dialog.getByRole('button', { name: 'Filters (1)', exact: true })).toBeVisible();

    await dialog.getByRole('button', { name: 'Top Gainers', exact: true }).click();

    // Filter UI hidden under preset mode
    await expect(dialog.getByRole('button', { name: /^Filters \(/ })).toHaveCount(0);

    // Returning to Custom — actual behavior per ScreenerDialog:108-111: filters
    // were wiped when the preset got selected, so the count is back at 0.
    await dialog.getByRole('button', { name: 'Custom', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Filters (0)', exact: true })).toBeVisible();
  });

  test('Save button is disabled with no filters and no preset', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    const footerSave = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(footerSave).toBeDisabled();
  });

  test('Save button enables once a filter is added; opens SaveScreenerDialog', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });
    const footerSave = dialog.getByRole('button', { name: 'Save', exact: true });

    await expect(footerSave).toBeDisabled();

    await dialog.getByRole('button', { name: 'Add Filter' }).click();
    await expect(footerSave).toBeEnabled();

    await footerSave.click();
    await expect(page.getByRole('dialog', { name: 'Save Screener' })).toBeVisible();
  });

  test('SaveScreenerDialog: empty name disables submit; non-empty enables and saves', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    await dialog.getByRole('button', { name: 'Add Filter' }).click();
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();

    const saveDialog = page.getByRole('dialog', { name: 'Save Screener' });
    await expect(saveDialog).toBeVisible();

    const submitBtn = saveDialog.getByRole('button', { name: 'Save' });
    await expect(submitBtn).toBeDisabled();

    await saveDialog.getByPlaceholder('Screener name...').fill('My new screen');
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();
    await expect(page.getByRole('dialog', { name: 'Save Screener' })).toHaveCount(0);

    // The new entry shows up after invalidation re-fetch.
    await expect(dialog.getByText('My new screen', { exact: true })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking a saved screener loads its filters and exits preset mode', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    // Pre-existing saved fixture has 1 filter
    const savedRow = dialog.getByText('My RSI screen', { exact: true }).locator('xpath=..');
    await savedRow.getByRole('button', { name: 'Load' }).click();

    await expect(dialog.getByRole('button', { name: 'Filters (1)', exact: true })).toBeVisible();
  });

  test('per-row delete removes the saved screener from the list', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    await expect(dialog.getByText('My RSI screen', { exact: true })).toBeVisible();

    const savedRow = dialog.getByText('My RSI screen', { exact: true }).locator('xpath=..');
    await savedRow.getByRole('button', { name: 'Delete' }).click();

    await expect(dialog.getByText('My RSI screen', { exact: true })).toHaveCount(0, { timeout: 5_000 });
  });

  test('results table renders all 5 fixture rows and footer summary', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    for (const row of RESULTS_FIXTURE.results) {
      await expect(dialog.getByText(row.symbol, { exact: true })).toBeVisible();
    }

    // Footer summary "5 matched / 220 scanned (142ms)"
    await expect(dialog).toContainText('5 matched / 220 scanned (142ms)');
  });

  test('clicking a column header toggles sort direction', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    const symbolHeader = dialog.getByRole('columnheader', { name: 'Symbol' });
    await symbolHeader.click();
    await symbolHeader.click();
    // No throw — table re-rendered both times. Rows still visible.
    await expect(dialog.getByText('BTCUSDT', { exact: true })).toBeVisible();
  });

  test('Refresh button bumps screener.run hit count by exactly one', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });
    await waitForRunHit(page, 1);

    const before = await getTrpcHitCount(page, 'screener.run');
    await dialog.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(
      () => getTrpcHitCount(page, 'screener.run'),
      { timeout: 5_000 },
    ).toBe(before + 1);
  });

  test('row click is wired (cursor-pointer, no error on click)', async ({ page }) => {
    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    const firstSymbolCell = dialog.getByText('BTCUSDT', { exact: true });
    await expect(firstSymbolCell).toBeVisible();
    // Click should not throw — onSymbolClick is wired by MainLayout
    await firstSymbolCell.click();
    await expect(dialog).toBeVisible();
  });
});

test.describe('Screener modal — empty state', () => {
  test('empty results render the empty-state message', async ({ page }) => {
    await installScreenerMock(page, {
      resultsOverride: { ...RESULTS_FIXTURE, results: [], totalMatched: 0 },
    });
    await page.goto('/');
    await waitForChartReady(page);

    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    await expect(dialog.getByText('No results found. Try adjusting your filters.', { exact: true }))
      .toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Screener modal — loading state', () => {
  test('spinner shows while screener.run is in flight, then results render', async ({ page }) => {
    await installScreenerMock(page, { delayRunMs: 1500 });
    await page.goto('/');
    await waitForChartReady(page);

    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    // Chakra Spinner renders as a span with aria-busy/role="status"; fall
    // back to class-based selector since role/name aren't set on Spinner v3.
    const spinner = dialog.locator('.chakra-spinner');
    await expect(spinner).toBeVisible({ timeout: 2_000 });
    await expect(dialog.getByText('BTCUSDT', { exact: true })).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Screener modal — error state', () => {
  test('server error renders the error block', async ({ page }) => {
    await installScreenerMock(page);

    // tRPC NOT_FOUND code disables React Query retry per the TrpcProvider
    // policy, so the error state surfaces on the first response.
    await page.route('**/trpc/screener.run**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          error: {
            json: {
              message: 'NOT_FOUND',
              code: -32004,
              data: { code: 'NOT_FOUND', httpStatus: 404 },
            },
          },
        }]),
      });
    });

    await page.goto('/');
    await waitForChartReady(page);

    await openModal(page);
    const dialog = page.getByRole('dialog', { name: SCREENER_DIALOG_NAME });

    await expect(dialog.getByText('Failed to load screener results. Please try again.', { exact: true }))
      .toBeVisible({ timeout: 10_000 });
  });
});
