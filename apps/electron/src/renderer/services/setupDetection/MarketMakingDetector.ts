import { calculateATR, calculateEMA } from '@marketmind/indicators';
import type { Kline } from '@shared/types';
import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from './BaseSetupDetector';

export interface MarketMakingConfig extends SetupDetectorConfig {
    atrPeriod: number;
    emaPeriod: number;
    spreadMultiplier: number;
    minSpreadPercent: number;
    maxSpreadPercent: number;
    gridLevels: number;
    volumeThreshold: number;
    timeInForce: number;
}

/**
 * Market Making Detector
 * 
 * Strategy: Place simultaneous buy and sell orders to capture bid-ask spread
 * Entry: BUY at (mid - spread/2), SELL at (mid + spread/2)
 * Exit: When filled on both sides or time limit reached
 * 
 * Expected Performance:
 * - Win Rate: 70-80% (both sides filled)
 * - R:R: 0.5:1 to 1:1 (high frequency, low risk)
 * - Best in sideways, high-volume markets
 * - Requires tight spread and sufficient liquidity
 */
export class MarketMakingDetector extends BaseSetupDetector {
    private mmConfig: MarketMakingConfig;

    constructor(config: MarketMakingConfig) {
        super(config);
        this.mmConfig = config;
    }

    detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
        if (currentIndex < Math.max(this.mmConfig.atrPeriod, this.mmConfig.emaPeriod)) {
            return { setup: null, confidence: 0 };
        }

        const current = klines[currentIndex];
        if (!current) {
            return { setup: null, confidence: 0 };
        }

        // Calculate mid price (EMA as fair value)
        const klinesUpToCurrent = klines.slice(0, currentIndex + 1);
        const midPrice = calculateEMA(klinesUpToCurrent, this.mmConfig.emaPeriod);
        if (midPrice === null) {
            return { setup: null, confidence: 0 };
        }

        // Calculate ATR for dynamic spread
        const atr = calculateATR(klinesUpToCurrent, this.mmConfig.atrPeriod);
        if (atr === null) {
            return { setup: null, confidence: 0 };
        }

        // Calculate spread
        const spread = this.calculateSpread(current.close, atr);
        if (!this.isSpreadValid(spread, current.close)) {
            return { setup: null, confidence: 0 };
        }

        // Check volume (need liquidity for market making)
        const avgVolume = this.calculateAverageVolume(klines, currentIndex, 20);
        if (current.volume < avgVolume * this.mmConfig.volumeThreshold) {
            return { setup: null, confidence: 0 };
        }

        // Check if market is ranging (not trending)
        if (!this.isMarketRanging(klines, currentIndex)) {
            return { setup: null, confidence: 0 };
        }

        // Create market making setup (LONG side)
        return this.createMarketMakingSetup(klines, currentIndex, midPrice, spread);
    }

    private calculateSpread(price: number, atr: number): number {
        // Spread = ATR * multiplier
        const dynamicSpread = atr * this.mmConfig.spreadMultiplier;
        
        // Ensure spread is within min/max bounds
        const minSpread = price * this.mmConfig.minSpreadPercent;
        const maxSpread = price * this.mmConfig.maxSpreadPercent;
        
        return Math.max(minSpread, Math.min(maxSpread, dynamicSpread));
    }

    private isSpreadValid(spread: number, price: number): boolean {
        const spreadPercent = (spread / price) * 100;
        return spreadPercent >= this.mmConfig.minSpreadPercent * 100 && 
               spreadPercent <= this.mmConfig.maxSpreadPercent * 100;
    }

    private isMarketRanging(klines: Kline[], currentIndex: number): boolean {
        // Check if EMA is flat (not trending)
        const emaPeriod = this.mmConfig.emaPeriod;
        if (currentIndex < emaPeriod + 5) return false;

        const klinesUpToCurrent = klines.slice(0, currentIndex + 1);
        const currentEMA = calculateEMA(klinesUpToCurrent, emaPeriod);
        
        const klinesUpToPrevious = klines.slice(0, currentIndex);
        const previousEMA = calculateEMA(klinesUpToPrevious, emaPeriod);

        if (currentEMA === null || previousEMA === null) return false;

        // EMA should be relatively flat (< 1% change - more permissive)
        const emaChange = Math.abs((currentEMA - previousEMA) / previousEMA);
        return emaChange < 0.01;
    }

    private createMarketMakingSetup(
        klines: Kline[],
        currentIndex: number,
        midPrice: number,
        spread: number
    ): SetupDetectorResult {
        const current = klines[currentIndex];
        const halfSpread = spread / 2;

        // Entry prices
        const buyPrice = midPrice - halfSpread;
        const sellPrice = midPrice + halfSpread;

        // For backtesting, we create a LONG setup (buy side)
        // In real trading, this would place both BUY and SELL orders
        const entryPrice = buyPrice;
        const stopLoss = buyPrice - spread; // Stop if market moves against us
        const takeProfit = sellPrice; // Target is the sell side

        const confidence = this.calculateConfidence(
            klines,
            currentIndex,
            spread,
            current.close
        );

        return {
            setup: {
                type: 'MARKET_MAKING',
                direction: 'LONG',
                entryPrice,
                stopLoss,
                takeProfit,
                confidence,
                metadata: {
                    midPrice,
                    spread,
                    spreadPercent: (spread / midPrice) * 100,
                    buyPrice,
                    sellPrice,
                    timeInForce: this.mmConfig.timeInForce,
                },
            },
            confidence,
        };
    }

    private calculateConfidence(
        klines: Kline[],
        currentIndex: number,
        spread: number,
        currentPrice: number
    ): number {
        let confidence = 0.60; // Base confidence

        // Higher confidence with tighter spread
        const spreadPercent = (spread / currentPrice) * 100;
        if (spreadPercent < 0.3) confidence += 0.15;
        else if (spreadPercent < 0.5) confidence += 0.10;
        else if (spreadPercent < 0.8) confidence += 0.05;

        // Higher confidence with higher volume
        const avgVolume = this.calculateAverageVolume(klines, currentIndex, 20);
        const current = klines[currentIndex];
        const volumeRatio = current.volume / avgVolume;
        if (volumeRatio > 1.5) confidence += 0.10;
        else if (volumeRatio > 1.2) confidence += 0.05;

        // Higher confidence if market is truly ranging
        const isRanging = this.isMarketRanging(klines, currentIndex);
        if (isRanging) confidence += 0.10;

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

export const createMarketMakingDetector = (
    config?: Partial<MarketMakingConfig>
): MarketMakingDetector => {
    const defaultConfig: MarketMakingConfig = {
        enabled: true,
        atrPeriod: 14,
        emaPeriod: 20,
        spreadMultiplier: 1.0, // 1x ATR as spread
        minSpreadPercent: 0.002, // 0.2% minimum
        maxSpreadPercent: 0.01, // 1.0% maximum
        gridLevels: 3, // Number of grid levels (future enhancement)
        volumeThreshold: 1.0, // 1x average volume
        timeInForce: 5, // Max klines to hold position
    };

    return new MarketMakingDetector({ ...defaultConfig, ...config });
};
