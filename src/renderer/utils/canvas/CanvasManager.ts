import { CHART_CONFIG } from '@shared/constants';
import type { Candle, Viewport } from '@shared/types';
import {
    calculateBounds,
    clampViewport,
    indexToX,
    priceToY,
    volumeToHeight,
    xToIndex,
    yToPrice,
    type Bounds,
    type Dimensions,
} from './coordinateSystem';
import { clearCanvas, setupCanvas } from './drawingUtils';

export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private candles: Candle[] = [];
  private viewport: Viewport;
  private bounds: Bounds | null = null;
  private dimensions: Dimensions | null = null;
  private padding: number;
  private renderCallback: (() => void) | null = null;
  private priceOffset: number = 0; // Offset for vertical panning
  private priceScale: number = 1; // Scale for vertical zooming

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    padding: number = 40,
  ) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.padding = padding;
    this.initialize();
  }

  public setRenderCallback(callback: (() => void) | null): void {
    this.renderCallback = callback;
    // Trigger render immediately when callback is set
    if (callback) {
      this.triggerRender();
    }
  }

  private triggerRender(): void {
    if (this.renderCallback) {
      this.renderCallback();
    }
  }

  private initialize(): void {
    this.ctx = setupCanvas(this.canvas);
    this.updateDimensions();
    this.updateCandleWidth();
  }

  private updateDimensions(): void {
    const rect = this.canvas.getBoundingClientRect();
    const chartHeight = rect.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    const chartWidth = rect.width - CHART_CONFIG.CANVAS_PADDING_RIGHT;

    this.dimensions = {
      width: rect.width,
      height: rect.height,
      chartHeight,
      volumeHeight: 0, // Volume is now rendered as overlay within chart area
      chartWidth,
    };
  }

  public setCandles(candles: Candle[]): void {
    this.candles = candles;
    this.updateBounds();
  }

  public getCandles(): Candle[] {
    return this.candles;
  }

  public setViewport(viewport: Viewport): void {
    this.viewport = clampViewport(viewport, this.candles.length);
    this.updateBounds();
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
    
    // Apply price offset and scale
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

  public clear(): void {
    if (!this.ctx || !this.dimensions) return;
    clearCanvas(this.ctx, this.dimensions.width, this.dimensions.height);
  }

  public resize(): void {
    this.initialize();
    this.updateBounds();
    this.triggerRender();
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
    return indexToX(index, this.viewport, this.dimensions.chartWidth);
  }

  public xToIndex(x: number): number {
    if (!this.dimensions) return 0;
    return xToIndex(x, this.viewport, this.dimensions.chartWidth);
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
    
    // Calculate dynamic candle width based on visible range
    this.updateCandleWidth();
    
    this.updateBounds();
    this.triggerRender();
  }

  public pan(deltaX: number): void {
    if (!this.dimensions) return;

    const range = this.viewport.end - this.viewport.start;
    const indexDelta = (deltaX / this.dimensions.chartWidth) * range;

    this.viewport.start -= indexDelta;
    this.viewport.end -= indexDelta;

    this.viewport = clampViewport(this.viewport, this.candles.length);
    this.updateBounds();
    this.triggerRender();
  }

  public panVertical(deltaY: number): void {
    if (!this.dimensions) return;

    // Get base bounds without offset/scale to calculate proper delta
    const baseBounds = this.candles.length > 0 ? calculateBounds(this.candles, this.viewport) : null;
    if (!baseBounds) return;

    const baseRange = baseBounds.maxPrice - baseBounds.minPrice;
    const chartHeight = this.dimensions.chartHeight;
    
    // Convert pixel delta to price delta (normal direction: drag down = move down)
    const priceDelta = (deltaY / chartHeight) * baseRange;
    
    // Update price offset
    this.priceOffset += priceDelta;
    
    this.updateBounds();
    this.triggerRender();
  }

  public zoomVertical(deltaY: number): void {
    if (!this.bounds || !this.dimensions) return;

    const zoomFactor = 1 + (deltaY / this.dimensions.chartHeight) * 2;
    this.priceScale *= zoomFactor;
    
    // Clamp scale to reasonable values
    this.priceScale = Math.max(0.1, Math.min(10, this.priceScale));
    
    this.updateBounds();
    this.triggerRender();
  }

  private updateCandleWidth(): void {
    if (!this.dimensions) return;

    const visibleRange = this.viewport.end - this.viewport.start;
    const availableWidth = this.dimensions.chartWidth;
    
    // Calculate width per candle including spacing
    const widthPerCandle = availableWidth / visibleRange;
    
    // Subtract spacing to get actual candle width
    const calculatedWidth = widthPerCandle - this.viewport.candleSpacing;
    
    // Clamp between min and max values
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
}
