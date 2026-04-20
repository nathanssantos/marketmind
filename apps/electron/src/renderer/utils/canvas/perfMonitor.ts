const FLAG_KEY = 'chart.perf';
const SAMPLE_WINDOW_MS = 1000;

const readFlag = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
};

export interface PerfSection {
  name: string;
  lastMs: number;
  avgMs: number;
}

export interface ComponentRenderStat {
  name: string;
  ratePerSec: number;
  total: number;
}

export interface PerfSnapshot {
  enabled: boolean;
  fps: number;
  lastFrameMs: number;
  sections: PerfSection[];
  componentRenders: ComponentRenderStat[];
}

interface SectionState {
  lastMs: number;
  sumMs: number;
  count: number;
}

interface ComponentState {
  count: number;
  total: number;
  windowStart: number;
}

class PerfMonitor {
  private enabled: boolean = readFlag();
  private frameCount: number = 0;
  private fps: number = 0;
  private lastFpsUpdate: number = 0;
  private lastFrameMs: number = 0;
  private sections: Map<string, SectionState> = new Map();
  private componentRenders: Map<string, ComponentState> = new Map();
  private subscribers: Set<() => void> = new Set();
  private lastNotify: number = 0;

  isEnabled(): boolean {
    return this.enabled;
  }

  refreshFlag(): void {
    this.enabled = readFlag();
    this.notifyAll();
  }

  beginFrame(): number {
    return this.enabled ? performance.now() : 0;
  }

  endFrame(startTs: number): void {
    if (!this.enabled) return;
    const now = performance.now();
    this.lastFrameMs = now - startTs;
    this.frameCount += 1;

    if (this.lastFpsUpdate === 0) this.lastFpsUpdate = now;
    const elapsed = now - this.lastFpsUpdate;
    if (elapsed >= SAMPLE_WINDOW_MS) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
      for (const [, state] of this.componentRenders) {
        if (now - state.windowStart >= SAMPLE_WINDOW_MS) {
          state.count = 0;
          state.windowStart = now;
        }
      }
      this.maybeNotify(now);
    }
  }

  mark(): number {
    return this.enabled ? performance.now() : 0;
  }

  measure(section: string, startTs: number): void {
    if (!this.enabled) return;
    const dur = performance.now() - startTs;
    const state = this.sections.get(section) ?? { lastMs: 0, sumMs: 0, count: 0 };
    state.lastMs = dur;
    state.sumMs += dur;
    state.count += 1;
    if (state.count > 120) {
      state.sumMs = state.sumMs * (60 / state.count);
      state.count = 60;
    }
    this.sections.set(section, state);
  }

  recordComponentRender(componentName: string): void {
    if (!this.enabled) return;
    const now = performance.now();
    const state = this.componentRenders.get(componentName) ?? { count: 0, total: 0, windowStart: now };
    state.count += 1;
    state.total += 1;
    if (now - state.windowStart >= SAMPLE_WINDOW_MS) {
      state.count = 1;
      state.windowStart = now;
    }
    this.componentRenders.set(componentName, state);
  }

  reset(): void {
    this.frameCount = 0;
    this.fps = 0;
    this.lastFpsUpdate = 0;
    this.lastFrameMs = 0;
    this.sections.clear();
    this.componentRenders.clear();
    this.notifyAll();
  }

  getSnapshot(): PerfSnapshot {
    const sections: PerfSection[] = [];
    for (const [name, state] of this.sections) {
      sections.push({
        name,
        lastMs: state.lastMs,
        avgMs: state.count > 0 ? state.sumMs / state.count : 0,
      });
    }
    sections.sort((a, b) => b.lastMs - a.lastMs);

    const now = performance.now();
    const componentRenders: ComponentRenderStat[] = [];
    for (const [name, state] of this.componentRenders) {
      const elapsed = Math.max(1, now - state.windowStart);
      componentRenders.push({
        name,
        ratePerSec: (state.count * 1000) / elapsed,
        total: state.total,
      });
    }
    componentRenders.sort((a, b) => b.ratePerSec - a.ratePerSec);

    return {
      enabled: this.enabled,
      fps: this.fps,
      lastFrameMs: this.lastFrameMs,
      sections,
      componentRenders,
    };
  }

  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private maybeNotify(now: number): void {
    if (now - this.lastNotify < 250) return;
    this.lastNotify = now;
    this.notifyAll();
  }

  private notifyAll(): void {
    for (const cb of this.subscribers) cb();
  }
}

export const perfMonitor = new PerfMonitor();

if (typeof window !== 'undefined') {
  (window as unknown as { __mmPerf: PerfMonitor }).__mmPerf = perfMonitor;
}
