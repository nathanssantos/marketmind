import type { Kline } from '@shared/types';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLineRenderer } from './useLineRenderer';

describe('useLineRenderer', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCtx = {
      strokeStyle: '',
      lineWidth: 0,
      fillStyle: '',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    mockCanvas = {
      getContext: vi.fn(() => mockCtx),
    } as unknown as HTMLCanvasElement;
  });

  it('should return renderLine function', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    expect(result.current.renderLine).toBeDefined();
    expect(typeof result.current.renderLine).toBe('function');
  });

  it('should not render when context is null', () => {
    mockCanvas.getContext = vi.fn(() => null);
    
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
    });

    expect(mockCtx.beginPath).not.toHaveBeenCalled();
  });

  it('should not render when no klines', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    result.current.renderLine({
      klines: [],
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
    });

    expect(mockCtx.stroke).not.toHaveBeenCalled();
  });

  it('should render line with default color', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '105', high: '115', low: '95', close: '110', volume: '1100', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
    });

    expect(mockCtx.strokeStyle).toBe('#2196f3');
  });

  it('should render line with custom color', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
      color: '#ff0000',
    });

    expect(mockCtx.strokeStyle).toBe('#ff0000');
  });

  it('should apply custom line width', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
      lineWidth: 3,
    });

    expect(mockCtx.lineWidth).toBe(3);
  });

  it('should render area when showArea is true', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '105', high: '115', low: '95', close: '110', volume: '1100', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
      showArea: true,
    });

    expect(mockCtx.fill).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
  });

  it('should not render area when showArea is false', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
      showArea: false,
    });

    expect(mockCtx.fill).not.toHaveBeenCalled();
  });

  it('should call moveTo for first kline and lineTo for subsequent klines', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '105', high: '115', low: '95', close: '110', volume: '1100', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '110', high: '120', low: '100', close: '115', volume: '1200', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
    });

    expect(mockCtx.moveTo).toHaveBeenCalledTimes(1);
    expect(mockCtx.lineTo).toHaveBeenCalled();
  });

  it('should use close price for line points', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = [
      { openTime: Date.now(), closeTime: Date.now() + 60000, open: '100', high: '110', low: '90', close: '105', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];
    
    result.current.renderLine({
      klines,
      viewport: { start: 0, end: 10, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 200 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
    });

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('should handle viewport slicing correctly', () => {
    const { result } = renderHook(() => useLineRenderer());
    
    const klines: Kline[] = Array.from({ length: 100 }, (_, i) => ({
      openTime: Date.now() + i * 60000,
      closeTime: Date.now() + (i + 1) * 60000,
      open: (100 + i).toString(),
      high: (110 + i).toString(),
      low: (90 + i).toString(),
      close: (105 + i).toString(),
      volume: '1000',
      quoteVolume: '105000',
      trades: 100,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '52500',
    }));
    
    result.current.renderLine({
      klines,
      viewport: { start: 10, end: 20, klineWidth: 10 },
      canvas: mockCanvas,
      bounds: { min: 0, max: 300 },
      dimensions: { width: 800, height: 600, chartWidth: 800, chartHeight: 600 },
    });

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });
});
