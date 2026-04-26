import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForChartReady, waitForE2EBridge, waitForFrames } from './helpers/chartTestSetup';

const SYMBOL = 'BTCUSDT';
const INTERVAL = '1h';

const setActiveTool = async (page: Page, tool: string | null) => {
  await page.evaluate((t) => {
    window.__drawingStore?.getState().setActiveTool(t);
  }, tool);
};

const getCanvasRect = async (page: Page) => {
  const rect = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  if (!rect) throw new Error('canvas not found');
  return rect;
};

const drawingsCount = (page: Page) =>
  page.evaluate(() => {
    const store = window.__drawingStore?.getState();
    if (!store) return 0;
    return Object.values(store.drawingsByKey ?? {}).reduce((acc, list) => acc + (list?.length ?? 0), 0);
  });

const lastDrawing = (page: Page) =>
  page.evaluate(() => {
    const store = window.__drawingStore?.getState();
    if (!store) return null;
    const all: Array<{ id: string; type: string }> = [];
    for (const list of Object.values(store.drawingsByKey ?? {})) {
      for (const d of list ?? []) all.push({ id: d.id, type: d.type });
    }
    return all[all.length - 1] ?? null;
  });

const activeTool = (page: Page) =>
  page.evaluate(() => window.__drawingStore?.getState().activeTool ?? null);

test.describe('Chart drawings — single-click two-point creation (line, ray, arrow)', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
  });

  for (const tool of ['line', 'ray', 'arrow', 'trendLine'] as const) {
    test(`creates ${tool} via single-click drag`, async ({ page }) => {
      await setActiveTool(page, tool);
      const rect = await getCanvasRect(page);
      const p1 = { x: rect.left + rect.width * 0.3, y: rect.top + rect.height * 0.4 };
      const p2 = { x: rect.left + rect.width * 0.6, y: rect.top + rect.height * 0.5 };

      const before = await drawingsCount(page);
      await page.mouse.move(p1.x, p1.y);
      await page.mouse.down();
      await page.mouse.move(p2.x, p2.y, { steps: 10 });
      await page.mouse.up();
      await waitForFrames(page, 3);

      expect(await drawingsCount(page)).toBe(before + 1);
      const last = await lastDrawing(page);
      expect(last?.type).toBe(tool);

      // Tool resets to null after the drawing was committed.
      expect(await activeTool(page)).toBeNull();
    });

    test(`zero-length click on ${tool} does NOT add a degenerate drawing`, async ({ page }) => {
      await setActiveTool(page, tool);
      const rect = await getCanvasRect(page);
      const p1 = { x: rect.left + rect.width * 0.3, y: rect.top + rect.height * 0.4 };

      const before = await drawingsCount(page);
      await page.mouse.move(p1.x, p1.y);
      await page.mouse.down();
      await page.mouse.up();
      await waitForFrames(page, 3);

      expect(await drawingsCount(page)).toBe(before);
      // Tool also resets back to null on cancel — so user can pick a new tool.
      expect(await activeTool(page)).toBeNull();
    });
  }
});

test.describe('Chart drawings — single-click point drawings (text, horizontalLine, verticalLine)', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
  });

  for (const tool of ['horizontalLine', 'verticalLine'] as const) {
    test(`creates ${tool} on a single mousedown`, async ({ page }) => {
      await setActiveTool(page, tool);
      const rect = await getCanvasRect(page);
      const p1 = { x: rect.left + rect.width * 0.4, y: rect.top + rect.height * 0.5 };

      const before = await drawingsCount(page);
      await page.mouse.move(p1.x, p1.y);
      await page.mouse.down();
      await page.mouse.up();
      await waitForFrames(page, 3);

      expect(await drawingsCount(page)).toBe(before + 1);
      const last = await lastDrawing(page);
      expect(last?.type).toBe(tool);
    });
  }
});

test.describe('Chart drawings — pencil freeform', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
  });

  test('drawing-freeform → mouseup creates a pencil drawing with multiple points', async ({ page }) => {
    await setActiveTool(page, 'pencil');
    const rect = await getCanvasRect(page);
    const start = { x: rect.left + rect.width * 0.2, y: rect.top + rect.height * 0.3 };

    const before = await drawingsCount(page);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(start.x + i * 30, start.y + i * 20, { steps: 1 });
    }
    await page.mouse.up();
    await waitForFrames(page, 3);

    expect(await drawingsCount(page)).toBe(before + 1);
    const last = await lastDrawing(page);
    expect(last?.type).toBe('pencil');
  });
});

