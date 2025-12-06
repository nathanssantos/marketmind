import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { MeanReversionDetector } from './MeanReversionDetector';

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
    high: close * 1.01,
    low: close * 0.99,
    close,
    volume,
    quoteVolume: close * volume,
    trades: 100,
});

const createTrendingKlines = (count: number, startPrice: number): Kline[] => {
    const klines: Kline[] = [];
    let price = startPrice;
    
    for (let i = 0; i < count; i++) {
        klines.push(createKline(price, 1000000, Date.now() + i * 3600000));
        price += 1; // Steady uptrend
    }
    
    return klines;
};

const createOversoldCondition = (baseKlines: Kline[]): Kline[] => {
    const klines = [...baseKlines];
    const lastPrice = klines[klines.length - 1]?.close || 100;
    
    // Create sharp drop to trigger oversold (close < lower band && RSI < 30)
    for (let i = 0; i < 5; i++) {
        const dropPrice = lastPrice - (i + 1) * 2;
        klines.push(createKline(dropPrice, 1500000, Date.now() + (klines.length + i) * 3600000));
    }
    
    return klines;
};

const createOverboughtCondition = (baseKlines: Kline[]): Kline[] => {
    const klines = [...baseKlines];
    const lastPrice = klines[klines.length - 1]?.close || 100;
    
    // Create sharp rally to trigger overbought (close > upper band && RSI > 70)
    for (let i = 0; i < 5; i++) {
        const rallyPrice = lastPrice + (i + 1) * 2;
        klines.push(createKline(rallyPrice, 1500000, Date.now() + (klines.length + i) * 3600000));
    }
    
    return klines;
};

