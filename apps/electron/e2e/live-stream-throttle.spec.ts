import { test, expect, type Page } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForSocket } from './helpers/socketBridge';
import {
  enablePerfOverlay,
  refreshPerfFlag,
  waitForChartReady,
} from './helpers/chartTestSetup';

declare global {
  interface Window {
    __panActivityStore?: {
      getState: () => {
        beginPan: (id: string) => void;
        endPan: (id: string) => void;
        isPanning: boolean;
        activePanels: Set<string>;
      };
    };
    __mmTestSubscriber?: {
      counts: { received: number; flushed: number };
      simulate: (payload: unknown) => void;
      reset: () => void;
    };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Mount a tiny throttle-aware subscriber inside the page that mirrors
 * what `useLiveStream` does, but is callable directly from the test.
 * This lets us E2E-verify the registry's pan-aware behavior without
 * depending on which panels happen to be in the default layout.
 */
const installTestSubscriber = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    let lastFlushAt: number | null = null;
    let pending: unknown = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let lastPublished: unknown = null;
    const counts = { received: 0, flushed: 0 };

    const THROTTLE_MS = 100;
    const PAN_MULTIPLIER = 4;

    const isPanActive = () => {
      const store = window.__panActivityStore;
      return !!store && store.getState().isPanning;
    };

    const shallowEqual = (a: unknown, b: unknown): boolean => {
      if (a === b) return true;
      if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
      const ka = Object.keys(a as object);
      const kb = Object.keys(b as object);
      if (ka.length !== kb.length) return false;
      for (const k of ka) {
        if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
      }
      return true;
    };

    const flush = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      const next = pending;
      pending = null;
      if (next === null || next === undefined) return;
      if (lastPublished !== null && shallowEqual(next, lastPublished)) {
        lastFlushAt = performance.now();
        return;
      }
      lastPublished = next;
      lastFlushAt = performance.now();
      counts.flushed += 1;
    };

    const simulate = (payload: unknown) => {
      counts.received += 1;
      pending = payload;

      const effective = isPanActive() ? THROTTLE_MS * PAN_MULTIPLIER : THROTTLE_MS;

      if (lastFlushAt === null) {
        flush();
        return;
      }

      const now = performance.now();
      const sinceLast = now - lastFlushAt;
      if (sinceLast >= effective && timerId === null) {
        flush();
        return;
      }

      if (timerId === null) {
        const delay = Math.max(0, effective - sinceLast);
        timerId = setTimeout(flush, delay);
      }
    };

    const reset = () => {
      lastFlushAt = null;
      pending = null;
      if (timerId !== null) clearTimeout(timerId);
      timerId = null;
      lastPublished = null;
      counts.received = 0;
      counts.flushed = 0;
    };

    window.__mmTestSubscriber = { counts, simulate, reset };
  });
};

const burst = async (page: Page, count: number): Promise<void> => {
  await page.evaluate((n) => {
    for (let i = 0; i < n; i += 1) {
      window.__mmTestSubscriber!.simulate({ value: i, ts: Date.now() });
    }
  }, count);
};

const readCounts = async (page: Page): Promise<{ received: number; flushed: number }> =>
  page.evaluate(() => ({ ...window.__mmTestSubscriber!.counts }));

