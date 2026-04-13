import { describe, expect, it, vi } from 'vitest';
import type { TrailingStopOptimizationConfig } from '@marketmind/types';
import {
  calculateAutoStopOffset,
  computeTrailingStop,
  DEFAULT_TRAILING_STOP_CONFIG,
  resolveTrailingStopConfig,
  type TrailingStopInput,
} from '../../services/trailing-stop-config';
import type { AutoTradingConfig, SymbolTrailingStopOverride } from '../../db/schema';
import { computeTrailingStopCore } from '../../services/trailing-stop-core';

vi.mock('../../services/trailing-stop-core', () => ({
  computeTrailingStopCore: vi.fn((_input, _config) => ({
    newStopLoss: 100,
    reason: 'progressive_trail' as const,
  })),
}));

const mockedCore = vi.mocked(computeTrailingStopCore);

describe('calculateAutoStopOffset', () => {
  it('returns 0 for atrPercent < 0.005', () => {
    expect(calculateAutoStopOffset(0)).toBe(0);
    expect(calculateAutoStopOffset(0.004)).toBe(0);
    expect(calculateAutoStopOffset(0.0049)).toBe(0);
  });

  it('returns 0.0025 for atrPercent in [0.005, 0.01)', () => {
    expect(calculateAutoStopOffset(0.005)).toBe(0.0025);
    expect(calculateAutoStopOffset(0.0099)).toBe(0.0025);
  });

  it('returns 0.005 for atrPercent in [0.01, 0.02)', () => {
    expect(calculateAutoStopOffset(0.01)).toBe(0.005);
    expect(calculateAutoStopOffset(0.019)).toBe(0.005);
  });

  it('returns 0.0075 for atrPercent in [0.02, 0.03)', () => {
    expect(calculateAutoStopOffset(0.02)).toBe(0.0075);
    expect(calculateAutoStopOffset(0.029)).toBe(0.0075);
  });

  it('returns 0.01 for atrPercent in [0.03, 0.04)', () => {
    expect(calculateAutoStopOffset(0.03)).toBe(0.01);
    expect(calculateAutoStopOffset(0.039)).toBe(0.01);
  });

  it('returns 0.015 for atrPercent >= 0.04', () => {
    expect(calculateAutoStopOffset(0.04)).toBe(0.015);
    expect(calculateAutoStopOffset(0.1)).toBe(0.015);
    expect(calculateAutoStopOffset(1)).toBe(0.015);
  });
});

describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
  it('has expected default values', () => {
    expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBe(0.002);
    expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBe(3);
    expect(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier).toBe(true);
    expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBe(2.0);
    expect(DEFAULT_TRAILING_STOP_CONFIG.useVolatilityBasedThresholds).toBe(true);
    expect(DEFAULT_TRAILING_STOP_CONFIG.marketType).toBe('FUTURES');
    expect(DEFAULT_TRAILING_STOP_CONFIG.useBnbDiscount).toBe(false);
  });
});

