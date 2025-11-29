import type { Candle, TradingSetup, SetupDirection } from '@shared/types';

export interface SetupDetectorConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
}

export interface SetupDetectorResult {
  setup: TradingSetup | null;
  confidence: number;
}

export abstract class BaseSetupDetector {
  protected config: SetupDetectorConfig;

  constructor(config: SetupDetectorConfig) {
    this.config = config;
  }

  abstract detect(
    candles: Candle[],
    currentIndex: number,
  ): SetupDetectorResult;

  protected createSetup(
    type: TradingSetup['type'],
    direction: SetupDirection,
    candles: Candle[],
    currentIndex: number,
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    confidence: number,
    volumeConfirmation: boolean,
    indicatorConfluence: number,
    setupData: Record<string, unknown>,
  ): TradingSetup {
    const current = candles[currentIndex];
    if (!current) {
      throw new Error('Invalid current candle index');
    }

    const riskRewardRatio = this.calculateRR(entryPrice, stopLoss, takeProfit);

    return {
      id: `${type}-${currentIndex}-${Date.now()}`,
      type,
      direction,
      timestamp: current.timestamp,
      entryPrice,
      stopLoss,
      takeProfit,
      riskRewardRatio,
      confidence,
      volumeConfirmation,
      indicatorConfluence,
      candleIndex: currentIndex,
      setupData,
      visible: true,
      source: 'algorithm',
    };
  }

  protected calculateRR(
    entry: number,
    stop: number,
    target: number,
  ): number {
    const risk = Math.abs(entry - stop);
    if (risk === 0) return 0;
    const reward = Math.abs(target - entry);
    return reward / risk;
  }

  protected meetsMinimumCriteria(
    confidence: number,
    riskReward: number,
  ): boolean {
    return (
      confidence >= this.config.minConfidence &&
      riskReward >= this.config.minRiskReward
    );
  }
}
