import type { Page } from '@playwright/test';
import type { PerfSnapshot } from '../../src/renderer/utils/canvas/perfMonitor';
import { toRawKline, type FixtureKline, type RawKlineRow } from './klineFixtures';

interface E2EIndicatorStoreState {
  addInstance: (input: {
    userIndicatorId: string;
    catalogType: string;
    params: Record<string, unknown>;
    visible: boolean;
  }) => string;
  removeInstance: (id: string) => void;
  instances: Array<{ id: string; catalogType: string }>;
}

interface E2EPriceStoreState {
  updatePriceBatch: (updates: Map<string, number>) => void;
  updatePrice: (symbol: string, price: number, source: 'chart' | 'websocket' | 'api') => void;
}

interface E2EQueryClient {
  setQueriesData: (
    filters: { predicate?: (query: { queryKey: unknown }) => boolean },
    updater: (old: unknown) => unknown,
  ) => void;
}

declare global {
  interface Window {
    __mmPerf?: {
      getSnapshot: () => PerfSnapshot;
      refreshFlag: () => void;
      reset: () => void;
    };
    __indicatorStore?: {
      getState: () => E2EIndicatorStoreState;
    };
    __priceStore?: {
      getState: () => E2EPriceStoreState;
    };
    __queryClient?: E2EQueryClient;
  }
}

export const enablePerfOverlay = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('chart.perf', '1');
    } catch {
      /* no-op */
    }
  });
};

export const refreshPerfFlag = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    window.__mmPerf?.refreshFlag();
  });
};

export const resetPerfMonitor = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    window.__mmPerf?.reset();
  });
};

export const readPerfSnapshot = async (page: Page): Promise<PerfSnapshot> =>
  page.evaluate(() => {
    const snap = window.__mmPerf?.getSnapshot();
    if (!snap) {
      return {
        enabled: false,
        fps: 0,
        lastFrameMs: 0,
        droppedFrames: 0,
        longSections: 0,
        sections: [],
        componentRenders: [],
      };
    }
    return snap;
  });

export const waitForFrames = async (page: Page, count: number): Promise<void> => {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        let remaining = n;
        const step = (): void => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    count,
  );
};

export const driveFrames = async (page: Page, frames: number): Promise<void> => {
  await page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) {
          resolve();
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const radius = Math.min(rect.width, rect.height) / 3;
        let remaining = n;
        const step = (t: number): void => {
          const angle = (t / 50) % (Math.PI * 2);
          const x = cx + Math.cos(angle) * radius;
          const y = cy + Math.sin(angle) * radius;
          const event = new MouseEvent('mousemove', {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
          });
          canvas.dispatchEvent(event);
          remaining -= 1;
          if (remaining <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    frames,
  );
};

export const waitForChartReady = async (page: Page, timeoutMs = 10_000): Promise<void> => {
  await page.waitForFunction(
    () => {
      const canvases = document.querySelectorAll('canvas');
      return canvases.length > 0;
    },
    { timeout: timeoutMs },
  );
  await waitForFrames(page, 10);
};

export interface AddIndicatorInput {
  catalogType: string;
  params?: Record<string, unknown>;
  visible?: boolean;
}

export const addIndicators = async (
  page: Page,
  indicators: AddIndicatorInput[],
): Promise<string[]> =>
  page.evaluate((inputs) => {
    const ids: string[] = [];
    const store = window.__indicatorStore;
    if (!store) throw new Error('indicator store not exposed on window');
    const state = store.getState();
    for (const input of inputs) {
      const id = state.addInstance({
        userIndicatorId: `e2e_${input.catalogType}`,
        catalogType: input.catalogType,
        params: input.params ?? {},
        visible: input.visible ?? true,
      });
      ids.push(id);
    }
    return ids;
  }, indicators);

export const clearIndicators = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const store = window.__indicatorStore;
    if (!store) return;
    const state = store.getState();
    for (const inst of [...state.instances]) {
      state.removeInstance(inst.id);
    }
  });
};

export interface PerfAssertions {
  minFps?: number;
  maxP95FrameMs?: number;
  maxChartCanvasRendersPerSec?: number;
}

export const slowestSectionMs = (snap: PerfSnapshot): number => {
  if (snap.sections.length === 0) return 0;
  return snap.sections[0]!.lastMs;
};

export const componentRenderRate = (snap: PerfSnapshot, name: string): number => {
  const entry = snap.componentRenders.find((c) => c.name === name);
  return entry?.ratePerSec ?? 0;
};

