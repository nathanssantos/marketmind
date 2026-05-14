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
  currentBalance: '10000',
  totalDeposits: '0',
  totalWithdrawals: '0',
  currency: 'USDT',
  apiKeyEncrypted: 'enc',
  apiSecretEncrypted: 'enc',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}];

const SNAPSHOTS_FIXTURE = [
  { id: 42, snapshotAt: '2026-04-29T10:00:00.000Z' },
  { id: 41, snapshotAt: '2026-04-28T10:00:00.000Z' },
  { id: 40, snapshotAt: '2026-04-27T10:00:00.000Z' },
];

const openLayoutsSection = async (page: Page) => {
  // Settings is a top-level toolbar button — Account-menu → Settings
  // menuitem was the old path before the toolbar refactor.
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('tab', { name: 'Data' }).click();
  await expect(page.getByText('Layout History')).toBeVisible();
};

test.describe('Settings → Data — Layout History (V1_5 B.1)', () => {
  test('renders empty state when there are no snapshots', async ({ page }) => {
    await installTrpcMock(page, {
      klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
      overrides: {
        'wallet.list': () => WALLET_FIXTURE,
        'wallet.listActive': () => WALLET_FIXTURE,
        'layout.listSnapshots': () => [],
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await openLayoutsSection(page);

    await expect(
      page.getByText('No snapshots yet — the first one is created the next day after you change your layout.'),
    ).toBeVisible();
  });

  test('lists snapshots and shows a restore button per row', async ({ page }) => {
    await installTrpcMock(page, {
      klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
      overrides: {
        'wallet.list': () => WALLET_FIXTURE,
        'wallet.listActive': () => WALLET_FIXTURE,
        'layout.listSnapshots': () => SNAPSHOTS_FIXTURE,
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await openLayoutsSection(page);

    for (const snap of SNAPSHOTS_FIXTURE) {
      await expect(page.getByTestId(`layout-snapshot-restore-${snap.id}`)).toBeVisible();
    }
  });

  test('restoring a snapshot fires the mutation and confirms via toast', async ({ page }) => {
    const restoreRequests: Array<{ url: string; body: string }> = [];
    page.on('request', (req) => {
      if (req.url().includes('layout.restoreSnapshot')) {
        restoreRequests.push({ url: req.url(), body: req.postData() ?? '' });
      }
    });

    await installTrpcMock(page, {
      klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
      overrides: {
        'wallet.list': () => WALLET_FIXTURE,
        'wallet.listActive': () => WALLET_FIXTURE,
        'layout.listSnapshots': () => SNAPSHOTS_FIXTURE,
        // Don't override layout.get — let the renderer fall through to its
        // default state (1 tab + 3 presets with real panels). Overriding
        // with empty grids would make the chart canvas never mount and
        // waitForChartReady would time out.
        'layout.restoreSnapshot': () => ({ success: true }),
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await openLayoutsSection(page);

    await page.getByTestId('layout-snapshot-restore-42').click();

    const confirmHeading = page.getByText('Restore this layout snapshot?');
    await expect(confirmHeading).toBeVisible();

    // Two dialogs now — Settings + confirmation. Scope confirm click to the
    // confirmation dialog by anchoring on its heading's nearest dialog ancestor.
    const confirmDialog = page.getByRole('dialog').filter({ hasText: 'Restore this layout snapshot?' });
    await confirmDialog.getByRole('button', { name: 'Restore', exact: true }).click();

    await expect(page.getByText('Layout restored')).toBeVisible({ timeout: 5_000 });

    expect(restoreRequests.length).toBeGreaterThan(0);
    const lastBody = restoreRequests[restoreRequests.length - 1]?.body ?? '';
    expect(lastBody).toContain('"snapshotId":42');
  });
});
