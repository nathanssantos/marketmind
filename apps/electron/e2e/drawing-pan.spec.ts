import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady, waitForE2EBridge, waitForFrames } from './helpers/chartTestSetup';

const SYMBOL = 'BTCUSDT';
const INTERVAL = '1h';

test.describe('2-click drawing does not leave pan stuck', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
  });

  test('placing a ray via two clicks then moving mouse does not pan the viewport', async ({ page }) => {
    await page.evaluate(() => {
      window.__drawingStore?.getState().setActiveTool('ray');
    });

    const viewportBefore = await page.evaluate(() => {
      return window.__canvasManager?.getViewport() ?? null;
    });

    const rect = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    if (!rect) throw new Error('canvas not found');

    const p1 = { x: rect.left + rect.width * 0.3, y: rect.top + rect.height * 0.4 };
    const p2 = { x: rect.left + rect.width * 0.6, y: rect.top + rect.height * 0.5 };

    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.up();
    await waitForFrames(page, 3);

    await page.mouse.move(p2.x, p2.y, { steps: 10 });
    await waitForFrames(page, 3);

    const isPanningDuringPlacement = await page.evaluate(() => window.__isPanning ?? null);
    expect(isPanningDuringPlacement, 'isPanning must not be true between clicks of a 2-click drawing').toBe(false);

    await page.mouse.down();
    await page.mouse.up();
    await waitForFrames(page, 3);

    const probePoints = [
      { x: rect.left + rect.width * 0.1, y: rect.top + rect.height * 0.2 },
      { x: rect.left + rect.width * 0.8, y: rect.top + rect.height * 0.3 },
      { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.7 },
    ];
    for (const p of probePoints) {
      await page.mouse.move(p.x, p.y, { steps: 5 });
      await waitForFrames(page, 2);
    }

    const viewportAfter = await page.evaluate(() => {
      return window.__canvasManager?.getViewport() ?? null;
    });
    const isPanningAfter = await page.evaluate(() => window.__isPanning ?? null);

    expect(isPanningAfter, 'isPanning must be false after a 2-click drawing completes').toBe(false);

    if (viewportBefore && viewportAfter) {
      expect(viewportAfter.start).toBeCloseTo(viewportBefore.start, 1);
      expect(viewportAfter.end).toBeCloseTo(viewportBefore.end, 1);
    }
  });

  test('click-drag-release ray flow still works without leaving pan stuck', async ({ page }) => {
    await page.evaluate(() => {
      window.__drawingStore?.getState().setActiveTool('ray');
    });

    const viewportBefore = await page.evaluate(() => {
      return window.__canvasManager?.getViewport() ?? null;
    });

    const rect = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const r = canvas.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    if (!rect) throw new Error('canvas not found');

    const p1 = { x: rect.left + rect.width * 0.3, y: rect.top + rect.height * 0.4 };
    const p2 = { x: rect.left + rect.width * 0.6, y: rect.top + rect.height * 0.5 };

    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.move(p2.x, p2.y, { steps: 20 });
    await page.mouse.up();
    await waitForFrames(page, 3);

    const away = { x: rect.left + rect.width * 0.85, y: rect.top + rect.height * 0.25 };
    await page.mouse.move(away.x, away.y, { steps: 10 });
    await waitForFrames(page, 3);

    const isPanningAfter = await page.evaluate(() => window.__isPanning ?? null);
    expect(isPanningAfter, 'isPanning must be false after drag-release drawing').toBe(false);

    const viewportAfter = await page.evaluate(() => {
      return window.__canvasManager?.getViewport() ?? null;
    });

    if (viewportBefore && viewportAfter) {
      expect(viewportAfter.start).toBeCloseTo(viewportBefore.start, 1);
      expect(viewportAfter.end).toBeCloseTo(viewportBefore.end, 1);
    }
  });
});
