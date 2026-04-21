import { test, expect } from '@playwright/test';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import {
  addIndicators,
  waitForChartReady,
  waitForFrames,
} from '../helpers/chartTestSetup';

const SCREENSHOT_TOLERANCE = {
  maxDiffPixelRatio: 0.03,
  animations: 'disabled',
} as const;

test.describe('Chart visual regression', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({
      count: 300,
      seed: 12345,
      symbol: 'BTCUSDT',
      interval: '1h',
      basePrice: 50_000,
      volatility: 0.004,
      endTime: Date.UTC(2026, 0, 15, 0, 0, 0),
    });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForFrames(page, 20);
  });

  test('base chart + sidebar layout', async ({ page }) => {
    await expect(page).toHaveScreenshot('base-app.png', {
      ...SCREENSHOT_TOLERANCE,
      fullPage: false,
    });
  });

  test('chart canvas pixel-stable after load', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveScreenshot('base-chart-canvas.png', SCREENSHOT_TOLERANCE);
  });

  test('chart with RSI indicator added', async ({ page }) => {
    await addIndicators(page, [{ catalogType: 'rsi', params: { period: 14 } }]);
    await waitForFrames(page, 30);
    await expect(page).toHaveScreenshot('chart-with-rsi.png', {
      ...SCREENSHOT_TOLERANCE,
      fullPage: false,
    });
  });

  test('chart with MACD indicator added', async ({ page }) => {
    await addIndicators(page, [
      { catalogType: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
    ]);
    await waitForFrames(page, 30);
    await expect(page).toHaveScreenshot('chart-with-macd.png', {
      ...SCREENSHOT_TOLERANCE,
      fullPage: false,
    });
  });

  test('chart with EMA overlay added', async ({ page }) => {
    await addIndicators(page, [{ catalogType: 'ema', params: { period: 50 } }]);
    await waitForFrames(page, 30);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toHaveScreenshot('chart-with-ema.png', SCREENSHOT_TOLERANCE);
  });

  test('line drawing tool active state', async ({ page }) => {
    const lineTool = page.getByRole('button', { name: 'Line', exact: true });
    await lineTool.click();
    await waitForFrames(page, 10);
    await expect(lineTool).toHaveAttribute('aria-pressed', 'true');

    await expect(page).toHaveScreenshot('line-tool-active.png', {
      ...SCREENSHOT_TOLERANCE,
      fullPage: false,
    });
  });
});
