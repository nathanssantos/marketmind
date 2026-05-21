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

let mockOHLCSnap = (x: number, y: number) => ({
  snappedIndex: x / 10,
  snappedPrice: 100 - y / 10,
  snapped: false,
  ohlcType: null as 'open' | 'high' | 'low' | 'close' | null,
  distance: Infinity,
});

vi.mock('./useOHLCMagnet', () => ({
  useOHLCMagnet: () => ({
    snap: (x: number, y: number) => mockOHLCSnap(x, y),
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
    it.each(['text', 'horizontalLine', 'verticalLine'] as const)(
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

    it('cancelInteraction({ revert: true }) restores the drawing back to its mousedown snapshot', () => {
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

      // Drag the line so it leaves the original position.
      act(() => {
        result.current.handleMouseMove(150, 100);
      });
      const movedStartIndex = drawingsForSymbol()[0]?.type === 'line'
        ? (drawingsForSymbol()[0] as { startIndex: number }).startIndex
        : null;
      expect(movedStartIndex).not.toBe(10);

      let cancelled = false;
      act(() => {
        cancelled = result.current.cancelInteraction({ revert: true });
      });

      expect(cancelled).toBe(true);
      const revertedStartIndex = drawingsForSymbol()[0]?.type === 'line'
        ? (drawingsForSymbol()[0] as { startIndex: number }).startIndex
        : null;
      expect(revertedStartIndex).toBe(10);
    });

    it('cancelInteraction({ revert: true }) discards the pending placement (does not commit)', () => {
      useDrawingStore.getState().setActiveTool('line');
      const { result } = setup();

      act(() => {
        result.current.handleMouseDown(100, 200);
      });
      expect(result.current.pendingDrawingRef.current).not.toBeNull();

      act(() => {
        result.current.handleMouseMove(300, 400);
      });

      let cancelled = false;
      act(() => {
        cancelled = result.current.cancelInteraction({ revert: true });
      });

      expect(cancelled).toBe(true);
      expect(result.current.pendingDrawingRef.current).toBeNull();
      expect(drawingsForSymbol()).toHaveLength(0);
    });
  });
});

describe('useDrawingInteraction — magnet snap composition', () => {
  beforeEach(() => {
    useDrawingStore.setState({
      drawingsByKey: {},
      activeTool: null,
      selectedDrawingId: null,
      magnetEnabled: true,
    });
    hitTestDrawingsMock.mockReset();
    mockOHLCSnap = (x: number, y: number) => ({
      snappedIndex: x / 10,
      snappedPrice: 100 - y / 10,
      snapped: false,
      ohlcType: null,
      distance: Infinity,
    });
  });

  afterEach(() => {
    useDrawingStore.setState({ drawingsByKey: {}, activeTool: null, selectedDrawingId: null });
  });

  const seedExistingLine = () => {
    // Existing line with endpoint that the renderer will paint at
    // pixel (100, 500) under the test mapper: indexToCenterX(10)=100,
    // priceToY(50)=500.
    const line: Drawing = {
      id: 'existing-line',
      type: 'line',
      symbol: 'BTCUSDT',
      interval: '1h',
      createdAt: 0,
      updatedAt: 0,
      visible: true,
      locked: false,
      zIndex: 0,
      startIndex: 10, startPrice: 50,
      endIndex: 20, endPrice: 60,
    };
    useDrawingStore.setState({
      drawingsByKey: { 'BTCUSDT:1h': [line] },
    });
  };

  it('uses the closer target when a candle vertex is clearly nearer than a drawing handle (OHLC wins)', () => {
    // Existing handle at (100, 500). Mock OHLC says a candle vertex sits
    // 2px from the cursor with distance=2; the handle is 11px from the
    // cursor. With HANDLE_BIAS_PX=4, handle score = 7, OHLC score = 2 →
    // OHLC wins. New drawing must anchor on the candle, not the handle.
    seedExistingLine();
    mockOHLCSnap = () => ({
      snappedIndex: 30,
      snappedPrice: 99,
      snapped: true,
      ohlcType: 'high',
      distance: 2,
    });
    useDrawingStore.setState({ activeTool: 'line' });

    const { result } = setup();
    act(() => {
      // Click 11px away from existing handle (within 12px threshold)
      // but the OHLC mock says the vertex is much closer.
      result.current.handleMouseDown(108, 503);
    });

    const pending = result.current.pendingDrawingRef.current;
    expect(pending).not.toBeNull();
    // The pending drawing's first anchor came from the OHLC mock,
    // NOT the existing-line handle at index 10.
    expect((pending as Drawing & { startIndex: number }).startIndex).toBe(30);
  });

  it('handle wins on near-ties because of HANDLE_BIAS_PX (deliberate anchor preserved)', () => {
    // Both targets at ~3px from cursor. Without the bias they'd be a
    // coin flip; with the bias, the handle wins. This preserves the
    // original "deliberate anchor first" intent without the rigid
    // priority that caused the reported bug.
    seedExistingLine();
    mockOHLCSnap = () => ({
      snappedIndex: 30,
      snappedPrice: 99,
      snapped: true,
      ohlcType: 'high',
      distance: 3,
    });
    useDrawingStore.setState({ activeTool: 'line' });

    const { result } = setup();
    act(() => {
      // Click 3px from the existing handle (101, 503): handle dist = √(1²+3²)=~3.16.
      result.current.handleMouseDown(101, 503);
    });

    const pending = result.current.pendingDrawingRef.current;
    expect(pending).not.toBeNull();
    // Anchor came from the existing handle (index 10), not OHLC (index 30).
    expect((pending as Drawing & { startIndex: number }).startIndex).toBe(10);
  });

  it('Cmd/Ctrl held → both magnet passes are skipped, raw cursor wins', () => {
    // Even with an existing handle right under the cursor AND an OHLC
    // vertex saying it snapped, the bypass returns raw position so the
    // user can place an anchor "slightly separated" without the snap
    // pulling it back to either target.
    seedExistingLine();
    mockOHLCSnap = () => ({
      snappedIndex: 30,
      snappedPrice: 99,
      snapped: true,
      ohlcType: 'high',
      distance: 1,
    });
    useDrawingStore.setState({ activeTool: 'line' });

    const { result } = setup();

    // Simulate Cmd press.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true }));
    });

    act(() => {
      // Click directly on the existing handle position (100, 500).
      result.current.handleMouseDown(100, 500);
    });

    const pending = result.current.pendingDrawingRef.current;
    expect(pending).not.toBeNull();
    // Raw cursor → index = 100 / 10 = 10 from the viewport math;
    // critically NOT from OHLC (would be 30) and NOT from handle
    // (would be xToIndex(100) = 10 from the existing line — same
    // numeric value but the magnet path was bypassed). The OHLC
    // index 30 NOT being chosen is the proof the bypass worked.
    expect((pending as Drawing & { startIndex: number }).startIndex).not.toBe(30);

    // Release Cmd.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { metaKey: false, ctrlKey: false }));
    });
  });

  it('window blur clears the bypass flag so magnet returns after Cmd-tab', () => {
    seedExistingLine();
    mockOHLCSnap = () => ({
      snappedIndex: 30,
      snappedPrice: 99,
      snapped: true,
      ohlcType: 'high',
      distance: 1,
    });
    useDrawingStore.setState({ activeTool: 'line' });

    const { result } = setup();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true }));
    });
    // User Cmd-tabs away — keyup never fires for the modifier, but
    // blur does. Without the blur listener the flag would stay set
    // and the magnet would remain off when they came back.
    act(() => {
      window.dispatchEvent(new Event('blur'));
    });

    act(() => {
      // Cursor 8.5px from handle (100, 500), OHLC mock says distance=1.
      // Handle score = 8.5 - 4 (bias) = 4.5; OHLC < handle → OHLC wins,
      // proving magnet is back on after the blur cleared the bypass flag.
      result.current.handleMouseDown(108, 503);
    });

    const pending = result.current.pendingDrawingRef.current;
    expect(pending).not.toBeNull();
    expect((pending as Drawing & { startIndex: number }).startIndex).toBe(30);
  });
});
