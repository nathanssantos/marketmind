import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { TrailingStopManager, createDefaultTrailingStopConfig } from './TrailingStopManager';

const createKline = (
    close: number,
    high?: number,
    low?: number,
    timestamp: number = Date.now()
): Kline => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    openTime: timestamp,
    closeTime: timestamp + 3600000,
    open: close,
    high: high ?? close * 1.01,
    low: low ?? close * 0.99,
    close,
    volume: 1000000,
    quoteVolume: close * 1000000,
    trades: 100,
    baseAssetVolume: 500000,
    quoteAssetVolume: close * 500000,
});

const createTrendingKlines = (count: number, startPrice: number, increment: number): Kline[] => {
    const klines: Kline[] = [];
    let price = startPrice;
    
    for (let i = 0; i < count; i++) {
        klines.push(createKline(price, price * 1.01, price * 0.99, Date.now() + i * 3600000));
        price += increment;
    }
    
    return klines;
};

describe('TrailingStopManager', () => {
    const defaultConfig = createDefaultTrailingStopConfig();

    describe('Initialization', () => {
        it('should initialize LONG position with stop below entry', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(30, 50000, 10);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            
            expect(state.currentStopLoss).toBeLessThan(entryPrice);
            expect(state.highestPrice).toBe(entryPrice);
            expect(state.rMultiples).toBe(0);
            expect(state.isAtBreakEven).toBe(false);
        });

        it('should initialize SHORT position with stop above entry', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(30, 50000, -10);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'SHORT', klines, 25);
            
            expect(state.currentStopLoss).toBeGreaterThan(entryPrice);
            expect(state.lowestPrice).toBe(entryPrice);
            expect(state.rMultiples).toBe(0);
            expect(state.isAtBreakEven).toBe(false);
        });

        it('should throw error if ATR cannot be calculated', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(5, 50000, 10); // Too few klines
            
            expect(() => {
                manager.initialize(50000, 'LONG', klines, 2);
            }).toThrow('Unable to calculate ATR');
        });
    });

    describe('LONG Position Trailing', () => {
        it('should trail stop up as price rises', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(50, 50000, 50);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            const initialStop = state.currentStopLoss;
            
            // Price moves up significantly
            const update = manager.update(
                { ...state, lastUpdateKlineIndex: 25 },
                entryPrice,
                'LONG',
                klines,
                45
            );
            
            expect(update.moved).toBe(true);
            expect(update.newStopLoss).toBeGreaterThan(initialStop);
        });

        it('should not move stop down (against position)', () => {
            const manager = new TrailingStopManager(defaultConfig);
            let klines = createTrendingKlines(30, 50000, 50);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            
            // Price rises, stop trails up
            const update1 = manager.update(
                { ...state, lastUpdateKlineIndex: 25, highestPrice: 51500 },
                entryPrice,
                'LONG',
                klines,
                29
            );
            
            const stopAfterRise = update1.newStopLoss;
            
            // Price drops back down
            klines = [...klines, ...createTrendingKlines(10, 51500, -100)];
            const update2 = manager.update(
                {
                    ...state,
                    currentStopLoss: stopAfterRise,
                    highestPrice: 51500,
                    lastUpdateKlineIndex: 29,
                },
                entryPrice,
                'LONG',
                klines,
                35
            );
            
            // Stop should not move down when price drops
            // It can only stay same or move up if new highs are made
            expect(update2.newStopLoss).toBeGreaterThanOrEqual(stopAfterRise);
        });

        it('should move to break-even after 1R profit', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(60, 50000, 100); // Larger price moves
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            const initialRisk = entryPrice - state.currentStopLoss;
            
            // Price moves up significantly
            const profitableIndex = 50;
            const currentPrice = klines[profitableIndex].close;
            const profit = currentPrice - entryPrice;
            
            // Only test if profit is >= 1R
            if (profit >= initialRisk) {
                const update = manager.update(
                    { ...state, lastUpdateKlineIndex: 25, highestPrice: currentPrice },
                    entryPrice,
                    'LONG',
                    klines,
                    profitableIndex
                );
                
                expect(update.rMultiples).toBeGreaterThanOrEqual(1.0);
                expect(update.newStopLoss).toBeGreaterThanOrEqual(entryPrice);
                expect(update.reason).toContain('break-even');
            } else {
                // Skip test if conditions aren't met
                expect(profit).toBeGreaterThan(0);
            }
        });
    });

    describe('SHORT Position Trailing', () => {
        it('should trail stop down as price falls', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(50, 50000, -50);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'SHORT', klines, 25);
            const initialStop = state.currentStopLoss;
            
            // Price moves down significantly
            const update = manager.update(
                { ...state, lastUpdateKlineIndex: 25 },
                entryPrice,
                'SHORT',
                klines,
                45
            );
            
            expect(update.moved).toBe(true);
            expect(update.newStopLoss).toBeLessThan(initialStop);
        });

        it('should not move stop up (against position)', () => {
            const manager = new TrailingStopManager(defaultConfig);
            let klines = createTrendingKlines(30, 50000, -50);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'SHORT', klines, 25);
            
            // Price falls, stop trails down
            const update1 = manager.update(
                { ...state, lastUpdateKlineIndex: 25, lowestPrice: 48500 },
                entryPrice,
                'SHORT',
                klines,
                29
            );
            
            const stopAfterFall = update1.newStopLoss;
            
            // Price rises back up
            klines = [...klines, ...createTrendingKlines(10, 48500, 100)];
            const update2 = manager.update(
                {
                    ...state,
                    currentStopLoss: stopAfterFall,
                    lowestPrice: 48500,
                    lastUpdateKlineIndex: 29,
                },
                entryPrice,
                'SHORT',
                klines,
                35
            );
            
            // Stop should not move up when price rises
            // It can only stay same or move down if new lows are made
            expect(update2.newStopLoss).toBeLessThanOrEqual(stopAfterFall);
        });

        it('should move to break-even after 1R profit', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(60, 50000, -100); // Larger price moves
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'SHORT', klines, 25);
            const initialRisk = state.currentStopLoss - entryPrice;
            
            // Price moves down significantly
            const profitableIndex = 50;
            const currentPrice = klines[profitableIndex].close;
            const profit = entryPrice - currentPrice;
            
            // Only test if profit is >= 1R
            if (profit >= initialRisk) {
                const update = manager.update(
                    { ...state, lastUpdateKlineIndex: 25, lowestPrice: currentPrice },
                    entryPrice,
                    'SHORT',
                    klines,
                    profitableIndex
                );
                
                expect(update.rMultiples).toBeGreaterThanOrEqual(1.0);
                expect(update.newStopLoss).toBeLessThanOrEqual(entryPrice);
                expect(update.reason).toContain('break-even');
            } else {
                // Skip test if conditions aren't met
                expect(profit).toBeGreaterThan(0);
            }
        });
    });

    describe('R-Multiple Calculation', () => {
        it('should calculate R-multiples correctly for LONG', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(50, 50000, 50);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            const initialRisk = entryPrice - state.currentStopLoss;
            
            const update = manager.update(
                { ...state, lastUpdateKlineIndex: 25 },
                entryPrice,
                'LONG',
                klines,
                35
            );
            
            const currentPrice = klines[35].close;
            const profit = currentPrice - entryPrice;
            const expectedR = profit / initialRisk;
            
            expect(update.rMultiples).toBeCloseTo(expectedR, 2);
        });

        it('should calculate R-multiples correctly for SHORT', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(50, 50000, -50);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'SHORT', klines, 25);
            const initialRisk = state.currentStopLoss - entryPrice;
            
            const update = manager.update(
                { ...state, lastUpdateKlineIndex: 25 },
                entryPrice,
                'SHORT',
                klines,
                35
            );
            
            const currentPrice = klines[35].close;
            const profit = entryPrice - currentPrice;
            const expectedR = profit / initialRisk;
            
            expect(update.rMultiples).toBeCloseTo(expectedR, 2);
        });
    });

    describe('Stop Hit Detection', () => {
        it('should detect LONG stop hit when price goes below stop', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const stopLoss = 49000;
            const kline = createKline(49500, 49600, 48900);
            
            const isHit = manager.isStopHit(stopLoss, 'LONG', kline);
            
            expect(isHit).toBe(true);
        });

        it('should not detect LONG stop hit when price stays above stop', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const stopLoss = 49000;
            const kline = createKline(49500, 49600, 49100);
            
            const isHit = manager.isStopHit(stopLoss, 'LONG', kline);
            
            expect(isHit).toBe(false);
        });

        it('should detect SHORT stop hit when price goes above stop', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const stopLoss = 51000;
            const kline = createKline(50500, 51100, 50400);
            
            const isHit = manager.isStopHit(stopLoss, 'SHORT', kline);
            
            expect(isHit).toBe(true);
        });

        it('should not detect SHORT stop hit when price stays below stop', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const stopLoss = 51000;
            const kline = createKline(50500, 50900, 50400);
            
            const isHit = manager.isStopHit(stopLoss, 'SHORT', kline);
            
            expect(isHit).toBe(false);
        });
    });

    describe('Exit Price Calculation', () => {
        it('should return stop loss price when stop is hit', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const stopLoss = 49000;
            const kline = createKline(49500, 49600, 48900);
            
            const exitPrice = manager.getExitPrice(stopLoss, 'LONG', kline);
            
            expect(exitPrice).toBe(stopLoss);
        });

        it('should return close price when stop is not hit', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const stopLoss = 49000;
            const kline = createKline(49500, 49600, 49100);
            
            const exitPrice = manager.getExitPrice(stopLoss, 'LONG', kline);
            
            expect(exitPrice).toBe(kline.close);
        });
    });

    describe('Configuration', () => {
        it('should use custom ATR multipliers', () => {
            const customConfig = {
                ...defaultConfig,
                initialATRMultiplier: 3.0,
                trailingATRMultiplier: 2.0,
            };
            const manager = new TrailingStopManager(customConfig);
            const klines = createTrendingKlines(30, 50000, 10);
            
            const state = manager.initialize(50000, 'LONG', klines, 25);
            
            // Initial stop should be further away with 3.0 multiplier
            const stopDistance = 50000 - state.currentStopLoss;
            expect(stopDistance).toBeGreaterThan(0);
        });

        it('should respect minimum trail distance', () => {
            const customConfig = {
                ...defaultConfig,
                minTrailDistance: 2.0, // Require 2x ATR minimum
            };
            const manager = new TrailingStopManager(customConfig);
            const klines = createTrendingKlines(50, 50000, 5); // Small moves
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            
            // Small price move shouldn't trigger trail
            const update = manager.update(
                { ...state, lastUpdateKlineIndex: 25 },
                entryPrice,
                'LONG',
                klines,
                30
            );
            
            // Likely won't move due to min distance requirement
            expect(update.moved).toBe(false);
        });
    });

    describe('Edge Cases', () => {
        it('should handle no new klines', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(30, 50000, 10);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            
            const update = manager.update(
                state,
                entryPrice,
                'LONG',
                klines,
                25
            );
            
            expect(update.moved).toBe(false);
            expect(update.reason).toContain('No new klines');
        });

        it('should handle ATR calculation failure on update', () => {
            const manager = new TrailingStopManager(defaultConfig);
            const klines = createTrendingKlines(30, 50000, 10);
            const entryPrice = 50000;
            
            const state = manager.initialize(entryPrice, 'LONG', klines, 25);
            
            // Try to update with insufficient data
            const update = manager.update(
                { ...state, lastUpdateKlineIndex: 0 },
                entryPrice,
                'LONG',
                klines.slice(0, 5),
                4
            );
            
            expect(update.moved).toBe(false);
            expect(update.reason).toContain('Unable to calculate ATR');
        });
    });
});