describe('resolveTrailingStopConfig', () => {
  const baseConfig: TrailingStopOptimizationConfig = {
    minTrailingDistancePercent: 0.002,
    swingLookback: 3,
    useATRMultiplier: true,
    atrMultiplier: 2.0,
    trailingDistancePercent: 0.4,
    useVolatilityBasedThresholds: true,
    marketType: 'FUTURES',
    useBnbDiscount: false,
    trailingDistanceMode: 'fixed',
    trailingStopOffsetPercent: 0,
  };

  it('returns baseConfig values when no override and no wallet config', () => {
    const result = resolveTrailingStopConfig('LONG', null, null, baseConfig);
    expect(result.trailingDistancePercent).toBe(0.4);
    expect(result.trailingDistanceMode).toBe('fixed');
    expect(result.trailingStopOffsetPercent).toBe(0);
    expect(result.useVolatilityBasedThresholds).toBe(true);
    expect(result.forceActivated).toBe(false);
  });

  it('uses wallet config when no symbol override', () => {
    const walletConfig = {
      trailingActivationPercentLong: '2.5',
      trailingActivationPercentShort: '3.0',
      trailingDistancePercentLong: '0.5',
      trailingDistancePercentShort: '0.6',
      trailingDistanceMode: 'adaptive' as const,
      trailingStopOffsetPercent: '0.01',
      useAdaptiveTrailing: false,
      trailingActivationModeLong: 'auto',
      trailingActivationModeShort: 'auto',
    } as unknown as AutoTradingConfig;

    const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);
    expect(result.activationPercentLong).toBe(2.5);
    expect(result.activationPercentShort).toBe(3.0);
    expect(result.trailingDistancePercent).toBe(0.5);
    expect(result.trailingDistanceMode).toBe('adaptive');
    expect(result.trailingStopOffsetPercent).toBe(0.01);
    expect(result.useVolatilityBasedThresholds).toBe(false);
  });

  it('uses SHORT distance when side is SHORT', () => {
    const walletConfig = {
      trailingDistancePercentLong: '0.5',
      trailingDistancePercentShort: '0.6',
    } as unknown as AutoTradingConfig;

    const result = resolveTrailingStopConfig('SHORT', null, walletConfig, baseConfig);
    expect(result.trailingDistancePercent).toBe(0.6);
  });

  it('prefers symbol override with useIndividualConfig=true', () => {
    const walletConfig = {
      trailingDistancePercentLong: '0.5',
      trailingDistancePercentShort: '0.6',
      trailingDistanceMode: 'adaptive',
      trailingStopOffsetPercent: '0.01',
      useAdaptiveTrailing: false,
      trailingActivationModeLong: 'auto',
      trailingActivationModeShort: 'auto',
    } as unknown as AutoTradingConfig;

    const symbolOverride = {
      useIndividualConfig: true,
      trailingActivationPercentLong: '1.0',
      trailingActivationPercentShort: '1.5',
      trailingDistancePercentLong: '0.3',
      trailingDistancePercentShort: '0.35',
      trailingDistanceMode: 'fixed',
      trailingStopOffsetPercent: '0.02',
      useAdaptiveTrailing: true,
      trailingActivationModeLong: 'manual',
      trailingActivationModeShort: 'auto',
      manualTrailingActivatedLong: true,
      manualTrailingActivatedShort: false,
    } as unknown as SymbolTrailingStopOverride;

    const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
    expect(result.activationPercentLong).toBe(1.0);
    expect(result.activationPercentShort).toBe(1.5);
    expect(result.trailingDistancePercent).toBe(0.3);
    expect(result.trailingDistanceMode).toBe('fixed');
    expect(result.trailingStopOffsetPercent).toBe(0.02);
    expect(result.useVolatilityBasedThresholds).toBe(true);
    expect(result.forceActivated).toBe(true);
  });

  it('does not force activate when activation mode is manual but not activated', () => {
    const symbolOverride = {
      useIndividualConfig: true,
      trailingActivationPercentLong: null,
      trailingActivationPercentShort: null,
      trailingDistancePercentLong: null,
      trailingDistancePercentShort: null,
      trailingDistanceMode: null,
      trailingStopOffsetPercent: null,
      useAdaptiveTrailing: null,
      trailingActivationModeLong: 'manual',
      trailingActivationModeShort: 'manual',
      manualTrailingActivatedLong: false,
      manualTrailingActivatedShort: false,
    } as unknown as SymbolTrailingStopOverride;

    const resultLong = resolveTrailingStopConfig('LONG', symbolOverride, null, baseConfig);
    expect(resultLong.forceActivated).toBe(false);

    const resultShort = resolveTrailingStopConfig('SHORT', symbolOverride, null, baseConfig);
    expect(resultShort.forceActivated).toBe(false);
  });

  it('ignores symbol override when useIndividualConfig is false', () => {
    const symbolOverride = {
      useIndividualConfig: false,
      trailingDistancePercentLong: '0.1',
      trailingDistancePercentShort: '0.15',
      trailingDistanceMode: 'adaptive',
    } as unknown as SymbolTrailingStopOverride;

    const result = resolveTrailingStopConfig('LONG', symbolOverride, null, baseConfig);
    expect(result.trailingDistancePercent).toBe(0.4);
  });

  it('falls back to baseConfig trailingDistancePercent when wallet config distance is falsy', () => {
    const walletConfig = {
      trailingDistancePercentLong: null,
      trailingDistancePercentShort: '',
    } as unknown as AutoTradingConfig;

    const resultLong = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);
    expect(resultLong.trailingDistancePercent).toBe(0.4);

    const resultShort = resolveTrailingStopConfig('SHORT', null, walletConfig, baseConfig);
    expect(resultShort.trailingDistancePercent).toBe(0.4);
  });
});

describe('computeTrailingStop', () => {
  const defaultInput: TrailingStopInput = {
    entryPrice: 100,
    currentPrice: 110,
    currentStopLoss: 95,
    side: 'LONG',
    swingPoints: [],
  };

  const defaultConfig: TrailingStopOptimizationConfig = {
    ...DEFAULT_TRAILING_STOP_CONFIG,
  };

  it('calls computeTrailingStopCore with correct parameters for LONG', () => {
    mockedCore.mockReturnValue({ newStopLoss: 105, reason: 'progressive_trail' });

    const result = computeTrailingStop(
      { ...defaultInput, highestPrice: 115, lowestPrice: 90 },
      defaultConfig
    );

    expect(result).toEqual({ newStopLoss: 105, reason: 'progressive_trail' });
    expect(mockedCore).toHaveBeenCalledWith(
      expect.objectContaining({
        highestPrice: 115,
        lowestPrice: undefined,
      }),
      expect.any(Object)
    );
  });

  it('calls computeTrailingStopCore with correct parameters for SHORT', () => {
    mockedCore.mockReturnValue({ newStopLoss: 95, reason: 'atr_trail' });

    const result = computeTrailingStop(
      { ...defaultInput, side: 'SHORT', highestPrice: 115, lowestPrice: 90 },
      defaultConfig
    );

    expect(result).toEqual({ newStopLoss: 95, reason: 'atr_trail' });
    expect(mockedCore).toHaveBeenCalledWith(
      expect.objectContaining({
        highestPrice: undefined,
        lowestPrice: 90,
      }),
      expect.any(Object)
    );
  });

  it('passes useFibonacciThresholds from config', () => {
    mockedCore.mockReturnValue({ newStopLoss: 100, reason: 'swing_trail' });

    computeTrailingStop(defaultInput, { ...defaultConfig, useFibonacciThresholds: true });

    expect(mockedCore).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ useFibonacciThresholds: true })
    );
  });

  it('defaults useFibonacciThresholds to false when undefined', () => {
    mockedCore.mockReturnValue({ newStopLoss: 100, reason: 'swing_trail' });

    computeTrailingStop(defaultInput, defaultConfig);

    expect(mockedCore).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ useFibonacciThresholds: false })
    );
  });

  it('returns null when core returns null', () => {
    mockedCore.mockReturnValue(null);

    const result = computeTrailingStop(defaultInput, defaultConfig);
    expect(result).toBeNull();
  });
});
