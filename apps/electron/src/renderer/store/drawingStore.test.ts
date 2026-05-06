import { describe, it, expect, beforeEach } from 'vitest';
import { useDrawingStore } from './drawingStore';
import type { LineDrawing } from '@marketmind/chart-studies';

const createTestDrawing = (overrides: Partial<LineDrawing> = {}): LineDrawing => ({
  id: 'test-1',
  type: 'line',
  symbol: 'BTCUSDT',
  interval: '1h',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  visible: true,
  locked: false,
  zIndex: 0,
  startIndex: 0,
  startPrice: 100,
  endIndex: 10,
  endPrice: 200,
  ...overrides,
});

describe('drawingStore', () => {
  beforeEach(() => {
    useDrawingStore.setState({
      drawingsByKey: {},
      activeTool: null,
      selectedDrawingId: null,
      magnetEnabled: true,
    });
  });

  describe('setActiveTool', () => {
    it('sets tool', () => {
      useDrawingStore.getState().setActiveTool('line');
      expect(useDrawingStore.getState().activeTool).toBe('line');
    });

    it('toggles off same tool', () => {
      useDrawingStore.getState().setActiveTool('line');
      useDrawingStore.getState().setActiveTool('line');
      expect(useDrawingStore.getState().activeTool).toBeNull();
    });

    it('clears selection when activating tool', () => {
      useDrawingStore.getState().selectDrawing('some-id');
      useDrawingStore.getState().setActiveTool('line');
      expect(useDrawingStore.getState().selectedDrawingId).toBeNull();
    });
  });

  describe('addDrawing', () => {
    it('adds drawing to correct symbol+interval key', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      expect(useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(1);
    });

    it('does not affect other symbols', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      expect(useDrawingStore.getState().getDrawingsForSymbol('ETHUSDT', '1h')).toHaveLength(0);
    });

    it('does not affect other intervals', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      expect(useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT', '5m')).toHaveLength(0);
    });
  });

  describe('updateDrawing', () => {
    it('updates drawing properties', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      useDrawingStore.getState().updateDrawing('test-1', { visible: false });
      const drawings = useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT', '1h');
      expect(drawings[0]!.visible).toBe(false);
    });
  });

  describe('deleteDrawing', () => {
    it('removes drawing', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      useDrawingStore.getState().deleteDrawing('test-1', 'BTCUSDT', '1h');
      expect(useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(0);
    });

    it('clears selection if deleting selected drawing', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      useDrawingStore.getState().selectDrawing('test-1');
      useDrawingStore.getState().deleteDrawing('test-1', 'BTCUSDT', '1h');
      expect(useDrawingStore.getState().selectedDrawingId).toBeNull();
    });
  });

  describe('selectDrawing', () => {
    it('selects drawing and clears tool', () => {
      useDrawingStore.getState().setActiveTool('line');
      useDrawingStore.getState().selectDrawing('some-id');
      expect(useDrawingStore.getState().selectedDrawingId).toBe('some-id');
      expect(useDrawingStore.getState().activeTool).toBeNull();
    });
  });

  describe('setMagnetEnabled', () => {
    it('toggles magnet', () => {
      useDrawingStore.getState().setMagnetEnabled(true);
      expect(useDrawingStore.getState().magnetEnabled).toBe(true);
    });
  });

  describe('setDrawingsForSymbol', () => {
    it('replaces drawings for a symbol+interval', () => {
      const d1 = createTestDrawing({ id: '1' });
      const d2 = createTestDrawing({ id: '2' });
      useDrawingStore.getState().setDrawingsForSymbol('BTCUSDT', '1h', [d1, d2]);
      expect(useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(2);
    });
  });

  describe('clearAll', () => {
    it('resets all state', () => {
      useDrawingStore.getState().addDrawing(createTestDrawing());
      useDrawingStore.getState().setActiveTool('line');
      useDrawingStore.getState().selectDrawing('test-1');
      useDrawingStore.getState().clearAll();
      const state = useDrawingStore.getState();
      expect(state.drawingsByKey).toEqual({});
      expect(state.activeTool).toBeNull();
      expect(state.selectedDrawingId).toBeNull();
    });
  });

  describe('undo / redo', () => {
    beforeEach(() => {
      useDrawingStore.getState().clearHistory();
      useDrawingStore.setState({ drawingsByKey: {} });
    });

    it('undoes an addDrawing', () => {
      const s = useDrawingStore.getState();
      const d = createTestDrawing({ id: 'u-1' });
      s.addDrawing(d);
      expect(s.getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(1);
      expect(s.canUndo('BTCUSDT', '1h')).toBe(true);

      const ok = s.undo('BTCUSDT', '1h');
      expect(ok).toBe(true);
      expect(s.getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(0);
      expect(s.canRedo('BTCUSDT', '1h')).toBe(true);
    });

    it('redoes an undone add', () => {
      const s = useDrawingStore.getState();
      const d = createTestDrawing({ id: 'u-2' });
      s.addDrawing(d);
      s.undo('BTCUSDT', '1h');
      const ok = s.redo('BTCUSDT', '1h');
      expect(ok).toBe(true);
      expect(s.getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(1);
      expect(s.getDrawingsForSymbol('BTCUSDT', '1h')[0]?.id).toBe('u-2');
    });

    it('undoes an updateDrawing back to the previous shape', () => {
      const s = useDrawingStore.getState();
      const d = createTestDrawing({ id: 'u-3', endPrice: 200 });
      s.addDrawing(d);
      s.updateDrawing('u-3', { endPrice: 999 } as Partial<LineDrawing>);
      const updated = s.getDrawingsForSymbol('BTCUSDT', '1h')[0] as LineDrawing;
      expect(updated.endPrice).toBe(999);

      s.undo('BTCUSDT', '1h');
      const reverted = s.getDrawingsForSymbol('BTCUSDT', '1h')[0] as LineDrawing;
      expect(reverted.endPrice).toBe(200);
    });

    it('undoes a deleteDrawing', () => {
      const s = useDrawingStore.getState();
      const d = createTestDrawing({ id: 'u-4' });
      s.addDrawing(d);
      s.deleteDrawing('u-4', 'BTCUSDT', '1h');
      expect(s.getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(0);

      s.undo('BTCUSDT', '1h');
      expect(s.getDrawingsForSymbol('BTCUSDT', '1h')).toHaveLength(1);
      expect(s.getDrawingsForSymbol('BTCUSDT', '1h')[0]?.id).toBe('u-4');
    });

    it('returns false when stacks are empty', () => {
      const s = useDrawingStore.getState();
      expect(s.undo('BTCUSDT', '1h')).toBe(false);
      expect(s.redo('BTCUSDT', '1h')).toBe(false);
    });

    it('clears redo stack on a new action', () => {
      const s = useDrawingStore.getState();
      s.addDrawing(createTestDrawing({ id: 'u-5' }));
      s.undo('BTCUSDT', '1h');
      expect(s.canRedo('BTCUSDT', '1h')).toBe(true);

      s.addDrawing(createTestDrawing({ id: 'u-6' }));
      expect(s.canRedo('BTCUSDT', '1h')).toBe(false);
    });
  });
});
