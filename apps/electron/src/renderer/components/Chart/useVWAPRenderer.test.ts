import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useVWAPRenderer } from './useVWAPRenderer';

vi.mock('@marketmind/indicators', () => ({
  calculateIntradayVWAP: vi.fn(() => [100, 101, 102, 103, 104]),
  calculateWeeklyVWAP: vi.fn(() => [200, 201, 202, 203, 204]),
  calculateMonthlyVWAP: vi.fn(() => [300, 301, 302, 303, 304]),
}));

describe('useVWAPRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;

  const mockKlines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '100000' },
    { openTime: 2000, closeTime: 3000, open: '102', high: '108', low: '100', close: '105', volume: '1100', quoteVolume: '115500' },
  ];

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), fill: vi.fn(), fillText: vi.fn(), fillRect: vi.fn(), closePath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(), setLineDash: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
      lineWidth: 1, strokeStyle: '', fillStyle: '', font: '', lineJoin: 'miter', lineCap: 'butt',
      textAlign: 'left' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;

    mockManager = {
      getContext: vi.fn(() => mockCtx),
      getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 728, chartHeight: 575, volumeHeight: 0 })),
      getViewport: vi.fn(() => ({ start: 0, end: 5, klineWidth: 100 })),
      getKlines: vi.fn(() => mockKlines),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      indexToX: vi.fn((index: number) => index * 140),
      indexToCenterX: vi.fn((index: number) => index * 140 + 70),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: null, enabled: true }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: mockManager, enabled: false }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render monthly VWAP by default', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: mockManager, enabled: true }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should render daily VWAP with daily period', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: mockManager, enabled: true, period: 'daily' }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.strokeStyle).toBe('#ff8c00');
    });

    it('should render weekly VWAP with weekly period', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: mockManager, enabled: true, period: 'weekly' }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.strokeStyle).toBe('#ff6b00');
    });

    it('should render monthly VWAP with monthly period', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: mockManager, enabled: true, period: 'monthly' }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.strokeStyle).toBe('#e65100');
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: mockManager, enabled: true }));
      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() => useVWAPRenderer({ manager: mockManager }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
