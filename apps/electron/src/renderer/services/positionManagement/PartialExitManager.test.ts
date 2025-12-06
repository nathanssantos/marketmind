import { describe, expect, it } from 'vitest';
import {
    PartialExitManager,
    createPartialExitManager,
    type PartialExitConfig
} from './PartialExitManager';

describe('PartialExitManager', () => {
    describe('Initialization', () => {
        it('should create manager with default config', () => {
            const manager = createPartialExitManager();
            const state = manager.initialize();

            expect(state.remainingPercentage).toBe(1.0);
            expect(state.executedExits).toHaveLength(0);
            expect(state.totalRealized).toBe(0);
        });

        it('should validate that exit levels sum to 100%', () => {
            expect(() => {
                new PartialExitManager({
                    enabled: true,
                    levels: [
                        { percentage: 0.5, rMultiple: 1.5 },
                        { percentage: 0.3, rMultiple: 2.5 },
                    ],
                    lockInProfitsAfterFirstExit: true,
                });
            }).toThrow('Exit levels must sum to 100%');
        });

        it('should accept custom config', () => {
            const customConfig: PartialExitConfig = {
                enabled: true,
                levels: [
                    { percentage: 0.5, rMultiple: 2.0 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
                lockInProfitsAfterFirstExit: false,
            };

            const manager = createPartialExitManager(customConfig);
            const state = manager.initialize();

            expect(state.remainingPercentage).toBe(1.0);
        });
    });

    describe('Exit Price Calculation', () => {
        it('should calculate exit prices for LONG position', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.5, rMultiple: 2.0 },
                    { percentage: 0.5, rMultiple: 3.0 },
                ],
            });

            const exitPrices = manager.calculateExitPrices(
                100, // entry
                95,  // stop (5 risk)
                'LONG'
            );

            expect(exitPrices).toHaveLength(2);
            expect(exitPrices[0].price).toBe(110); // 100 + (5 * 2.0)
            expect(exitPrices[1].price).toBe(115); // 100 + (5 * 3.0)
        });

        it('should calculate exit prices for SHORT position', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.5, rMultiple: 2.0 },
                    { percentage: 0.5, rMultiple: 3.0 },
                ],
            });

            const exitPrices = manager.calculateExitPrices(
                100, // entry
                105, // stop (5 risk)
                'SHORT'
            );

            expect(exitPrices).toHaveLength(2);
            expect(exitPrices[0].price).toBe(90); // 100 - (5 * 2.0)
            expect(exitPrices[1].price).toBe(85); // 100 - (5 * 3.0)
        });

        it('should handle trailing level (rMultiple = 0)', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.5, rMultiple: 2.0 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
            });

            const exitPrices = manager.calculateExitPrices(100, 95, 'LONG');

            expect(exitPrices[0].price).toBe(110);
            expect(exitPrices[1].price).toBeUndefined(); // Trailing level
        });
    });

    describe('Exit Trigger Detection - LONG Position', () => {
        it('should trigger first exit when target is reached', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.33, rMultiple: 1.5 },
                    { percentage: 0.33, rMultiple: 2.5 },
                    { percentage: 0.34, rMultiple: 0 },
                ],
            });

            const state = manager.initialize();

            const result = manager.checkForExit(
                state,
                107.5, // current price (1.5R target hit)
                100,   // entry
                95,    // stop (5 risk)
                'LONG',
                10
            );

            expect(result).not.toBeNull();
            expect(result!.shouldExit).toBe(true);
            expect(result!.exitPercentage).toBe(0.33);
            expect(result!.rMultiple).toBe(1.5);
            expect(result!.level).toBe(0);
        });

        it('should trigger second exit when second target is reached', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.33, rMultiple: 1.5 },
                    { percentage: 0.33, rMultiple: 2.5 },
                    { percentage: 0.34, rMultiple: 0 },
                ],
            });

            let state = manager.initialize();

            // First exit at 1.5R
            const firstExit = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, firstExit!, 100, 10, 'LONG');

            // Second exit at 2.5R
            const secondExit = manager.checkForExit(state, 112.5, 100, 95, 'LONG', 15);

            expect(secondExit).not.toBeNull();
            expect(secondExit!.exitPercentage).toBe(0.33);
            expect(secondExit!.rMultiple).toBe(2.5);
            expect(secondExit!.level).toBe(1);
        });

        it('should not trigger same level twice', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.5, rMultiple: 1.5 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
            });

            let state = manager.initialize();

            const firstExit = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, firstExit!, 100, 10, 'LONG');

            // Try to trigger same level again
            const duplicateExit = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 11);

            expect(duplicateExit).toBeNull();
        });

        it('should not trigger if target not reached', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.5, rMultiple: 2.0 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
            });

            const state = manager.initialize();

            const result = manager.checkForExit(
                state,
                105,  // Below 2R target of 110
                100,
                95,
                'LONG',
                10
            );

            expect(result).toBeNull();
        });
    });

    describe('Exit Trigger Detection - SHORT Position', () => {
        it('should trigger first exit when target is reached', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.33, rMultiple: 1.5 },
                    { percentage: 0.33, rMultiple: 2.5 },
                    { percentage: 0.34, rMultiple: 0 },
                ],
            });

            const state = manager.initialize();

            const result = manager.checkForExit(
                state,
                92.5, // current price (1.5R target hit)
                100,  // entry
                105,  // stop (5 risk)
                'SHORT',
                10
            );

            expect(result).not.toBeNull();
            expect(result!.shouldExit).toBe(true);
            expect(result!.exitPercentage).toBe(0.33);
            expect(result!.rMultiple).toBe(1.5);
        });

        it('should not trigger if target not reached', () => {
            const manager = createPartialExitManager({
                levels: [
                    { percentage: 0.5, rMultiple: 2.0 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
            });

            const state = manager.initialize();

            const result = manager.checkForExit(
                state,
                95,  // Above 2R target of 90
                100,
                105,
                'SHORT',
                10
            );

            expect(result).toBeNull();
        });
    });

    describe('Exit Execution', () => {
        it('should update state after executing exit', () => {
            const manager = createPartialExitManager();
            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            expect(state.remainingPercentage).toBeCloseTo(0.67, 2);
            expect(state.executedExits).toHaveLength(1);
            expect(state.executedExits[0].level).toBe(0);
            expect(state.executedExits[0].percentage).toBe(0.33);
            expect(state.executedExits[0].price).toBe(107.5);
            expect(state.executedExits[0].klineIndex).toBe(10);
        });

        it('should track realized profit', () => {
            const manager = createPartialExitManager();
            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            // (107.5 - 100) * 0.33 = 2.475
            expect(state.totalRealized).toBeCloseTo(2.475, 3);
        });

        it('should accumulate multiple exits', () => {
            const manager = createPartialExitManager();
            let state = manager.initialize();

            const firstExit = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, firstExit!, 100, 10, 'LONG');

            const secondExit = manager.checkForExit(state, 112.5, 100, 95, 'LONG', 15);
            state = manager.executeExit(state, secondExit!, 100, 15, 'LONG');

            expect(state.remainingPercentage).toBeCloseTo(0.34, 2);
            expect(state.executedExits).toHaveLength(2);
            // (7.5 * 0.33) + (12.5 * 0.33) = 2.475 + 4.125 = 6.6
            expect(state.totalRealized).toBeCloseTo(6.6, 3);
        });
    });

    describe('PnL Calculation', () => {
        it('should calculate total PnL with no exits', () => {
            const manager = createPartialExitManager();
            const state = manager.initialize();

            const pnl = manager.calculateTotalPnL(state, 110, 100, 'LONG');

            expect(pnl.realized).toBe(0);
            expect(pnl.unrealized).toBe(10); // (110 - 100) * 1.0
            expect(pnl.total).toBe(10);
        });

        it('should calculate total PnL with partial exits', () => {
            const manager = createPartialExitManager();
            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            const pnl = manager.calculateTotalPnL(state, 110, 100, 'LONG');

            expect(pnl.realized).toBeCloseTo(2.475, 3); // First exit profit
            expect(pnl.unrealized).toBeCloseTo(6.7, 3); // (110 - 100) * 0.67
            expect(pnl.total).toBeCloseTo(9.175, 3);
        });

        it('should calculate PnL for SHORT position', () => {
            const manager = createPartialExitManager();
            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 92.5, 100, 105, 'SHORT', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'SHORT');

            const pnl = manager.calculateTotalPnL(state, 90, 100, 'SHORT');

            expect(pnl.realized).toBeCloseTo(2.475, 3); // (100 - 92.5) * 0.33
            expect(pnl.unrealized).toBeCloseTo(6.7, 3); // (100 - 90) * 0.67
            expect(pnl.total).toBeCloseTo(9.175, 3);
        });
    });

    describe('Profit Locking', () => {
        it('should indicate profit locking after first exit', () => {
            const manager = createPartialExitManager({
                lockInProfitsAfterFirstExit: true,
                levels: [
                    { percentage: 0.5, rMultiple: 1.5 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
            });

            let state = manager.initialize();
            expect(manager.shouldLockInProfits(state)).toBe(false);

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            expect(manager.shouldLockInProfits(state)).toBe(true);
        });

        it('should not lock profits if disabled', () => {
            const manager = createPartialExitManager({
                lockInProfitsAfterFirstExit: false,
                levels: [
                    { percentage: 0.5, rMultiple: 1.5 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
            });

            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            expect(manager.shouldLockInProfits(state)).toBe(false);
        });

        it('should not lock if all position exited', () => {
            const manager = createPartialExitManager({
                lockInProfitsAfterFirstExit: true,
                levels: [
                    { percentage: 1.0, rMultiple: 1.5 },
                ],
            });

            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            expect(state.remainingPercentage).toBe(0);
            expect(manager.shouldLockInProfits(state)).toBe(false);
        });
    });

    describe('Exit Summary', () => {
        it('should return no exits message', () => {
            const manager = createPartialExitManager();
            const state = manager.initialize();

            const summary = manager.getExitSummary(state);

            expect(summary).toBe('No exits executed');
        });

        it('should summarize single exit', () => {
            const manager = createPartialExitManager();
            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            const summary = manager.getExitSummary(state);

            expect(summary).toContain('Executed 1 exits');
            expect(summary).toContain('33% at 1.5R');
            expect(summary).toContain('Remaining: 67%');
        });

        it('should summarize multiple exits', () => {
            const manager = createPartialExitManager();
            let state = manager.initialize();

            const firstExit = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, firstExit!, 100, 10, 'LONG');

            const secondExit = manager.checkForExit(state, 112.5, 100, 95, 'LONG', 15);
            state = manager.executeExit(state, secondExit!, 100, 15, 'LONG');

            const summary = manager.getExitSummary(state);

            expect(summary).toContain('Executed 2 exits');
            expect(summary).toContain('33% at 1.5R');
            expect(summary).toContain('33% at 2.5R');
            expect(summary).toContain('Remaining: 34%');
        });
    });

    describe('Disabled Mode', () => {
        it('should not trigger exits when disabled', () => {
            const manager = createPartialExitManager({
                enabled: false,
                levels: [
                    { percentage: 0.5, rMultiple: 1.5 },
                    { percentage: 0.5, rMultiple: 0 },
                ],
            });

            const state = manager.initialize();

            const result = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);

            expect(result).toBeNull();
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero risk (avoid division by zero)', () => {
            const manager = createPartialExitManager();
            const state = manager.initialize();

            const result = manager.checkForExit(
                state,
                110,
                100,
                100, // Same as entry (zero risk)
                'LONG',
                10
            );

            expect(result).toBeNull();
        });

        it('should not trigger when remaining percentage is zero', () => {
            const manager = createPartialExitManager({
                levels: [{ percentage: 1.0, rMultiple: 1.5 }],
            });

            let state = manager.initialize();

            const exitResult = manager.checkForExit(state, 107.5, 100, 95, 'LONG', 10);
            state = manager.executeExit(state, exitResult!, 100, 10, 'LONG');

            expect(state.remainingPercentage).toBe(0);

            const secondCheck = manager.checkForExit(state, 110, 100, 95, 'LONG', 15);

            expect(secondCheck).toBeNull();
        });
    });
});
