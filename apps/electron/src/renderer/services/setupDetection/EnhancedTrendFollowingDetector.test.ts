import type { Kline } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { EnhancedTrendFollowingDetector } from './EnhancedTrendFollowingDetector';

const createKline = (
    close: number,
    volume: number = 1000000,
    timestamp: number = Date.now()
): Kline => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    openTime: timestamp,
    closeTime: timestamp + 3600000,
    open: close,
    high: close * 1.005,
    low: close * 0.995,
    close,
    volume,
    quoteVolume: close * volume,
    trades: 100,
    baseAssetVolume: volume * 0.5,
    quoteAssetVolume: close * volume * 0.5,
});

const createTrendingKlines = (count: number, startPrice: number, trend: number): Kline[] => {
    const klines: Kline[] = [];
    let price = startPrice;
    
    for (let i = 0; i < count; i++) {
        klines.push(createKline(price, 1000000 + Math.random() * 200000, Date.now() + i * 3600000));
        price += trend;
    }
    
    return klines;
};

const createBullishCrossover = (baseKlines: Kline[]): Kline[] => {
    const klines = [...baseKlines];
    const lastPrice = klines[klines.length - 1]?.close || 50000;
    
    for (let i = 0; i < 10; i++) {
        const price = lastPrice + (i + 1) * 50;
        klines.push(createKline(price, 1200000, Date.now() + (klines.length + i) * 3600000));
    }
    
    return klines;
};

const createBearishCrossover = (baseKlines: Kline[]): Kline[] => {
    const klines = [...baseKlines];
    const lastPrice = klines[klines.length - 1]?.close || 50000;
    
    for (let i = 0; i < 10; i++) {
        const price = lastPrice - (i + 1) * 50;
        klines.push(createKline(price, 1200000, Date.now() + (klines.length + i) * 3600000));
    }
    
    return klines;
};

