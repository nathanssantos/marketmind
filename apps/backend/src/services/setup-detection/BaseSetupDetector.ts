import type {
  Kline,
  SetupDirection,
  TradingSetup,
  TriggerCandleSnapshot,
  TriggerIndicatorValues,
} from '@marketmind/types';

export interface SetupDetectorConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
}

export interface SetupDetectorResult {
  setup: TradingSetup | null;
  confidence: number;
  triggerKlineIndex?: number;
  triggerCandleData?: TriggerCandleSnapshot[];
  triggerIndicatorValues?: TriggerIndicatorValues;
}

export abstract class BaseSetupDetector {
  protected config: SetupDetectorConfig;

  constructor(config: SetupDetectorConfig) {
    this.config = config;
  }

  abstract detect(
    klines: Kline[],
    currentIndex: number,
  ): SetupDetectorResult;

  protected createSetup(
    type: TradingSetup['type'],
    direction: SetupDirection,
    klines: Kline[],
    currentIndex: number,
    entryPrice: number,
    stopLoss: number | null,
    takeProfit: number | null,
    confidence: number,
    volumeConfirmation: boolean,
    indicatorConfluence: number,
    setupData: Record<string, unknown>,
  ): TradingSetup {
    const current = klines[currentIndex];
    if (!current) {
      throw new Error('Invalid current kline index');
    }

    const riskRewardRatio = this.calculateRR(entryPrice, stopLoss, takeProfit);

    return {
      id: `${type}-${currentIndex}-${Date.now()}`,
      type,
      direction,
      openTime: current.openTime,
      entryPrice,
      stopLoss: stopLoss ?? undefined,
      takeProfit: takeProfit ?? undefined,
      riskRewardRatio,
      confidence,
      volumeConfirmation,
      indicatorConfluence,
      klineIndex: currentIndex,
      setupData,
      visible: true,
      source: 'algorithm',
    };
  }

  protected calculateRR(
    entry: number,
    stopLoss: number | null,
    takeProfit: number | null,
  ): number {
    if (stopLoss === null || takeProfit === null) return 0;

    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);

    if (risk === 0) return 0;

    return reward / risk;
  }

  protected meetsMinimumRequirements(
    confidence: number,
    riskReward: number,
  ): boolean {
    return (
      confidence >= this.config.minConfidence &&
      riskReward >= this.config.minRiskReward
    );
  }

  updateConfig(config: SetupDetectorConfig): void {
    this.config = config;
  }

  getConfig(): SetupDetectorConfig {
    return this.config;
  }
}
