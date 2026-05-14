import type { MarketType } from '@marketmind/types';
import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';

interface MockWallet {
  id: string;
  name: string;
  walletType: 'paper' | 'testnet' | 'live';
  marketType: MarketType;
  currency: string;
  exchange: string;
  initialBalance: string;
  currentBalance: string;
  totalWalletBalance: string | null;
  totalDeposits: string;
  totalWithdrawals: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const makePaperWallet = (overrides: Partial<MockWallet> = {}): MockWallet => ({
  id: `wallet_${Math.random().toString(36).slice(2, 10)}`,
  name: 'Paper Trader',
  walletType: 'paper',
  marketType: 'FUTURES',
  currency: 'USDT',
  exchange: 'BINANCE',
  initialBalance: '10000',
  currentBalance: '10000',
  totalWalletBalance: '10000',
  totalDeposits: '0',
  totalWithdrawals: '0',
  isActive: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...overrides,
});

test.describe('Wallet Selector E2E', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, {
      klines,
      overrides: { 'wallet.list': () => [] },
    });
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('shows "No wallets created" placeholder with empty wallet list', async ({ page }) => {
    await expect(page.getByText('No wallets created')).toBeVisible();
  });

  test('hides Active Wallet button when no wallets exist', async ({ page }) => {
    const walletButton = page.getByRole('button', { name: 'Active Wallet' });
    await expect(walletButton).toHaveCount(0);
  });
});

test.describe('Wallet Selector with existing wallet E2E', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, {
      klines,
      overrides: {
        'wallet.list': () => [makePaperWallet({ name: 'E2E Paper Wallet' })],
      },
    });
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('shows wallet name in selector button', async ({ page }) => {
    const walletButton = page.getByRole('button', { name: 'Active Wallet' });
    await expect(walletButton).toBeVisible();
    await expect(walletButton).toContainText('E2E Paper Wallet');
  });

  test('opens popover with Crypto section on click', async ({ page }) => {
    await page.getByRole('button', { name: 'Active Wallet' }).click();
    const popover = page.locator('[data-scope="popover"][data-part="content"]');
    await expect(popover.getByText('Crypto', { exact: true })).toBeVisible();
    await expect(popover.getByText('E2E Paper Wallet')).toBeVisible();
  });
});

test.describe('Wallet Creation E2E', () => {
  test('creates paper wallet via Settings → Wallets and it appears in selector', async ({ page }) => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    const walletList: MockWallet[] = [];
    await installTrpcMock(page, {
      klines,
      overrides: {
        'wallet.list': () => [...walletList],
        'wallet.createPaper': (input: unknown) => {
          const { name, initialBalance, currency } =
            input as { name: string; initialBalance?: string; currency?: string };
          const wallet = makePaperWallet({
            name,
            initialBalance: initialBalance ?? '10000',
            currentBalance: initialBalance ?? '10000',
            currency: currency ?? 'USDT',
          });
          walletList.push(wallet);
          return wallet;
        },
      },
    });

    await page.goto('/');
    await waitForChartReady(page);

    // Settings is a top-level toolbar button — Account-menu → Settings
    // menuitem was the old path before the toolbar refactor.
    await page.getByRole('button', { name: 'Settings' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('tab', { name: 'Wallets' }).click();

    await page.getByRole('button', { name: 'Create Wallet', exact: true }).first().click();
    await expect(page.getByText('Create New Wallet')).toBeVisible();

    const nameInput = page.getByRole('textbox').filter({ hasText: '' }).first();
    await nameInput.fill('E2E Created Wallet');

    await page.getByRole('button', { name: 'Create Wallet', exact: true }).last().click();

    await expect(page.getByText('E2E Created Wallet').first()).toBeVisible();
    expect(walletList).toHaveLength(1);
    expect(walletList[0]?.name).toBe('E2E Created Wallet');
  });
});

test.describe('Authentication pages E2E', () => {
  test('/login renders email, password, and submit controls', async ({ page }) => {
    await installTrpcMock(page);
    await page.goto('/login');

    await expect(page.getByText('Sign In', { exact: false }).first()).toBeVisible();
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
  });

  test('clicking Create account navigates to /register', async ({ page }) => {
    await installTrpcMock(page);
    await page.goto('/login');

    await page.getByRole('link', { name: /create account|sign up/i }).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });
});
