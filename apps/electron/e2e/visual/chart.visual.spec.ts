import { test, expect } from '@playwright/test';

test.describe('Chart Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="chart-container"]', { timeout: 10000 });
  });

  test('candlestick chart renders correctly', async ({ page }) => {
    await page.waitForTimeout(1000);

    const chartContainer = page.locator('[data-testid="chart-container"]');
    await expect(chartContainer).toHaveScreenshot('candlestick-chart.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('chart with volume panel renders correctly', async ({ page }) => {
    await page.waitForTimeout(1000);

    const chartWithVolume = page.locator('[data-testid="chart-with-volume"]');
    if (await chartWithVolume.isVisible()) {
      await expect(chartWithVolume).toHaveScreenshot('chart-with-volume.png', {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    }
  });

  test('chart zoom works correctly', async ({ page }) => {
    const chartContainer = page.locator('[data-testid="chart-container"]');

    await chartContainer.hover();
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(500);

    await expect(chartContainer).toHaveScreenshot('chart-zoomed-in.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });

  test('chart crosshair renders on hover', async ({ page }) => {
    const chartContainer = page.locator('[data-testid="chart-container"]');
    const boundingBox = await chartContainer.boundingBox();

    if (boundingBox) {
      await page.mouse.move(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2
      );
      await page.waitForTimeout(500);

      await expect(chartContainer).toHaveScreenshot('chart-with-crosshair.png', {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    }
  });
});

test.describe('Theme Visual Regression', () => {
  test('light theme renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="chart-container"]');

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('app-light-theme.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('dark theme renders correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="chart-container"]');

    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
    });
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('app-dark-theme.png', {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
      animations: 'disabled',
    });
  });
});

test.describe('Indicator Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="chart-container"]');
  });

  test('RSI indicator panel renders correctly', async ({ page }) => {
    const rsiToggle = page.locator('[data-testid="indicator-toggle-rsi"]');
    if (await rsiToggle.isVisible()) {
      await rsiToggle.click();
      await page.waitForTimeout(500);

      const rsiPanel = page.locator('[data-testid="indicator-panel-rsi"]');
      if (await rsiPanel.isVisible()) {
        await expect(rsiPanel).toHaveScreenshot('rsi-indicator.png', {
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
        });
      }
    }
  });

  test('MACD indicator panel renders correctly', async ({ page }) => {
    const macdToggle = page.locator('[data-testid="indicator-toggle-macd"]');
    if (await macdToggle.isVisible()) {
      await macdToggle.click();
      await page.waitForTimeout(500);

      const macdPanel = page.locator('[data-testid="indicator-panel-macd"]');
      if (await macdPanel.isVisible()) {
        await expect(macdPanel).toHaveScreenshot('macd-indicator.png', {
          maxDiffPixelRatio: 0.02,
          animations: 'disabled',
        });
      }
    }
  });

  test('Bollinger Bands overlay renders correctly', async ({ page }) => {
    const bbToggle = page.locator('[data-testid="indicator-toggle-bb"]');
    if (await bbToggle.isVisible()) {
      await bbToggle.click();
      await page.waitForTimeout(500);

      const chartContainer = page.locator('[data-testid="chart-container"]');
      await expect(chartContainer).toHaveScreenshot('chart-with-bollinger-bands.png', {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    }
  });
});
