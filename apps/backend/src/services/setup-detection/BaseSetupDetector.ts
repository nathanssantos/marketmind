import type {
  Kline,
  SetupDirection,
  TradingSetup,
  TriggerCandleSnapshot,
  TriggerIndicatorValues,
} from '@marketmind/types';
import { EXIT_CALCULATOR } from '../../constants';

export interface SetupDetectorConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
}

export interface SetupRejection {
  reason: string;
  details?: Record<string, string | number | boolean | null>;
}

export interface SetupDetectorResult {
  setup: TradingSetup | null;
  confidence: number;
  triggerKlineIndex?: number;
  triggerCandleData?: TriggerCandleSnapshot[];
  triggerIndicatorValues?: TriggerIndicatorValues;
  rejection?: SetupRejection;
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

    const adjustedStopLoss = this.enforceMinimumStopDistance(
      entryPrice,
      stopLoss,
      direction
    );
    const riskRewardRatio = this.calculateRR(entryPrice, adjustedStopLoss, takeProfit);

    return {
      id: `${type}-${currentIndex}-${Date.now()}`,
      type,
      direction,
      openTime: current.openTime,
      entryPrice,
      stopLoss: adjustedStopLoss ?? undefined,
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

  protected enforceMinimumStopDistance(
    entryPrice: number,
    stopLoss: number | null,
    direction: SetupDirection
  ): number | null {
    if (stopLoss === null) return null;

    const minStopPercent = EXIT_CALCULATOR.MIN_STOP_DISTANCE_PERCENT / 100;
    const minDistance = entryPrice * minStopPercent;
    const currentDistance = Math.abs(entryPrice - stopLoss);

    if (currentDistance >= minDistance) return stopLoss;

    return direction === 'LONG'
      ? entryPrice - minDistance
      : entryPrice + minDistance;
  }

  updateConfig(config: SetupDetectorConfig): void {
    this.config = config;
  }

  getConfig(): SetupDetectorConfig {
    return this.config;
  }
}
