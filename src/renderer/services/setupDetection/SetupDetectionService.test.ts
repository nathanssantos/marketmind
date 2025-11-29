import { describe, it, expect } from 'vitest';
import type { Candle } from '@shared/types';
import {
  SetupDetectionService,
  createDefaultSetupDetectionConfig,
} from './SetupDetectionService';

const createCandle = (
  close: number,
  high?: number,
  low?: number,
  open?: number,
  volume = 1000,
  timestamp = Date.now(),
): Candle => ({
  timestamp,
  open: open ?? close,
  high: high ?? close,
  low: low ?? close,
  close,
  volume,
});

describe('SetupDetectionService', () => {
  it('should create service with default config', () => {
    const service = new SetupDetectionService();
    const config = service.getConfig();

    expect(config.setup91).toBeDefined();
    expect(config.pattern123).toBeDefined();
    expect(config.setup91.enabled).toBe(false);
    expect(config.pattern123.enabled).toBe(false);
  });

  it('should return empty array for insufficient candles', () => {
    const service = new SetupDetectionService();
    const candles = [createCandle(100), createCandle(101)];

    const setups = service.detectSetups(candles);
    expect(setups).toEqual([]);
  });

  it('should detect setups with sufficient data', () => {
    const service = new SetupDetectionService({
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: true },
      pattern123: { ...createDefaultSetupDetectionConfig().pattern123, enabled: true },
    });
    
    const candles = Array.from({ length: 100 }, (_, i) => {
      const base = 100;
      const price = base + Math.sin(i / 10) * 5;
      return createCandle(price, price + 1, price - 1, price, 1000 * (1 + Math.random()));
    });

    const setups = service.detectSetups(candles);
    
    expect(Array.isArray(setups)).toBe(true);
  });

  it('should update configuration', () => {
    const service = new SetupDetectionService();
    
    service.updateConfig({
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: false },
    });

    const config = service.getConfig();
    expect(config.setup91.enabled).toBe(false);
  });

  it('should sort setups by confidence', () => {
    const service = new SetupDetectionService();
    
    const candles = Array.from({ length: 200 }, (_, i) => {
      const base = 100;
      const trend = i * 0.1;
      const price = base + trend + Math.sin(i / 5) * 3;
      return createCandle(price, price + 2, price - 2, price, 2000 + Math.random() * 1000);
    });

    const setups = service.detectSetups(candles);
    
    for (let i = 0; i < setups.length - 1; i++) {
      expect(setups[i]!.confidence).toBeGreaterThanOrEqual(setups[i + 1]!.confidence);
    }
  });

  it('should detect setups in range', () => {
    const service = new SetupDetectionService();
    
    const candles = Array.from({ length: 150 }, (_, i) => {
      const base = 100;
      const price = base + Math.sin(i / 8) * 4;
      return createCandle(price, price + 1.5, price - 1.5, price, 1500);
    });

    const setups = service.detectSetupsInRange(candles, 50, 100);
    
    expect(Array.isArray(setups)).toBe(true);
  });

  it('should respect enabled flags', () => {
    const service = new SetupDetectionService({
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: false },
      pattern123: { ...createDefaultSetupDetectionConfig().pattern123, enabled: false },
    });
    
    const candles = Array.from({ length: 100 }, (_, i) =>
      createCandle(100 + i * 0.5, 100 + i * 0.5 + 2, 100 + i * 0.5 - 2),
    );

    const setups = service.detectSetups(candles);
    
    expect(setups).toEqual([]);
  });

  it('should filter by minimum confidence', () => {
    const service = new SetupDetectionService({
      setup91: { ...createDefaultSetupDetectionConfig().setup91, minConfidence: 90 },
      pattern123: { ...createDefaultSetupDetectionConfig().pattern123, minConfidence: 90 },
    });
    
    const candles = Array.from({ length: 100 }, () =>
      createCandle(100 + Math.random() * 10, 100 + Math.random() * 10 + 1, 100 + Math.random() * 10 - 1),
    );

    const setups = service.detectSetups(candles);
    
    setups.forEach((setup) => {
      expect(setup.confidence).toBeGreaterThanOrEqual(90);
    });
  });
});
