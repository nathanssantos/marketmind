import { calculateATR } from '@marketmind/indicators';
import type { Kline } from '@shared/types';

export interface TrailingStopConfig {
    initialATRMultiplier: number;
    trailingATRMultiplier: number;
    breakEvenAfterR: number;
    breakEvenBuffer: number;
    minTrailDistance: number;
}

export interface TrailingStopState {
    currentStopLoss: number;
    highestPrice: number;
    lowestPrice: number;
    rMultiples: number;
    isAtBreakEven: boolean;
    lastUpdateKlineIndex: number;
}

export interface TrailingStopUpdate {
    newStopLoss: number;
    moved: boolean;
    reason: string;
    rMultiples: number;
}

/**
 * ATR-Based Trailing Stop Manager
 * 
 * Features:
 * - Initial stop loss based on ATR
 * - Trailing stop that follows price
 * - Break-even move after 1R profit
 * - Prevents stop from moving against position
 * - Configurable ATR multipliers
 * 
 * Usage:
 * ```typescript
 * const manager = new TrailingStopManager(config);
 * const state = manager.initialize(entry, direction, klines, currentIndex);
 * const update = manager.update(state, klines, currentIndex);
 * ```
 */
export class TrailingStopManager {
    private config: TrailingStopConfig;

    constructor(config: TrailingStopConfig) {
        this.config = config;
    }

    /**
     * Initialize trailing stop state for a new position
     */
    initialize(
        entryPrice: number,
        direction: 'LONG' | 'SHORT',
        klines: Kline[],
        currentIndex: number
    ): TrailingStopState {
        const atrArray = calculateATR(klines.slice(0, currentIndex + 1), 14);
        const atr = atrArray[atrArray.length - 1];
        
        if (!atr || atr === 0) {
            throw new Error('Unable to calculate ATR for initial stop loss');
        }

        const stopDistance = atr * this.config.initialATRMultiplier;
        const initialStopLoss = direction === 'LONG'
            ? entryPrice - stopDistance
            : entryPrice + stopDistance;

        return {
            currentStopLoss: initialStopLoss,
            highestPrice: direction === 'LONG' ? entryPrice : Infinity,
            lowestPrice: direction === 'SHORT' ? entryPrice : 0,
            rMultiples: 0,
            isAtBreakEven: false,
            lastUpdateKlineIndex: currentIndex,
        };
    }

    /**
     * Update trailing stop based on current price action
     */
    update(
        state: TrailingStopState,
        entryPrice: number,
        direction: 'LONG' | 'SHORT',
        klines: Kline[],
        currentIndex: number
    ): TrailingStopUpdate {
        if (currentIndex <= state.lastUpdateKlineIndex) {
            return {
                newStopLoss: state.currentStopLoss,
                moved: false,
                reason: 'No new klines',
                rMultiples: state.rMultiples,
            };
        }

        const currentKline = klines[currentIndex];
        if (!currentKline) {
            return {
                newStopLoss: state.currentStopLoss,
                moved: false,
                reason: 'Invalid kline at current index',
                rMultiples: state.rMultiples,
            };
        }

        const currentPrice = Number(currentKline.close);
        const atrArray = calculateATR(klines.slice(0, currentIndex + 1), 14);
        const atr = atrArray[atrArray.length - 1];
        
        if (!atr || atr === 0) {
            return {
                newStopLoss: state.currentStopLoss,
                moved: false,
                reason: 'Unable to calculate ATR',
                rMultiples: state.rMultiples,
            };
        }

        // Update highest/lowest price
        const newHighest = direction === 'LONG' 
            ? Math.max(state.highestPrice, currentPrice)
            : state.highestPrice;
        const newLowest = direction === 'SHORT'
            ? Math.min(state.lowestPrice, currentPrice)
            : state.lowestPrice;

        // Calculate current R-multiples
        const initialRisk = Math.abs(entryPrice - state.currentStopLoss);
        const currentProfit = direction === 'LONG'
            ? currentPrice - entryPrice
            : entryPrice - currentPrice;
        const rMultiples = initialRisk > 0 ? currentProfit / initialRisk : 0;

        // Check if we should move to break-even
        if (!state.isAtBreakEven && rMultiples >= this.config.breakEvenAfterR) {
            const breakEvenStop = direction === 'LONG'
                ? entryPrice + (atr * this.config.breakEvenBuffer)
                : entryPrice - (atr * this.config.breakEvenBuffer);

            return {
                newStopLoss: breakEvenStop,
                moved: true,
                reason: `Moved to break-even after ${this.config.breakEvenAfterR}R`,
                rMultiples,
            };
        }

        // Calculate trailing stop
        const trailDistance = atr * this.config.trailingATRMultiplier;
        const potentialStop = direction === 'LONG'
            ? newHighest - trailDistance
            : newLowest + trailDistance;

        // Only move stop if it's favorable (never move against position)
        const shouldMove = direction === 'LONG'
            ? potentialStop > state.currentStopLoss
            : potentialStop < state.currentStopLoss;

        // Check minimum trail distance
        const currentDistance = Math.abs(currentPrice - potentialStop);
        const minDistance = atr * this.config.minTrailDistance;
        
        if (shouldMove && currentDistance >= minDistance) {
            return {
                newStopLoss: potentialStop,
                moved: true,
                reason: `Trailed ${direction === 'LONG' ? 'up' : 'down'} by ${trailDistance.toFixed(2)}`,
                rMultiples,
            };
        }

        return {
            newStopLoss: state.currentStopLoss,
            moved: false,
            reason: 'No favorable move available',
            rMultiples,
        };
    }

    /**
     * Check if stop loss has been hit
     */
    isStopHit(
        stopLoss: number,
        direction: 'LONG' | 'SHORT',
        kline: Kline
    ): boolean {
        if (direction === 'LONG') {
            return Number(kline.low) <= stopLoss;
        }
        return Number(kline.high) >= stopLoss;
    }

    /**
     * Get exit price when stop is hit
     */
    getExitPrice(
        stopLoss: number,
        direction: 'LONG' | 'SHORT',
        kline: Kline
    ): number {
        if (this.isStopHit(stopLoss, direction, kline)) {
            return stopLoss;
        }
        return Number(kline.close);
    }
}

export const createDefaultTrailingStopConfig = (): TrailingStopConfig => ({
    initialATRMultiplier: 2.0,      // Initial stop: 2x ATR
    trailingATRMultiplier: 1.5,     // Trail: 1.5x ATR
    breakEvenAfterR: 1.0,            // Move to BE after 1R profit
    breakEvenBuffer: 0.1,            // BE + 0.1 ATR
    minTrailDistance: 1.0,           // Min 1x ATR trail distance
});

export const createTrailingStopManager = (
    config?: Partial<TrailingStopConfig>
): TrailingStopManager => {
    const defaultConfig = createDefaultTrailingStopConfig();
    return new TrailingStopManager({ ...defaultConfig, ...config });
};
