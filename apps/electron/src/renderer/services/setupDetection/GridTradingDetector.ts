import { calculateATR, calculateEMA } from '@marketmind/indicators';
import type { Kline } from '@shared/types';
import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from './BaseSetupDetector';

export interface GridTradingConfig extends SetupDetectorConfig {
    emaPeriod: number;
    atrPeriod: number;
    gridLevels: number;
    gridSpacingATR: number; // ATR multiplier for grid spacing
    minGridSpacing: number; // Minimum spacing as % of price
    maxGridSpacing: number; // Maximum spacing as % of price
    requireRanging: boolean; // Only trade in ranging markets
    volumeThreshold: number; // Multiplier of average volume
}

/**
 * Grid Trading Detector
 * 
 * Strategy: Place multiple buy/sell orders at predetermined price levels
 * Entry: Multiple limit orders above and below current price
 * Exit: Take profit at next grid level
 * 
 * Expected Performance:
 * - Win Rate: 65-75%
 * - R:R: 1:1 (symmetric grid)
 * - Best in ranging/sideways markets
 * - Accumulates profit through price oscillations
 */
export class GridTradingDetector extends BaseSetupDetector {
    private gridConfig: GridTradingConfig;

    constructor(config: GridTradingConfig) {
        super(config);
        this.gridConfig = config;
    }

    detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
        if (currentIndex < Math.max(this.gridConfig.emaPeriod, this.gridConfig.atrPeriod)) {
            return { setup: null, confidence: 0 };
        }

        const current = klines[currentIndex];
        if (!current) {
            return { setup: null, confidence: 0 };
        }

        // Calculate fair value (EMA)
        const klinesUpToCurrent = klines.slice(0, currentIndex + 1);
        const fairValue = calculateEMA(klinesUpToCurrent, this.gridConfig.emaPeriod);
        if (fairValue === null) {
            return { setup: null, confidence: 0 };
        }

        // Calculate ATR for grid spacing
        const atr = calculateATR(klinesUpToCurrent, this.gridConfig.atrPeriod);
        if (atr === null) {
            return { setup: null, confidence: 0 };
        }

        // Check if market is ranging (required for grid trading)
        if (this.gridConfig.requireRanging && !this.isMarketRanging(klines, currentIndex)) {
            return { setup: null, confidence: 0 };
        }

        // Check volume
        const avgVolume = this.calculateAverageVolume(klines, currentIndex, 20);
        if (current.volume < avgVolume * this.gridConfig.volumeThreshold) {
            return { setup: null, confidence: 0 };
        }

        // Calculate grid levels
        const gridSpacing = this.calculateGridSpacing(current.close, atr);
        const gridLevels = this.createGridLevels(fairValue, gridSpacing);

        // Determine which grid level we're at
        const currentGridLevel = this.findCurrentGridLevel(current.close, gridLevels);

