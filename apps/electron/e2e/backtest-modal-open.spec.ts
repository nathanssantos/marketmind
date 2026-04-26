import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady } from './helpers/chartTestSetup';

test.describe('Backtest modal — open / close from toolbar', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 200, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('toolbar button opens the modal and close button hides it', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Backtest', exact: true });
    await expect(trigger).toBeVisible();

    await expect(page.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);

    await trigger.click();

    const dialog = page.getByRole('dialog', { name: 'Backtest' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Backtest configuration coming soon.')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Backtest' })).toHaveCount(0);
  });
});
