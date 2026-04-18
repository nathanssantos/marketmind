import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import { describe, expect, it, vi } from 'vitest';
import { RENDERER_REGISTRY, getRenderer, isGenericRenderKind } from '../index';

describe('renderer registry', () => {
  it('exposes a renderer for every generic RenderKind', () => {
    const expected = ['overlay-line', 'overlay-bands', 'overlay-points', 'pane-line', 'pane-multi', 'pane-histogram'];
    for (const kind of expected) {
      expect(RENDERER_REGISTRY[kind as keyof typeof RENDERER_REGISTRY]).toBeTypeOf('function');
    }
  });

  it('isGenericRenderKind matches all keys of the registry', () => {
    for (const kind of Object.keys(RENDERER_REGISTRY)) {
      expect(isGenericRenderKind(kind)).toBe(true);
    }
    expect(isGenericRenderKind('custom')).toBe(false);
    expect(isGenericRenderKind('not-a-kind')).toBe(false);
  });

  it('every catalog definition with a non-custom render kind has a registered renderer', () => {
    for (const def of Object.values(INDICATOR_CATALOG)) {
      if (def.render.kind === 'custom') continue;
      const renderer = getRenderer(def.render.kind);
      expect(renderer, `Missing renderer for ${def.type} (kind=${def.render.kind})`).toBeTypeOf('function');
    }
  });

  it('renderer no-ops gracefully when manager has no context', () => {
    const manager = {
      getContext: vi.fn(() => null),
      getDimensions: vi.fn(() => null),
      getViewport: vi.fn(() => ({ start: 0, end: 0, klineWidth: 1 })),
      getKlines: vi.fn(() => []),
      getPanelInfo: vi.fn(() => null),
      indexToX: vi.fn(() => 0),
      priceToY: vi.fn(() => 0),
    } as unknown as Parameters<NonNullable<typeof RENDERER_REGISTRY['overlay-line']>>[0]['manager'];

    const definition = INDICATOR_CATALOG['ema']!;
    const instance = {
      id: 'i-1',
      userIndicatorId: 'u-1',
      catalogType: 'ema',
      params: { period: 9, color: '#ff0000', lineWidth: 1 },
      visible: true,
    };

    for (const renderer of Object.values(RENDERER_REGISTRY)) {
      expect(() =>
        renderer!(
          { manager, colors: {} as never },
          { instance, definition, values: { value: [] } },
        ),
      ).not.toThrow();
    }
  });
});
