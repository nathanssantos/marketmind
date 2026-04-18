import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_INDICATOR_PARAMS, INDICATOR_CATEGORIES, OVERLAY_INDICATORS, PANEL_INDICATORS, useIndicatorStore } from './indicatorStore';

const resetState = () =>
  act(() => {
    useIndicatorStore.setState({
      activeIndicators: ['volume'],
      indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
      instances: [],
    });
  });

describe('indicatorStore', () => {
  beforeEach(resetState);
  afterEach(resetState);

  it('should have default volume indicator active', () => {
    const { result } = renderHook(() => useIndicatorStore());
    expect(result.current.activeIndicators).toContain('volume');
    expect(result.current.isActive('volume')).toBe(true);
  });

  it('should toggle indicator', () => {
    const { result } = renderHook(() => useIndicatorStore());
    expect(result.current.isActive('rsi')).toBe(false);
    act(() => {
      result.current.toggleIndicator('rsi');
    });
    expect(result.current.isActive('rsi')).toBe(true);
    act(() => {
      result.current.toggleIndicator('rsi');
    });
    expect(result.current.isActive('rsi')).toBe(false);
  });

  it('should set indicator active state', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.setIndicatorActive('macd', true);
    });
    expect(result.current.isActive('macd')).toBe(true);
    act(() => {
      result.current.setIndicatorActive('macd', false);
    });
    expect(result.current.isActive('macd')).toBe(false);
  });

  it('should not duplicate indicator when setting active', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.setIndicatorActive('rsi', true);
      result.current.setIndicatorActive('rsi', true);
    });
    expect(result.current.activeIndicators.filter(i => i === 'rsi')).toHaveLength(1);
  });

  it('should set indicator params', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.setIndicatorParams('macd', { fast: 8, slow: 17 });
    });
    expect(result.current.indicatorParams.macd?.fast).toBe(8);
    expect(result.current.indicatorParams.macd?.slow).toBe(17);
    expect(result.current.indicatorParams.macd?.signal).toBe(9);
  });

  it('should get active indicators by category', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.toggleIndicator('rsi');
      result.current.toggleIndicator('stochastic');
      result.current.toggleIndicator('macd');
    });
    const oscillators = result.current.getActiveByCategory('oscillators');
    expect(oscillators).toContain('rsi');
    expect(oscillators).toContain('stochastic');
    expect(oscillators).not.toContain('macd');
    const momentum = result.current.getActiveByCategory('momentum');
    expect(momentum).toContain('macd');
  });

  it('should get active panel indicators', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.toggleIndicator('rsi');
      result.current.toggleIndicator('ichimoku');
    });
    const panels = result.current.getActivePanelIndicators();
    expect(panels).toContain('rsi');
    expect(panels).not.toContain('ichimoku');
    expect(panels).not.toContain('volume');
  });

  it('should get active overlay indicators', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.toggleIndicator('ichimoku');
      result.current.toggleIndicator('rsi');
    });
    const overlays = result.current.getActiveOverlayIndicators();
    expect(overlays).toContain('ichimoku');
    expect(overlays).toContain('volume');
    expect(overlays).not.toContain('rsi');
  });

  it('should reset params to defaults', () => {
    const { result } = renderHook(() => useIndicatorStore());
    act(() => {
      result.current.setIndicatorParams('macd', { fast: 100, slow: 200 });
    });
    expect(result.current.indicatorParams.macd?.fast).toBe(100);
    act(() => {
      result.current.resetParams('macd');
    });
    expect(result.current.indicatorParams.macd?.fast).toBe(DEFAULT_INDICATOR_PARAMS.macd?.fast);
    expect(result.current.indicatorParams.macd?.slow).toBe(DEFAULT_INDICATOR_PARAMS.macd?.slow);
  });

  it('should have correct indicator categories', () => {
    expect(INDICATOR_CATEGORIES.oscillators).toContain('rsi');
    expect(INDICATOR_CATEGORIES.momentum).toContain('macd');
    expect(INDICATOR_CATEGORIES.trend).toContain('adx');
    expect(INDICATOR_CATEGORIES.volume).toContain('obv');
  });

  it('should have correct panel indicators', () => {
    expect(PANEL_INDICATORS).toContain('rsi');
    expect(PANEL_INDICATORS).toContain('macd');
    expect(PANEL_INDICATORS).not.toContain('volume');
    expect(PANEL_INDICATORS).not.toContain('ichimoku');
  });

  it('should have correct overlay indicators', () => {
    expect(OVERLAY_INDICATORS).toContain('volume');
    expect(OVERLAY_INDICATORS).toContain('ichimoku');
    expect(OVERLAY_INDICATORS).not.toContain('rsi');
    expect(OVERLAY_INDICATORS).not.toContain('macd');
  });

  describe('instances slice', () => {
    it('should default to an empty instances array', () => {
      const { result } = renderHook(() => useIndicatorStore());
      expect(result.current.instances).toEqual([]);
    });

    it('should preserve legacy fields when hydrating without instances', () => {
      act(() => {
        useIndicatorStore.getState().hydrate({
          activeIndicators: ['rsi', 'macd'],
        });
      });
      const state = useIndicatorStore.getState();
      expect(state.activeIndicators).toEqual(['rsi', 'macd']);
      expect(state.instances).toEqual([]);
    });

    it('should not wipe legacy fields when hydrating instances', () => {
      act(() => {
        useIndicatorStore.getState().hydrate({
          activeIndicators: ['rsi'],
          instances: [
            {
              id: 'persisted-1',
              userIndicatorId: 'user-1',
              catalogType: 'rsi',
              params: { period: 14 },
              visible: true,
            },
          ],
        });
      });
      const state = useIndicatorStore.getState();
      expect(state.activeIndicators).toEqual(['rsi']);
      expect(state.instances).toHaveLength(1);
      expect(state.instances[0]?.id).toBe('persisted-1');
    });

    it('should drop malformed instances during hydration', () => {
      act(() => {
        useIndicatorStore.getState().hydrate({
          instances: [
            { id: 'good', userIndicatorId: 'u-1', catalogType: 'rsi', params: { period: 14 }, visible: true },
            { id: 'bad-no-userid', catalogType: 'rsi', params: {}, visible: true },
            null,
            'not-an-object',
          ],
        });
      });
      const state = useIndicatorStore.getState();
      expect(state.instances).toHaveLength(1);
      expect(state.instances[0]?.id).toBe('good');
    });

    it('should generate ids and add instances', () => {
      const { result } = renderHook(() => useIndicatorStore());
      let id = '';
      act(() => {
        id = result.current.addInstance({
          userIndicatorId: 'user-1',
          catalogType: 'rsi',
          params: { period: 14 },
          visible: true,
        });
      });
      expect(id).toBeTruthy();
      expect(result.current.instances).toHaveLength(1);
      expect(result.current.instances[0]?.id).toBe(id);
    });

    it('should remove an instance by id', () => {
      const { result } = renderHook(() => useIndicatorStore());
      let id = '';
      act(() => {
        id = result.current.addInstance({
          userIndicatorId: 'user-1',
          catalogType: 'ema',
          params: { period: 9 },
          visible: true,
        });
      });
      act(() => result.current.removeInstance(id));
      expect(result.current.instances).toHaveLength(0);
    });

    it('should remove all instances tied to a userIndicatorId', () => {
      const { result } = renderHook(() => useIndicatorStore());
      act(() => {
        result.current.addInstance({ userIndicatorId: 'u-1', catalogType: 'ema', params: { period: 9 }, visible: true });
        result.current.addInstance({ userIndicatorId: 'u-1', catalogType: 'ema', params: { period: 21 }, visible: true });
        result.current.addInstance({ userIndicatorId: 'u-2', catalogType: 'rsi', params: { period: 14 }, visible: true });
      });
      act(() => result.current.removeInstancesByUserIndicatorId('u-1'));
      expect(result.current.instances).toHaveLength(1);
      expect(result.current.instances[0]?.userIndicatorId).toBe('u-2');
    });

    it('should patch an instance and merge params', () => {
      const { result } = renderHook(() => useIndicatorStore());
      let id = '';
      act(() => {
        id = result.current.addInstance({
          userIndicatorId: 'u-1',
          catalogType: 'rsi',
          params: { period: 14, color: '#000' },
          visible: true,
        });
      });
      act(() => result.current.updateInstance(id, { params: { period: 21 }, visible: false }));
      const updated = result.current.instances[0];
      expect(updated?.params).toEqual({ period: 21, color: '#000' });
      expect(updated?.visible).toBe(false);
    });

    it('should toggle instance visibility', () => {
      const { result } = renderHook(() => useIndicatorStore());
      let id = '';
      act(() => {
        id = result.current.addInstance({
          userIndicatorId: 'u-1',
          catalogType: 'rsi',
          params: { period: 14 },
          visible: true,
        });
      });
      act(() => result.current.toggleInstanceVisible(id));
      expect(result.current.instances[0]?.visible).toBe(false);
      act(() => result.current.toggleInstanceVisible(id));
      expect(result.current.instances[0]?.visible).toBe(true);
    });

    it('should reorder instances by id list', () => {
      const { result } = renderHook(() => useIndicatorStore());
      const ids: string[] = [];
      act(() => {
        ids.push(result.current.addInstance({ userIndicatorId: 'u-1', catalogType: 'ema', params: { period: 9 }, visible: true }));
        ids.push(result.current.addInstance({ userIndicatorId: 'u-2', catalogType: 'ema', params: { period: 21 }, visible: true }));
        ids.push(result.current.addInstance({ userIndicatorId: 'u-3', catalogType: 'ema', params: { period: 200 }, visible: true }));
      });
      act(() => result.current.reorderInstances([ids[2]!, ids[0]!, ids[1]!]));
      expect(result.current.instances.map((i) => i.id)).toEqual([ids[2], ids[0], ids[1]]);
    });

    it('should filter visible instances and group by paneId', () => {
      const { result } = renderHook(() => useIndicatorStore());
      act(() => {
        result.current.addInstance({ userIndicatorId: 'u-1', catalogType: 'rsi', params: { period: 14 }, visible: true, paneId: 'rsi' });
        result.current.addInstance({ userIndicatorId: 'u-2', catalogType: 'rsi', params: { period: 21 }, visible: false, paneId: 'rsi' });
        result.current.addInstance({ userIndicatorId: 'u-3', catalogType: 'macd', params: {}, visible: true, paneId: 'macd' });
      });
      expect(result.current.getVisibleInstances()).toHaveLength(2);
      expect(result.current.getInstancesByPaneId('rsi')).toHaveLength(2);
    });
  });
});
