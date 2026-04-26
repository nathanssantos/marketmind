import type { Drawing } from '@marketmind/chart-studies';
import type { Kline } from '@marketmind/types';
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hitTestDrawingsMock = vi.fn();

vi.mock('@marketmind/chart-studies', async () => {
  const actual = await vi.importActual<typeof import('@marketmind/chart-studies')>('@marketmind/chart-studies');
  return {
    ...actual,
    hitTestDrawings: (...args: unknown[]) => hitTestDrawingsMock(...args),
  };
});

vi.mock('./useOHLCMagnet', () => ({
  useOHLCMagnet: () => ({
    snap: (x: number, y: number) => ({
      snappedIndex: x / 10,
      snappedPrice: 100 - y / 10,
      snapped: false,
      ohlcType: null,
    }),
  }),
}));

import { useDrawingStore } from '@renderer/store/drawingStore';
import { useDrawingInteraction } from './useDrawingInteraction';

const makeManager = () => ({
  markDirty: vi.fn(),
  indexToCenterX: (i: number) => i * 10,
  priceToY: (p: number) => (100 - p) * 10,
  yToPrice: (y: number) => 100 - y / 10,
  indexToX: (i: number) => i * 10,
  xToIndex: (x: number) => x / 10,
  getViewport: () => ({ start: 0, end: 100 }),
  getDimensions: () => ({ width: 1000, height: 1000, chartWidth: 900, chartHeight: 900 }),
});

const KLINES: Kline[] = Array.from({ length: 50 }, (_, i) => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  openTime: 1_700_000_000_000 + i * 3_600_000,
  closeTime: 1_700_000_000_000 + (i + 1) * 3_600_000 - 1,
  open: 50_000 + i,
  high: 50_100 + i,
  low: 49_900 + i,
  close: 50_050 + i,
  volume: 100 + i,
  quoteVolume: 0,
  trades: 0,
  takerBuyBaseVolume: 0,
  takerBuyQuoteVolume: 0,
}));

const setup = () => {
  const manager = makeManager();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderHook(() => useDrawingInteraction({ manager: manager as any, klines: KLINES, symbol: 'BTCUSDT', interval: '1h' }));
};

const drawingsForSymbol = () => useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT', '1h');

