import type { TradingSetup } from '@marketmind/types';
import type { TradeOutcome } from '../types';

interface BacktestTrade {
  setupId?: string;
  pnlPercent?: number;
  exitReason?: string;
  holdingBars?: number;
}

export class LabelGenerator {
  private minProfitThreshold: number;
  private holdingBarsWeight: number;

  constructor(config?: { minProfitThreshold?: number; holdingBarsWeight?: number }) {
    this.minProfitThreshold = config?.minProfitThreshold ?? 0;
    this.holdingBarsWeight = config?.holdingBarsWeight ?? 0;
  }

  generateLabels(
    setups: TradingSetup[],
    trades: BacktestTrade[]
  ): Map<string, TradeOutcome> {
    const outcomes = new Map<string, TradeOutcome>();
    const tradeBySetupId = new Map<string, BacktestTrade>();

    for (const trade of trades) {
      if (trade.setupId) {
        tradeBySetupId.set(trade.setupId, trade);
      }
    }

    for (const setup of setups) {
      const trade = tradeBySetupId.get(setup.id);

      if (!trade) {
        continue;
      }

      const pnlPercent = trade.pnlPercent ?? 0;
      const isWinner = pnlPercent > this.minProfitThreshold;

      const outcome: TradeOutcome = {
        setupId: setup.id,
        isWinner,
        pnlPercent,
        holdingBars: trade.holdingBars ?? 0,
        exitReason: this.parseExitReason(trade.exitReason),
      };

      outcomes.set(setup.id, outcome);
    }

    return outcomes;
  }

  toBinaryLabel(outcome: TradeOutcome): number {
    return outcome.isWinner ? 1 : 0;
  }

  toWeightedLabel(outcome: TradeOutcome): number {
    const baseLabel = this.toBinaryLabel(outcome);

    if (this.holdingBarsWeight === 0) return baseLabel;

    const holdingPenalty = Math.min(1, outcome.holdingBars / 100) * this.holdingBarsWeight;
    return baseLabel * (1 - holdingPenalty);
  }

  generateLabelsFromKlines(
    setup: TradingSetup,
    subsequentCloses: number[],
    maxBars: number = 20
  ): TradeOutcome {
    const entryPrice = setup.entryPrice;
    const stopLoss = setup.stopLoss;
    const takeProfit = setup.takeProfit;
    const isLong = setup.direction === 'LONG';

    let exitReason: TradeOutcome['exitReason'] = 'time_exit';
    let exitPrice = subsequentCloses[Math.min(maxBars - 1, subsequentCloses.length - 1)] ?? entryPrice;
    let holdingBars = Math.min(maxBars, subsequentCloses.length);

    for (let i = 0; i < Math.min(maxBars, subsequentCloses.length); i++) {
      const close = subsequentCloses[i];
      if (close === undefined) continue;

      if (stopLoss !== undefined) {
        const hitStopLoss = isLong ? close <= stopLoss : close >= stopLoss;
        if (hitStopLoss) {
          exitReason = 'stop_loss';
          exitPrice = stopLoss;
          holdingBars = i + 1;
          break;
        }
      }

      if (takeProfit !== undefined) {
        const hitTakeProfit = isLong ? close >= takeProfit : close <= takeProfit;
        if (hitTakeProfit) {
          exitReason = 'take_profit';
          exitPrice = takeProfit;
          holdingBars = i + 1;
          break;
        }
      }
    }

    const pnlPercent = isLong
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;

    const isWinner = pnlPercent > this.minProfitThreshold;

    return {
      setupId: setup.id,
      isWinner,
      pnlPercent,
      holdingBars,
      exitReason,
    };
  }

  calculateClassWeights(labels: number[]): { class0Weight: number; class1Weight: number } {
    const positives = labels.filter((l) => l === 1).length;
    const negatives = labels.length - positives;

    if (positives === 0 || negatives === 0) {
      return { class0Weight: 1, class1Weight: 1 };
    }

    const total = labels.length;
    const class0Weight = total / (2 * negatives);
    const class1Weight = total / (2 * positives);

    return { class0Weight, class1Weight };
  }

  private parseExitReason(reason?: string): TradeOutcome['exitReason'] {
    if (!reason) return 'time_exit';

    const lowerReason = reason.toLowerCase();
    if (lowerReason.includes('stop') || lowerReason.includes('sl')) return 'stop_loss';
    if (lowerReason.includes('take') || lowerReason.includes('tp') || lowerReason.includes('profit'))
      return 'take_profit';
    if (lowerReason.includes('signal')) return 'signal_exit';
    return 'time_exit';
  }
}
