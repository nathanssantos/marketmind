import { describe, it, expect, beforeEach } from 'vitest';
import { useDrawingStore } from './drawingStore';
import type { LineDrawing } from '@marketmind/chart-studies';

const createTestDrawing = (overrides: Partial<LineDrawing> = {}): LineDrawing => ({
  id: 'test-1',
  type: 'line',
  symbol: 'BTCUSDT',
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
      drawingsBySymbol: {},
      activeTool: null,
      selectedDrawingId: null,
      magnetEnabled: false,
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
    it('adds drawing to correct symbol', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      expect(useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT')).toHaveLength(1);
    });

    it('does not affect other symbols', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      expect(useDrawingStore.getState().getDrawingsForSymbol('ETHUSDT')).toHaveLength(0);
    });
  });

  describe('updateDrawing', () => {
    it('updates drawing properties', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      useDrawingStore.getState().updateDrawing('test-1', { visible: false });
      const drawings = useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT');
      expect(drawings[0]!.visible).toBe(false);
    });
  });

  describe('deleteDrawing', () => {
    it('removes drawing', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      useDrawingStore.getState().deleteDrawing('test-1', 'BTCUSDT');
      expect(useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT')).toHaveLength(0);
    });

    it('clears selection if deleting selected drawing', () => {
      const drawing = createTestDrawing();
      useDrawingStore.getState().addDrawing(drawing);
      useDrawingStore.getState().selectDrawing('test-1');
      useDrawingStore.getState().deleteDrawing('test-1', 'BTCUSDT');
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
    it('replaces drawings for a symbol', () => {
      const d1 = createTestDrawing({ id: '1' });
      const d2 = createTestDrawing({ id: '2' });
      useDrawingStore.getState().setDrawingsForSymbol('BTCUSDT', [d1, d2]);
      expect(useDrawingStore.getState().getDrawingsForSymbol('BTCUSDT')).toHaveLength(2);
    });
  });

  describe('clearAll', () => {
    it('resets all state', () => {
      useDrawingStore.getState().addDrawing(createTestDrawing());
      useDrawingStore.getState().setActiveTool('line');
      useDrawingStore.getState().selectDrawing('test-1');
      useDrawingStore.getState().clearAll();
      const state = useDrawingStore.getState();
      expect(state.drawingsBySymbol).toEqual({});
      expect(state.activeTool).toBeNull();
      expect(state.selectedDrawingId).toBeNull();
    });
  });
});
