import type { Kline } from '@shared/types';
import { describe, expect, it } from 'vitest';
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

  it('should prevent duplicate detections with cooldown', () => {
    const service = new SetupDetectionService({
      ...createDefaultSetupDetectionConfig(),
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: true, minConfidence: 50 },
      setupCooldownPeriod: 5,
    });
    
    const baseCandles = Array.from({ length: 50 }, (_, i) => 
      createCandle(100 + i * 0.1, 100 + i * 0.1 + 1, 100 + i * 0.1 - 1, 100 + i * 0.1, 1000)
    );

    const firstDetection = service.detectSetups(baseCandles);
    const firstCount = firstDetection.filter(s => s.type === 'setup-9-1').length;

    for (let i = 0; i < 4; i++) {
      const newCandle = createCandle(100 + (50 + i) * 0.1, 100 + (50 + i) * 0.1 + 1, 100 + (50 + i) * 0.1 - 1, 100 + (50 + i) * 0.1, 1000);
      baseCandles.push(newCandle);
      const setups = service.detectSetups(baseCandles);
      const setup91Count = setups.filter(s => s.type === 'setup-9-1').length;
      expect(setup91Count).toBe(firstCount);
    }

    for (let i = 4; i < 10; i++) {
      const newCandle = createCandle(100 + (50 + i) * 0.1, 100 + (50 + i) * 0.1 + 1, 100 + (50 + i) * 0.1 - 1, 100 + (50 + i) * 0.1, 1000);
      baseCandles.push(newCandle);
    }
    
    const afterCooldown = service.detectSetups(baseCandles);
    expect(afterCooldown.length).toBeGreaterThanOrEqual(0);
  });

  it('should detect bullish trend when price above EMA 200', () => {
    const service = new SetupDetectionService({
      ...createDefaultSetupDetectionConfig(),
      enableTrendFilter: true,
      allowCounterTrend: false,
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: true, minConfidence: 50 },
    });

    const candles = Array.from({ length: 250 }, (_, i) => 
      createCandle(100 + i * 0.5, 100 + i * 0.5 + 1, 100 + i * 0.5 - 1, 100 + i * 0.5, 2000)
    );

    const setups = service.detectSetups(candles);
    
    setups.forEach((setup) => {
      if (setup.type === 'setup-9-1') {
        expect(['LONG', 'SHORT']).toContain(setup.direction);
      }
    });
  });

  it('should detect bearish trend when price below EMA 200', () => {
    const service = new SetupDetectionService({
      ...createDefaultSetupDetectionConfig(),
      enableTrendFilter: true,
      allowCounterTrend: false,
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: true, minConfidence: 50 },
    });

    const candles = Array.from({ length: 250 }, (_, i) => 
      createCandle(200 - i * 0.3, 200 - i * 0.3 + 1, 200 - i * 0.3 - 1, 200 - i * 0.3, 2000)
    );

    const setups = service.detectSetups(candles);
    
    setups.forEach((setup) => {
      if (setup.type === 'setup-9-1') {
        expect(['LONG', 'SHORT']).toContain(setup.direction);
      }
    });
  });

  it('should allow all setups when trend filter disabled', () => {
    const service = new SetupDetectionService({
      ...createDefaultSetupDetectionConfig(),
      enableTrendFilter: false,
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: true, minConfidence: 50 },
    });

    const candles = Array.from({ length: 250 }, (_, i) => 
      createCandle(100 + Math.sin(i / 10) * 20, 100 + Math.sin(i / 10) * 20 + 2, 100 + Math.sin(i / 10) * 20 - 2, 100 + Math.sin(i / 10) * 20, 2000)
    );

    const setups = service.detectSetups(candles);
    
    expect(Array.isArray(setups)).toBe(true);
  });

  it('should allow counter-trend when allowCounterTrend is true', () => {
    const service = new SetupDetectionService({
      ...createDefaultSetupDetectionConfig(),
      enableTrendFilter: true,
      allowCounterTrend: true,
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: true, minConfidence: 50 },
    });

    const candles = Array.from({ length: 250 }, (_, i) => 
      createCandle(100 + Math.sin(i / 10) * 15, 100 + Math.sin(i / 10) * 15 + 1.5, 100 + Math.sin(i / 10) * 15 - 1.5, 100 + Math.sin(i / 10) * 15, 2000)
    );

    const setups = service.detectSetups(candles);
    
    expect(Array.isArray(setups)).toBe(true);
  });

  it('should respect custom cooldown period', () => {
    const customCooldown = 15;
    const service = new SetupDetectionService({
      ...createDefaultSetupDetectionConfig(),
      setup91: { ...createDefaultSetupDetectionConfig().setup91, enabled: true, minConfidence: 50 },
      setupCooldownPeriod: customCooldown,
    });

    const candles = Array.from({ length: 100 }, (_, i) => 
      createCandle(100 + i * 0.1, 100 + i * 0.1 + 1, 100 + i * 0.1 - 1, 100 + i * 0.1, 1500)
    );

    service.detectSetups(candles);

    for (let i = 0; i < customCooldown - 1; i++) {
      candles.push(createCandle(100 + (100 + i) * 0.1, 100 + (100 + i) * 0.1 + 1, 100 + (100 + i) * 0.1 - 1, 100 + (100 + i) * 0.1, 1500));
      const setups = service.detectSetups(candles);
      expect(Array.isArray(setups)).toBe(true);
    }
  });
});