const isKlineListQueryKey = (key: unknown): boolean => {
  if (!Array.isArray(key)) return false;
  const head = key[0];
  return Array.isArray(head) && head[0] === 'kline' && head[1] === 'list';
};

/**
 * Push a batch of price updates through usePriceStore.updatePriceBatch.
 * Exercises the sidebar/portfolio re-render path (usePricesForSymbols) and
 * ChartCanvas's imperative subscribe callback without triggering chart data re-fetch.
 */
export const pushPriceTicks = async (page: Page, ticks: Record<string, number>): Promise<void> => {
  await page.evaluate((payload) => {
    const store = window.__priceStore;
    if (!store) throw new Error('price store not exposed on window (VITE_E2E_BYPASS_AUTH not set?)');
    const map = new Map<string, number>(Object.entries(payload));
    store.getState().updatePriceBatch(map);
  }, ticks);
};

/**
 * Mutate the latest (current) kline inside the React Query cache for all
 * `kline.list` queries. Patches close/volume and widens high/low as needed.
 * Returns the number of caches updated.
 */
export const updateLatestKline = async (
  page: Page,
  patch: { close: number; volume?: number },
): Promise<number> =>
  page.evaluate((p) => {
    const qc = window.__queryClient;
    if (!qc) throw new Error('queryClient not exposed on window (VITE_E2E_BYPASS_AUTH not set?)');
    let touched = 0;
    qc.setQueriesData(
      {
        predicate: (q: { queryKey: unknown }) => {
          const key = q.queryKey;
          return (
            Array.isArray(key) &&
            Array.isArray(key[0]) &&
            (key[0] as unknown[])[0] === 'kline' &&
            (key[0] as unknown[])[1] === 'list'
          );
        },
      },
      (old: unknown) => {
        if (!Array.isArray(old) || old.length === 0) return old;
        touched += 1;
        const rows = old as Array<Record<string, string | number>>;
        const last = rows[rows.length - 1];
        if (!last) return old;
        const newClose = String(p.close);
        const newHigh = Math.max(parseFloat(String(last.high)), p.close);
        const newLow = Math.min(parseFloat(String(last.low)), p.close);
        const patched: Record<string, string | number> = {
          ...last,
          close: newClose,
          high: String(newHigh),
          low: String(newLow),
        };
        if (typeof p.volume === 'number') patched.volume = String(p.volume);
        return [...rows.slice(0, -1), patched];
      },
    );
    return touched;
  }, patch);

/**
 * Append a new kline to every `kline.list` cache entry. The fixture is
 * pre-stringified to match the raw-row shape used by the tRPC mock.
 */
export const appendKline = async (page: Page, kline: FixtureKline): Promise<number> => {
  const raw: RawKlineRow = toRawKline(kline);
  return page.evaluate((rawRow) => {
    const qc = window.__queryClient;
    if (!qc) throw new Error('queryClient not exposed on window (VITE_E2E_BYPASS_AUTH not set?)');
    let touched = 0;
    qc.setQueriesData(
      {
        predicate: (q: { queryKey: unknown }) => {
          const key = q.queryKey;
          return (
            Array.isArray(key) &&
            Array.isArray(key[0]) &&
            (key[0] as unknown[])[0] === 'kline' &&
            (key[0] as unknown[])[1] === 'list'
          );
        },
      },
      (old: unknown) => {
        if (!Array.isArray(old)) return old;
        touched += 1;
        return [...old, rawRow];
      },
    );
    return touched;
  }, raw);
};

/**
 * Drive `frames` pan steps over the chart canvas. Presses the left mouse
 * button once, emits `frames` rAF-paced mousemove events horizontally, then
 * releases. Exercises the same pan path a real user drag triggers.
 */
export const drivePan = async (page: Page, frames: number, amplitudePx = 200): Promise<void> => {
  const rect = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  if (!rect) return;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 0; i < frames; i += 1) {
    const offset = Math.sin((i / 30) * Math.PI) * amplitudePx;
    await page.mouse.move(cx + offset, cy, { steps: 1 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  }
  await page.mouse.up();
};

/**
 * Drive `frames` wheel events over the chart canvas. Alternates zoom in/out
 * so the visible range returns near its starting point.
 */
export const driveWheelZoom = async (page: Page, frames: number, deltaPx = 80): Promise<void> => {
  const rect = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  if (!rect) return;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < frames; i += 1) {
    const dir = i % 2 === 0 ? -1 : 1;
    await page.mouse.wheel(0, dir * deltaPx);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
  }
};

export { isKlineListQueryKey };
