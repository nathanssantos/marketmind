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

interface BoundsCache {
  bounds: Bounds | null;
  viewportStart: number;
  viewportEnd: number;
  klinesLength: number;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private klines: Kline[] = [];
  private viewport: Viewport;
  private bounds: Bounds | null = null;
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
  private boundsCache: BoundsCache = { bounds: null, viewportStart: 0, viewportEnd: 0, klinesLength: 0 };
  private resizeObserver: ResizeObserver | null = null;
  private paddingTop: number = CHART_CONFIG.CANVAS_PADDING_TOP;
  private paddingBottom: number = CHART_CONFIG.CANVAS_PADDING_BOTTOM;

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

    if (!globalThis.__canvasManagerInstances) {
      globalThis.__canvasManagerInstances = new Set();
    }
    globalThis.__canvasManagerInstances.add(this);
  }

  private observeResize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.ctx = setupCanvas(this.canvas);
      this.updateDimensions();
      this.updateKlineWidth();
      this.markDirty('all');
    });
    this.resizeObserver.observe(parent);
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

      if (elapsed < this.minFrameTime && !this.dirtyFlags.all) {
        this.isAnimating = false;
        this.scheduleRender();
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
    this.scheduleRender();
  }

  public clearDirtyFlags(): void {
    this.dirtyFlags = { klines: false, viewport: false, dimensions: false, overlays: false, all: false };
  }

  public getDirtyFlags(): Readonly<DirtyFlags> {
    return { ...this.dirtyFlags };
  }

  private initialize(): void {
    this.ctx = setupCanvas(this.canvas);
    this.updateDimensions();
    this.updateKlineWidth();
  }

  private updateDimensions(): void {
    const rect = this.canvas.getBoundingClientRect();
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
    const oldLast = this.klines[this.klines.length - 1];
    const newLast = klines[klines.length - 1];

    const changed =
      this.klines.length !== klines.length || !oldLast || !newLast ||
      oldLast.openTime !== newLast.openTime || oldLast.open !== newLast.open ||
      oldLast.high !== newLast.high || oldLast.low !== newLast.low ||
      oldLast.close !== newLast.close || oldLast.volume !== newLast.volume;

    if (changed) {
      this.boundsCache = { bounds: null, viewportStart: 0, viewportEnd: 0, klinesLength: 0 };
    }

    this.klines = klines;
    this.updateBounds();
    if (changed) this.markDirty('klines');
  }

  public getKlines(): Kline[] { return this.klines; }

  public setViewport(viewport: Viewport): void {
    const changed =
      this.viewport.start !== viewport.start ||
      this.viewport.end !== viewport.end ||
      this.viewport.klineWidth !== viewport.klineWidth;

    this.viewport = clampViewport(viewport, this.klines.length);
    this.updateBounds();
    if (changed) this.markDirty('viewport');
  }

  public getViewport(): Viewport { return this.viewport; }

  private updateBounds(): void {
    if (this.klines.length === 0) {
      this.bounds = null;
      this.boundsCache = { bounds: null, viewportStart: 0, viewportEnd: 0, klinesLength: 0 };
      return;
    }

    const start = Math.floor(this.viewport.start);
    const end = Math.ceil(this.viewport.end);

    const canUseCached = this.boundsCache.bounds &&
      start >= this.boundsCache.viewportStart &&
      end <= this.boundsCache.viewportEnd &&
      this.klines.length === this.boundsCache.klinesLength;

    const baseBounds = canUseCached
      ? this.boundsCache.bounds!
      : calculateBounds(this.klines, this.viewport);

    if (!canUseCached) {
      this.boundsCache = { bounds: baseBounds, viewportStart: start, viewportEnd: end, klinesLength: this.klines.length };
    }

    this.bounds = applyBoundsTransform(baseBounds, this.priceOffset, this.priceScale);
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
    this.updateBounds();
    this.markDirty('all');
  }

  public setChartPadding(top: number, bottom: number): void {
    this.paddingTop = top;
    this.paddingBottom = bottom;
  }

  public priceToY(price: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return priceToY(price, this.bounds, this.dimensions, this.paddingTop, this.paddingBottom);
  }

  public yToPrice(y: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return yToPrice(y, this.bounds, this.dimensions, this.paddingTop, this.paddingBottom);
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
    this.updateBounds();
    this.markDirty('viewport');
  }

  public pan(deltaX: number): void {
    if (!this.dimensions) return;
    this.viewport = panViewport(this.viewport, this.dimensions, this.klines, deltaX);
    this.updateBounds();
    this.markDirty('viewport');
  }

  public panVertical(deltaY: number): void {
    if (!this.dimensions) return;
    this.priceOffset = panVerticalOffset(this.priceOffset, deltaY, this.dimensions.chartHeight, this.klines, this.viewport, this.priceScale);
    this.updateBounds();
    this.markDirty('viewport');
  }

  public zoomVertical(deltaY: number): void {
    if (!this.bounds || !this.dimensions) return;
    this.priceScale = zoomVerticalScale(this.priceScale, deltaY, this.dimensions.chartHeight);
    this.updateBounds();
    this.markDirty('viewport');
  }

  public resetVerticalZoom(): void {
    this.priceOffset = 0;
    this.priceScale = 1;
    this.updateBounds();
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
      this.updateBounds();
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
