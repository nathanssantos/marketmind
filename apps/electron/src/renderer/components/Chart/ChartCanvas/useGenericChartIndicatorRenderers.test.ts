import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('./renderers', () => {
  const calls: Array<{ kind: string; instanceId: string }> = [];
  const make = (kind: string) =>
    vi.fn((_ctx: unknown, input: { instance: { id: string } }) => {
      calls.push({ kind, instanceId: input.instance.id });
    });
  const RENDERER_REGISTRY = {
    'overlay-line': make('overlay-line'),
    'overlay-bands': make('overlay-bands'),
    'overlay-points': make('overlay-points'),
    'pane-line': make('pane-line'),
    'pane-multi': make('pane-multi'),
    'pane-histogram': make('pane-histogram'),
  };
  return {
    RENDERER_REGISTRY,
    getRenderer: (kind: string) => RENDERER_REGISTRY[kind as keyof typeof RENDERER_REGISTRY],
    isGenericRenderKind: (kind: string) => kind in RENDERER_REGISTRY,
    __calls: calls,
  };
});

import { useGenericChartIndicatorRenderers } from './useGenericChartIndicatorRenderers';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { IndicatorOutputs } from './useGenericChartIndicators';

const mockManager = (): CanvasManager => ({
  getContext: vi.fn(() => ({}) as CanvasRenderingContext2D),
  getDimensions: vi.fn(() => ({ chartWidth: 800, chartHeight: 600 })),
  getViewport: vi.fn(() => ({ start: 0, end: 5, klineWidth: 8 })),
  getKlines: vi.fn(() => []),
  indexToX: vi.fn(() => 0),
  priceToY: vi.fn(() => 0),
}) as unknown as CanvasManager;

const colors = {} as ChartThemeColors;

const makeInstance = (overrides: Partial<IndicatorInstance>): IndicatorInstance => ({
  id: 'i-default',
  userIndicatorId: 'u-default',
  catalogType: 'sma',
  params: {},
  visible: true,
  ...overrides,
});

const outputsMap = (entries: [string, IndicatorOutputs][]): Map<string, IndicatorOutputs> =>
  new Map(entries);

describe('useGenericChartIndicatorRenderers', () => {
  it('returns no-op functions when manager is null', () => {
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: null,
        colors,
        instances: [makeInstance({ id: 'a' })],
        outputs: outputsMap([['a', { value: [1, 2, 3] }]]),
      }),
    );
    expect(() => result.current.renderAllOverlayIndicators()).not.toThrow();
    expect(() => result.current.renderAllPanelIndicators()).not.toThrow();
  });

  it('dispatches overlay-line indicators (sma) on renderAllOverlayIndicators', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [makeInstance({ id: 'sma1', catalogType: 'sma' })],
        outputs: outputsMap([['sma1', { value: [1, 2, 3] }]]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toEqual([{ kind: 'overlay-line', instanceId: 'sma1' }]);
  });

  it('dispatches pane-multi (macd) on renderAllPanelIndicators', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [makeInstance({ id: 'macd1', catalogType: 'macd' })],
        outputs: outputsMap([['macd1', { line: [], signal: [], histogram: [] }]]),
      }),
    );
    result.current.renderAllPanelIndicators();
    expect(calls).toEqual([{ kind: 'pane-multi', instanceId: 'macd1' }]);
  });

  it('skips invisible instances', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [makeInstance({ id: 'a', visible: false })],
        outputs: outputsMap([['a', { value: [] }]]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toHaveLength(0);
  });

  it('skips custom-render instances (e.g. fibonacci)', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [makeInstance({ id: 'f', catalogType: 'fibonacci', params: {} })],
        outputs: outputsMap([['f', {}]]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toHaveLength(0);
  });

  it('skips instances missing outputs', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [makeInstance({ id: 'sma1', catalogType: 'sma' })],
        outputs: outputsMap([]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toHaveLength(0);
  });

  it('does not call pane renderers from renderAllOverlayIndicators', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [
          makeInstance({ id: 'sma1', catalogType: 'sma' }),
          makeInstance({ id: 'rsi1', catalogType: 'rsi' }),
        ],
        outputs: outputsMap([
          ['sma1', { value: [] }],
          ['rsi1', { value: [] }],
        ]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls.every((c) => c.kind.startsWith('overlay-'))).toBe(true);
  });

  it('renderInstance dispatches a single instance by id', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [
          makeInstance({ id: 'a', catalogType: 'sma' }),
          makeInstance({ id: 'b', catalogType: 'ema' }),
        ],
        outputs: outputsMap([
          ['a', { value: [] }],
          ['b', { value: [] }],
        ]),
      }),
    );
    result.current.renderInstance('b');
    expect(calls).toEqual([{ kind: 'overlay-line', instanceId: 'b' }]);
  });

  it('orders by zIndex', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        instances: [
          makeInstance({ id: 'top', catalogType: 'sma', zIndex: 10 }),
          makeInstance({ id: 'bottom', catalogType: 'sma', zIndex: 1 }),
        ],
        outputs: outputsMap([
          ['top', { value: [] }],
          ['bottom', { value: [] }],
        ]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls.map((c) => c.instanceId)).toEqual(['bottom', 'top']);
  });
});