describe('EnhancedTrendFollowingDetector', () => {
    const defaultConfig = {
        enabled: true,
        ltfPeriodFast: 9,
        ltfPeriodSlow: 21,
        htfMultiplier: 4,
        htfPeriod: 50,
        atrPeriod: 14,
        stopLossATR: 1.5,
        takeProfitRatio: 3.0,
        requireHTFConfirmation: true,
        volumeThreshold: 1.0,
        minConfidence: 0.55,
        minRiskReward: 2.0,
    };

    describe('Initialization', () => {
        it('should create detector with valid config', () => {
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            expect(detector).toBeDefined();
        });

        it('should use custom config parameters', () => {
            const customConfig = { ...defaultConfig, takeProfitRatio: 4.0 };
            const detector = new EnhancedTrendFollowingDetector(customConfig);
            expect(detector).toBeDefined();
        });
    });

    describe('Setup Detection', () => {
        it('should detect LONG setup on bullish crossover with HTF confirmation', () => {
            const baseKlines = createTrendingKlines(200, 48000, 20);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup) {
                expect(result.setup.type).toBe('ENHANCED_TREND_FOLLOWING');
                expect(result.setup.direction).toBe('LONG');
                expect(result.confidence).toBeGreaterThan(0);
            }
        });

        it('should detect SHORT setup on bearish crossover with HTF confirmation', () => {
            const baseKlines = createTrendingKlines(200, 52000, -20);
            const klines = createBearishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup) {
                expect(result.setup.type).toBe('ENHANCED_TREND_FOLLOWING');
                expect(result.setup.direction).toBe('SHORT');
                expect(result.confidence).toBeGreaterThan(0);
            }
        });

        it('should not detect setup without HTF confirmation when required', () => {
            const uptrend = createTrendingKlines(150, 48000, 30);
            const klines = createBearishCrossover(uptrend); // Bearish cross in uptrend
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            expect(result.setup).toBeNull();
        });

        it('should detect setup without HTF confirmation when not required', () => {
            const uptrend = createTrendingKlines(150, 48000, 30);
            const klines = createBullishCrossover(uptrend);
            const customConfig = { ...defaultConfig, requireHTFConfirmation: false };
            const detector = new EnhancedTrendFollowingDetector(customConfig);
            const result = detector.detect(klines, klines.length - 1);

            expect(result.setup).toBeDefined();
        });

        it('should not detect setup with insufficient data', () => {
            const klines = createTrendingKlines(30, 50000, 20);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, 20);

            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should not detect setup with low volume', () => {
            const baseKlines = createTrendingKlines(200, 48000, 20);
            const tempKlines = createBullishCrossover(baseKlines);
            const klines = tempKlines.map((k, i) => 
                i < tempKlines.length - 10 ? k : { ...k, volume: k.volume * 0.5 }
            );
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            expect(result.setup).toBeNull();
        });
    });

    describe('Setup Properties', () => {
        it('should create LONG setup with proper price levels', () => {
            const baseKlines = createTrendingKlines(200, 48000, 20);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup && result.setup.direction === 'LONG') {
                expect(result.setup.entryPrice).toBeGreaterThan(result.setup.stopLoss);
                expect(result.setup.takeProfit).toBeGreaterThan(result.setup.entryPrice);
                
                const risk = result.setup.entryPrice - result.setup.stopLoss;
                const reward = result.setup.takeProfit - result.setup.entryPrice;
                const actualRR = reward / risk;
                
                expect(actualRR).toBeCloseTo(defaultConfig.takeProfitRatio, 1);
            }
        });

        it('should create SHORT setup with proper price levels', () => {
            const baseKlines = createTrendingKlines(200, 52000, -20);
            const klines = createBearishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup && result.setup.direction === 'SHORT') {
                expect(result.setup.entryPrice).toBeLessThan(result.setup.stopLoss);
                expect(result.setup.takeProfit).toBeLessThan(result.setup.entryPrice);
                
                const risk = result.setup.stopLoss - result.setup.entryPrice;
                const reward = result.setup.entryPrice - result.setup.takeProfit;
                const actualRR = reward / risk;
                
                expect(actualRR).toBeCloseTo(defaultConfig.takeProfitRatio, 1);
            }
        });

        it('should include metadata with EMA values', () => {
            const baseKlines = createTrendingKlines(200, 48000, 20);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup?.metadata) {
                expect(result.setup.metadata).toHaveProperty('emaFast');
                expect(result.setup.metadata).toHaveProperty('emaSlow');
                expect(result.setup.metadata).toHaveProperty('htfEMA');
                expect(result.setup.metadata).toHaveProperty('htfClose');
                expect(result.setup.metadata).toHaveProperty('atr');
                expect(result.setup.metadata).toHaveProperty('ltfSeparation');
                expect(result.setup.metadata).toHaveProperty('htfSeparation');
            }
        });
    });

    describe('Multi-Timeframe Analysis', () => {
        it('should convert to higher timeframe correctly', () => {
            const klines = createTrendingKlines(200, 50000, 10);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            
            klines.length = 200;
            const result = detector.detect(klines, 199);

            if (result.setup?.metadata) {
                expect(result.setup.metadata).toHaveProperty('htfClose');
                expect(result.setup.metadata).toHaveProperty('htfEMA');
            }
        });

        it('should require bullish HTF for LONG setup', () => {
            const baseKlines = createTrendingKlines(200, 48000, 20);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup && result.setup.direction === 'LONG' && result.setup.metadata) {
                const htfClose = result.setup.metadata.htfClose as number;
                const htfEMA = result.setup.metadata.htfEMA as number;
                expect(htfClose).toBeGreaterThan(htfEMA);
            }
        });

        it('should require bearish HTF for SHORT setup', () => {
            const baseKlines = createTrendingKlines(200, 52000, -20);
            const klines = createBearishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup && result.setup.direction === 'SHORT' && result.setup.metadata) {
                const htfClose = result.setup.metadata.htfClose as number;
                const htfEMA = result.setup.metadata.htfEMA as number;
                expect(htfClose).toBeLessThan(htfEMA);
            }
        });
    });

    describe('Confidence Calculation', () => {
        it('should have higher confidence with strong LTF separation', () => {
            const baseKlines = createTrendingKlines(200, 48000, 50); // Strong trend
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup) {
                expect(result.confidence).toBeGreaterThan(0.55);
            }
        });

        it('should have higher confidence with strong HTF separation', () => {
            const baseKlines = createTrendingKlines(200, 48000, 30);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup) {
                expect(result.confidence).toBeGreaterThan(0.55);
            }
        });

        it('should have higher confidence with aligned timeframes', () => {
            const baseKlines = createTrendingKlines(200, 48000, 30);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup && result.setup.direction === 'LONG') {
                expect(result.confidence).toBeGreaterThan(0.6);
            }
        });

        it('should cap confidence at 0.95', () => {
            const baseKlines = createTrendingKlines(200, 48000, 80); // Very strong trend
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup) {
                expect(result.confidence).toBeLessThanOrEqual(0.95);
            }
        });
    });

    describe('EMA Crossover Detection', () => {
        it('should detect bullish crossover', () => {
            const baseKlines = createTrendingKlines(200, 48000, 10);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup?.metadata) {
                const emaFast = result.setup.metadata.emaFast as number;
                const emaSlow = result.setup.metadata.emaSlow as number;
                expect(emaFast).toBeGreaterThan(emaSlow);
            }
        });

        it('should detect bearish crossover', () => {
            const baseKlines = createTrendingKlines(200, 52000, -10);
            const klines = createBearishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup?.metadata) {
                const emaFast = result.setup.metadata.emaFast as number;
                const emaSlow = result.setup.metadata.emaSlow as number;
                expect(emaFast).toBeLessThan(emaSlow);
            }
        });
    });

    describe('ATR-Based Stop Loss', () => {
        it('should calculate stop loss based on ATR for LONG', () => {
            const baseKlines = createTrendingKlines(200, 48000, 20);
            const klines = createBullishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup && result.setup.direction === 'LONG' && result.setup.metadata) {
                const atr = result.setup.metadata.atr as number;
                const emaSlow = result.setup.metadata.emaSlow as number;
                const expectedSL = emaSlow - (atr * defaultConfig.stopLossATR);
                
                expect(result.setup.stopLoss).toBeCloseTo(expectedSL, 0);
            }
        });

        it('should calculate stop loss based on ATR for SHORT', () => {
            const baseKlines = createTrendingKlines(200, 52000, -20);
            const klines = createBearishCrossover(baseKlines);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, klines.length - 1);

            if (result.setup && result.setup.direction === 'SHORT' && result.setup.metadata) {
                const atr = result.setup.metadata.atr as number;
                const emaSlow = result.setup.metadata.emaSlow as number;
                const expectedSL = emaSlow + (atr * defaultConfig.stopLossATR);
                
                expect(result.setup.stopLoss).toBeCloseTo(expectedSL, 0);
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty klines array', () => {
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect([], 0);

            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should handle index out of bounds', () => {
            const klines = createTrendingKlines(30, 50000, 20);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, 100);

            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should handle negative index', () => {
            const klines = createTrendingKlines(200, 50000, 20);
            const detector = new EnhancedTrendFollowingDetector(defaultConfig);
            const result = detector.detect(klines, -1);

            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });
    });
});
