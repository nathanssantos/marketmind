import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@renderer/services/trpc', () => ({
  trpc: {
    layout: {
      get: { query: vi.fn().mockResolvedValue(null) },
      save: { mutate: vi.fn().mockResolvedValue({ success: true }) },
    },
  },
}));

vi.mock('./preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({ chart: {} }),
  },
}));

import {
  LAYOUT_TEMPLATES,
  migrateGridGranularity,
  scalePosition,
  useLayoutStore,
} from './layoutStore';
import type { ChartPanelConfig, LayoutPreset, NamedPanelConfig } from '@shared/types/layout';
import { GRID_VERSION } from '@shared/types/layout';

const baseSnapshot = useLayoutStore.getState();

const resetState = () => {
  useLayoutStore.setState(baseSnapshot, true);
};

describe('layoutStore — addLayout', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('creates an empty layout (single chart) when no template is given', () => {
    const { result } = renderHook(() => useLayoutStore());
    const before = result.current.layoutPresets.length;
    act(() => {
      result.current.addLayout('My layout');
    });
    const after = result.current.layoutPresets;
    expect(after).toHaveLength(before + 1);
    const created = after[after.length - 1]!;
    expect(created.name).toBe('My layout');
    // 'empty' template builds a single chart panel
    expect(created.grid).toHaveLength(1);
    expect(created.grid[0]?.kind).toBe('chart');
  });

  it('creates a layout from a trading variant template (3 charts + ticket / confluence / orders / portfolio / positions)', () => {
    const { result } = renderHook(() => useLayoutStore());
    act(() => {
      result.current.addLayout('Trading 2', 'tradingSwing');
    });
    const created = result.current.layoutPresets.at(-1)!;
    expect(created.name).toBe('Trading 2');
    const kinds = created.grid.map((p) => p.kind).sort();
    expect(kinds).toEqual(['chart', 'chart', 'chart', 'confluence', 'orders', 'portfolio', 'positions', 'ticket']);
    const charts = created.grid.filter((p) => p.kind === 'chart') as ChartPanelConfig[];
    expect(charts.map((c) => c.timeframe).sort()).toEqual(['15m', '1h', '4h']);
  });

  it('each trading variant template renders its declared timeframes', () => {
    const cases: Array<[Parameters<typeof useLayoutStore.getState>[0] extends never ? never : 'tradingScalp' | 'tradingDay' | 'tradingMidterm' | 'tradingPosition' | 'tradingLong', string[]]> = [
      ['tradingScalp', ['15m', '1m', '5m']],
      ['tradingDay', ['15m', '1h', '5m']],
      ['tradingMidterm', ['1d', '1h', '4h']],
      ['tradingPosition', ['1d', '1w', '4h']],
      ['tradingLong', ['1M', '1d', '1w']],
    ];
    for (const [key, expected] of cases) {
      const { result } = renderHook(() => useLayoutStore());
      act(() => {
        result.current.addLayout(`x-${key}`, key);
      });
      const created = result.current.layoutPresets.at(-1)!;
      const charts = (created.grid.filter((p) => p.kind === 'chart') as ChartPanelConfig[])
        .map((c) => c.timeframe)
        .sort();
      expect(charts).toEqual(expected);
    }
  });

  it('creates a layout from the auto-trading template', () => {
    const { result } = renderHook(() => useLayoutStore());
    act(() => {
      result.current.addLayout('AT', 'autoTrading');
    });
    const created = result.current.layoutPresets.at(-1)!;
    const kinds = created.grid.map((p) => p.kind).sort();
    expect(kinds).toEqual(['chart', 'chart', 'chart', 'orders', 'portfolio', 'positions', 'watchers']);
  });

  it('creates a layout from the auto-scalping template', () => {
    const { result } = renderHook(() => useLayoutStore());
    act(() => {
      result.current.addLayout('Scalp', 'autoScalping');
    });
    const created = result.current.layoutPresets.at(-1)!;
    const kinds = created.grid.map((p) => p.kind).sort();
    expect(kinds).toContain('orderBook');
    expect(kinds).toContain('orderFlowMetrics');
    expect(kinds).toContain('autoTradingSetup');
    expect(kinds).toContain('portfolio');
    const charts = created.grid.filter((p) => p.kind === 'chart') as ChartPanelConfig[];
    expect(charts.map((c) => c.timeframe)).toEqual(['1m']);
  });

  it('LAYOUT_TEMPLATES exports the full set (empty + 6 trading variants + auto-trading + auto-scalping + market-indicators)', () => {
    const keys = LAYOUT_TEMPLATES.map((t) => t.key).sort();
    expect(keys).toEqual([
      'autoScalping',
      'autoTrading',
      'empty',
      'marketIndicators',
      'tradingDay',
      'tradingLong',
      'tradingMidterm',
      'tradingPosition',
      'tradingScalp',
      'tradingSwing',
    ]);
  });
});

