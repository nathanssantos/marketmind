import { calculateATR, calculateEMA } from '@marketmind/indicators';
import type { Kline, SetupType } from '@marketmind/types';
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
        const midPriceArray = calculateEMA(klinesUpToCurrent, this.mmConfig.emaPeriod);
        const midPrice = midPriceArray[midPriceArray.length - 1];
        if (midPrice === null) {
            return { setup: null, confidence: 0 };
        }

        // Calculate ATR for dynamic spread
        const atrArray = calculateATR(klinesUpToCurrent, this.mmConfig.atrPeriod);
        const atr = atrArray[atrArray.length - 1];
        if (atr === null || atr === undefined || isNaN(atr)) {
            return { setup: null, confidence: 0 };
        }

        // Calculate spread
        const spread = this.calculateSpread(Number(current.close), atr as number);
        if (!this.isSpreadValid(spread, Number(current.close))) {
            return { setup: null, confidence: 0 };
        }

        // Check volume (need liquidity for market making)
        const avgVolume = this.calculateAverageVolume(klines, currentIndex, 20);
        if (Number(current.volume) < avgVolume * this.mmConfig.volumeThreshold) {
            return { setup: null, confidence: 0 };
        }

        // Check if market is ranging (not trending)
        if (!this.isMarketRanging(klines, currentIndex)) {
            return { setup: null, confidence: 0 };
        }

        // Create market making setup (LONG side)
        return this.createMarketMakingSetup(klines, currentIndex, midPrice as number, spread);
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
        const emaPeriod = this.mmConfig.emaPeriod;
        const lookbackPeriod = 10;
        
        if (currentIndex < emaPeriod + lookbackPeriod) return false;

        const emaChanges: number[] = [];
        
        for (let i = currentIndex - lookbackPeriod; i <= currentIndex; i++) {
            const klinesUpToCurrent = klines.slice(0, i + 1);
            const currentEMAArray = calculateEMA(klinesUpToCurrent, emaPeriod);
            const currentEMA = currentEMAArray[currentEMAArray.length - 1];
            
            const klinesUpToPrevious = klines.slice(0, i);
            const previousEMAArray = calculateEMA(klinesUpToPrevious, emaPeriod);
            const previousEMA = previousEMAArray[previousEMAArray.length - 1];
            
            if (currentEMA === null || previousEMA === null || currentEMA === undefined || previousEMA === undefined) {
                return false;
            }
            
            const change = Math.abs((currentEMA - previousEMA) / previousEMA);
            emaChanges.push(change);
        }
        
        const avgChange = emaChanges.reduce((sum, change) => sum + change, 0) / emaChanges.length;
        
        return avgChange < 0.0015;
    }

    private createMarketMakingSetup(
        klines: Kline[],
        currentIndex: number,
        midPrice: number,
        spread: number
    ): SetupDetectorResult {
        const current = klines[currentIndex]!;
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
            Number(current.close)
        );

        return {
            setup: {
                type: 'MARKET_MAKING' as SetupType,
                direction: 'LONG',
                entryPrice,
                stopLoss,
                takeProfit,
                riskRewardRatio: (takeProfit - entryPrice) / (entryPrice - stopLoss),
                confidence,
                volumeConfirmation: true,
                indicatorConfluence: 0.7,
                klineIndex: currentIndex,
                openTime: klines[currentIndex]!.openTime,
                id: `MARKET_MAKING-LONG-${currentIndex}-${Date.now()}`,
                visible: true,
                source: 'algorithm' as const,
                setupData: {
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
        const current = klines[currentIndex]!;
        const volumeRatio = Number(current.volume) / avgVolume;
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
        const sum = slice.reduce((acc, k) => acc + Number(k.volume), 0);
        return sum / slice.length;
    }
}

export const createDefaultMarketMakingConfig = (
    config?: Partial<MarketMakingConfig>
): MarketMakingConfig => {
    const defaultConfig: MarketMakingConfig = {
        enabled: true,
        minConfidence: 60,
        minRiskReward: 1.2,
        atrPeriod: 14,
        emaPeriod: 20,
        spreadMultiplier: 1.0,
        minSpreadPercent: 0.002,
        maxSpreadPercent: 0.01,
        gridLevels: 3,
        volumeThreshold: 1.0,
        timeInForce: 5,
    };

    return { ...defaultConfig, ...config };
};
