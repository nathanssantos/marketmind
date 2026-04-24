import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../utils/oscillatorRendering', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/oscillatorRendering')>();
  return { ...actual, drawPanelBackground: vi.fn() };
});

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
    getCustomRenderer: () => undefined,
    isGenericRenderKind: (kind: string) => kind in RENDERER_REGISTRY,
    __calls: calls,
  };
});

import { useGenericChartIndicatorRenderers } from './useGenericChartIndicatorRenderers';
import { useIndicatorStore, type IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { IndicatorOutputs } from './useGenericChartIndicators';

const mockManager = (panels?: Record<string, { y: number; height: number }>): CanvasManager => ({
  getContext: vi.fn(() => ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
  }) as unknown as CanvasRenderingContext2D),
  getDimensions: vi.fn(() => ({ chartWidth: 800, chartHeight: 600 })),
  getViewport: vi.fn(() => ({ start: 0, end: 5, klineWidth: 8 })),
  getKlines: vi.fn(() => []),
  getPanelInfo: vi.fn((id: string) => panels?.[id] ?? null),
  indexToX: vi.fn(() => 0),
  priceToY: vi.fn(() => 0),
  markDirty: vi.fn(),
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

const outputsRef = (entries: [string, IndicatorOutputs][]): { current: Map<string, IndicatorOutputs> } => ({
  current: new Map(entries),
});

const setInstances = (instances: IndicatorInstance[]): void => {
  useIndicatorStore.setState({ instances });
};

describe('useGenericChartIndicatorRenderers', () => {
  beforeEach(() => {
    useIndicatorStore.setState({ instances: [] });
  });

  it('returns no-op functions when manager is null', () => {
    setInstances([makeInstance({ id: 'a' })]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: null,
        colors,
        outputsRef: outputsRef([['a', { value: [1, 2, 3] }]]),
      }),
    );
    expect(() => result.current.renderAllOverlayIndicators()).not.toThrow();
    expect(() => result.current.renderAllPanelIndicators()).not.toThrow();
  });

  it('dispatches overlay-line indicators (sma) on renderAllOverlayIndicators', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    setInstances([makeInstance({ id: 'sma1', catalogType: 'sma' })]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([['sma1', { value: [1, 2, 3] }]]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toEqual([{ kind: 'overlay-line', instanceId: 'sma1' }]);
  });

  it('dispatches pane-multi (macd) on renderAllPanelIndicators', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    setInstances([makeInstance({ id: 'macd1', catalogType: 'macd' })]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([['macd1', { line: [], signal: [], histogram: [] }]]),
      }),
    );
    result.current.renderAllPanelIndicators();
    expect(calls).toEqual([{ kind: 'pane-multi', instanceId: 'macd1' }]);
  });

  it('skips invisible instances', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    setInstances([makeInstance({ id: 'a', visible: false })]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([['a', { value: [] }]]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toHaveLength(0);
  });

  it('skips custom-render instances (e.g. fibonacci)', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    setInstances([makeInstance({ id: 'f', catalogType: 'fibonacci', params: {} })]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([['f', {}]]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toHaveLength(0);
  });

  it('skips instances missing outputs', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    setInstances([makeInstance({ id: 'sma1', catalogType: 'sma' })]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls).toHaveLength(0);
  });

  it('does not call pane renderers from renderAllOverlayIndicators', async () => {
    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    setInstances([
      makeInstance({ id: 'sma1', catalogType: 'sma' }),
      makeInstance({ id: 'rsi1', catalogType: 'rsi' }),
    ]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([
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

    setInstances([
      makeInstance({ id: 'a', catalogType: 'sma' }),
      makeInstance({ id: 'b', catalogType: 'ema' }),
    ]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([
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

    setInstances([
      makeInstance({ id: 'top', catalogType: 'sma', zIndex: 10 }),
      makeInstance({ id: 'bottom', catalogType: 'sma', zIndex: 1 }),
    ]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager(),
        colors,
        outputsRef: outputsRef([
          ['top', { value: [] }],
          ['bottom', { value: [] }],
        ]),
      }),
    );
    result.current.renderAllOverlayIndicators();
    expect(calls.map((c) => c.instanceId)).toEqual(['bottom', 'top']);
  });

  it('renderAllPanelIndicators draws panel background once per unique panel, not per indicator', async () => {
    const oscillator = await import('../utils/oscillatorRendering');
    const bgSpy = oscillator.drawPanelBackground as unknown as ReturnType<typeof vi.fn>;
    bgSpy.mockClear();

    const renderers = await import('./renderers');
    const calls = (renderers as unknown as { __calls: Array<{ kind: string; instanceId: string }> }).__calls;
    calls.length = 0;

    setInstances([
      makeInstance({ id: 'rsi-a', catalogType: 'rsi' }),
      makeInstance({ id: 'rsi-b', catalogType: 'rsi' }),
      makeInstance({ id: 'macd-1', catalogType: 'macd' }),
      makeInstance({ id: 'atr-1', catalogType: 'atr' }),
    ]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager({
          rsi: { y: 400, height: 80 },
          macd: { y: 480, height: 80 },
          atr: { y: 560, height: 40 },
        }),
        colors,
        outputsRef: outputsRef([
          ['rsi-a', { value: [] }],
          ['rsi-b', { value: [] }],
          ['macd-1', { line: [], signal: [], histogram: [] }],
          ['atr-1', { value: [] }],
        ]),
      }),
    );
    result.current.renderAllPanelIndicators();

    expect(calls).toHaveLength(4);
    expect(bgSpy).toHaveBeenCalledTimes(3);
    const yValues = bgSpy.mock.calls.map((args) => (args[0] as { panelY: number }).panelY).sort((a, b) => a - b);
    expect(yValues).toEqual([400, 480, 560]);
  });

  it('renderAllPanelIndicators skips background when no pane-kind indicators are active', async () => {
    const oscillator = await import('../utils/oscillatorRendering');
    const bgSpy = oscillator.drawPanelBackground as unknown as ReturnType<typeof vi.fn>;
    bgSpy.mockClear();

    setInstances([makeInstance({ id: 'sma1', catalogType: 'sma' })]);
    const { result } = renderHook(() =>
      useGenericChartIndicatorRenderers({
        manager: mockManager({ rsi: { y: 400, height: 80 } }),
        colors,
        outputsRef: outputsRef([['sma1', { value: [] }]]),
      }),
    );
    result.current.renderAllPanelIndicators();

    expect(bgSpy).not.toHaveBeenCalled();
  });
});
