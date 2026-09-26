import type { Page } from '@playwright/test';

export interface ProbeStats {
  count: number;
  p50: number;
  p95: number;
  max: number;
  mean: number;
  stdDev: number;
}

export interface FrameProbeReport {
  durationMs: number;
  raf: ProbeStats & { nominalMs: number; missedVsyncs: number; missedPct: number };
  renders: ProbeStats & { perSec: number; over34ms: number; over50ms: number };
  renderJsMs: ProbeStats;
  baseSnapshotMs: ProbeStats;
  baseRestoreMs: ProbeStats;
  inputToRenderMs: ProbeStats;
  inputEvents: number;
  longAnimationFrames: {
    supported: boolean;
    count: number;
    totalMs: number;
    maxMs: number;
    blockingMs: number;
    topScripts: Array<{ source: string; durationMs: number }>;
  };
  longTasks: { count: number; totalMs: number };
  heapDeltaMB: number | null;
}

interface FrameProbeWindow extends Window {
  __mmFrameProbe?: {
    start: () => void;
    stop: () => FrameProbeReport;
  };
  __mmPerf?: { endFrame: (startTs: number) => void; lastFrameMs?: number };
  __canvasManager?: { snapshotBaseLayer: () => void; restoreBaseLayer: () => boolean } | null;
  gc?: () => void;
}