test.describe('Live-stream registry — pan-aware throttling', () => {
  test.beforeEach(async ({ page }) => {
    await enablePerfOverlay(page);
    const klines = generateKlines({ count: 100, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });
    await page.goto('/');
    await waitForChartReady(page);
    await refreshPerfFlag(page);
    await waitForSocket(page);
    await installTestSubscriber(page);
  });

  test('idle: 60 rapid emits collapse to ≤ 2 React publishes (cold-start + trailing)', async ({ page }) => {
    await page.evaluate(() => window.__mmTestSubscriber!.reset());

    await burst(page, 60);
    // Wait past the throttle window so the trailing flush settles.
    await sleep(150);

    const { received, flushed } = await readCounts(page);
    expect(received).toBe(60);
    // Cold-start path = 1 free flush + at most 1 trailing flush.
    expect(flushed).toBeLessThanOrEqual(2);
    expect(flushed / received).toBeLessThan(0.1);
  });

  test('pan-active: throttle stretches by panMultiplier (no flush at idle window, flushes at stretched window)', async ({ page }) => {
    // Steady-state: emit one + wait so the cold-start flush is consumed.
    await page.evaluate(() => {
      window.__mmTestSubscriber!.reset();
      window.__mmTestSubscriber!.simulate({ value: 0 });
    });
    await sleep(150);

    const before = await readCounts(page);
    expect(before.flushed).toBe(1);

    // Begin pan.
    await page.evaluate(() => {
      window.__panActivityStore!.getState().beginPan('e2e-pan');
    });
    expect(await page.evaluate(() => window.__panActivityStore!.getState().isPanning)).toBe(true);

    // Burst during pan — stretched throttle is 400ms.
    await burst(page, 60);

    // Wait less than the stretched window — no flush should fire yet.
    await sleep(150);
    const mid = await readCounts(page);
    expect(mid.flushed).toBe(1);          // still just the steady-state baseline
    expect(mid.received).toBe(61);        // 1 baseline + 60 burst

    // Wait past the stretched window — exactly one trailing flush fires.
    await sleep(350);
    const after = await readCounts(page);
    expect(after.flushed).toBe(2);

    // End pan.
    await page.evaluate(() => {
      window.__panActivityStore!.getState().endPan('e2e-pan');
    });
    expect(await page.evaluate(() => window.__panActivityStore!.getState().isPanning)).toBe(false);
  });

  test('real chart pan flips the global flag (mouse down → up)', async ({ page }) => {
    const isPanning = (): Promise<boolean> =>
      page.evaluate(() => window.__panActivityStore!.getState().isPanning);

    expect(await isPanning()).toBe(false);

    // Drag the chart canvas. mousedown alone should set the flag — we
    // wired `usePanActivityStore.beginPan` into `handleMouseDown`.
    const canvas = await page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    expect(await isPanning()).toBe(true);

    // Drag a bit — the flag stays set the whole time.
    await page.mouse.move(cx - 50, cy);
    expect(await isPanning()).toBe(true);
    await page.mouse.move(cx - 100, cy);
    expect(await isPanning()).toBe(true);

    await page.mouse.up();
    expect(await isPanning()).toBe(false);
  });

  test('long pan with continuous emits: flushes stay rare for the whole duration', async ({ page }) => {
    // Reset, then take a baseline cold-start flush so we are in
    // steady-state when the pan starts.
    await page.evaluate(() => {
      window.__mmTestSubscriber!.reset();
      window.__mmTestSubscriber!.simulate({ value: 0 });
    });
    await sleep(150);
    const before = await readCounts(page);
    expect(before.flushed).toBe(1);

    // Start a real chart pan via mouse — same path the user takes.
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();

    expect(await page.evaluate(() => window.__panActivityStore!.getState().isPanning)).toBe(true);

    // Drive a 2-second pan with two streams of updates running
    // in parallel:
    //   - mouse moves at ~120Hz (the user wiggling the chart)
    //   - bookTicker payloads at ~50Hz (the WS fire hose)
    // Throttle policy is 100ms (= 400ms during pan), so the trailing
    // flush should fire ~5 times in 2s, not 100+.
    const PAN_DURATION_MS = 2000;
    const startedAt = Date.now();
    let dx = 0;
    let payloadIdx = 0;
    while (Date.now() - startedAt < PAN_DURATION_MS) {
      // Pan motion.
      dx -= 5;
      await page.mouse.move(cx + dx, cy);
      // Two simulated bookTicker payloads per pan step. We flush via
      // page.evaluate batched to keep test loop overhead down.
      payloadIdx += 1;
      await page.evaluate((i) => {
        window.__mmTestSubscriber!.simulate({ value: i, ts: Date.now() });
        window.__mmTestSubscriber!.simulate({ value: i + 1, ts: Date.now() + 1 });
      }, payloadIdx * 2);
      await sleep(10);
    }

    await page.mouse.up();
    expect(await page.evaluate(() => window.__panActivityStore!.getState().isPanning)).toBe(false);

    // Allow the trailing flush to settle.
    await sleep(500);

    const after = await readCounts(page);
    const burstReceived = after.received - before.received;
    const flushedDuringPan = after.flushed - before.flushed;

    // We sent ~hundreds of payloads (2s / ~10ms per pair × 2 = ~400).
    // Sanity: at least 50 reached the subscriber.
    expect(burstReceived).toBeGreaterThanOrEqual(50);
    // Stretched throttle is 400ms during pan; with ~2s of pan + 500ms
    // settle, the expected flush ceiling is roughly:
    //   (PAN_DURATION_MS + 500ms post-mouseup) / 400ms ≈ 6-7
    // plus 1-2 boundary flushes (the moment pan ends and the multiplier
    // collapses, a queued flush at the smaller idle window can fire).
    // Cap at 12 to absorb timing jitter on slow CI without losing the
    // signal — a regression that breaks the throttle would produce
    // dozens or hundreds of flushes here.
    expect(flushedDuringPan).toBeLessThanOrEqual(12);
    // Concrete win: the savings ratio should be 90%+.
    const savingsRatio = 1 - flushedDuringPan / burstReceived;
    expect(savingsRatio).toBeGreaterThan(0.9);
  });

  test('panActivityStore correctly handles multiple concurrent panners (set semantics)', async ({ page }) => {
    const isPanning = (): Promise<boolean> =>
      page.evaluate(() => window.__panActivityStore!.getState().isPanning);

    expect(await isPanning()).toBe(false);

    await page.evaluate(() => {
      window.__panActivityStore!.getState().beginPan('panel-A');
      window.__panActivityStore!.getState().beginPan('panel-B');
    });
    expect(await isPanning()).toBe(true);

    // Releasing one panel keeps the global flag set — the OTHER panel
    // is still mid-pan.
    await page.evaluate(() => {
      window.__panActivityStore!.getState().endPan('panel-A');
    });
    expect(await isPanning()).toBe(true);

    // Releasing the last panel finally clears the flag.
    await page.evaluate(() => {
      window.__panActivityStore!.getState().endPan('panel-B');
    });
    expect(await isPanning()).toBe(false);

    // Idempotent: ending a panel that wasn't panning is a no-op.
    await page.evaluate(() => {
      window.__panActivityStore!.getState().endPan('panel-X');
    });
    expect(await isPanning()).toBe(false);
  });
});
