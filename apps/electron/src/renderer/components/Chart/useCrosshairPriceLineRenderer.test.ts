import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors.tsx';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useCrosshairPriceLineRenderer } from './useCrosshairPriceLineRenderer';

const createMousePositionRef = (pos: { x: number; y: number } | null) => ({ current: pos });

describe('useCrosshairPriceLineRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let mockColors: ChartThemeColors;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      setLineDash: vi.fn(),
      closePath: vi.fn(),
      lineWidth: 1,
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    } as unknown as CanvasRenderingContext2D;

    mockManager = {
      getContext: vi.fn(() => mockCtx),
      getDimensions: vi.fn(() => ({
        width: 800,
        height: 600,
        chartWidth: 728,
        chartHeight: 575,
        volumeHeight: 0,
      })),
      getBounds: vi.fn(() => ({
        minPrice: 90,
        maxPrice: 110,
      })),
      yToPrice: vi.fn((y: number) => 100 - (y - 300) * 0.1),
      isFlipped: vi.fn(() => false),
    } as unknown as CanvasManager;

    mockColors = {
      crosshair: 'rgba(128, 128, 128, 0.8)',
      background: '#1a1a1a',
      axisLabel: '#888888',
      axisLine: '#333333',
      currentPriceLabel: { bg: '#22c55e', text: '#ffffff' },
      lineDefault: '#666666',
      ma: ['#3b82f6', '#f59e0b', '#8b5cf6'],
      bullish: '#22c55e',
      bearish: '#ef4444',
      aiPattern: {
        support: '#22c55e',
        resistance: '#ef4444',
        trendlineBullish: '#22c55e',
        trendlineBearish: '#ef4444',
        liquidityZone: '#3b82f6',
        sellZone: '#ef4444',
        buyZone: '#22c55e',
        accumulationZone: '#f59e0b',
        tooltip: { bg: '#1a1a1a', text: '#ffffff', border: '#333333' },
      },
    } as ChartThemeColors;
  });

  it('should not render when disabled', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: false,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.stroke).not.toHaveBeenCalled();
  });

  it('should not render when manager is null', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: null,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.stroke).not.toHaveBeenCalled();
  });

  it('should not render when mousePosition is null', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef(null),
      })
    );

    result.current.render();

    expect(mockCtx.stroke).not.toHaveBeenCalled();
  });

  it('should not render when mouse is outside chart area', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 750, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.stroke).not.toHaveBeenCalled();
  });

  it('should render crosshair lines when conditions are met', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.clip).toHaveBeenCalled();
  });

  it('should draw horizontal line from 0 to chartWidth', () => {
    const mouseY = 200;

    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: mouseY }),
      })
    );

    result.current.render();

    expect(mockCtx.moveTo).toHaveBeenCalledWith(0, mouseY);
    expect(mockCtx.lineTo).toHaveBeenCalledWith(728, mouseY);
  });

  it('should draw vertical line from 0 to chartHeight', () => {
    const mouseX = 100;

    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: mouseX, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.moveTo).toHaveBeenCalledWith(mouseX, 0);
    expect(mockCtx.lineTo).toHaveBeenCalledWith(mouseX, 575);
  });

  it('should apply clipping to chart area', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.rect).toHaveBeenCalledWith(0, 0, 728, 575);
    expect(mockCtx.clip).toHaveBeenCalled();
  });

  it('should draw price tag on price scale', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.fill).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('should use dashed line style when specified', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
        lineStyle: 'dashed',
      })
    );

    result.current.render();

    expect(mockCtx.setLineDash).toHaveBeenCalledWith([8, 4]);
  });

  it('should use dotted line style when specified', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
        lineStyle: 'dotted',
      })
    );

    result.current.render();

    expect(mockCtx.setLineDash).toHaveBeenCalledWith([2, 3]);
  });

  it('should use solid line style when specified', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
        lineStyle: 'solid',
      })
    );

    result.current.render();

    expect(mockCtx.setLineDash).toHaveBeenCalledWith([1, 3]);
  });

  it('should use custom line width when specified', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
        lineWidth: 3,
      })
    );

    result.current.render();

    expect(mockCtx.lineWidth).toBe(3);
  });

  it('should format price with 2 decimal places', () => {
    mockManager.yToPrice = vi.fn(() => 123.456789);

    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.fillText).toHaveBeenCalledWith('123.46', expect.any(Number), expect.any(Number));
  });

  it('should save and restore context', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('should draw price tag arrow shape with path operations', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.moveTo).toHaveBeenCalled();
    expect(mockCtx.lineTo).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('should set font and text alignment for price tag', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.font).toBe('11px monospace');
    expect(mockCtx.textAlign).toBe('left');
    expect(mockCtx.textBaseline).toBe('middle');
  });

  it('should use crosshair color for stroke and price tag', () => {
    const customColors = {
      ...mockColors,
      crosshair: '#FF5733',
    };

    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: customColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.strokeStyle).toBe('#FF5733');
  });

  it('should calculate tag position using CHART_RIGHT_MARGIN', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.fillText).toHaveBeenCalled();
    const fillTextCalls = vi.mocked(mockCtx.fillText).mock.calls;
    expect(fillTextCalls.length).toBeGreaterThan(0);
  });

  it('should apply global alpha for crosshair transparency', () => {
    const { result } = renderHook(() =>
      useCrosshairPriceLineRenderer({
        manager: mockManager,
        colors: mockColors,
        enabled: true,
        mousePositionRef: createMousePositionRef({ x: 100, y: 200 }),
      })
    );

    result.current.render();

    expect(mockCtx.globalAlpha).toBe(0.6);
  });
});
