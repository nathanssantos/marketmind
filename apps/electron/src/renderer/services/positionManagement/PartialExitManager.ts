export interface PartialExitLevel {
    percentage: number;
    rMultiple: number;
    price?: number;
}

export interface PartialExitConfig {
    enabled: boolean;
    levels: PartialExitLevel[];
    lockInProfitsAfterFirstExit: boolean;
}

export interface PartialExitState {
    remainingPercentage: number;
    executedExits: Array<{
        level: number;
        percentage: number;
        price: number;
        rMultiple: number;
        klineIndex: number;
    }>;
    totalRealized: number;
}

export interface PartialExitResult {
    shouldExit: boolean;
    exitPercentage: number;
    exitPrice: number;
    reason: string;
    level: number;
    rMultiple: number;
}

/**
 * Partial Exit Manager
 * 
 * Manages scaled exits from positions at predefined profit targets
 * 
 * Features:
 * - Multiple exit levels based on R-multiples
 * - Percentage-based position scaling
 * - Automatic profit locking after first exit
 * - Tracks realized and unrealized PnL
 * 
 * Example configuration:
 * ```typescript
 * const config = {
 *   enabled: true,
 *   levels: [
 *     { percentage: 0.33, rMultiple: 1.5 },  // Take 33% at 1.5R
 *     { percentage: 0.33, rMultiple: 2.5 },  // Take 33% at 2.5R
 *     { percentage: 0.34, rMultiple: 0 },    // Rest trails with stop
 *   ],
 *   lockInProfitsAfterFirstExit: true,
 * };
 * ```
 */
export class PartialExitManager {
    private config: PartialExitConfig;

    constructor(config: PartialExitConfig) {
        this.config = config;
        
        const totalPercentage = config.levels.reduce((sum, level) => sum + level.percentage, 0);
        if (Math.abs(totalPercentage - 1.0) > 0.01) {
            throw new Error(`Exit levels must sum to 100% (got ${(totalPercentage * 100).toFixed(2)}%)`);
        }
    }

    /**
     * Initialize partial exit state
     */
    initialize(): PartialExitState {
        return {
            remainingPercentage: 1.0,
            executedExits: [],
            totalRealized: 0,
        };
    }

    /**
     * Calculate target prices for exit levels
     */
    calculateExitPrices(
        entryPrice: number,
        stopLoss: number,
        direction: 'LONG' | 'SHORT'
    ): PartialExitLevel[] {
        const risk = Math.abs(entryPrice - stopLoss);

        return this.config.levels.map((level) => {
            if (level.rMultiple === 0) {
                return { ...level, price: undefined };
            }

            const reward = risk * level.rMultiple;
            const exitPrice = direction === 'LONG'
                ? entryPrice + reward
                : entryPrice - reward;

            return {
                ...level,
                price: exitPrice,
            };
        });
    }

    /**
     * Check if any exit level should be triggered
     */
    checkForExit(
        state: PartialExitState,
        currentPrice: number,
        entryPrice: number,
        stopLoss: number,
        direction: 'LONG' | 'SHORT',
        currentIndex: number
    ): PartialExitResult | null {
        if (!this.config.enabled || state.remainingPercentage <= 0) {
            return null;
        }

        const risk = Math.abs(entryPrice - stopLoss);
        if (risk === 0) {
            return null;
        }

        const exitLevels = this.calculateExitPrices(entryPrice, stopLoss, direction);
        const currentProfit = direction === 'LONG'
            ? currentPrice - entryPrice
            : entryPrice - currentPrice;
        const currentR = currentProfit / risk;

        // Find the highest untriggered level that should execute
        for (let i = 0; i < exitLevels.length; i++) {
            const level = exitLevels[i];
            const alreadyExecuted = state.executedExits.some(exit => exit.level === i);

            if (alreadyExecuted) continue;
            if (level.rMultiple === 0) continue; // Skip trailing exit level

            // Check if target is hit
            const targetHit = direction === 'LONG'
                ? currentPrice >= (level.price ?? Infinity)
                : currentPrice <= (level.price ?? 0);

            if (targetHit || currentR >= level.rMultiple) {
                return {
                    shouldExit: true,
                    exitPercentage: level.percentage,
                    exitPrice: level.price ?? currentPrice,
                    reason: `Partial exit at ${level.rMultiple}R (${(level.percentage * 100).toFixed(0)}% of position)`,
                    level: i,
                    rMultiple: level.rMultiple,
                };
            }
        }

        return null;
    }

    /**
     * Execute a partial exit and update state
     */
    executeExit(
        state: PartialExitState,
        exitResult: PartialExitResult,
        entryPrice: number,
        currentIndex: number,
        direction: 'LONG' | 'SHORT'
    ): PartialExitState {
        const realizedProfit = direction === 'LONG'
            ? (exitResult.exitPrice - entryPrice) * exitResult.exitPercentage
            : (entryPrice - exitResult.exitPrice) * exitResult.exitPercentage;

        return {
            remainingPercentage: state.remainingPercentage - exitResult.exitPercentage,
            executedExits: [
                ...state.executedExits,
                {
                    level: exitResult.level,
                    percentage: exitResult.exitPercentage,
                    price: exitResult.exitPrice,
                    rMultiple: exitResult.rMultiple,
                    klineIndex: currentIndex,
                },
            ],
            totalRealized: state.totalRealized + realizedProfit,
        };
    }

    /**
     * Calculate total PnL (realized + unrealized)
     */
    calculateTotalPnL(
        state: PartialExitState,
        currentPrice: number,
        entryPrice: number,
        direction: 'LONG' | 'SHORT'
    ): {
        realized: number;
        unrealized: number;
        total: number;
    } {
        const unrealizedProfit = direction === 'LONG'
            ? (currentPrice - entryPrice) * state.remainingPercentage
            : (entryPrice - currentPrice) * state.remainingPercentage;

        return {
            realized: state.totalRealized,
            unrealized: unrealizedProfit,
            total: state.totalRealized + unrealizedProfit,
        };
    }

    /**
     * Check if should move to break-even after first exit
     */
    shouldLockInProfits(state: PartialExitState): boolean {
        return (
            this.config.lockInProfitsAfterFirstExit &&
            state.executedExits.length > 0 &&
            state.remainingPercentage > 0
        );
    }

    /**
     * Get summary of executed exits
     */
    getExitSummary(state: PartialExitState): string {
        if (state.executedExits.length === 0) {
            return 'No exits executed';
        }

        const exitDetails = state.executedExits
            .map((exit) => `${(exit.percentage * 100).toFixed(0)}% at ${exit.rMultiple}R`)
            .join(', ');

        return `Executed ${state.executedExits.length} exits: ${exitDetails}. Remaining: ${(state.remainingPercentage * 100).toFixed(0)}%`;
    }
}

export const createDefaultPartialExitConfig = (): PartialExitConfig => ({
    enabled: true,
    levels: [
        { percentage: 0.33, rMultiple: 1.5 },  // 33% at 1.5R
        { percentage: 0.33, rMultiple: 2.5 },  // 33% at 2.5R
        { percentage: 0.34, rMultiple: 0 },    // 34% trails with stop
    ],
    lockInProfitsAfterFirstExit: true,
});

export const createPartialExitManager = (
    config?: Partial<PartialExitConfig>
): PartialExitManager => {
    const defaultConfig = createDefaultPartialExitConfig();
    const mergedConfig = {
        ...defaultConfig,
        ...config,
        levels: config?.levels ?? defaultConfig.levels,
    };
    return new PartialExitManager(mergedConfig);
};
