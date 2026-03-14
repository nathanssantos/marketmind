import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useOrderLinesRenderer } from './useOrderLinesRenderer';

const createHoveredOrderIdRef = (id: string | null) => ({ current: id });

describe('useOrderLinesRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), fill: vi.fn(), fillText: vi.fn(), fillRect: vi.fn(), closePath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(), setLineDash: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
      roundRect: vi.fn(), arc: vi.fn(), globalAlpha: 1,
      lineWidth: 1, strokeStyle: '', fillStyle: '', font: '', lineCap: 'butt', lineJoin: 'miter',
      textAlign: 'left' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;

    const mockKlines = [
      { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000' },
    ];

    mockManager = {
      getContext: vi.fn(() => mockCtx),
      getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 728, chartHeight: 575, volumeHeight: 0 })),
      getViewport: vi.fn(() => ({ start: 0, end: 5, klineWidth: 100 })),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      getKlines: vi.fn(() => mockKlines),
      indexToX: vi.fn((index: number) => index * 140),
      indexToCenterX: vi.fn((index: number) => index * 140 + 70),
    } as unknown as CanvasManager;
  });

  describe('renderOrderLines', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(null, true, createHoveredOrderIdRef(null)));
      result.current.renderOrderLines();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should not render when no orders and trading disabled', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, false, createHoveredOrderIdRef(null)));
      result.current.renderOrderLines();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should render when trading enabled with no orders', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, true, createHoveredOrderIdRef(null)));
      result.current.renderOrderLines();
    });

    it('should render when backend executions provided', () => {
      const mockExecutions = [{
        id: 'exec-1',
        symbol: 'BTCUSDT',
        side: 'LONG' as const,
        entryPrice: '100',
        quantity: '1',
        stopLoss: '95',
        takeProfit: '110',
        status: 'open',
        setupType: 'test-setup',
      }];
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, true, createHoveredOrderIdRef(null), mockExecutions));
      result.current.renderOrderLines();
    });
  });

  describe('hook return value', () => {
    it('should return render function and helper methods', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, true, createHoveredOrderIdRef(null)));
      expect(result.current.renderOrderLines).toBeTypeOf('function');
      expect(result.current.getClickedOrderId).toBeTypeOf('function');
      expect(result.current.getOrderAtPosition).toBeTypeOf('function');
      expect(result.current.getHoveredOrder).toBeTypeOf('function');
      expect(result.current.getSLTPAtPosition).toBeTypeOf('function');
    });
  });

  describe('getClickedOrderId', () => {
    it('should return null when no close button clicked', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, true, createHoveredOrderIdRef(null)));
      const clickedId = result.current.getClickedOrderId(0, 0);
      expect(clickedId).toBeNull();
    });
  });

  describe('getOrderAtPosition', () => {
    it('should return null when no order at position', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, true, createHoveredOrderIdRef(null)));
      const order = result.current.getOrderAtPosition(0, 0);
      expect(order).toBeNull();
    });
  });

  describe('getHoveredOrder', () => {
    it('should return null when no order hovered', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, true, createHoveredOrderIdRef(null)));
      const order = result.current.getHoveredOrder(0, 0);
      expect(order).toBeNull();
    });
  });

  describe('getSLTPAtPosition', () => {
    it('should return null when no SLTP at position', () => {
      const { result } = renderHook(() => useOrderLinesRenderer(mockManager, true, createHoveredOrderIdRef(null)));
      const sltp = result.current.getSLTPAtPosition(0, 0);
      expect(sltp).toBeNull();
    });
  });
});
