import type { Viewport } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSetupMarkerRenderer, type SetupMarker } from './AnnotationLayer';

describe('AnnotationLayer', () => {
  let mockCtx: CanvasRenderingContext2D;
  let viewport: Viewport;
  const theme = {
    bullish: '#26a69a',
    bearish: '#ef5350',
    text: '#D9D9D9',
  };

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      fill: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
      font: '',
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;

    viewport = {
      start: 0,
      end: 50,
      klineWidth: 10,
      klineSpacing: 2,
      width: 800,
      height: 600,
      priceMin: 90,
      priceMax: 120,
    };
  });

  const createMarker = (overrides: Partial<SetupMarker> = {}): SetupMarker => ({
    klineIndex: 25,
    price: 105,
    type: 'ENTRY',
    direction: 'LONG',
    ...overrides,
  });

  describe('createSetupMarkerRenderer', () => {
    it('should create a renderer function', () => {
      const renderer = createSetupMarkerRenderer([], {}, theme);
      expect(typeof renderer).toBe('function');
    });

    it('should not render when markers array is empty', () => {
      const renderer = createSetupMarkerRenderer([], {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should render entry marker for long position', () => {
      const markers = [createMarker({ type: 'ENTRY', direction: 'LONG' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should render entry marker for short position', () => {
      const markers = [createMarker({ type: 'ENTRY', direction: 'SHORT' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should render exit marker for long position', () => {
      const markers = [createMarker({ type: 'EXIT', direction: 'LONG' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should render exit marker for short position', () => {
      const markers = [createMarker({ type: 'EXIT', direction: 'SHORT' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should render stop loss marker', () => {
      const markers = [createMarker({ type: 'STOP_LOSS' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.rect).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should render take profit marker', () => {
      const markers = [createMarker({ type: 'TAKE_PROFIT' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should skip markers outside viewport horizontally', () => {
      const markers = [createMarker({ klineIndex: 100 })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });

    it('should skip markers below viewport', () => {
      const markers = [createMarker({ price: 50 })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });

    it('should skip markers above viewport', () => {
      const markers = [createMarker({ price: 150 })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.beginPath).not.toHaveBeenCalled();
    });

    it('should render labels by default', () => {
      const markers = [createMarker({ label: 'Entry' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.measureText).toHaveBeenCalledWith('Entry');
      expect(mockCtx.fillText).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should not render labels when disabled', () => {
      const markers = [createMarker({ label: 'Entry' })];
      const renderer = createSetupMarkerRenderer(markers, { showLabels: false }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should not render labels when marker has no label', () => {
      const markers = [createMarker()];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should use custom entry color', () => {
      const markers = [createMarker({ type: 'ENTRY', direction: 'LONG' })];
      const renderer = createSetupMarkerRenderer(markers, { entryColor: '#00ff00' }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe('#00ff00');
    });

    it('should use custom exit color', () => {
      const markers = [createMarker({ type: 'EXIT', direction: 'LONG' })];
      const renderer = createSetupMarkerRenderer(markers, { exitColor: '#ff0000' }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe('#ff0000');
    });

    it('should use custom stop loss color', () => {
      const markers = [createMarker({ type: 'STOP_LOSS' })];
      const renderer = createSetupMarkerRenderer(markers, { stopLossColor: '#ff00ff' }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe('#ff00ff');
    });

    it('should use custom take profit color', () => {
      const markers = [createMarker({ type: 'TAKE_PROFIT' })];
      const renderer = createSetupMarkerRenderer(markers, { takeProfitColor: '#00ffff' }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe('#00ffff');
    });

    it('should use custom marker size', () => {
      const markers = [createMarker({ type: 'TAKE_PROFIT' })];
      const renderer = createSetupMarkerRenderer(markers, { markerSize: 12 }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.arc).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 12, 0, Math.PI * 2);
    });

    it('should use custom font size', () => {
      const markers = [createMarker({ label: 'Test' })];
      const renderer = createSetupMarkerRenderer(markers, { fontSize: 14 }, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.font).toBe('14px sans-serif');
    });

    it('should render multiple markers', () => {
      const markers = [
        createMarker({ klineIndex: 10, type: 'ENTRY' }),
        createMarker({ klineIndex: 20, type: 'STOP_LOSS' }),
        createMarker({ klineIndex: 30, type: 'TAKE_PROFIT' }),
      ];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(3);
      expect(mockCtx.fill).toHaveBeenCalledTimes(3);
    });

    it('should render triangle-up for long entry', () => {
      const markers = [createMarker({ type: 'ENTRY', direction: 'LONG' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
    });

    it('should render triangle-down for short entry', () => {
      const markers = [createMarker({ type: 'ENTRY', direction: 'SHORT' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalledTimes(2);
    });

    it('should calculate correct x position', () => {
      const markers = [createMarker({ klineIndex: 25 })];
      const renderer = createSetupMarkerRenderer(markers, { markerSize: 8 }, theme);
      renderer(mockCtx, viewport);

      const expectedX = ((25 - 0) / (50 - 0)) * 800;
      expect(mockCtx.moveTo).toHaveBeenCalledWith(expectedX, expect.any(Number));
    });

    it('should calculate correct y position', () => {
      const markers = [createMarker({ price: 105 })];
      const renderer = createSetupMarkerRenderer(markers, { markerSize: 8 }, theme);
      renderer(mockCtx, viewport);

      const expectedY = 600 - ((105 - 90) / (120 - 90)) * 600;
      expect(mockCtx.moveTo).toHaveBeenCalledWith(expect.any(Number), expectedY - 8);
    });

    it('should set global alpha for label background', () => {
      const markers = [createMarker({ label: 'Test' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.globalAlpha).toBe(1);
    });

    it('should use theme colors for entry', () => {
      const markers = [createMarker({ type: 'ENTRY', direction: 'LONG' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe(theme.bullish);
    });

    it('should use bearish color for short entry', () => {
      const markers = [createMarker({ type: 'ENTRY', direction: 'SHORT' })];
      const renderer = createSetupMarkerRenderer(markers, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillStyle).toBe(theme.bearish);
    });
  });
});
