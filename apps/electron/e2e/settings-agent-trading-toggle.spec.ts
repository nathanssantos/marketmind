import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';

const buildWallet = (id: string, name: string, agentTradingEnabled: boolean) => ({
  id,
  name,
  exchange: 'BINANCE',
  marketType: 'FUTURES',
  walletType: 'paper',
  isActive: true,
  agentTradingEnabled,
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
});

const openSecurityTab = async (page: Page) => {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('tab', { name: 'Security' }).click();
  await expect(page.getByText('AI Agent Trading')).toBeVisible();
};

test.describe('Settings → Security — AI Agent Trading toggle (V1_5 C.1)', () => {
  test('lists each wallet with a toggle reflecting agentTradingEnabled state', async ({ page }) => {
    const wallets = [
      buildWallet('w1', 'Paper Alpha', false),
      buildWallet('w2', 'Paper Beta', true),
    ];
    await installTrpcMock(page, {
      klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
      overrides: {
        'wallet.list': () => wallets,
        'wallet.listActive': () => wallets,
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await openSecurityTab(page);

    const w1Toggle = page.getByTestId('agent-trading-toggle-w1');
    const w2Toggle = page.getByTestId('agent-trading-toggle-w2');
    await expect(w1Toggle).toBeVisible();
    await expect(w2Toggle).toBeVisible();

    // Chakra Switch keeps the underlying input checked-state in sync with
    // the rendered control. Read it instead of the literal `value` attribute
    // (which is always "on" for a checkbox).
    expect(await w1Toggle.locator('input').isChecked()).toBe(false);
    expect(await w2Toggle.locator('input').isChecked()).toBe(true);
  });

  test('enabling fires a confirm dialog before mutating', async ({ page }) => {
    const updateRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('wallet.update')) {
        updateRequests.push(req.postData() ?? '');
      }
    });

    const wallets = [buildWallet('w1', 'Paper Alpha', false)];
    await installTrpcMock(page, {
      klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
      overrides: {
        'wallet.list': () => wallets,
        'wallet.listActive': () => wallets,
        'wallet.update': () => ({ success: true }),
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await openSecurityTab(page);

    // Chakra Switch root is a label wrapping a hidden input; clicking the
    // visible control element rather than the label root is what fires
    // onCheckedChange consistently.
    await page.getByTestId('agent-trading-toggle-w1').locator('[data-part="control"]').click();

    // Confirm dialog renders alongside the Settings dialog. Anchor on the
    // heading text directly to avoid ambiguity between the two dialogs.
    const confirmHeading = page.getByText('Enable agent trading on this wallet?');
    await expect(confirmHeading).toBeVisible();

    expect(updateRequests).toHaveLength(0);

    await page.getByRole('button', { name: 'Enable agent trading', exact: true }).click();

    await expect.poll(() => updateRequests.length).toBeGreaterThan(0);
    expect(updateRequests[0]).toContain('"agentTradingEnabled":true');
    expect(updateRequests[0]).toContain('"id":"w1"');
  });

  test('disabling skips the confirm dialog and updates immediately', async ({ page }) => {
    const updateRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('wallet.update')) {
        updateRequests.push(req.postData() ?? '');
      }
    });

    const wallets = [buildWallet('w1', 'Paper Alpha', true)];
    await installTrpcMock(page, {
      klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
      overrides: {
        'wallet.list': () => wallets,
        'wallet.listActive': () => wallets,
        'wallet.update': () => ({ success: true }),
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
    await openSecurityTab(page);

    // Chakra Switch root is a label wrapping a hidden input; clicking the
    // visible control element rather than the label root is what fires
    // onCheckedChange consistently.
    await page.getByTestId('agent-trading-toggle-w1').locator('[data-part="control"]').click();

    await expect.poll(() => updateRequests.length).toBeGreaterThan(0);
    expect(updateRequests[0]).toContain('"agentTradingEnabled":false');
  });
});
