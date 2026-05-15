import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';
import { openToolsItem } from './helpers/toolsMenu';

test.describe('Backtest modal — open / close from toolbar', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('toolbar button opens the modal with the form, escape closes it', async ({ page }) => {
    await expect(page.locator('[data-testid="toolbar-tools-button"]')).toBeVisible();

    await expect(page.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);

    await openToolsItem(page, 'backtest');

    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await expect(dialog).toBeVisible();

    // Form tabs visible
    await expect(dialog.getByRole('tab', { name: 'Basic' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Strategies' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Filters' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Risk' })).toBeVisible();

    // Submit button rendered
    await expect(dialog.getByRole('button', { name: 'Run backtest' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);
  });

  test('Cmd+Shift+B keyboard shortcut toggles the modal', async ({ page }) => {
    await expect(page.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);

    const isMac = process.platform === 'darwin';
    const modifier = isMac ? 'Meta' : 'Control';

    await page.keyboard.press(`${modifier}+Shift+KeyB`);

    await expect(page.getByRole('dialog', { name: 'Backtest' })).toBeVisible();

    await page.keyboard.press(`${modifier}+Shift+KeyB`);
    await expect(page.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);
  });
});