        // Create setup based on position relative to grid
        return this.createGridSetup(klines, currentIndex, fairValue, gridLevels, currentGridLevel);
    }

    private isMarketRanging(klines: Kline[], currentIndex: number): boolean {
        const emaPeriod = this.gridConfig.emaPeriod;
        if (currentIndex < emaPeriod + 10) return false;

        // Check last 10 klines for EMA flatness
        let emaChanges = 0;
        for (let i = 0; i < 10; i++) {
            const idx = currentIndex - i;
            const klinesUpToCurrent = klines.slice(0, idx + 1);
            const currentEMA = calculateEMA(klinesUpToCurrent, emaPeriod);
            
            const klinesUpToPrevious = klines.slice(0, idx);
            const previousEMA = calculateEMA(klinesUpToPrevious, emaPeriod);

            if (currentEMA === null || previousEMA === null) continue;

            const emaChange = Math.abs((currentEMA - previousEMA) / previousEMA);
            emaChanges += emaChange;
        }

        const avgEMAChange = emaChanges / 10;
        // Market is ranging if average EMA change is < 0.5% (more permissive)
        return avgEMAChange < 0.005;
    }

    private calculateGridSpacing(price: number, atr: number): number {
        // Dynamic spacing based on ATR
        const dynamicSpacing = atr * this.gridConfig.gridSpacingATR;
        
        // Ensure spacing is within min/max bounds
        const minSpacing = price * this.gridConfig.minGridSpacing;
        const maxSpacing = price * this.gridConfig.maxGridSpacing;
        
        return Math.max(minSpacing, Math.min(maxSpacing, dynamicSpacing));
    }

    private createGridLevels(
        center: number,
        spacing: number
    ): Array<{ level: number; price: number; type: 'BUY' | 'SELL' }> {
        const levels: Array<{ level: number; price: number; type: 'BUY' | 'SELL' }> = [];
        const halfLevels = Math.floor(this.gridConfig.gridLevels / 2);

        // Create buy levels below center
        for (let i = 1; i <= halfLevels; i++) {
            levels.push({
                level: -i,
                price: center - (spacing * i),
                type: 'BUY',
            });
        }

        // Center level
        levels.push({
            level: 0,
            price: center,
            type: 'BUY', // Neutral, can be either
        });

        // Create sell levels above center
        for (let i = 1; i <= halfLevels; i++) {
            levels.push({
                level: i,
                price: center + (spacing * i),
                type: 'SELL',
            });
        }

        return levels.sort((a, b) => a.price - b.price);
    }

    private findCurrentGridLevel(
        currentPrice: number,
        gridLevels: Array<{ level: number; price: number; type: 'BUY' | 'SELL' }>
    ): number {
        // Find which grid level we're closest to
        let closestLevel = 0;
        let minDistance = Infinity;

        for (const grid of gridLevels) {
            const distance = Math.abs(currentPrice - grid.price);
            if (distance < minDistance) {
                minDistance = distance;
                closestLevel = grid.level;
            }
        }

        return closestLevel;
    }

    private createGridSetup(
        klines: Kline[],
        currentIndex: number,
        fairValue: number,
        gridLevels: Array<{ level: number; price: number; type: 'BUY' | 'SELL' }>,
        currentLevel: number
    ): SetupDetectorResult {
        const current = klines[currentIndex];
        
        // If below fair value, BUY setup
        // If above fair value, SELL setup
        const direction = current.close < fairValue ? 'LONG' : 'SHORT';

        // Find next grid levels
        const nextLevelUp = gridLevels.find(g => g.price > current.close);
        const nextLevelDown = gridLevels.findLast(g => g.price < current.close);

        if (!nextLevelUp || !nextLevelDown) {
            return { setup: null, confidence: 0 };
        }

        const entryPrice = current.close;
        const stopLoss = direction === 'LONG' 
            ? nextLevelDown.price - (nextLevelUp.price - nextLevelDown.price) * 0.5
            : nextLevelUp.price + (nextLevelUp.price - nextLevelDown.price) * 0.5;
        const takeProfit = direction === 'LONG' 
            ? nextLevelUp.price 
            : nextLevelDown.price;

        const confidence = this.calculateConfidence(
            klines,
            currentIndex,
            current.close,
            fairValue,
            gridLevels
        );

        return {
            setup: {
                type: 'GRID_TRADING',
                direction,
                entryPrice,
                stopLoss,
                takeProfit,
                confidence,
                metadata: {
                    fairValue,
                    currentLevel,
                    gridLevels: gridLevels.map(g => ({
                        level: g.level,
                        price: g.price,
                        type: g.type,
                    })),
                    gridSpacing: gridLevels[1].price - gridLevels[0].price,
                    totalLevels: this.gridConfig.gridLevels,
                },
            },
            confidence,
        };
    }

    private calculateConfidence(
        klines: Kline[],
        currentIndex: number,
        currentPrice: number,
        fairValue: number,
        gridLevels: Array<{ level: number; price: number; type: 'BUY' | 'SELL' }>
    ): number {
        let confidence = 0.65; // Base confidence for grid trading

        // Higher confidence if market is ranging
        const isRanging = this.isMarketRanging(klines, currentIndex);
        if (isRanging) confidence += 0.15;

        // Higher confidence if price is near fair value
        const distanceFromFair = Math.abs((currentPrice - fairValue) / fairValue);
        if (distanceFromFair < 0.01) confidence += 0.10;
        else if (distanceFromFair < 0.02) confidence += 0.05;

        // Higher confidence with higher volume
        const avgVolume = this.calculateAverageVolume(klines, currentIndex, 20);
        const current = klines[currentIndex];
        const volumeRatio = current.volume / avgVolume;
        if (volumeRatio > 1.5) confidence += 0.05;
        else if (volumeRatio > 1.2) confidence += 0.03;

        return Math.min(confidence, 0.95);
    }

    protected calculateAverageVolume(
        klines: Kline[],
        currentIndex: number,
        period: number
    ): number {
        const start = Math.max(0, currentIndex - period + 1);
        const slice = klines.slice(start, currentIndex + 1);
        const sum = slice.reduce((acc, k) => acc + k.volume, 0);
        return sum / slice.length;
    }
}

export const createGridTradingDetector = (
    config?: Partial<GridTradingConfig>
): GridTradingDetector => {
    const defaultConfig: GridTradingConfig = {
        enabled: true,
        emaPeriod: 20,
        atrPeriod: 14,
        gridLevels: 7, // 3 buy, 1 center, 3 sell
        gridSpacingATR: 1.0, // 1x ATR spacing
        minGridSpacing: 0.005, // 0.5% minimum
        maxGridSpacing: 0.02, // 2.0% maximum
        requireRanging: true,
        volumeThreshold: 0.8, // Accept lower volume for grid
    };

    return new GridTradingDetector({ ...defaultConfig, ...config });
};
