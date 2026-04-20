const FLAG_KEY = 'chart.perf';
const SAMPLE_WINDOW_MS = 1000;
const DROPPED_FRAME_THRESHOLD_MS = 33;
const LONG_SECTION_THRESHOLD_MS = 20;
const LONG_SECTION_BUFFER_SIZE = 20;

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

export interface LongSectionEntry {
  name: string;
  ms: number;
  ts: number;
}

export interface PerfSnapshot {
  enabled: boolean;
  fps: number;
  lastFrameMs: number;
  droppedFrames: number;
  sections: PerfSection[];
  longSections: LongSectionEntry[];
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

const EMPTY_SNAPSHOT: PerfSnapshot = {
  enabled: false,
  fps: 0,
  lastFrameMs: 0,
  droppedFrames: 0,
  sections: [],
  longSections: [],
  componentRenders: [],
};

class PerfMonitor {
  private enabled: boolean = readFlag();
  private frameCount: number = 0;
  private fps: number = 0;
  private lastFpsUpdate: number = 0;
  private lastFrameMs: number = 0;
  private droppedFrames: number = 0;
  private sections: Map<string, SectionState> = new Map();
  private longSections: LongSectionEntry[] = [];
  private longSectionsHead: number = 0;
  private componentRenders: Map<string, ComponentState> = new Map();
  private subscribers: Set<() => void> = new Set();
  private lastNotify: number = 0;
  private cachedSnapshot: PerfSnapshot = EMPTY_SNAPSHOT;
  private snapshotDirty: boolean = true;

  isEnabled(): boolean {
    return this.enabled;
  }

  refreshFlag(): void {
    this.enabled = readFlag();
    this.snapshotDirty = true;
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
    if (this.lastFrameMs > DROPPED_FRAME_THRESHOLD_MS) this.droppedFrames += 1;

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
      this.snapshotDirty = true;
      this.maybeNotify(now);
    }
  }

  mark(): number {
    return this.enabled ? performance.now() : 0;
  }

  measure(section: string, startTs: number): void {
    if (!this.enabled) return;
    const now = performance.now();
    const dur = now - startTs;
    const state = this.sections.get(section) ?? { lastMs: 0, sumMs: 0, count: 0 };
    state.lastMs = dur;
    state.sumMs += dur;
    state.count += 1;
    if (state.count > 120) {
      state.sumMs = state.sumMs * (60 / state.count);
      state.count = 60;
    }
    this.sections.set(section, state);
    if (dur > LONG_SECTION_THRESHOLD_MS) {
      const entry: LongSectionEntry = { name: section, ms: dur, ts: now };
      if (this.longSections.length < LONG_SECTION_BUFFER_SIZE) {
        this.longSections.push(entry);
      } else {
        this.longSections[this.longSectionsHead] = entry;
        this.longSectionsHead = (this.longSectionsHead + 1) % LONG_SECTION_BUFFER_SIZE;
      }
      this.snapshotDirty = true;
    }
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
    this.droppedFrames = 0;
    this.sections.clear();
    this.longSections = [];
    this.longSectionsHead = 0;
    this.componentRenders.clear();
    this.snapshotDirty = true;
    this.notifyAll();
  }

  getSnapshot(): PerfSnapshot {
    if (!this.snapshotDirty) return this.cachedSnapshot;

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

    const orderedLongSections: LongSectionEntry[] = [];
    if (this.longSections.length < LONG_SECTION_BUFFER_SIZE) {
      orderedLongSections.push(...this.longSections);
    } else {
      for (let i = 0; i < LONG_SECTION_BUFFER_SIZE; i += 1) {
        const idx = (this.longSectionsHead + i) % LONG_SECTION_BUFFER_SIZE;
        orderedLongSections.push(this.longSections[idx]!);
      }
    }

    const snap: PerfSnapshot = {
      enabled: this.enabled,
      fps: this.fps,
      lastFrameMs: this.lastFrameMs,
      droppedFrames: this.droppedFrames,
      sections,
      longSections: orderedLongSections,
      componentRenders,
    };
    this.cachedSnapshot = snap;
    this.snapshotDirty = false;
    return snap;
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
