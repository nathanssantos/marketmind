import { CHART_CONFIG } from '@shared/constants';
import type { Candle, Viewport } from '@shared/types';
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
  candles: boolean;
  viewport: boolean;
  dimensions: boolean;
  overlays: boolean;
  all: boolean;
}

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private candles: Candle[] = [];
  private viewport: Viewport;
  private bounds: Bounds | null = null;
  private dimensions: Dimensions | null = null;
  private padding: number;
  private renderCallback: (() => void) | null = null;
  private priceOffset: number = 0;
  private priceScale: number = 1;
  private rightMargin: number = CHART_CONFIG.CHART_RIGHT_MARGIN;
  private stochasticPanelHeight: number = 0;
  private rsiPanelHeight: number = 0;
  private animationFrameId: number | null = null;
  private isAnimating: boolean = false;
  private dirtyFlags: DirtyFlags = {
    candles: true,
    viewport: true,
    dimensions: true,
    overlays: true,
    all: true,
  };
  private lastRenderTime: number = 0;
  private minFrameTime: number = 16;

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
           this.dirtyFlags.candles || 
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
      candles: false,
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
    this.updateCandleWidth();
  }

  private updateDimensions(): void {
    const rect = this.canvas.getBoundingClientRect();
    const chartHeight = rect.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM - this.stochasticPanelHeight - this.rsiPanelHeight;
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

  public setCandles(candles: Candle[]): void {
    const oldLastCandle = this.candles[this.candles.length - 1];
    const newLastCandle = candles[candles.length - 1];
    
    const candlesChanged = 
      this.candles.length !== candles.length ||
      !oldLastCandle ||
      !newLastCandle ||
      oldLastCandle.timestamp !== newLastCandle.timestamp ||
      oldLastCandle.open !== newLastCandle.open ||
      oldLastCandle.high !== newLastCandle.high ||
      oldLastCandle.low !== newLastCandle.low ||
      oldLastCandle.close !== newLastCandle.close ||
      oldLastCandle.volume !== newLastCandle.volume;
    
    this.candles = candles;
    this.updateBounds();
    
    if (candlesChanged) {
      this.markDirty('candles');
    }
  }

  public getCandles(): Candle[] {
    return this.candles;
  }

  public setViewport(viewport: Viewport): void {
    const viewportChanged = 
      this.viewport.start !== viewport.start ||
      this.viewport.end !== viewport.end ||
      this.viewport.candleWidth !== viewport.candleWidth;
      
    this.viewport = clampViewport(viewport, this.candles.length);
    this.updateBounds();
    
    if (viewportChanged) {
      this.markDirty('viewport');
    }
  }

  public getViewport(): Viewport {
    return this.viewport;
  }

  private updateBounds(): void {
    if (this.candles.length === 0) {
      this.bounds = null;
      return;
    }

    const baseBounds = calculateBounds(this.candles, this.viewport);
    
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

  public setRightMargin(margin: number): void {
    this.rightMargin = margin;
    this.markDirty('dimensions');
  }

  public setStochasticPanelHeight(height: number): void {
    if (this.stochasticPanelHeight !== height) {
      this.stochasticPanelHeight = height;
      this.updateDimensions();
      this.markDirty('dimensions');
    }
  }

  public getStochasticPanelHeight(): number {
    return this.stochasticPanelHeight;
  }

  public setRSIPanelHeight(height: number): void {
    if (this.rsiPanelHeight !== height) {
      this.rsiPanelHeight = height;
      this.updateDimensions();
      this.markDirty('dimensions');
    }
  }

  public getRSIPanelHeight(): number {
    return this.rsiPanelHeight;
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
    const effectiveWidth = this.dimensions.chartWidth - this.rightMargin;
    const visibleRange = this.viewport.end - this.viewport.start;
    const widthPerCandle = effectiveWidth / visibleRange;
    const relativeIndex = index - this.viewport.start;
    return relativeIndex * widthPerCandle;
  }

  public indexToCenterX(index: number): number {
    if (!this.dimensions) return 0;
    const effectiveWidth = this.dimensions.chartWidth - this.rightMargin;
    const visibleRange = this.viewport.end - this.viewport.start;
    const widthPerCandle = effectiveWidth / visibleRange;
    const relativeIndex = index - this.viewport.start;
    return relativeIndex * widthPerCandle + widthPerCandle / 2;
  }

  public xToIndex(x: number): number {
    if (!this.dimensions) return 0;
    const effectiveWidth = this.dimensions.chartWidth - this.rightMargin;
    const visibleRange = this.viewport.end - this.viewport.start;
    const widthPerCandle = effectiveWidth / visibleRange;
    const relativeIndex = x / widthPerCandle;
    return this.viewport.start + relativeIndex;
  }

  public getVisibleCandles(): Candle[] {
    const start = Math.floor(this.viewport.start);
    const end = Math.min(Math.ceil(this.viewport.end), this.candles.length);
    return this.candles.slice(start, end);
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

    this.viewport = clampViewport(this.viewport, this.candles.length);
    
    this.updateCandleWidth();
    
    this.updateBounds();
    this.markDirty('viewport');
  }

  public pan(deltaX: number): void {
    if (!this.dimensions) return;

    const range = this.viewport.end - this.viewport.start;
    const indexDelta = (deltaX / this.dimensions.chartWidth) * range;

    this.viewport.start -= indexDelta;
    this.viewport.end -= indexDelta;

    this.viewport = clampViewport(this.viewport, this.candles.length);
    this.updateBounds();
    this.markDirty('viewport');
  }

  public panVertical(deltaY: number): void {
    if (!this.dimensions) return;

    const baseBounds = this.candles.length > 0 ? calculateBounds(this.candles, this.viewport) : null;
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
    const initialCandleCount = Math.min(CHART_CONFIG.INITIAL_CANDLES_VISIBLE, this.candles.length);
    
    this.viewport = {
      ...this.viewport,
      start: Math.max(0, this.candles.length - initialCandleCount),
      end: this.candles.length,
    };
    
    this.resetVerticalZoom();
    this.updateCandleWidth();
    this.markDirty('all');
  }

  public panToNextCandle(): void {
    if (this.candles.length === 0) return;
    
    const newStart = this.viewport.start + 1;
    const newEnd = this.viewport.end + 1;
    
    if (newEnd <= this.candles.length) {
      this.viewport = {
        ...this.viewport,
        start: newStart,
        end: newEnd,
      };
      
      this.updateCandleWidth();
      this.updateBounds();
      this.markDirty('viewport');
    }
  }

  private updateCandleWidth(): void {
    if (!this.dimensions) return;

    const visibleRange = this.viewport.end - this.viewport.start;
    const availableWidth = this.dimensions.chartWidth;
    
    const widthPerCandle = availableWidth / visibleRange;
    
    const candleWidthRatio = 0.8;
    const calculatedWidth = widthPerCandle * candleWidthRatio;
    
    this.viewport.candleWidth = Math.max(
      CHART_CONFIG.MIN_CANDLE_WIDTH,
      Math.min(CHART_CONFIG.MAX_CANDLE_WIDTH, calculatedWidth)
    );
  }

  public getCandleAtX(x: number): Candle | null {
    const index = Math.floor(this.xToIndex(x));
    return this.candles[index] ?? null;
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
    
    this.candles = [];
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
