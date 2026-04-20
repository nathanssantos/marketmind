import type { Page } from '@playwright/test';
import type { PerfSnapshot } from '../../src/renderer/utils/canvas/perfMonitor';

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
