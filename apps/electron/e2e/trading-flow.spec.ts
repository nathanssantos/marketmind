import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { addIndicators, waitForChartReady, waitForFrames } from './helpers/chartTestSetup';

test.describe('Trading Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
  });

  test('chart canvas mounts with kline fixture data', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box, 'canvas should have non-zero size').not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBeGreaterThan(0);

    const paintedPixels = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
      let total = 0;
      for (const c of canvases) {
        if (c.width === 0 || c.height === 0) continue;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        try {
          const img = ctx.getImageData(0, 0, c.width, c.height).data;
          for (let i = 3; i < img.length; i += 4) {
            if (img[i]! > 0) total += 1;
          }
        } catch {
          continue;
        }
      }
      return total;
    });
    expect(paintedPixels, 'canvases must have painted non-transparent pixels').toBeGreaterThan(1000);
  });

  test('symbol selector opens popover and switches to ETHUSDT', async ({ page }) => {
    const symbolButton = page.getByRole('button', { name: 'Exchange' });
    await expect(symbolButton).toBeVisible();
    await expect(symbolButton).toContainText('BTC');

    await symbolButton.click();

    const ethRow = page.getByText('ETH/USDT').first();
    await expect(ethRow).toBeVisible();
    await ethRow.click();

    await expect(symbolButton).toContainText('ETH');
  });

  test('timeframe selector opens popover and switches to 4h', async ({ page }) => {
    const timeframeButton = page.getByRole('button', { name: 'Timeframe' });
    await expect(timeframeButton).toBeVisible();
    await expect(timeframeButton).toContainText('1h');

    await timeframeButton.click();

    const fourHour = page.getByText('4h', { exact: true });
    await expect(fourHour.first()).toBeVisible();
    await fourHour.first().click();

    await expect(timeframeButton).toContainText('4h');
  });

  test('indicator store accepts RSI instance via bridge', async ({ page }) => {
    const ids = await addIndicators(page, [
      { catalogType: 'rsi', params: { period: 14 } },
    ]);
    expect(ids).toHaveLength(1);

    const count = await page.evaluate(() => {
      const store = window.__indicatorStore;
      return store?.getState().instances.filter((i) => i.catalogType === 'rsi').length ?? 0;
    });
    expect(count).toBe(1);

    await waitForFrames(page, 10);
    const canvasCountAfter = await page.locator('canvas').count();
    expect(canvasCountAfter).toBeGreaterThan(0);
  });

  test('drawing tool activation updates drawing store and aria-pressed', async ({ page }) => {
    const lineTool = page.getByRole('button', { name: 'Line', exact: true });
    await expect(lineTool).toBeVisible();
    await expect(lineTool).toHaveAttribute('aria-pressed', 'false');

    await lineTool.click();

    await expect(lineTool).toHaveAttribute('aria-pressed', 'true');

    const activeTool = await page.evaluate(
      () => window.__drawingStore?.getState().activeTool ?? null,
    );
    expect(activeTool).toBe('line');

    await lineTool.click();
    await expect(lineTool).toHaveAttribute('aria-pressed', 'false');
    const clearedTool = await page.evaluate(
      () => window.__drawingStore?.getState().activeTool ?? null,
    );
    expect(clearedTool).toBeNull();
  });

  test('chart re-renders on viewport resize', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForFrames(page, 5);
    const before = await page.locator('canvas').first().boundingBox();
    expect(before).not.toBeNull();

    await page.setViewportSize({ width: 1600, height: 900 });
    await waitForFrames(page, 10);
    const after = await page.locator('canvas').first().boundingBox();
    expect(after).not.toBeNull();
    expect(after!.width).toBeGreaterThan(before!.width);
  });
});