test.describe('Chart drawings — three-point creation (channel)', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
    // Disable magnet so click 1's down + up at same pixel doesn't snap to
    // the same OHLC point and trigger the "start === end" cancellation.
    await page.evaluate(() => {
      window.__drawingStore?.getState().setMagnetEnabled(false);
    });
  });

  test('channel completes after click-drag for the base line + a final click for width', async ({ page }) => {
    await setActiveTool(page, 'channel');
    const rect = await getCanvasRect(page);
    const p1 = { x: rect.left + rect.width * 0.25, y: rect.top + rect.height * 0.4 };
    const p2 = { x: rect.left + rect.width * 0.55, y: rect.top + rect.height * 0.5 };
    const p3 = { x: rect.left + rect.width * 0.7, y: rect.top + rect.height * 0.65 };

    const before = await drawingsCount(page);

    // Click 1: down at p1 — phase=placing-second; drag to p2 — end updates;
    // up at p2 — phase=placing-third, end=p2.
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    await page.mouse.move(p2.x, p2.y, { steps: 10 });
    await page.mouse.up();
    await waitForFrames(page, 3);
    expect(await drawingsCount(page)).toBe(before);

    // Click 2: down at p3 — finalizes the channel (sets widthIndex, commits).
    await page.mouse.move(p3.x, p3.y, { steps: 5 });
    await page.mouse.down();
    await waitForFrames(page, 3);

    expect(await drawingsCount(page)).toBe(before + 1);
    const last = await lastDrawing(page);
    expect(last?.type).toBe('channel');
  });
});

// The "first click selects only / second click drags" rule is exhaustively
// covered by the unit tests in
// apps/electron/src/renderer/components/Chart/drawings/useDrawingInteraction.test.ts —
// using mocked hitTestDrawings to deterministically control hit results.
// An e2e equivalent is brittle because real hit-testing depends on snap
// rounding for the seeded line's screen coordinates.

test.describe('Chart drawings — "stuck mouse" regressions', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
  });

  test('releasing mouseup outside the canvas during drag releases the drag state', async ({ page }) => {
    // Seed a horizontalLine and select it
    await setActiveTool(page, 'horizontalLine');
    const rect = await getCanvasRect(page);
    const linePoint = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
    await page.mouse.move(linePoint.x, linePoint.y);
    await page.mouse.down();
    await page.mouse.up();
    await waitForFrames(page, 3);

    // Two clicks: first to select, second to start drag
    await page.mouse.move(linePoint.x, linePoint.y);
    await page.mouse.down();
    await page.mouse.up();
    await waitForFrames(page, 2);

    await page.mouse.move(linePoint.x, linePoint.y);
    await page.mouse.down();
    await page.mouse.move(linePoint.x, linePoint.y - 40, { steps: 3 });

    // Move OUT of the canvas (above it) and release there.
    await page.mouse.move(linePoint.x, rect.top - 50, { steps: 3 });
    await page.mouse.up();
    await waitForFrames(page, 3);

    // The next plain click on the chart should NOT continue the drag —
    // i.e. moving the mouse from a different spot doesn't shift the line.
    const beforePrice = await page.evaluate(() => {
      const list = window.__drawingStore?.getState().drawingsByKey['BTCUSDT:1h'] ?? [];
      const hl = list.find((d) => d.type === 'horizontalLine');
      return hl && 'price' in hl ? hl.price : null;
    });

    // Hover (no click) over a different region. If state were stuck on
    // dragging, the move event would shift the drawing.
    await page.mouse.move(rect.left + rect.width * 0.2, rect.top + rect.height * 0.8, { steps: 5 });
    await waitForFrames(page, 3);

    const afterPrice = await page.evaluate(() => {
      const list = window.__drawingStore?.getState().drawingsByKey['BTCUSDT:1h'] ?? [];
      const hl = list.find((d) => d.type === 'horizontalLine');
      return hl && 'price' in hl ? hl.price : null;
    });

    expect(afterPrice).toBe(beforePrice);
  });

  test('mouse leaves the canvas mid-placement → cancels pending drawing, no degenerate add', async ({ page }) => {
    await setActiveTool(page, 'line');
    const rect = await getCanvasRect(page);
    const p1 = { x: rect.left + rect.width * 0.3, y: rect.top + rect.height * 0.4 };

    const before = await drawingsCount(page);
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down();
    // Move the mouse OUT of the canvas without releasing.
    await page.mouse.move(rect.left + rect.width / 2, rect.top - 100, { steps: 5 });
    // The mouseleave handler runs — pending drawing is dropped.
    await waitForFrames(page, 3);

    // Release outside.
    await page.mouse.up();
    await waitForFrames(page, 3);

    // Pending placement was cancelled — no degenerate drawing added.
    // (We deliberately leave the active tool alone so the user can retry.)
    expect(await drawingsCount(page)).toBe(before);
  });
});

test.describe('Chart drawings — toolbar tool-button state', () => {
  test.beforeEach(async ({ page }) => {
    const klines = generateKlines({ count: 300, symbol: SYMBOL, interval: INTERVAL });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await waitForE2EBridge(page);
  });

  test('clicking a drawing tool button activates the tool in the store', async ({ page }) => {
    await page.getByRole('button', { name: 'Line', exact: true }).click();
    expect(await activeTool(page)).toBe('line');

    // Clicking the same button again toggles off.
    await page.getByRole('button', { name: 'Line', exact: true }).click();
    expect(await activeTool(page)).toBeNull();
  });

  test('selecting a different tool replaces the previous one', async ({ page }) => {
    await page.getByRole('button', { name: 'Line', exact: true }).click();
    expect(await activeTool(page)).toBe('line');

    await page.getByRole('button', { name: 'Channel', exact: true }).click();
    expect(await activeTool(page)).toBe('channel');
  });
});
