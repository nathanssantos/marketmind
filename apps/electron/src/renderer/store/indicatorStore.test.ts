import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_INDICATOR_PARAMS, INDICATOR_CATEGORIES, OVERLAY_INDICATORS, PANEL_INDICATORS, useIndicatorStore } from './indicatorStore';

describe('indicatorStore', () => {
  beforeEach(() => {
    act(() => {
      useIndicatorStore.setState({
        activeIndicators: ['volume'],
        indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
      });
    });
  });

  afterEach(() => {
    act(() => {
      useIndicatorStore.setState({
        activeIndicators: ['volume'],
        indicatorParams: { ...DEFAULT_INDICATOR_PARAMS },
      });
    });
  });

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
});
