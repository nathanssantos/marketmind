import type { Kline } from '@marketmind/types';
import {
    TrailingStopManager,
    createTrailingStopManager,
    type TrailingStopConfig,
    type TrailingStopState,
} from './TrailingStopManager';
import {
    PartialExitManager,
    createPartialExitManager,
    type PartialExitConfig,
    type PartialExitState,
    type PartialExitResult,
} from './PartialExitManager';

export interface PositionConfig {
    trailingStop: TrailingStopConfig;
    partialExit: PartialExitConfig;
}

export interface Position {
    id: string;
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    entryIndex: number;
    quantity: number;
    status: 'OPEN' | 'PARTIAL' | 'CLOSED';
    
    trailingStopState?: TrailingStopState;
    partialExitState: PartialExitState;
    
    closePrice?: number;
    closeIndex?: number;
    closeReason?: string;
}

export interface PositionUpdate {
    stopMoved?: boolean;
    newStopPrice?: number;
    partialExitTriggered?: boolean;
    partialExitDetails?: PartialExitResult;
    stopHit?: boolean;
    shouldClose?: boolean;
    currentPnL?: number;
    currentR?: number;
}

/**
 * Position Manager
 * 
 * Orchestrates position lifecycle with trailing stops and partial exits
 * 
 * Features:
 * - Manages both trailing stops and partial exits
 * - Coordinates break-even moves after first partial exit
 * - Tracks position state (OPEN, PARTIAL, CLOSED)
 * - Calculates real-time PnL and R-multiples
 * 
 * Workflow:
 * 1. Open position with entry price and direction
 * 2. Update with new klines (triggers trailing stops and partial exits)
 * 3. Check for stop hits or full exit
 * 4. Calculate PnL and R-multiples
 * 5. Close position when conditions met
 */
export class PositionManager {
    private trailingStop: TrailingStopManager;
    private partialExit: PartialExitManager;
    private config: PositionConfig;

    constructor(config: PositionConfig) {
        this.config = config;
        this.trailingStop = createTrailingStopManager(config.trailingStop);
        this.partialExit = createPartialExitManager(config.partialExit);
    }

    /**
     * Open a new position
     */
    openPosition(
        id: string,
        symbol: string,
        direction: 'LONG' | 'SHORT',
        entryPrice: number,
        entryIndex: number,
        quantity: number,
        historicalKlines: Kline[]
    ): Position {
        const trailingStopState = this.trailingStop.initialize(
            entryPrice,
            direction,
            historicalKlines,
            entryIndex
        );

        const partialExitState = this.partialExit.initialize();

        return {
            id,
            symbol,
            direction,
            entryPrice,
            entryIndex,
            quantity,
            status: 'OPEN',
            trailingStopState,
            partialExitState,
        };
    }

    /**
     * Update position with new klines
     */
    updatePosition(
        position: Position,
        allKlines: Kline[],
        currentIndex: number
    ): { position: Position; update: PositionUpdate } {
        if (position.status === 'CLOSED') {
            return { position, update: {} };
        }

        if (!position.trailingStopState) {
            throw new Error('Position has no trailing stop state');
        }

        let currentPosition = { ...position };
        const update: PositionUpdate = {};

        // Check for partial exits first
        if (this.config.partialExit.enabled && currentPosition.partialExitState.remainingPercentage > 0) {
            const currentKline = allKlines[currentIndex];
            
            const exitResult = this.partialExit.checkForExit(
                currentPosition.partialExitState,
                currentKline.close,
                currentPosition.entryPrice,
                currentPosition.trailingStopState.currentStopLoss,
                currentPosition.direction,
                currentIndex
            );

            if (exitResult) {
                update.partialExitTriggered = true;
                update.partialExitDetails = exitResult;

                currentPosition.partialExitState = this.partialExit.executeExit(
                    currentPosition.partialExitState,
                    exitResult,
                    currentPosition.entryPrice,
                    currentIndex,
                    currentPosition.direction
                );

                if (currentPosition.partialExitState.remainingPercentage > 0) {
                    currentPosition.status = 'PARTIAL';
                } else {
                    currentPosition.status = 'CLOSED';
                    currentPosition.closePrice = exitResult.exitPrice;
                    currentPosition.closeIndex = currentIndex;
                    currentPosition.closeReason = 'All partial exits completed';
                    return { position: currentPosition, update };
                }
            }
        }

        // Update trailing stop
        const previousStop = currentPosition.trailingStopState.currentStopLoss;
        const trailingUpdate = this.trailingStop.update(
            currentPosition.trailingStopState,
            currentPosition.entryPrice,
            currentPosition.direction,
            allKlines,
            currentIndex
        );

        // Update all state fields
        const currentPrice = allKlines[currentIndex].close;
        currentPosition.trailingStopState.currentStopLoss = trailingUpdate.newStopLoss;
        currentPosition.trailingStopState.rMultiples = trailingUpdate.rMultiples;
        currentPosition.trailingStopState.lastUpdateKlineIndex = currentIndex;
        
        // Update highest/lowest price
        if (currentPosition.direction === 'LONG') {
            currentPosition.trailingStopState.highestPrice = Math.max(
                currentPosition.trailingStopState.highestPrice,
                currentPrice
            );
        } else {
            currentPosition.trailingStopState.lowestPrice = Math.min(
                currentPosition.trailingStopState.lowestPrice,
                currentPrice
            );
        }
        
        // Update break-even status if stop moved to entry or better
        if (trailingUpdate.moved) {
            const isNowAtBreakEven = currentPosition.direction === 'LONG'
                ? trailingUpdate.newStopLoss >= currentPosition.entryPrice
                : trailingUpdate.newStopLoss <= currentPosition.entryPrice;
            
            if (isNowAtBreakEven) {
                currentPosition.trailingStopState.isAtBreakEven = true;
            }
        }

        if (trailingUpdate.moved) {
            update.stopMoved = true;
            update.newStopPrice = trailingUpdate.newStopLoss;
        }

        // Check for stop hit
        const currentKline = allKlines[currentIndex];
        const stopHit = currentPosition.direction === 'LONG'
            ? currentKline.low <= currentPosition.trailingStopState.currentStopLoss
            : currentKline.high >= currentPosition.trailingStopState.currentStopLoss;

        if (stopHit) {
            update.stopHit = true;
            update.shouldClose = true;

            currentPosition.status = 'CLOSED';
            currentPosition.closePrice = currentPosition.trailingStopState.currentStopLoss;
            currentPosition.closeIndex = currentIndex;
            currentPosition.closeReason = 'Trailing stop hit';
        }

        // Calculate current PnL and R
        update.currentPnL = this.calculatePnL(currentPosition, allKlines, currentIndex).total;
        update.currentR = trailingUpdate.rMultiples;

        return { position: currentPosition, update };
    }

