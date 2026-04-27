import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';

const installSettingsMock = (page: Page) =>
  installTrpcMock(page, {
    klines: generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' }),
  });

const openSettings = async (page: Page, tab?: string) => {
  await page.waitForFunction(() => typeof window.__globalActions !== 'undefined');
  await page.evaluate((t) => {
    window.__globalActions?.openSettings(t);
  }, tab);
  await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 10_000 });
};

test.describe('Settings overhaul', () => {
  test.beforeEach(async ({ page }) => {
    await installSettingsMock(page);
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('opens with the default Account tab', async ({ page }) => {
    await openSettings(page);
    await expect(page.getByTestId('account-name-input')).toBeVisible();
  });

  test('opens directly on a requested tab via openSettings(tab)', async ({ page }) => {
    await openSettings(page, 'security');
    await expect(page.getByTestId('security-current-password')).toBeVisible();
  });

  test('shows the four section labels in the rail', async ({ page }) => {
    await openSettings(page);
    const rail = page.getByTestId('settings-rail');
    await expect(rail.getByText('Account', { exact: true }).first()).toBeVisible();
    await expect(rail.getByText('Appearance', { exact: true })).toBeVisible();
    await expect(rail.getByText('Trading', { exact: true })).toBeVisible();
    await expect(rail.getByText('System', { exact: true })).toBeVisible();
  });

  test('renders an icon-prefixed trigger for every tab', async ({ page }) => {
    await openSettings(page);
    const tabs = [
      'account', 'security', 'notifications',
      'general', 'chart',
      'wallets', 'tradingProfiles', 'autoTrading', 'indicators', 'customSymbols',
      'data', 'updates', 'about',
    ];
    for (const id of tabs) {
      await expect(page.getByTestId(`settings-tab-${id}`)).toBeVisible();
    }
  });

  test('Account tab: name input shows current name', async ({ page }) => {
    await openSettings(page, 'account');
    const input = page.getByTestId('account-name-input');
    await expect(input).toHaveValue('E2E Test User');
  });

  test('Account tab: avatar color swatches are clickable', async ({ page }) => {
    await openSettings(page, 'account');
    const swatch = page.getByTestId('avatar-color-#10B981');
    await expect(swatch).toBeVisible();
    await swatch.click();
  });

  test('Security tab: change password submit is disabled until form is valid', async ({ page }) => {
    await openSettings(page, 'security');
    const submit = page.getByTestId('security-change-password-submit');
    await expect(submit).toBeDisabled();

    await page.getByTestId('security-current-password').fill('current-pass');
    await page.getByTestId('security-new-password').fill('newpass123');
    await page.getByTestId('security-confirm-password').fill('newpass123');
    await expect(submit).toBeEnabled();
  });

  test('Security tab: shows the current session in the sessions list', async ({ page }) => {
    await openSettings(page, 'security');
    await expect(page.getByText('Chrome on macOS')).toBeVisible();
  });

  test('Notifications tab: shows the three switches', async ({ page }) => {
    await openSettings(page, 'notifications');
    await expect(page.getByTestId('notifications-order-toasts')).toBeVisible();
    await expect(page.getByTestId('notifications-setup-toasts')).toBeVisible();
    await expect(page.getByTestId('notifications-sound-enabled')).toBeVisible();
  });

  test('Updates tab: renders auto-check / auto-download / check-now controls', async ({ page }) => {
    await openSettings(page, 'updates');
    await expect(page.getByTestId('updates-auto-check')).toBeVisible();
    await expect(page.getByTestId('updates-auto-download')).toBeVisible();
    await expect(page.getByTestId('updates-check-now')).toBeVisible();
  });

  test('rail navigation: clicking a tab swaps the right pane', async ({ page }) => {
    await openSettings(page);
    await page.getByTestId('settings-tab-about').click();
    await expect(page.getByText('MarketMind', { exact: true }).first()).toBeVisible();
  });

  test('Chart tab: renders the palette swatches', async ({ page }) => {
    await openSettings(page, 'chart');
    await expect(page.getByTestId('chart-palette-default')).toBeVisible();
  });

  test('Data tab: renders the repair button and storage controls', async ({ page }) => {
    await openSettings(page, 'data');
    await expect(page.getByTestId('data-repair-all')).toBeVisible();
    await expect(page.getByTestId('data-clear-storage')).toBeVisible();
  });
});
