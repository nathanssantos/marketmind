import { calculateATR } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { logger } from './logger';
import { strategyPerformanceService } from './strategy-performance';

export interface ConfidenceFactors {
  baseConfidence: number;
  strategyPerformance: number;
  volatilityAdjustment: number;
  volumeConfirmation: number;
  consecutiveLosses: number;
  final: number;
}

export interface ConfidenceParams {
  baseConfidence: number;
  strategyId: string;
  symbol: string;
  interval: string;
  klines: Kline[];
  currentVolume: number;
  avgVolume: number;
}

export class ConfidenceCalculator {
  async calculate(params: ConfidenceParams): Promise<ConfidenceFactors> {
    const {
      baseConfidence,
      strategyId,
      symbol,
      interval,
      klines,
      currentVolume,
      avgVolume,
    } = params;

    const performance = await strategyPerformanceService.getPerformance(
      strategyId,
      symbol,
      interval
    );

    const perfFactor = this.calculatePerformanceFactor(performance);
    const volatilityFactor = this.calculateVolatilityFactor(klines);
    const volumeFactor = this.calculateVolumeFactor(currentVolume, avgVolume);
    const lossesPenalty = this.calculateConsecutiveLossesPenalty(performance);

    const adjustedConfidence = baseConfidence * perfFactor * volatilityFactor * volumeFactor * lossesPenalty;
    const finalConfidence = Math.max(0, Math.min(100, adjustedConfidence));

    const factors: ConfidenceFactors = {
      baseConfidence,
      strategyPerformance: perfFactor,
      volatilityAdjustment: volatilityFactor,
      volumeConfirmation: volumeFactor,
      consecutiveLosses: lossesPenalty,
      final: finalConfidence,
    };

    if (lossesPenalty < 0.9) {
      logger.warn({
        symbol,
        strategyId,
        consecutiveLosses: performance?.currentConsecutiveLosses,
        penalty: lossesPenalty,
        adjustedConfidence: finalConfidence.toFixed(1),
      }, '[Confidence] Consecutive losses penalty applied');
    }

    if (perfFactor < 0.8 && performance && performance.totalTrades >= 20) {
      logger.warn({
        symbol,
        strategyId,
        winRate: performance.winRate,
        avgRr: performance.avgRr,
        perfFactor,
        adjustedConfidence: finalConfidence.toFixed(1),
      }, '[Confidence] Poor strategy performance penalty applied');
    }

    logger.debug({
      symbol,
      strategyId,
      interval,
      factors: {
        base: baseConfidence.toFixed(1),
        perf: perfFactor.toFixed(2),
        vol: volatilityFactor.toFixed(2),
        volume: volumeFactor.toFixed(2),
        losses: lossesPenalty.toFixed(2),
      },
      final: finalConfidence.toFixed(1),
    }, '[Confidence] Calculation complete');

    return factors;
  }

  private calculatePerformanceFactor(
    performance: Awaited<ReturnType<typeof strategyPerformanceService.getPerformance>>
  ): number {
    if (!performance || performance.totalTrades < 20) {
      return 1.0;
    }

    const winRate = parseFloat(performance.winRate);
    const avgRr = parseFloat(performance.avgRr);

    if (winRate >= 60 && avgRr >= 2.0) return 1.2;
    if (winRate >= 55 && avgRr >= 1.5) return 1.1;
    if (winRate >= 50 && avgRr >= 1.0) return 1.0;
    if (winRate >= 45) return 0.9;
    if (winRate >= 40) return 0.8;
    
    return 0.7;
  }

  private calculateVolatilityFactor(klines: Kline[]): number {
    if (klines.length < 14) return 1.0;

    try {
      const atrValues = calculateATR(klines, 14);
      if (atrValues.length === 0) return 1.0;

      const atr = atrValues[atrValues.length - 1];
      if (!atr) return 1.0;

      const currentPrice = parseFloat(klines[klines.length - 1]?.close ?? '0');
      if (currentPrice === 0) return 1.0;

      const atrPercent = (atr / currentPrice) * 100;

      if (atrPercent < 1.0) return 1.1;
      if (atrPercent < 2.0) return 1.05;
      if (atrPercent < 3.0) return 1.0;
      if (atrPercent < 4.0) return 0.95;
      if (atrPercent < 5.0) return 0.9;
      
      return 0.85;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to calculate volatility factor');
      return 1.0;
    }
  }

  private calculateVolumeFactor(currentVolume: number, avgVolume: number): number {
    if (avgVolume === 0) return 1.0;

    const volumeRatio = currentVolume / avgVolume;

    if (volumeRatio >= 2.0) return 1.15;
    if (volumeRatio >= 1.5) return 1.1;
    if (volumeRatio >= 1.0) return 1.0;
    if (volumeRatio >= 0.8) return 0.95;
    if (volumeRatio >= 0.5) return 0.9;
    
    return 0.85;
  }

  private calculateConsecutiveLossesPenalty(
    performance: Awaited<ReturnType<typeof strategyPerformanceService.getPerformance>>
  ): number {
    if (!performance) return 1.0;

    const currentLosses = performance.currentConsecutiveLosses;

    if (currentLosses === 0) return 1.0;
    if (currentLosses === 1) return 0.95;
    if (currentLosses === 2) return 0.9;
    if (currentLosses === 3) return 0.85;
    if (currentLosses >= 4) return 0.75;
    
    return 1.0;
  }

  enhanceBaseConfidence(
    baseFactors: Record<string, number>,
    weights?: Record<string, number>
  ): number {
    const defaultWeights = {
      pattern: 0.3,
      volume: 0.2,
      indicators: 0.25,
      trend: 0.15,
      momentum: 0.1,
    };

    const finalWeights = { ...defaultWeights, ...weights };

    let totalConfidence = 0;
    let totalWeight = 0;

    for (const [key, value] of Object.entries(baseFactors)) {
      const weight = finalWeights[key as keyof typeof finalWeights] ?? 0.1;
      totalConfidence += value * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? (totalConfidence / totalWeight) * 100 : 0;
  }
}

export const confidenceCalculator = new ConfidenceCalculator();