describe('useDrawingInteraction — state machine', () => {
  beforeEach(() => {
    useDrawingStore.setState({
      drawingsByKey: {},
      activeTool: null,
      selectedDrawingId: null,
      magnetEnabled: false,
    });
    hitTestDrawingsMock.mockReset();
  });

  afterEach(() => {
    useDrawingStore.setState({ drawingsByKey: {}, activeTool: null, selectedDrawingId: null });
  });

  describe('two-point creation (line)', () => {
    it('mousedown → mousemove → mouseup creates one drawing and resets phase to idle', () => {
      useDrawingStore.getState().setActiveTool('line');
      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 200);
      });
      expect(result.current.pendingDrawingRef.current).not.toBeNull();

      act(() => {
        result.current.handleMouseMove(300, 400);
      });

      act(() => {
        result.current.handleMouseUp(300, 400);
      });

      expect(result.current.pendingDrawingRef.current).toBeNull();
      expect(drawingsForSymbol()).toHaveLength(1);
      expect(drawingsForSymbol()[0]?.type).toBe('line');
    });

    it('mousedown → mouseup at same coords cancels (zero-length) for ray (not in the legacy whitelist)', () => {
      useDrawingStore.getState().setActiveTool('ray');
      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 200);
        result.current.handleMouseUp(100, 200);
      });

      expect(drawingsForSymbol()).toHaveLength(0);
      expect(useDrawingStore.getState().activeTool).toBeNull();
    });

    it.each(['trendLine', 'priceRange', 'ellipse', 'gannFan'] as const)(
      'mousedown → mouseup at same coords cancels (zero-length) for %s',
      (type) => {
        useDrawingStore.getState().setActiveTool(type);
        const { result } = setup();
        act(() => {
          result.current.handleMouseDown(100, 200);
          result.current.handleMouseUp(100, 200);
        });
        expect(drawingsForSymbol()).toHaveLength(0);
      },
    );
  });

  describe('three-point creation (channel)', () => {
    it('mousedown → mouseup → mousedown finalizes channel via 3 clicks (placing-second → placing-third → idle)', () => {
      useDrawingStore.getState().setActiveTool('channel');
      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 200);
      });
      expect(result.current.pendingDrawingRef.current).not.toBeNull();

      act(() => {
        result.current.handleMouseUp(300, 400);
      });
      expect(drawingsForSymbol()).toHaveLength(0);
      expect(result.current.pendingDrawingRef.current).not.toBeNull();

      act(() => {
        result.current.handleMouseDown(500, 600);
      });

      expect(drawingsForSymbol()).toHaveLength(1);
      expect(result.current.pendingDrawingRef.current).toBeNull();
    });
  });

  describe('freeform creation (pencil)', () => {
    it('mousedown → multiple mousemove → mouseup creates pencil drawing', () => {
      useDrawingStore.getState().setActiveTool('pencil');
      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 100);
      });
      expect(result.current.pendingDrawingRef.current).not.toBeNull();

      act(() => {
        result.current.handleMouseMove(200, 200);
        result.current.handleMouseMove(300, 300);
      });

      act(() => {
        result.current.handleMouseUp(300, 300);
      });

      expect(drawingsForSymbol()).toHaveLength(1);
      expect(drawingsForSymbol()[0]?.type).toBe('pencil');
      expect(result.current.pendingDrawingRef.current).toBeNull();
    });
  });

  describe('single-click creation (text, horizontalLine)', () => {
    it.each(['text', 'horizontalLine', 'verticalLine', 'anchoredVwap'] as const)(
      'creates %s on a single mousedown without entering placing-second',
      (type) => {
        useDrawingStore.getState().setActiveTool(type);
        const { result } = setup();

        act(() => {
          result.current.handleMouseDown(100, 200);
        });

        expect(drawingsForSymbol()).toHaveLength(1);
        expect(drawingsForSymbol()[0]?.type).toBe(type);
        expect(result.current.pendingDrawingRef.current).toBeNull();
      },
    );
  });

  describe('selection vs drag (no active tool)', () => {
    const seedDrawing = (): Drawing => {
      const drawing: Drawing = {
        id: 'd1',
        type: 'line',
        symbol: 'BTCUSDT',
        interval: '1h',
        visible: true,
        locked: false,
        zIndex: 0,
        createdAt: 0,
        updatedAt: 0,
        startIndex: 10,
        startPrice: 90,
        endIndex: 20,
        endPrice: 80,
      };
      useDrawingStore.setState({
        drawingsByKey: { 'BTCUSDT:1h': [drawing] },
        selectedDrawingId: null,
        activeTool: null,
      });
      return drawing;
    };

    it('first click on an UNSELECTED drawing only selects it — no drag phase', () => {
      seedDrawing();
      hitTestDrawingsMock.mockReturnValue({ drawingId: 'd1', handleType: 'body', distance: 0 });

      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 100);
      });

      expect(useDrawingStore.getState().selectedDrawingId).toBe('d1');
      // Crucial assertion: phase remains idle, mouse is NOT held captive in
      // a 'dragging' state. A subsequent mousemove should not move the line.
      expect(result.current.pendingDrawingRef.current).toBeNull();
    });

    it('second click on an ALREADY-SELECTED drawing enters drag mode (cursor → grabbing)', () => {
      seedDrawing();
      useDrawingStore.setState({ selectedDrawingId: 'd1' });
      hitTestDrawingsMock.mockReturnValue({ drawingId: 'd1', handleType: 'body', distance: 0 });

      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 100);
      });

      // No tool active so 'grabbing' cursor is the observable proof of
      // dragging phase (see getCursor() in useDrawingInteraction).
      expect(result.current.getCursor()).toBe('grabbing');

      act(() => {
        result.current.handleMouseMove(150, 100);
      });
      const drawn = drawingsForSymbol()[0];
      expect(drawn?.type === 'line' && drawn.startIndex !== 10).toBe(true);
    });

    it('clicking on empty space (no hit) deselects', () => {
      seedDrawing();
      useDrawingStore.setState({ selectedDrawingId: 'd1' });
      hitTestDrawingsMock.mockReturnValue(null);

      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(800, 800);
      });

      expect(useDrawingStore.getState().selectedDrawingId).toBeNull();
      expect(result.current.pendingDrawingRef.current).toBeNull();
    });

    it('clicking a locked drawing selects it but does not enter drag', () => {
      seedDrawing();
      useDrawingStore.setState((s) => ({
        drawingsByKey: { 'BTCUSDT:1h': (s.drawingsByKey['BTCUSDT:1h'] ?? []).map((d) => ({ ...d, locked: true })) },
      }));
      hitTestDrawingsMock.mockReturnValue({ drawingId: 'd1', handleType: 'body', distance: 0 });

      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 100);
      });

      expect(useDrawingStore.getState().selectedDrawingId).toBe('d1');
      expect(result.current.pendingDrawingRef.current).toBeNull();
    });
  });

  describe('cancelInteraction', () => {
    it('returns false when phase is idle', () => {
      const { result } = setup();
      let cancelled = false;
      act(() => {
        cancelled = result.current.cancelInteraction();
      });
      expect(cancelled).toBe(false);
      expect(result.current.pendingDrawingRef.current).toBeNull();
    });

    it('discards the pending drawing and resets to idle when called mid-placement', () => {
      useDrawingStore.getState().setActiveTool('line');
      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 200);
      });
      expect(result.current.pendingDrawingRef.current).not.toBeNull();

      let cancelled = false;
      act(() => {
        cancelled = result.current.cancelInteraction();
      });

      expect(cancelled).toBe(true);
      expect(result.current.pendingDrawingRef.current).toBeNull();
      expect(drawingsForSymbol()).toHaveLength(0);
    });

    it('releases drag state without reverting the drawing when called mid-drag', () => {
      // Seed a drawing then enter drag via second click on selected
      const drawing: Drawing = {
        id: 'd1', type: 'line', symbol: 'BTCUSDT', interval: '1h', visible: true, locked: false, zIndex: 0,
        createdAt: 0, updatedAt: 0,
        startIndex: 10, startPrice: 90, endIndex: 20, endPrice: 80,
      };
      useDrawingStore.setState({
        drawingsByKey: { 'BTCUSDT:1h': [drawing] },
        selectedDrawingId: 'd1',
        activeTool: null,
      });
      hitTestDrawingsMock.mockReturnValue({ drawingId: 'd1', handleType: 'body', distance: 0 });

      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 100);
      });
      // Drag mode → grabbing cursor (see getCursor()).
      expect(result.current.getCursor()).toBe('grabbing');

      // Move so the drawing has shifted from its original position
      act(() => {
        result.current.handleMouseMove(150, 100);
      });

      let cancelled = false;
      act(() => {
        cancelled = result.current.cancelInteraction();
      });

      expect(cancelled).toBe(true);
      // Cursor is no longer 'grabbing' — drag has been released.
      expect(result.current.getCursor()).not.toBe('grabbing');
      // Drawing still exists — drag was released, not reverted.
      expect(drawingsForSymbol()).toHaveLength(1);
    });
  });
});