    /**
     * Calculate total PnL (realized + unrealized)
     */
    calculatePnL(
        position: Position,
        klines: Kline[],
        currentIndex?: number
    ): { realized: number; unrealized: number; total: number } {
        if (position.status === 'CLOSED' && position.closePrice) {
            const finalPnL = position.direction === 'LONG'
                ? (position.closePrice - position.entryPrice) * position.quantity
                : (position.entryPrice - position.closePrice) * position.quantity;

            return {
                realized: finalPnL,
                unrealized: 0,
                total: finalPnL,
            };
        }

        const idx = currentIndex ?? klines.length - 1;
        const currentPrice = klines[idx].close;
        
        return this.partialExit.calculateTotalPnL(
            position.partialExitState,
            currentPrice,
            position.entryPrice,
            position.direction
        );
    }

    /**
     * Get position summary
     */
    getPositionSummary(position: Position, klines: Kline[], currentIndex?: number): string {
        const idx = currentIndex ?? klines.length - 1;
        const pnl = this.calculatePnL(position, klines, idx);
        const currentPrice = klines[idx].close;
        const r = position.trailingStopState
            ? position.trailingStopState.rMultiples
            : 0;

        const exitSummary = this.partialExit.getExitSummary(position.partialExitState);

        return [
            `Position ${position.id} (${position.symbol})`,
            `Status: ${position.status}`,
            `Direction: ${position.direction}`,
            `Entry: ${position.entryPrice.toFixed(2)}`,
            `Current: ${currentPrice.toFixed(2)}`,
            `PnL: ${pnl.total.toFixed(2)} (${r.toFixed(2)}R)`,
            `Stop: ${position.trailingStopState?.currentStopLoss.toFixed(2) ?? 'N/A'}`,
            `Exits: ${exitSummary}`,
        ].join(' | ');
    }

    /**
     * Close position manually
     */
    closePosition(
        position: Position,
        closePrice: number,
        closeIndex: number,
        reason: string
    ): Position {
        return {
            ...position,
            status: 'CLOSED',
            closePrice,
            closeIndex,
            closeReason: reason,
        };
    }
}

export const createDefaultPositionConfig = (): PositionConfig => ({
    trailingStop: {
        initialATRMultiplier: 2.0,
        trailingATRMultiplier: 1.0,
        breakEvenAfterR: 1.0,
        breakEvenBuffer: 0.0,
        minTrailDistance: 0.0001,
    },
    partialExit: {
        enabled: true,
        levels: [
            { percentage: 0.33, rMultiple: 1.5 },
            { percentage: 0.33, rMultiple: 2.5 },
            { percentage: 0.34, rMultiple: 0 },
        ],
        lockInProfitsAfterFirstExit: true,
    },
});

export const createPositionManager = (
    config?: Partial<PositionConfig>
): PositionManager => {
    const defaultConfig = createDefaultPositionConfig();
    const mergedConfig = {
        trailingStop: {
            ...defaultConfig.trailingStop,
            ...config?.trailingStop,
        },
        partialExit: {
            ...defaultConfig.partialExit,
            ...config?.partialExit,
            levels: config?.partialExit?.levels ?? defaultConfig.partialExit.levels,
        },
    };
    return new PositionManager(mergedConfig);
};