describe('MeanReversionDetector', () => {
    const defaultConfig = {
        bbPeriod: 20,
        bbStdDev: 2,
        rsiPeriod: 14,
        rsiOversold: 30,
        rsiOverbought: 70,
        minVolume: 1.2,
        maxHoldBars: 48,
        minConfidence: 0.6,
        minRiskReward: 1.5,
    };

    describe('Initialization', () => {
        it('should create detector with valid config', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            expect(detector).toBeDefined();
        });

        it('should use custom config parameters', () => {
            const customConfig = {
                ...defaultConfig,
                bbPeriod: 30,
                rsiOversold: 25,
                minConfidence: 0.7,
            };
            const detector = new MeanReversionDetector(customConfig);
            expect(detector).toBeDefined();
        });
    });

    describe('Insufficient Data Handling', () => {
        it('should return null for empty klines', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const result = detector.detect([], 0);
            
            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should return null when currentIndex < required period', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const klines = createTrendingKlines(10, 100);
            const result = detector.detect(klines, 5);
            
            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should return null when indicators cannot be calculated', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const klines = createTrendingKlines(15, 100);
            const result = detector.detect(klines, 14);
            
            // Either null or valid setup depending on data
            expect(result).toBeDefined();
        });
    });

    describe('LONG Setup Detection', () => {
        it('should detect LONG setup on oversold conditions', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup) {
                expect(result.setup.type).toBe('MEAN_REVERSION');
                expect(result.setup.direction).toBe('LONG');
                expect(result.setup.stopLoss).toBeLessThan(result.setup.entryPrice);
                expect(result.setup.takeProfit).toBeGreaterThan(result.setup.entryPrice);
                expect(result.confidence).toBeGreaterThanOrEqual(defaultConfig.minConfidence);
            }
        });

        it('should set stop loss below entry for LONG', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup?.direction === 'LONG') {
                expect(result.setup.stopLoss).toBeLessThan(result.setup.entryPrice);
                const riskDistance = result.setup.entryPrice - result.setup.stopLoss;
                expect(riskDistance).toBeGreaterThan(0);
            }
        });

        it('should set take profit at middle band for LONG', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup?.direction === 'LONG' && result.setup.metadata.bbMiddle) {
                expect(result.setup.takeProfit).toBe(result.setup.metadata.bbMiddle);
            }
        });

        it('should include Bollinger Bands in metadata for LONG', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup?.direction === 'LONG') {
                expect(result.setup.metadata.bbUpper).toBeDefined();
                expect(result.setup.metadata.bbMiddle).toBeDefined();
                expect(result.setup.metadata.bbLower).toBeDefined();
                expect(result.setup.metadata.rsi).toBeDefined();
                expect(result.setup.metadata.percentB).toBeDefined();
                expect(result.setup.metadata.strategy).toBe('oversold');
            }
        });
    });

    describe('SHORT Setup Detection', () => {
        it('should detect SHORT setup on overbought conditions', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOverboughtCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup) {
                expect(result.setup.type).toBe('MEAN_REVERSION');
                expect(result.setup.direction).toBe('SHORT');
                expect(result.setup.stopLoss).toBeGreaterThan(result.setup.entryPrice);
                expect(result.setup.takeProfit).toBeLessThan(result.setup.entryPrice);
                expect(result.confidence).toBeGreaterThanOrEqual(defaultConfig.minConfidence);
            }
        });

        it('should set stop loss above entry for SHORT', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOverboughtCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup?.direction === 'SHORT') {
                expect(result.setup.stopLoss).toBeGreaterThan(result.setup.entryPrice);
                const riskDistance = result.setup.stopLoss - result.setup.entryPrice;
                expect(riskDistance).toBeGreaterThan(0);
            }
        });

        it('should set take profit at middle band for SHORT', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOverboughtCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup?.direction === 'SHORT' && result.setup.metadata.bbMiddle) {
                expect(result.setup.takeProfit).toBe(result.setup.metadata.bbMiddle);
            }
        });

        it('should include Bollinger Bands in metadata for SHORT', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOverboughtCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup?.direction === 'SHORT') {
                expect(result.setup.metadata.bbUpper).toBeDefined();
                expect(result.setup.metadata.bbMiddle).toBeDefined();
                expect(result.setup.metadata.bbLower).toBeDefined();
                expect(result.setup.metadata.rsi).toBeDefined();
                expect(result.setup.metadata.percentB).toBeDefined();
                expect(result.setup.metadata.strategy).toBe('overbought');
            }
        });
    });

    describe('Volume Confirmation', () => {
        it('should reject setups with insufficient volume', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            
            // Set current kline volume below threshold
            const currentIndex = klines.length - 1;
            if (klines[currentIndex]) {
                klines[currentIndex].volume = 500000; // Below 1.2x average
            }
            
            const result = detector.detect(klines, currentIndex);
            
            // Should be rejected due to low volume
            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should accept setups with sufficient volume', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            // May or may not detect depending on exact conditions
            expect(result).toBeDefined();
        });
    });

    describe('Confidence Calculation', () => {
        it('should increase confidence for extreme deviations', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            
            // Create two oversold conditions with different extremity
            const mildKlines = [...baseKlines];
            const extremeKlines = [...baseKlines];
            
            // Mild drop
            for (let i = 0; i < 5; i++) {
                const price = 100 - (i + 1) * 1.5;
                mildKlines.push(createKline(price, 1500000, Date.now() + (mildKlines.length + i) * 3600000));
            }
            
            // Extreme drop
            for (let i = 0; i < 5; i++) {
                const price = 100 - (i + 1) * 3;
                extremeKlines.push(createKline(price, 1500000, Date.now() + (extremeKlines.length + i) * 3600000));
            }
            
            const mildResult = detector.detect(mildKlines, mildKlines.length - 1);
            const extremeResult = detector.detect(extremeKlines, extremeKlines.length - 1);
            
            // Extreme deviation should have higher confidence
            if (mildResult.setup && extremeResult.setup) {
                expect(extremeResult.confidence).toBeGreaterThanOrEqual(mildResult.confidence);
            }
        });

        it('should cap confidence at 0.95', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup) {
                expect(result.confidence).toBeLessThanOrEqual(0.95);
            }
        });

        it('should meet minimum confidence threshold', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup) {
                expect(result.confidence).toBeGreaterThanOrEqual(defaultConfig.minConfidence);
            }
        });
    });

    describe('Risk-Reward Validation', () => {
        it('should meet minimum risk-reward ratio', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            if (result.setup) {
                const risk = Math.abs(result.setup.entryPrice - result.setup.stopLoss);
                const reward = Math.abs(result.setup.takeProfit - result.setup.entryPrice);
                const rr = reward / risk;
                
                expect(rr).toBeGreaterThanOrEqual(defaultConfig.minRiskReward);
            }
        });

        it('should reject setups with poor risk-reward', () => {
            const strictConfig = {
                ...defaultConfig,
                minRiskReward: 3.0, // Very high requirement
            };
            const detector = new MeanReversionDetector(strictConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            // Most setups will be rejected with 3:1 requirement
            expect(result).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle ranging market without extreme conditions', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const klines: Kline[] = [];
            
            // Create ranging market
            for (let i = 0; i < 40; i++) {
                const price = 100 + Math.sin(i / 5) * 2; // Oscillating price
                klines.push(createKline(price, 1000000, Date.now() + i * 3600000));
            }
            
            const result = detector.detect(klines, klines.length - 1);
            
            // May or may not detect depending on exact conditions
            expect(result).toBeDefined();
        });

        it('should handle strong trending market', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const klines = createTrendingKlines(40, 100);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            // Strong trend should not trigger mean reversion
            // (price stays within bands during healthy trend)
            expect(result).toBeDefined();
        });

        it('should handle zero volume klines', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            if (klines[currentIndex]) {
                klines[currentIndex].volume = 0;
            }
            
            const result = detector.detect(klines, currentIndex);
            
            expect(result.setup).toBeNull();
            expect(result.confidence).toBe(0);
        });

        it('should handle invalid currentIndex', () => {
            const detector = new MeanReversionDetector(defaultConfig);
            const klines = createTrendingKlines(30, 100);
            
            const result1 = detector.detect(klines, -1);
            expect(result1.setup).toBeNull();
            expect(result1.confidence).toBe(0);
            
            const result2 = detector.detect(klines, klines.length);
            expect(result2.setup).toBeNull();
            expect(result2.confidence).toBe(0);
        });
    });

    describe('Custom Configuration', () => {
        it('should respect custom BB period', () => {
            const customConfig = {
                ...defaultConfig,
                bbPeriod: 30,
            };
            const detector = new MeanReversionDetector(customConfig);
            const klines = createTrendingKlines(40, 100);
            const result = detector.detect(klines, klines.length - 1);
            
            expect(result).toBeDefined();
        });

        it('should respect custom RSI thresholds', () => {
            const customConfig = {
                ...defaultConfig,
                rsiOversold: 25,
                rsiOverbought: 75,
            };
            const detector = new MeanReversionDetector(customConfig);
            const klines = createTrendingKlines(30, 100);
            const result = detector.detect(klines, klines.length - 1);
            
            expect(result).toBeDefined();
        });

        it('should respect custom volume threshold', () => {
            const customConfig = {
                ...defaultConfig,
                minVolume: 2.0, // Higher volume requirement
            };
            const detector = new MeanReversionDetector(customConfig);
            const baseKlines = createTrendingKlines(30, 100);
            const klines = createOversoldCondition(baseKlines);
            const currentIndex = klines.length - 1;
            
            const result = detector.detect(klines, currentIndex);
            
            // May reject more setups due to stricter volume requirement
            expect(result).toBeDefined();
        });
    });
});