describe('layoutStore — duplicateLayout', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('clones a layout with a new id, " (copy)" suffix, and re-minted panel ids', () => {
    const { result } = renderHook(() => useLayoutStore());
    const source = result.current.layoutPresets[0]!;
    const sourceIds = source.grid.map((p) => p.id);

    act(() => {
      result.current.duplicateLayout(source.id);
    });

    const copy = result.current.layoutPresets.at(-1)!;
    expect(copy.id).not.toBe(source.id);
    expect(copy.name).toBe(`${source.name} (copy)`);
    expect(copy.grid).toHaveLength(source.grid.length);
    // Panel ids must NOT collide with the source — duplicates should be
    // independent of the original (resizing one shouldn't affect the other).
    for (const p of copy.grid) {
      expect(sourceIds).not.toContain(p.id);
    }
  });

  it('uses the provided custom name when given', () => {
    const { result } = renderHook(() => useLayoutStore());
    const source = result.current.layoutPresets[0]!;
    act(() => {
      result.current.duplicateLayout(source.id, 'Backup of Trading');
    });
    expect(result.current.layoutPresets.at(-1)!.name).toBe('Backup of Trading');
  });

  it('is a no-op when the layoutId does not exist', () => {
    const { result } = renderHook(() => useLayoutStore());
    const before = result.current.layoutPresets.length;
    act(() => {
      result.current.duplicateLayout('does-not-exist');
    });
    expect(result.current.layoutPresets).toHaveLength(before);
  });
});

describe('layoutStore — migrateGridGranularity', () => {
  it('returns presets unchanged when fromVersion >= GRID_VERSION', () => {
    const presets: LayoutPreset[] = [{
      id: 'l1',
      name: 'L1',
      order: 0,
      grid: [{
        id: 'p1',
        kind: 'chart',
        timeframe: '1h',
        chartType: 'kline',
        gridPosition: { x: 0, y: 0, w: 6, h: 10 },
        windowState: 'normal',
      } satisfies ChartPanelConfig],
    }];
    const out = migrateGridGranularity(presets, GRID_VERSION);
    expect(out).toBe(presets);
  });

  it('scales v1 panels by ×16 horizontal and ×4 vertical', () => {
    const presets: LayoutPreset[] = [{
      id: 'l1',
      name: 'L1',
      order: 0,
      grid: [{
        id: 'p1',
        kind: 'chart',
        timeframe: '1h',
        chartType: 'kline',
        // v1 coords (cols=12, rowHeight=30)
        gridPosition: { x: 6, y: 10, w: 6, h: 10 },
        windowState: 'normal',
      } satisfies ChartPanelConfig],
    }];

    const out = migrateGridGranularity(presets, 1);
    const pos = out[0]!.grid[0]!.gridPosition;
    expect(pos).toEqual({
      x: 6 * 16,   // 96
      y: 10 * 4,   // 40
      w: 6 * 16,   // 96
      h: 10 * 4,   // 40
    });
  });

  it('scales savedGridPosition when present', () => {
    const presets: LayoutPreset[] = [{
      id: 'l1',
      name: 'L1',
      order: 0,
      grid: [{
        id: 'p1',
        kind: 'ticket',
        gridPosition: { x: 0, y: 0, w: 4, h: 12 },
        savedGridPosition: { x: 1, y: 2, w: 3, h: 4 },
        windowState: 'minimized',
      } satisfies NamedPanelConfig],
    }];
    const out = migrateGridGranularity(presets, 1);
    expect(out[0]!.grid[0]!.savedGridPosition).toEqual({ x: 16, y: 8, w: 48, h: 16 });
  });

  it('preserves panel identity, kind, and other fields during migration', () => {
    const presets: LayoutPreset[] = [{
      id: 'l1',
      name: 'L1',
      order: 0,
      grid: [{
        id: 'panel-id-keep',
        kind: 'chart',
        timeframe: '4h',
        chartType: 'line',
        gridPosition: { x: 0, y: 0, w: 6, h: 20 },
        windowState: 'normal',
      } satisfies ChartPanelConfig],
    }];
    const out = migrateGridGranularity(presets, 1);
    const panel = out[0]!.grid[0]! as ChartPanelConfig;
    expect(panel.id).toBe('panel-id-keep');
    expect(panel.kind).toBe('chart');
    expect(panel.timeframe).toBe('4h');
    expect(panel.chartType).toBe('line');
    expect(panel.windowState).toBe('normal');
  });
});

describe('layoutStore — scalePosition', () => {
  it('multiplies each axis by its factor and rounds to integer', () => {
    expect(scalePosition({ x: 1.4, y: 2.5, w: 3.6, h: 4.4 }, 2, 4)).toEqual({
      x: 3,    // 2.8 → 3
      y: 10,   // 10 → 10
      w: 7,    // 7.2 → 7
      h: 18,   // 17.6 → 18
    });
  });
});
