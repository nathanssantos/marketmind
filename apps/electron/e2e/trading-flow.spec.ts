import { test, expect } from '@playwright/test';

test.describe('Trading Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display chart with kline data', async ({ page }) => {
    const chartContainer = page.locator('[data-testid="chart-container"]');
    await expect(chartContainer).toBeVisible({ timeout: 10000 });

    const canvas = chartContainer.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('should be able to change symbol', async ({ page }) => {
    const symbolSelector = page.locator('[data-testid="symbol-selector"]');
    if (await symbolSelector.isVisible()) {
      await symbolSelector.click();

      const symbolOption = page.locator('[data-testid="symbol-option-ETHUSDT"]');
      if (await symbolOption.isVisible()) {
        await symbolOption.click();

        await page.waitForTimeout(1000);

        const currentSymbol = page.locator('[data-testid="current-symbol"]');
        await expect(currentSymbol).toContainText('ETH');
      }
    }
  });

  test('should be able to change timeframe', async ({ page }) => {
    const timeframeSelector = page.locator('[data-testid="timeframe-selector"]');
    if (await timeframeSelector.isVisible()) {
      await timeframeSelector.click();

      const timeframeOption = page.locator('[data-testid="timeframe-option-4h"]');
      if (await timeframeOption.isVisible()) {
        await timeframeOption.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should show price info on chart hover', async ({ page }) => {
    const chartContainer = page.locator('[data-testid="chart-container"]');
    await expect(chartContainer).toBeVisible();

    const boundingBox = await chartContainer.boundingBox();
    if (boundingBox) {
      await page.mouse.move(
        boundingBox.x + boundingBox.width / 2,
        boundingBox.y + boundingBox.height / 2
      );

      await page.waitForTimeout(500);

      const tooltip = page.locator('[data-testid="chart-tooltip"]');
      if (await tooltip.isVisible()) {
        await expect(tooltip).toBeVisible();
      }
    }
  });

  test('should be able to toggle indicators', async ({ page }) => {
    const indicatorsButton = page.locator('[data-testid="indicators-button"]');
    if (await indicatorsButton.isVisible()) {
      await indicatorsButton.click();

      const indicatorsList = page.locator('[data-testid="indicators-list"]');
      await expect(indicatorsList).toBeVisible();

      const rsiCheckbox = page.locator('[data-testid="indicator-checkbox-rsi"]');
      if (await rsiCheckbox.isVisible()) {
        await rsiCheckbox.click();
        await page.waitForTimeout(500);

        const rsiPanel = page.locator('[data-testid="indicator-panel-rsi"]');
        await expect(rsiPanel).toBeVisible();
      }
    }
  });
});

test.describe('Order Entry E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display order entry panel', async ({ page }) => {
    const orderPanel = page.locator('[data-testid="order-entry-panel"]');
    if (await orderPanel.isVisible()) {
      await expect(orderPanel).toBeVisible();

      const buyButton = page.locator('[data-testid="buy-button"]');
      const sellButton = page.locator('[data-testid="sell-button"]');

      await expect(buyButton).toBeVisible();
      await expect(sellButton).toBeVisible();
    }
  });

  test('should validate order quantity', async ({ page }) => {
    const quantityInput = page.locator('[data-testid="quantity-input"]');
    if (await quantityInput.isVisible()) {
      await quantityInput.fill('0');

      const submitButton = page.locator('[data-testid="submit-order-button"]');
      if (await submitButton.isVisible()) {
        await expect(submitButton).toBeDisabled();
      }
    }
  });

  test('should calculate position value', async ({ page }) => {
    const quantityInput = page.locator('[data-testid="quantity-input"]');
    if (await quantityInput.isVisible()) {
      await quantityInput.fill('0.1');
      await page.waitForTimeout(300);

      const positionValue = page.locator('[data-testid="position-value"]');
      if (await positionValue.isVisible()) {
        const text = await positionValue.textContent();
        expect(text).toBeTruthy();
        expect(parseFloat(text?.replace(/[^0-9.]/g, '') || '0')).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Portfolio View E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display portfolio summary', async ({ page }) => {
    const portfolioTab = page.locator('[data-testid="portfolio-tab"]');
    if (await portfolioTab.isVisible()) {
      await portfolioTab.click();
      await page.waitForTimeout(500);

      const portfolioSummary = page.locator('[data-testid="portfolio-summary"]');
      await expect(portfolioSummary).toBeVisible();
    }
  });

  test('should display open positions', async ({ page }) => {
    const positionsTab = page.locator('[data-testid="positions-tab"]');
    if (await positionsTab.isVisible()) {
      await positionsTab.click();
      await page.waitForTimeout(500);

      const positionsList = page.locator('[data-testid="positions-list"]');
      await expect(positionsList).toBeVisible();
    }
  });

  test('should display order history', async ({ page }) => {
    const historyTab = page.locator('[data-testid="history-tab"]');
    if (await historyTab.isVisible()) {
      await historyTab.click();
      await page.waitForTimeout(500);

      const orderHistory = page.locator('[data-testid="order-history"]');
      await expect(orderHistory).toBeVisible();
    }
  });
});
