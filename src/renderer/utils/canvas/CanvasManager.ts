import type { Candle, Viewport } from '@shared/types';
import { CHART_CONFIG } from '@shared/constants';
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
  private volumeHeightRatio: number;
  private renderCallback: (() => void) | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    viewport: Viewport,
    padding: number = 40,
    volumeHeightRatio: number = 0.25,
  ) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.padding = padding;
    this.volumeHeightRatio = volumeHeightRatio;
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
    const volumeHeight = rect.height * this.volumeHeightRatio;
    const chartHeight = rect.height - volumeHeight;
    const chartWidth = rect.width - CHART_CONFIG.CANVAS_PADDING_RIGHT;

    this.dimensions = {
      width: rect.width,
      height: rect.height,
      chartHeight,
      volumeHeight,
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

    this.bounds = calculateBounds(this.candles, this.viewport);
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
