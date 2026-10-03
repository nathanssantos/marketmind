import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import {
  EMBEDDED_BOOT_TIMEOUT_MS,
  createUserDataDir,
  launchEmbeddedApp,
  removeUserDataDir,
  waitForRendererWindow,
} from './embedded-launch';

const ACCOUNT_EMAIL = 'paper-trading-e2e@marketmind.test';
const ACCOUNT_PASSWORD = 'PaperTrading#2026x';
const WALLET_NAME = 'Paper E2E';
const SPOT_WALLET_NAME = 'Paper Spot E2E';
const UI_TIMEOUT_MS = 30_000;

const registerAccount = async (page: Page): Promise<void> => {
  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Email' }).fill(ACCOUNT_EMAIL);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill(ACCOUNT_PASSWORD);
  await page.getByRole('textbox', { name: 'Confirm password' }).fill(ACCOUNT_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.getByText('Continue without verifying').click();
  await expect(page.getByText('No wallets created').first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
};

const createPaperWallet = async (page: Page): Promise<void> => {
  await page.getByText('No wallets created').first().click();
  await page.getByRole('button', { name: 'Create Wallet' }).click();
  const createDialog = page.getByRole('dialog').last();
  await createDialog.getByPlaceholder('My Wallet').fill(WALLET_NAME);
  await createDialog.getByRole('button', { name: 'Create Wallet' }).click();
  await expect(page.getByRole('dialog').getByText(WALLET_NAME)).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

const createSpotWalletAndSelectIt = async (page: Page): Promise<void> => {
  await page.getByText(WALLET_NAME).first().click();
  await page.getByText('Manage wallets').click();
  await page.getByRole('button', { name: 'Create Wallet' }).click();
  const createDialog = page.getByRole('dialog').last();
  await createDialog.getByText('Futures', { exact: true }).click();
  await page.getByText('Spot', { exact: true }).last().click();
  await createDialog.getByPlaceholder('My Wallet').fill(SPOT_WALLET_NAME);
  await createDialog.getByRole('button', { name: 'Create Wallet' }).click();
  await expect(page.getByRole('dialog').getByText(SPOT_WALLET_NAME)).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByText(WALLET_NAME).first().click();
  await page.getByRole('dialog').getByText(SPOT_WALLET_NAME).click();
  await page.keyboard.press('Escape');
  await expect(page.getByText(SPOT_WALLET_NAME).first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

const sendMarketOrder = async (page: Page, side: 'Buy' | 'Sell'): Promise<void> => {
  await page.getByRole('button', { name: new RegExp(`^${side}`) }).first().click();
  await page.getByRole('button', { name: `Confirm ${side}` }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: UI_TIMEOUT_MS });
};

test.describe.serial('paper trading on the embedded stack', () => {
  let userDataDir: string;
  let app: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    test.setTimeout(EMBEDDED_BOOT_TIMEOUT_MS * 2);
    userDataDir = createUserDataDir();
    app = await launchEmbeddedApp(userDataDir);
    page = await waitForRendererWindow(app);
    await expect(page.locator('input[type="password"]').first()).toBeVisible({ timeout: EMBEDDED_BOOT_TIMEOUT_MS });
    await registerAccount(page);
    await createPaperWallet(page);
  });

  test.afterAll(async () => {
    await app.close();
    removeUserDataDir(userDataDir);
  });

  test('a market buy opens a LONG, an equal sell closes it, and a further sell opens a SHORT', async () => {
    test.setTimeout(EMBEDDED_BOOT_TIMEOUT_MS);
    const positions = page.getByRole('table').filter({ hasText: 'AVG PRICE' });

    await page.getByText('10%', { exact: true }).first().click();
    await sendMarketOrder(page, 'Buy');
    await expect(positions.getByRole('row').filter({ hasText: 'BTCUSDT' }).filter({ hasText: 'Buy' })).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await sendMarketOrder(page, 'Sell');
    await expect(page.getByText('No open positions.').first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(page.getByText('1 trades')).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await sendMarketOrder(page, 'Sell');
    await expect(positions.getByRole('row').filter({ hasText: 'BTCUSDT' }).filter({ hasText: 'Sell' })).toBeVisible({ timeout: UI_TIMEOUT_MS });

    await sendMarketOrder(page, 'Buy');
    await expect(page.getByText('No open positions.').first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(page.getByText('2 trades')).toBeVisible({ timeout: UI_TIMEOUT_MS });
  });

  test('a spot wallet can only sell what it holds, so it never opens a SHORT', async () => {
    test.setTimeout(EMBEDDED_BOOT_TIMEOUT_MS);
    const positions = page.getByRole('table').filter({ hasText: 'AVG PRICE' });
    const sell = page.getByRole('button', { name: /^Sell/ }).first();

    await createSpotWalletAndSelectIt(page);
    await expect(sell).toBeDisabled({ timeout: UI_TIMEOUT_MS });

    await page.getByText('10%', { exact: true }).first().click();
    await sendMarketOrder(page, 'Buy');
    await expect(positions.getByRole('row').filter({ hasText: 'BTCUSDT' }).filter({ hasText: 'SPOT' })).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(sell).toBeEnabled({ timeout: UI_TIMEOUT_MS });

    await sendMarketOrder(page, 'Sell');
    await expect(page.getByText('No open positions.').first()).toBeVisible({ timeout: UI_TIMEOUT_MS });
    await expect(sell).toBeDisabled({ timeout: UI_TIMEOUT_MS });
  });
});
