import type { Kline, Viewport } from '@marketmind/types';
import { CHART_CONFIG, PANEL_RENDER_ORDER, type PanelId } from '@shared/constants';
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

export interface DirtyFlags {
  klines: boolean;
  viewport: boolean;
  dimensions: boolean;
  overlays: boolean;
  all: boolean;
}

export interface PanelConfig {
  id: string;
  height: number;
  order: number;
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
  private panels: Map<string, PanelConfig> = new Map();
  private eventRowHeight: number = 0;
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
  private cachedTotalPanelHeight: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    padding: number = 40,
  ) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.padding = padding;
    this.initialize();
    
    if (!globalThis.__canvasManagerInstances) {
      globalThis.__canvasManagerInstances = new Set();
    }
    globalThis.__canvasManagerInstances.add(this);
  }

  public setRenderCallback(callback: (() => void) | null): void {
    this.renderCallback = callback;
    if (callback) {
      this.scheduleRender();
    }
  }

  private scheduleRender(): void {
    if (this.isAnimating) return;
    
    if (!this.isDirty()) return;
    
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
    this.dirtyFlags = {
      klines: false,
      viewport: false,
      dimensions: false,
      overlays: false,
      all: false,
    };
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
    const totalPanelHeight = this.getTotalPanelHeight();
    const chartHeight = rect.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM - totalPanelHeight - this.eventRowHeight;
    const chartWidth = rect.width - CHART_CONFIG.CANVAS_PADDING_RIGHT;

    this.dimensions = {
      width: rect.width,
      height: rect.height,
      chartHeight,
      volumeHeight: 0,
      chartWidth,
    };

    this.markDirty('dimensions');
  }

  public setKlines(klines: Kline[]): void {
    const oldLastKline = this.klines[this.klines.length - 1];
    const newLastKline = klines[klines.length - 1];

    const klinesChanged =
      this.klines.length !== klines.length ||
      !oldLastKline ||
      !newLastKline ||
      oldLastKline.openTime !== newLastKline.openTime ||
      oldLastKline.open !== newLastKline.open ||
      oldLastKline.high !== newLastKline.high ||
      oldLastKline.low !== newLastKline.low ||
      oldLastKline.close !== newLastKline.close ||
      oldLastKline.volume !== newLastKline.volume;

    if (klinesChanged) {
      this.boundsCache = { bounds: null, viewportStart: 0, viewportEnd: 0, klinesLength: 0 };
    }

    this.klines = klines;
    this.updateBounds();

    if (klinesChanged) {
      this.markDirty('klines');
    }
  }

  public getKlines(): Kline[] {
    return this.klines;
  }

  public setViewport(viewport: Viewport): void {
    const viewportChanged = 
      this.viewport.start !== viewport.start ||
      this.viewport.end !== viewport.end ||
      this.viewport.klineWidth !== viewport.klineWidth;
      
    this.viewport = clampViewport(viewport, this.klines.length);
    this.updateBounds();
    
    if (viewportChanged) {
      this.markDirty('viewport');
    }
  }

  public getViewport(): Viewport {
    return this.viewport;
  }

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
      this.boundsCache = {
        bounds: baseBounds,
        viewportStart: start,
        viewportEnd: end,
        klinesLength: this.klines.length,
      };
    }

    const center = (baseBounds.minPrice + baseBounds.maxPrice) / 2;
    const range = (baseBounds.maxPrice - baseBounds.minPrice) * this.priceScale;

    this.bounds = {
      ...baseBounds,
      minPrice: center - range / 2 + this.priceOffset,
      maxPrice: center + range / 2 + this.priceOffset,
    };
  }

  public getBounds(): Bounds | null {
    return this.bounds;
  }

  public getDimensions(): Dimensions | null {
    return this.dimensions;
  }

  public getContext(): CanvasRenderingContext2D | null {
    return this.ctx;
  }

  public setRightMargin(_margin: number): void {
    // No-op: rightMargin is no longer used in coordinate calculations
    // The chart now uses the full chartWidth and allows scrolling into future
  }

  public setPanelHeight(panelId: string, height: number): void {
    const existingPanel = this.panels.get(panelId);
    const order = PANEL_RENDER_ORDER.indexOf(panelId as PanelId);
    const panelOrder = order >= 0 ? order : this.panels.size;
    const oldHeight = existingPanel?.height ?? 0;

    if (height === 0) {
      if (existingPanel) {
        this.cachedTotalPanelHeight -= oldHeight;
        this.panels.delete(panelId);
        this.updateDimensions();
        this.markDirty('dimensions');
      }
      return;
    }

    if (!existingPanel || existingPanel.height !== height) {
      this.cachedTotalPanelHeight += height - oldHeight;
      this.panels.set(panelId, { id: panelId, height, order: panelOrder });
      this.updateDimensions();
      this.markDirty('dimensions');
    }
  }

  public getPanelHeight(panelId: string): number {
    return this.panels.get(panelId)?.height ?? 0;
  }

  public getTotalPanelHeight(): number {
    return this.cachedTotalPanelHeight;
  }

  public getPanelTop(panelId: string): number {
    if (!this.dimensions) return 0;
    const sortedPanels = this.getActivePanels();
    let top = this.dimensions.chartHeight;

    for (const panel of sortedPanels) {
      if (panel.id === panelId) return top;
      top += panel.height;
    }
    return top;
  }

  public getActivePanels(): PanelConfig[] {
    return Array.from(this.panels.values()).sort((a, b) => a.order - b.order);
  }

  public setStochasticPanelHeight(height: number): void {
    this.setPanelHeight('stochastic', height);
  }

  public getStochasticPanelHeight(): number {
    return this.getPanelHeight('stochastic');
  }

  public setRSIPanelHeight(height: number): void {
    this.setPanelHeight('rsi', height);
  }

  public getRSIPanelHeight(): number {
    return this.getPanelHeight('rsi');
  }

  public getPanelInfo(panelId: string): { y: number; height: number } | null {
    const height = this.getPanelHeight(panelId);
    if (height === 0) return null;
    if (!this.dimensions) return null;
    const panelTop = this.getPanelTop(panelId);
    return { y: panelTop, height };
  }

  public setEventRowHeight(height: number): void {
    if (this.eventRowHeight === height) return;
    this.eventRowHeight = height;
    this.updateDimensions();
  }

  public getEventRowHeight(): number {
    return this.eventRowHeight;
  }

  public getEventRowY(): number {
    if (!this.dimensions) return 0;
    return this.dimensions.chartHeight + this.getTotalPanelHeight();
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

  public priceToY(price: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return priceToY(
      price,
      this.bounds,
      this.dimensions,
      CHART_CONFIG.CANVAS_PADDING_TOP,
      CHART_CONFIG.CANVAS_PADDING_BOTTOM,
    );
  }

  public yToPrice(y: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return yToPrice(
      y,
      this.bounds,
      this.dimensions,
      CHART_CONFIG.CANVAS_PADDING_TOP,
      CHART_CONFIG.CANVAS_PADDING_BOTTOM,
    );
  }

  public volumeToHeight(volume: number): number {
    if (!this.bounds || !this.dimensions) return 0;
    return volumeToHeight(volume, this.bounds, this.dimensions);
  }

  public indexToX(index: number): number {
    if (!this.dimensions) return 0;
    const visibleRange = this.viewport.end - this.viewport.start;
    if (visibleRange === 0) return 0;
    const widthPerKline = this.dimensions.chartWidth / visibleRange;
    const relativeIndex = index - this.viewport.start;
    return relativeIndex * widthPerKline;
  }

  public indexToCenterX(index: number): number {
    if (!this.dimensions) return 0;
    const visibleRange = this.viewport.end - this.viewport.start;
    if (visibleRange === 0) return 0;
    const widthPerKline = this.dimensions.chartWidth / visibleRange;
    const relativeIndex = index - this.viewport.start;
    return relativeIndex * widthPerKline + widthPerKline / 2;
  }

  public xToIndex(x: number): number {
    if (!this.dimensions) return 0;
    const visibleRange = this.viewport.end - this.viewport.start;
    if (visibleRange === 0) return this.viewport.start;
    const widthPerKline = this.dimensions.chartWidth / visibleRange;
    const relativeIndex = x / widthPerKline;
    return this.viewport.start + relativeIndex;
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

      if (klineTime < timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  public timestampToIndex(timestamp: number, intervalMs: number): number {
    if (this.klines.length === 0) return 0;

    const lastKline = this.klines[this.klines.length - 1]!;
    const lastOpenTime = typeof lastKline.openTime === 'number'
      ? lastKline.openTime
      : new Date(lastKline.openTime).getTime();

    if (timestamp <= lastOpenTime) {
      return this.timeToIndex(timestamp);
    }

    const klinesAhead = Math.ceil((timestamp - lastOpenTime) / intervalMs);
    return this.klines.length - 1 + klinesAhead;
  }

  public timestampToX(timestamp: number, intervalMs: number): number {
    const index = this.timestampToIndex(timestamp, intervalMs);
    return this.indexToCenterX(index);
  }

  public getKlineCount(): number {
    return this.klines.length;
  }

  public getMaxViewportEnd(): number {
    const visibleRange = this.viewport.end - this.viewport.start;
    const maxFuture = Math.max(
      CHART_CONFIG.MIN_FUTURE_KLINES,
      Math.floor(visibleRange * CHART_CONFIG.FUTURE_VIEWPORT_EXTENSION),
    );
    return this.klines.length + maxFuture;
  }

  public getVisibleKlines(): Kline[] {
    const start = Math.floor(this.viewport.start);
    const end = Math.min(Math.ceil(this.viewport.end), this.klines.length);
    return this.klines.slice(start, end);
  }

  public zoom(delta: number, centerX?: number): void {
    if (!this.dimensions) return;

    const zoomFactor = 1 + delta * 0.1;
    const range = this.viewport.end - this.viewport.start;
    const newRange = range / zoomFactor;

    if (centerX !== undefined) {
      const centerIndex = this.xToIndex(centerX);
      const centerRatio = (centerIndex - this.viewport.start) / range;

      this.viewport.start = centerIndex - newRange * centerRatio;
      this.viewport.end = centerIndex + newRange * (1 - centerRatio);
    } else {
      const center = (this.viewport.start + this.viewport.end) / 2;
      this.viewport.start = center - newRange / 2;
      this.viewport.end = center + newRange / 2;
    }

    this.viewport = clampViewport(this.viewport, this.klines.length);
    
    this.updateKlineWidth();
    
    this.updateBounds();
    this.markDirty('viewport');
  }

  public pan(deltaX: number): void {
    if (!this.dimensions) return;

    const range = this.viewport.end - this.viewport.start;
    const indexDelta = (deltaX / this.dimensions.chartWidth) * range;

    this.viewport.start -= indexDelta;
    this.viewport.end -= indexDelta;

    this.viewport = clampViewport(this.viewport, this.klines.length);
    this.updateBounds();
    this.markDirty('viewport');
  }

  public panVertical(deltaY: number): void {
    if (!this.dimensions) return;

    const baseBounds = this.klines.length > 0 ? calculateBounds(this.klines, this.viewport) : null;
    if (!baseBounds) return;

    const baseRange = baseBounds.maxPrice - baseBounds.minPrice;
    const chartHeight = this.dimensions.chartHeight;
    
    const priceDelta = (deltaY / chartHeight) * baseRange;
    
    this.priceOffset += priceDelta;
    
    this.updateBounds();
    this.markDirty('viewport');
  }

  public zoomVertical(deltaY: number): void {
    if (!this.bounds || !this.dimensions) return;

    const zoomFactor = 1 + (deltaY / this.dimensions.chartHeight) * 2;
    this.priceScale *= zoomFactor;
    
    this.priceScale = Math.max(0.1, Math.min(10, this.priceScale));
    
    this.updateBounds();
    this.markDirty('viewport');
  }

  public resetVerticalZoom(): void {
    this.priceOffset = 0;
    this.priceScale = 1;
    this.updateBounds();
    this.markDirty('viewport');
  }

  public resetToInitialView(): void {
    const initialKlineCount = Math.min(CHART_CONFIG.INITIAL_KLINES_VISIBLE, this.klines.length);
    const futureSpace = Math.max(
      CHART_CONFIG.MIN_FUTURE_KLINES,
      Math.floor(initialKlineCount * CHART_CONFIG.INITIAL_FUTURE_EXTENSION),
    );

    this.viewport = {
      ...this.viewport,
      start: Math.max(0, this.klines.length - initialKlineCount),
      end: this.klines.length + futureSpace,
    };

    this.resetVerticalZoom();
    this.updateKlineWidth();
    this.markDirty('all');
  }

  public panToNextKline(): void {
    if (this.klines.length === 0) return;

    const newStart = this.viewport.start + 1;
    const newEnd = this.viewport.end + 1;
    const maxEnd = this.getMaxViewportEnd();

    if (newEnd <= maxEnd) {
      this.viewport = {
        ...this.viewport,
        start: newStart,
        end: newEnd,
      };

      this.updateKlineWidth();
      this.updateBounds();
      this.markDirty('viewport');
    }
  }

  private updateKlineWidth(): void {
    if (!this.dimensions) return;

    const visibleRange = this.viewport.end - this.viewport.start;
    const availableWidth = this.dimensions.chartWidth;
    
    const widthPerKline = availableWidth / visibleRange;
    
    const klineWidthRatio = 0.8;
    const calculatedWidth = widthPerKline * klineWidthRatio;
    
    this.viewport.klineWidth = Math.max(
      CHART_CONFIG.MIN_KLINE_WIDTH,
      calculatedWidth
    );
  }

  public getKlineAtX(x: number): Kline | null {
    const index = Math.floor(this.xToIndex(x));
    return this.klines[index] ?? null;
  }

  public getPadding(): number {
    return this.padding;
  }

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
