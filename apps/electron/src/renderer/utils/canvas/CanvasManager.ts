import type { Kline, Viewport } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants';
import {
    calculateBounds,
    clampViewport,
    priceToY,
    volumeToHeight,
    yToPrice,
    type Bounds,
    type Dimensions,
} from './coordinateSystem';
import { clearCanvas, setupCanvas } from './drawingUtils';
import { PanelManager, type PanelConfig } from './PanelManager';
import {
    applyBoundsTransform,
    calculateInitialView,
    calculateKlineWidth,
    getMaxViewportEnd,
    panVerticalOffset,
    panViewport,
    zoomVerticalScale,
    zoomViewport,
} from './ViewportNavigator';

export type { PanelConfig };

export interface DirtyFlags {
  klines: boolean;
  viewport: boolean;
  dimensions: boolean;
  overlays: boolean;
  all: boolean;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private klines: Kline[] = [];
  private viewport: Viewport;
  private bounds: Bounds | null = null;
  // Y-axis "lock" — the un-transformed (raw min/max) bounds captured
  // at the last explicit fit event (initial load, symbol/interval/
  // chart-type change, `>>` reset, vertical zoom reset). Horizontal
  // pan / zoom / new-tick updates DO NOT recompute this; the visible
  // bounds are derived by re-applying the user's vertical transform
  // (priceOffset/priceScale) onto these locked raw bounds. This is
  // the market-standard camera behavior — TradingView, Binance and
  // IBKR all keep Y sticky during horizontal pan, allowing price to
  // exit the viewport vertically until the user explicitly refits.
  private rawBaseBounds: Bounds | null = null;
  private dimensions: Dimensions | null = null;
  private padding: number;
  private renderCallback: (() => void) | null = null;
  private priceOffset: number = 0;
  private priceScale: number = 1;
  private panelManager: PanelManager = new PanelManager();
  private animationFrameId: number | null = null;
  private isAnimating: boolean = false;
  private dirtyFlags: DirtyFlags = {
    klines: true,
    viewport: true,
    dimensions: true,
    overlays: true,
    all: true,
  };
  private lastRenderTime: number = 0;
  private minFrameTime: number = 16;
  private viewportFrameTime: number = 33;
  private overlayOnlyFrameTime: number = 33;
  private lastViewportDirtyAt: number = 0;
  private frameCache: Map<unknown, unknown> | null = null;
  private frameCacheGeneration: number = 0;
  private offscreen: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private offscreenValid: boolean = false;
  private resizeObserver: ResizeObserver | null = null;
  // Cached canvas bounding rect — populated on init + every ResizeObserver
  // tick. Read by interaction handlers (wheel, mousedown) so they don't
  // call getBoundingClientRect during pan/zoom (forced reflow).
  private cachedRect: DOMRectReadOnly | null = null;
  private paddingTop: number = CHART_CONFIG.CANVAS_PADDING_TOP;
  private paddingBottom: number = CHART_CONFIG.CANVAS_PADDING_BOTTOM;
  private flipped: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    padding: number = 40,
  ) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.padding = padding;
    this.initialize();
    this.observeResize();

    globalThis.__canvasManagerInstances ??= new Set();
    globalThis.__canvasManagerInstances.add(this);
  }

  private resizeRafId: number | null = null;
  private observeResize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.resizeRafId !== null) return;
      this.resizeRafId = requestAnimationFrame(() => {
        this.resizeRafId = null;
        this.ctx = setupCanvas(this.canvas);
        this.cachedRect = this.canvas.getBoundingClientRect();
        this.updateDimensions();
        this.updateKlineWidth();
        this.offscreenValid = false;
        this.markDirty('all');
      });
    });
    this.resizeObserver.observe(parent);
  }

  /**
   * Returns the canvas bounding rect from a ResizeObserver-maintained
   * cache. Avoids the forced-reflow cost of calling
   * `getBoundingClientRect()` on every wheel / mousedown event during
   * pan/zoom interactions. The cache is invalidated and refreshed
   * whenever ResizeObserver fires.
   *
   * Falls back to a live `getBoundingClientRect()` only on the first
   * call before any resize tick has populated the cache (cold start).
   */
  public getCachedRect(): DOMRectReadOnly {
    if (this.cachedRect) return this.cachedRect;
    this.cachedRect = this.canvas.getBoundingClientRect();
    return this.cachedRect;
  }

  public setRenderCallback(callback: (() => void) | null): void {
    this.renderCallback = callback;
    if (callback) this.scheduleRender();
  }

  private scheduleRender(): void {
    if (this.isAnimating || !this.isDirty()) return;

    this.isAnimating = true;
    this.animationFrameId = requestAnimationFrame(() => {
      const now = performance.now();
      const elapsed = now - this.lastRenderTime;

      const f = this.dirtyFlags;
      const isOverlayOnly = f.overlays && !f.all && !f.klines && !f.viewport && !f.dimensions;
      const isViewportOnly = f.viewport && !f.all && !f.klines && !f.dimensions;
      const budget = isOverlayOnly
        ? this.overlayOnlyFrameTime
        : isViewportOnly
          ? this.viewportFrameTime
          : this.minFrameTime;

      if (elapsed < budget && !f.all) {
        this.isAnimating = false;
        this.scheduleRender();
        return;
      }

      // Bail on a zero-size canvas (macOS hands us this during display
      // reconfiguration / Space switch). Drawing into it loses GPU state
      // and the next valid frame restores from a corrupted snapshot.
      // Keep dirty flags so the next rAF retries once dimensions return.
      if (!this.canvas.width || !this.canvas.height) {
        this.isAnimating = false;
        this.animationFrameId = null;
        if (this.isDirty()) this.scheduleRender();
        return;
      }

      if (this.renderCallback && this.isDirty()) {
        this.renderCallback();
        this.lastRenderTime = now;
      }

      this.isAnimating = false;
      this.animationFrameId = null;
    });
  }

  public isDirty(): boolean {
    return this.dirtyFlags.all ||
           this.dirtyFlags.klines ||
           this.dirtyFlags.viewport ||
           this.dirtyFlags.dimensions ||
           this.dirtyFlags.overlays;
  }

  public markDirty(flag: keyof DirtyFlags = 'all'): void {
    this.dirtyFlags[flag] = true;
    if (flag !== 'overlays') this.offscreenValid = false;
    if (flag === 'viewport') this.lastViewportDirtyAt = performance.now();
    this.scheduleRender();
  }

  public isRecentlyPanning(windowMs: number = 200): boolean {
    return performance.now() - this.lastViewportDirtyAt < windowMs;
  }

  public clearDirtyFlags(): void {
    this.dirtyFlags = { klines: false, viewport: false, dimensions: false, overlays: false, all: false };
    if (this.frameCache) this.frameCache.clear();
    this.frameCacheGeneration++;
  }

  public getFrameCached<T>(key: unknown, compute: () => T): T {
    this.frameCache ??= new Map();
    if (this.frameCache.has(key)) return this.frameCache.get(key) as T;
    const value = compute();
    this.frameCache.set(key, value);
    return value;
  }

  public getFrameGeneration(): number {
    return this.frameCacheGeneration;
  }

  private ensureOffscreen(): boolean {
    if (!this.canvas.width || !this.canvas.height) return false;
    this.offscreen ??= document.createElement('canvas');
    if (this.offscreen.width !== this.canvas.width || this.offscreen.height !== this.canvas.height) {
      this.offscreen.width = this.canvas.width;
      this.offscreen.height = this.canvas.height;
      this.offscreenCtx = this.offscreen.getContext('2d');
      this.offscreenValid = false;
    }
    this.offscreenCtx ??= this.offscreen.getContext('2d');
    return this.offscreenCtx !== null;
  }

  public snapshotBaseLayer(): void {
    if (!this.ensureOffscreen() || !this.offscreen || !this.offscreenCtx) return;
    this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.offscreenCtx.clearRect(0, 0, this.offscreen.width, this.offscreen.height);
    this.offscreenCtx.drawImage(this.canvas, 0, 0);
    this.offscreenValid = true;
  }

  public restoreBaseLayer(): boolean {
    if (!this.ctx || !this.offscreen || !this.offscreenValid) return false;
    // Snapshot can become stale dimensionally if the canvas resized
    // while the window was hidden / on another Space (offscreen still
    // holds the previous size). Drawing it produces a stretched/skewed
    // base that overlays paint on top of, surfacing as malformed
    // candles. Treat dimension drift as no-snapshot to force a clean
    // full re-render that frame.
    if (this.offscreen.width !== this.canvas.width || this.offscreen.height !== this.canvas.height) {
      this.offscreenValid = false;
      return false;
    }
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.offscreen, 0, 0);
    this.ctx.restore();
    return true;
  }

  public invalidateBaseLayer(): void {
    this.offscreenValid = false;
  }

  public hasBaseSnapshot(): boolean {
    return this.offscreenValid;
  }

  public getDirtyFlags(): Readonly<DirtyFlags> {
    return { ...this.dirtyFlags };
  }

  private initialize(): void {
    this.ctx = setupCanvas(this.canvas);
    this.cachedRect = this.canvas.getBoundingClientRect();
    this.updateDimensions();
    this.updateKlineWidth();
  }

  private updateDimensions(): void {
    // Read from the ResizeObserver-maintained cache rather than forcing
    // a fresh `getBoundingClientRect()` on every dirty pass.
    const rect = this.getCachedRect();
    const totalPanelHeight = this.panelManager.getTotalPanelHeight();
    const chartHeight = rect.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM - totalPanelHeight - this.panelManager.getEventRowHeight();

    this.dimensions = {
      width: rect.width,
      height: rect.height,
      chartHeight,
      volumeHeight: 0,
      chartWidth: rect.width - CHART_CONFIG.CANVAS_PADDING_RIGHT,
    };

    this.markDirty('dimensions');
  }

  public setKlines(klines: Kline[]): void {
    const oldFirst = this.klines[0];
    const oldLast = this.klines[this.klines.length - 1];
    const newFirst = klines[0];
    const newLast = klines[klines.length - 1];

    const changed =
      this.klines.length !== klines.length || !oldLast || oldLast.openTime !== newLast?.openTime || oldLast.open !== newLast.open ||
      oldLast.high !== newLast.high || oldLast.low !== newLast.low ||
      oldLast.close !== newLast.close || oldLast.volume !== newLast.volume;

    // First-openTime change = pagination prepend, symbol swap, or
    // timeframe swap. Force a full re-snapshot so the offscreen base
    // layer doesn't keep stale candle geometry around.
    const firstChanged = (oldFirst?.openTime ?? 0) !== (newFirst?.openTime ?? 0);

    this.klines = klines;
    // Refit Y only when the dataset's anchor changes (initial load,
    // symbol swap, timeframe swap, pagination prepend) — a plain
    // last-candle tick keeps the locked bounds so the user's price
    // scale doesn't twitch on every WS update.
    if (firstChanged || this.rawBaseBounds === null) {
      this.refitBaseBounds();
    }
    if (firstChanged) {
      this.markDirty('all');
    } else if (changed) {
      this.markDirty('klines');
    }
  }

  public getKlines(): Kline[] { return this.klines; }

  public setViewport(viewport: Viewport): void {
    const changed =
      this.viewport.start !== viewport.start ||
      this.viewport.end !== viewport.end ||
      this.viewport.klineWidth !== viewport.klineWidth;

    this.viewport = clampViewport(viewport, this.klines.length);
    this.applyTransform();
    if (changed) this.markDirty('viewport');
  }

  public getViewport(): Viewport { return this.viewport; }

  /**
   * Refit Y-axis to the current viewport's raw min/max — the only path
   * that actually mutates `rawBaseBounds`. Called at chart load, on
   * symbol/interval/chart-type swap, on `>>` reset, on vertical-zoom
   * reset, and on resize. Horizontal pan/zoom must NOT call this.
   */
  private refitBaseBounds(): void {
    if (this.klines.length === 0) {
      this.bounds = null;
      this.rawBaseBounds = null;
      return;
    }
    this.rawBaseBounds = calculateBounds(this.klines, this.viewport);
    this.bounds = applyBoundsTransform(this.rawBaseBounds, this.priceOffset, this.priceScale);
  }

  /**
   * Re-apply the current vertical transform (priceOffset/priceScale)
   * onto the locked `rawBaseBounds`, leaving the raw bounds untouched.
   * Used by every viewport mutation that should NOT refit Y: horizontal
   * pan, horizontal zoom, vertical pan, vertical zoom, setViewport,
   * panToNextKline. The first call falls back to `refitBaseBounds()`
   * so the very first render still has bounds.
   */
  private applyTransform(): void {
    if (!this.rawBaseBounds) {
      this.refitBaseBounds();
      return;
    }
    if (this.klines.length === 0) {
      this.bounds = null;
      return;
    }
    this.bounds = applyBoundsTransform(this.rawBaseBounds, this.priceOffset, this.priceScale);
  }

  public getBounds(): Bounds | null { return this.bounds; }
  public getDimensions(): Dimensions | null { return this.dimensions; }
  public getContext(): CanvasRenderingContext2D | null { return this.ctx; }
  public setRightMargin(_margin: number): void {}

  public setPanelHeight(panelId: string, height: number): void {
    if (this.panelManager.setPanelHeight(panelId, height)) {
      this.updateDimensions();
      this.markDirty('dimensions');
    }
  }

  public getPanelHeight(panelId: string): number { return this.panelManager.getPanelHeight(panelId); }
  public getTotalPanelHeight(): number { return this.panelManager.getTotalPanelHeight(); }

  public getPanelTop(panelId: string): number {
    if (!this.dimensions) return 0;
    return this.panelManager.getPanelTop(panelId, this.dimensions.chartHeight);
  }

  public getActivePanels(): PanelConfig[] { return this.panelManager.getActivePanels(); }

  public setStochasticPanelHeight(height: number): void { this.setPanelHeight('stochastic', height); }
  public getStochasticPanelHeight(): number { return this.getPanelHeight('stochastic'); }
  public setRSIPanelHeight(height: number): void { this.setPanelHeight('rsi', height); }
  public getRSIPanelHeight(): number { return this.getPanelHeight('rsi'); }

  public getPanelInfo(panelId: string): { y: number; height: number } | null {
    if (!this.dimensions) return null;
    return this.panelManager.getPanelInfo(panelId, this.dimensions.chartHeight);
  }

  public setEventRowHeight(height: number): void {
    if (this.panelManager.setEventRowHeight(height)) this.updateDimensions();
  }

  public getEventRowHeight(): number { return this.panelManager.getEventRowHeight(); }

  public getEventRowY(): number {
    if (!this.dimensions) return 0;
    return this.panelManager.getEventRowY(this.dimensions.chartHeight);
  }

  public clear(): void {
    if (!this.ctx || !this.dimensions) return;
    clearCanvas(this.ctx, this.dimensions.width, this.dimensions.height);
  }

  public resize(): void {
    this.initialize();
    this.applyTransform();
    this.markDirty('all');
  }

  public setChartPadding(top: number, bottom: number): void {
    this.paddingTop = top;
    this.paddingBottom = bottom;
  }

  public setFlipped(flipped: boolean): void {
    if (this.flipped === flipped) return;
    this.flipped = flipped;
    this.markDirty('all');
  }

  public isFlipped(): boolean {
    return this.flipped;
  }

  public priceToY(price: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return priceToY(price, this.bounds, this.dimensions, this.paddingTop, this.paddingBottom, this.flipped);
  }

  public yToPrice(y: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return yToPrice(y, this.bounds, this.dimensions, this.paddingTop, this.paddingBottom, this.flipped);
  }

  public volumeToHeight(volume: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return volumeToHeight(volume, this.bounds, this.dimensions);
  }

  public indexToX(index: number): number {
    if (!this.dimensions) return 0;
    const visibleRange = this.viewport.end - this.viewport.start;
    if (visibleRange === 0) return 0;
    return (index - this.viewport.start) * (this.dimensions.chartWidth / visibleRange);
  }

  public indexToCenterX(index: number): number {
    if (!this.dimensions) return 0;
    const visibleRange = this.viewport.end - this.viewport.start;
    if (visibleRange === 0) return 0;
    const widthPerKline = this.dimensions.chartWidth / visibleRange;
    return (index - this.viewport.start) * widthPerKline + widthPerKline / 2;
  }

  public xToIndex(x: number): number {
    if (!this.dimensions) return 0;
    const visibleRange = this.viewport.end - this.viewport.start;
    if (visibleRange === 0) return this.viewport.start;
    return this.viewport.start + x / (this.dimensions.chartWidth / visibleRange);
  }

  public timeToIndex(timestamp: number): number {
    if (this.klines.length === 0) return -1;
    let left = 0;
    let right = this.klines.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const klineTime = typeof this.klines[mid]!.openTime === 'number'
        ? this.klines[mid]!.openTime
        : new Date(this.klines[mid]!.openTime).getTime();

      if (klineTime < timestamp) left = mid + 1;
      else right = mid;
    }
    return left;
  }

  public timestampToIndex(timestamp: number, intervalMs: number): number {
    if (this.klines.length === 0) return 0;
    const lastKline = this.klines[this.klines.length - 1]!;
    const lastOpenTime = typeof lastKline.openTime === 'number'
      ? lastKline.openTime
      : new Date(lastKline.openTime).getTime();

    if (timestamp <= lastOpenTime) return this.timeToIndex(timestamp);
    return this.klines.length - 1 + Math.ceil((timestamp - lastOpenTime) / intervalMs);
  }

  public timestampToX(timestamp: number, intervalMs: number): number {
    return this.indexToCenterX(this.timestampToIndex(timestamp, intervalMs));
  }

  public getKlineCount(): number { return this.klines.length; }

  public getMaxViewportEnd(): number {
    return getMaxViewportEnd(this.klines, this.viewport);
  }

  public getVisibleKlines(): Kline[] {
    const start = Math.floor(this.viewport.start);
    const end = Math.min(Math.ceil(this.viewport.end), this.klines.length);
    return this.klines.slice(start, end);
  }

  public zoom(delta: number, centerX?: number): void {
    if (!this.dimensions) return;
    this.viewport = zoomViewport(
      { viewport: this.viewport, priceOffset: this.priceOffset, priceScale: this.priceScale },
      this.dimensions, this.klines, delta, centerX
    );
    this.updateKlineWidth();
    // Horizontal zoom keeps Y bounds locked — re-apply transform only.
    this.applyTransform();
    this.markDirty('viewport');
  }

  public pan(deltaX: number): void {
    if (!this.dimensions) return;
    this.viewport = panViewport(this.viewport, this.dimensions, this.klines, deltaX);
    // Horizontal pan keeps Y bounds locked — re-apply transform only.
    this.applyTransform();
    this.markDirty('viewport');
  }

  public panVertical(deltaY: number): void {
    if (!this.dimensions) return;
    const adjustedDeltaY = this.flipped ? -deltaY : deltaY;
    // Pass the LOCKED rawBaseBounds — not re-derived bounds — so the
    // priceDelta basis matches what the chart is actually drawing.
    // See `panVerticalOffset` doc for the bug history.
    this.priceOffset = panVerticalOffset(this.priceOffset, adjustedDeltaY, this.dimensions.chartHeight, this.rawBaseBounds, this.priceScale);
    this.applyTransform();
    this.markDirty('viewport');
  }

  public zoomVertical(deltaY: number): void {
    if (!this.bounds || !this.dimensions) return;
    this.priceScale = zoomVerticalScale(this.priceScale, deltaY, this.dimensions.chartHeight);
    this.applyTransform();
    this.markDirty('viewport');
  }

  public resetVerticalZoom(): void {
    this.priceOffset = 0;
    this.priceScale = 1;
    // Reset is one of the explicit refit triggers — re-anchor base
    // bounds to the current viewport so the user sees a clean fit.
    this.refitBaseBounds();
    this.markDirty('viewport');
  }

  public resetForSymbolChange(): void {
    this.resetVerticalZoom();
    this.updateKlineWidth();
    this.markDirty('all');
  }

  public resetToInitialView(): void {
    this.viewport = calculateInitialView(this.klines, this.viewport);
    this.resetVerticalZoom();
    this.updateKlineWidth();
    this.markDirty('all');
  }

  public panToNextKline(): void {
    if (this.klines.length === 0) return;
    const newEnd = this.viewport.end + 1;
    if (newEnd <= this.getMaxViewportEnd()) {
      this.viewport = { ...this.viewport, start: this.viewport.start + 1, end: newEnd };
      this.updateKlineWidth();
      this.applyTransform();
      this.markDirty('viewport');
    }
  }

  private updateKlineWidth(): void {
    if (!this.dimensions) return;
    this.viewport.klineWidth = calculateKlineWidth(this.viewport, this.dimensions.chartWidth);
  }

  public getKlineAtX(x: number): Kline | null {
    return this.klines[Math.floor(this.xToIndex(x))] ?? null;
  }

  public getPadding(): number { return this.padding; }

  public destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.isAnimating = false;
    this.renderCallback = null;

    if (this.ctx) {
      this.clear();
      this.ctx = null;
    }

    this.klines = [];
    this.bounds = null;
    this.dimensions = null;

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }

    if (globalThis.__canvasManagerInstances) {
      globalThis.__canvasManagerInstances.delete(this);
    }
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (globalThis.__canvasManagerInstances) {
      globalThis.__canvasManagerInstances.forEach((manager: CanvasManager) => {
        manager.destroy();
      });
      globalThis.__canvasManagerInstances.clear();
    }
  });
}