export const installFrameProbe = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const w = window as FrameProbeWindow;
    if (w.__mmFrameProbe) return;
    const perf = w.__mmPerf;
    if (!perf) throw new Error('__mmPerf not exposed (VITE_E2E_BYPASS_AUTH not set?)');

    const LOAF_TYPE = 'long-animation-frame';
    const MISSED_VSYNC_FACTOR = 1.5;
    const NOMINAL_SAMPLE_SHARE = 0.2;
    const BYTES_PER_MB = 1024 * 1024;

    const state = {
      running: false,
      startedAt: 0,
      stoppedAt: 0,
      rafId: 0,
      rafTs: [] as number[],
      renderTs: [] as number[],
      renderJsMs: [] as number[],
      snapshotMs: [] as number[],
      restoreMs: [] as number[],
      latencyMs: [] as number[],
      inputTs: [] as number[],
      loaf: [] as Array<{ duration: number; blocking: number; scripts: Array<{ source: string; durationMs: number }> }>,
      longTasks: [] as number[],
      heapStart: null as number | null,
    };

    const originalEndFrame = perf.endFrame.bind(perf);
    perf.endFrame = (startTs: number): void => {
      originalEndFrame(startTs);
      if (!state.running) return;
      const now = performance.now();
      state.renderTs.push(now);
      if (typeof perf.lastFrameMs === 'number') state.renderJsMs.push(perf.lastFrameMs);
      const lastInput = state.inputTs.length > 0 ? state.inputTs[state.inputTs.length - 1] : null;
      if (lastInput !== null) state.latencyMs.push(now - lastInput);
    };

    const manager = w.__canvasManager;
    if (manager) {
      const originalSnapshot = manager.snapshotBaseLayer.bind(manager);
      const originalRestore = manager.restoreBaseLayer.bind(manager);
      manager.snapshotBaseLayer = (): void => {
        const startedAt = performance.now();
        originalSnapshot();
        if (state.running) state.snapshotMs.push(performance.now() - startedAt);
      };
      manager.restoreBaseLayer = (): boolean => {
        const startedAt = performance.now();
        const restored = originalRestore();
        if (state.running) state.restoreMs.push(performance.now() - startedAt);
        return restored;
      };
    }

    document.addEventListener(
      'mousemove',
      (event) => {
        if (state.running && event.buttons === 1) state.inputTs.push(event.timeStamp);
      },
      { capture: true, passive: true },
    );

    const supportsLoaf = PerformanceObserver.supportedEntryTypes.includes(LOAF_TYPE);
    const loafObserver = new PerformanceObserver((list) => {
      if (!state.running) return;
      for (const entry of list.getEntries()) {
        const loaf = entry as PerformanceEntry & {
          blockingDuration?: number;
          scripts?: Array<{ sourceURL?: string; invoker?: string; duration: number }>;
        };
        state.loaf.push({
          duration: loaf.duration,
          blocking: loaf.blockingDuration ?? 0,
          scripts: (loaf.scripts ?? []).map((script) => ({
            source: script.sourceURL || script.invoker || 'unknown',
            durationMs: script.duration,
          })),
        });
      }
    });
    const longTaskObserver = new PerformanceObserver((list) => {
      if (!state.running) return;
      for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
    });

    const readHeap = (): number | null => {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return memory ? memory.usedJSHeapSize : null;
    };

    const rafLoop = (ts: number): void => {
      if (!state.running) return;
      state.rafTs.push(ts);
      state.rafId = requestAnimationFrame(rafLoop);
    };

    const quantile = (sorted: number[], q: number): number => {
      if (sorted.length === 0) return 0;
      const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
      return sorted[index] ?? 0;
    };

    const stats = (values: number[]): ProbeStats => {
      const sorted = [...values].sort((a, b) => a - b);
      const count = sorted.length;
      const mean = count === 0 ? 0 : sorted.reduce((sum, v) => sum + v, 0) / count;
      const variance = count === 0 ? 0 : sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / count;
      return {
        count,
        p50: quantile(sorted, 0.5),
        p95: quantile(sorted, 0.95),
        max: count === 0 ? 0 : sorted[count - 1]!,
        mean,
        stdDev: Math.sqrt(variance),
      };
    };

    const deltas = (timestamps: number[]): number[] => {
      const out: number[] = [];
      for (let i = 1; i < timestamps.length; i += 1) out.push(timestamps[i]! - timestamps[i - 1]!);
      return out;
    };

    w.__mmFrameProbe = {
      start: () => {
        w.gc?.();
        state.rafTs = [];
        state.renderTs = [];
        state.renderJsMs = [];
        state.snapshotMs = [];
        state.restoreMs = [];
        state.latencyMs = [];
        state.inputTs = [];
        state.loaf = [];
        state.longTasks = [];
        state.heapStart = readHeap();
        state.running = true;
        state.startedAt = performance.now();
        if (supportsLoaf) loafObserver.observe({ type: LOAF_TYPE, buffered: false });
        longTaskObserver.observe({ type: 'longtask', buffered: false });
        state.rafId = requestAnimationFrame(rafLoop);
      },
      stop: () => {
        state.running = false;
        state.stoppedAt = performance.now();
        cancelAnimationFrame(state.rafId);
        loafObserver.disconnect();
        longTaskObserver.disconnect();
        const durationMs = state.stoppedAt - state.startedAt;

        const rafDeltas = deltas(state.rafTs);
        const sortedRaf = [...rafDeltas].sort((a, b) => a - b);
        const nominalSample = sortedRaf.slice(0, Math.max(1, Math.floor(sortedRaf.length * NOMINAL_SAMPLE_SHARE)));
        const nominalMs = quantile(nominalSample, 0.5);
        const missedVsyncs = rafDeltas.filter((d) => d > nominalMs * MISSED_VSYNC_FACTOR).length;

        const renderDeltas = deltas(state.renderTs);
        const heapEnd = readHeap();
        const scriptTotals = new Map<string, number>();
        for (const frame of state.loaf) {
          for (const script of frame.scripts) {
            scriptTotals.set(script.source, (scriptTotals.get(script.source) ?? 0) + script.durationMs);
          }
        }
        const topScripts = [...scriptTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([source, durationMs]) => ({ source, durationMs }));

        return {
          durationMs,
          raf: {
            ...stats(rafDeltas),
            nominalMs,
            missedVsyncs,
            missedPct: rafDeltas.length === 0 ? 0 : (missedVsyncs / rafDeltas.length) * 100,
          },
          renders: {
            ...stats(renderDeltas),
            perSec: durationMs === 0 ? 0 : (state.renderTs.length * 1000) / durationMs,
            over34ms: renderDeltas.filter((d) => d > 34).length,
            over50ms: renderDeltas.filter((d) => d > 50).length,
          },
          renderJsMs: stats(state.renderJsMs),
          baseSnapshotMs: stats(state.snapshotMs),
          baseRestoreMs: stats(state.restoreMs),
          inputToRenderMs: stats(state.latencyMs),
          inputEvents: state.inputTs.length,
          longAnimationFrames: {
            supported: supportsLoaf,
            count: state.loaf.length,
            totalMs: state.loaf.reduce((sum, f) => sum + f.duration, 0),
            maxMs: state.loaf.reduce((max, f) => Math.max(max, f.duration), 0),
            blockingMs: state.loaf.reduce((sum, f) => sum + f.blocking, 0),
            topScripts,
          },
          longTasks: {
            count: state.longTasks.length,
            totalMs: state.longTasks.reduce((sum, d) => sum + d, 0),
          },
          heapDeltaMB:
            state.heapStart === null || heapEnd === null ? null : (heapEnd - state.heapStart) / BYTES_PER_MB,
        };
      },
    };
  });
};

export const startFrameProbe = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const probe = (window as FrameProbeWindow).__mmFrameProbe;
    if (!probe) throw new Error('frame probe not installed');
    probe.start();
  });
};

export const stopFrameProbe = async (page: Page): Promise<FrameProbeReport> =>
  page.evaluate(() => {
    const probe = (window as FrameProbeWindow).__mmFrameProbe;
    if (!probe) throw new Error('frame probe not installed');
    return probe.stop();
  });
