import type { TradingSetup, BacktestTrade } from '@marketmind/types';
import type { PredictionResult } from '../types';
import type { EnhancedSetup } from '../inference/RealtimePredictor';
import { ClassificationEvaluator, type ClassificationMetrics, type ClassificationReport } from './ClassificationMetrics';
import { TradingMetricsEvaluator, type TradingMetrics } from './TradingMetrics';

export interface BacktestEvaluationConfig {
  minProbability: number;
  blendWeight: number;
  compareWithBaseline: boolean;
  evaluateBySetupType: boolean;
  generateROC: boolean;
}

export const DEFAULT_EVALUATION_CONFIG: BacktestEvaluationConfig = {
  minProbability: 0.5,
  blendWeight: 0.4,
  compareWithBaseline: true,
  evaluateBySetupType: false,
  generateROC: true,
};

export interface BacktestEvaluationInput {
  trades: BacktestTrade[];
  setups?: TradingSetup[];
}

export interface BacktestEvaluationResult {
  summary: {
    totalSetups: number;
    totalTrades: number;
    mlFilteredSetups: number;
    mlFilteredTrades: number;
    filteringRate: number;
  };
  classification: ClassificationReport;
  trading: TradingMetrics;
  bySetupType?: Map<string, { classification: ClassificationMetrics; trading: TradingMetrics }>;
  optimalThreshold: {
    threshold: number;
    improvement: number;
    metric: string;
  };
  recommendations: string[];
}

export interface SetupWithPrediction extends TradingSetup {
  mlPrediction?: PredictionResult;
  mlConfidence?: number;
  blendedConfidence?: number;
}

export class BacktestMLEvaluator {
  private classificationEvaluator: ClassificationEvaluator;
  private tradingEvaluator: TradingMetricsEvaluator;

  constructor() {
    this.classificationEvaluator = new ClassificationEvaluator();
    this.tradingEvaluator = new TradingMetricsEvaluator();
  }

  evaluateBacktest(
    input: BacktestEvaluationInput,
    predictions: Map<string, PredictionResult>,
    config: Partial<BacktestEvaluationConfig> = {}
  ): BacktestEvaluationResult {
    const evalConfig = { ...DEFAULT_EVALUATION_CONFIG, ...config };

    const setups = input.setups ?? [];
    const trades = input.trades ?? [];

    const { predictions: predArray, labels, probabilities } = this.alignPredictionsWithTrades(trades, predictions);

    const classificationReport = this.classificationEvaluator.generateReport(predArray, labels, probabilities);

    const tradingMetrics = this.tradingEvaluator.evaluate(trades, predictions, {
      minProbability: evalConfig.minProbability,
      minConfidence: 50,
    });

    const optimalThreshold = this.tradingEvaluator.findOptimalThreshold(trades, predictions, 'sharpe');

    const mlFilteredSetups = setups.filter((setup) => {
      const pred = predictions.get(setup.id);
      return pred && pred.probability >= evalConfig.minProbability;
    });

    const mlFilteredTrades = trades.filter((trade) => {
      const pred = predictions.get(trade.setupId ?? '');
      return pred && pred.probability >= evalConfig.minProbability;
    });

    const recommendations = this.generateRecommendations(classificationReport.metrics, tradingMetrics, optimalThreshold);

    const result: BacktestEvaluationResult = {
      summary: {
        totalSetups: setups.length,
        totalTrades: trades.length,
        mlFilteredSetups: mlFilteredSetups.length,
        mlFilteredTrades: mlFilteredTrades.length,
        filteringRate: setups.length > 0 ? ((setups.length - mlFilteredSetups.length) / setups.length) * 100 : 0,
      },
      classification: classificationReport,
      trading: tradingMetrics,
      optimalThreshold: {
        ...optimalThreshold,
        metric: 'sharpe',
      },
      recommendations,
    };

    if (evalConfig.evaluateBySetupType) {
      result.bySetupType = this.evaluateBySetupType(trades, predictions, evalConfig.minProbability);
    }

    return result;
  }

  simulateMLEnhancedBacktest(
    setups: TradingSetup[],
    predictions: Map<string, PredictionResult>,
    config: Partial<BacktestEvaluationConfig> = {}
  ): {
    enhancedSetups: EnhancedSetup[];
    acceptedSetups: TradingSetup[];
    rejectedSetups: TradingSetup[];
  } {
    const evalConfig = { ...DEFAULT_EVALUATION_CONFIG, ...config };

    const enhancedSetups: EnhancedSetup[] = [];
    const acceptedSetups: TradingSetup[] = [];
    const rejectedSetups: TradingSetup[] = [];

    for (const setup of setups) {
      const prediction = predictions.get(setup.id);

      if (prediction) {
        const mlConfidence = prediction.confidence;
        const blendedConfidence = Math.round(
          setup.confidence * (1 - evalConfig.blendWeight) + mlConfidence * evalConfig.blendWeight
        );

        const enhanced: EnhancedSetup = {
          ...setup,
          originalConfidence: setup.confidence,
          mlConfidence,
          blendedConfidence,
          confidence: blendedConfidence,
          mlPrediction: prediction,
        };

        enhancedSetups.push(enhanced);

        if (prediction.probability >= evalConfig.minProbability) {
          acceptedSetups.push({ ...setup, confidence: blendedConfidence });
        } else {
          rejectedSetups.push(setup);
        }
      } else {
        enhancedSetups.push({
          ...setup,
          originalConfidence: setup.confidence,
          blendedConfidence: setup.confidence,
        });
        acceptedSetups.push(setup);
      }
    }

    return {
      enhancedSetups,
      acceptedSetups,
      rejectedSetups,
    };
  }

  compareThresholds(
    trades: BacktestTrade[],
    predictions: Map<string, PredictionResult>,
    thresholds: number[] = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
  ): Array<{
    threshold: number;
    tradesAccepted: number;
    winRate: number;
    profitFactor: number;
    sharpe: number;
  }> {
    const results: Array<{
      threshold: number;
      tradesAccepted: number;
      winRate: number;
      profitFactor: number;
      sharpe: number;
    }> = [];

    for (const threshold of thresholds) {
      const metrics = this.tradingEvaluator.evaluate(trades, predictions, {
        minProbability: threshold,
        minConfidence: 0,
      });

      results.push({
        threshold,
        tradesAccepted: metrics.tradesAccepted,
        winRate: metrics.mlEnhancedWinRate,
        profitFactor: metrics.mlEnhancedProfitFactor,
        sharpe: metrics.mlEnhancedSharpe,
      });
    }

    return results;
  }

  private alignPredictionsWithTrades(
    trades: BacktestTrade[],
    predictions: Map<string, PredictionResult>
  ): {
    predictions: number[];
    labels: number[];
    probabilities: number[];
  } {
    const predArray: number[] = [];
    const labels: number[] = [];
    const probabilities: number[] = [];

    for (const trade of trades) {
      const prediction = predictions.get(trade.setupId ?? '');
      if (!prediction) continue;

      predArray.push(prediction.label);
      labels.push((trade.pnlPercent ?? 0) > 0 ? 1 : 0);
      probabilities.push(prediction.probability);
    }

    return { predictions: predArray, labels, probabilities };
  }

  private evaluateBySetupType(
    trades: BacktestTrade[],
    predictions: Map<string, PredictionResult>,
    minProbability: number
  ): Map<string, { classification: ClassificationMetrics; trading: TradingMetrics }> {
    const tradesByType = new Map<string, BacktestTrade[]>();

    for (const trade of trades) {
      const setupType = trade.setupType ?? 'unknown';
      const existing = tradesByType.get(setupType) ?? [];
      existing.push(trade);
      tradesByType.set(setupType, existing);
    }

    const resultsByType = new Map<string, { classification: ClassificationMetrics; trading: TradingMetrics }>();

    for (const [setupType, typeTrades] of tradesByType) {
      const { predictions: predArray, labels, probabilities } = this.alignPredictionsWithTrades(typeTrades, predictions);

      if (predArray.length < 5) continue;

      const classification = this.classificationEvaluator.evaluate(predArray, labels, probabilities);
      const trading = this.tradingEvaluator.evaluate(typeTrades, predictions, {
        minProbability,
        minConfidence: 0,
      });

      resultsByType.set(setupType, { classification, trading });
    }

    return resultsByType;
  }

  private generateRecommendations(
    classification: ClassificationMetrics,
    trading: TradingMetrics,
    optimalThreshold: { threshold: number; improvement: number }
  ): string[] {
    const recommendations: string[] = [];

    if (classification.accuracy < 0.55) {
      recommendations.push('Model accuracy is below 55%. Consider retraining with more data or different features.');
    }

    if (classification.auc < 0.6) {
      recommendations.push('Model AUC is low. The model may not be distinguishing well between winning and losing trades.');
    }

    if (trading.filteringRate > 60) {
      recommendations.push('ML is filtering more than 60% of trades. Consider lowering the probability threshold.');
    } else if (trading.filteringRate < 10) {
      recommendations.push('ML is filtering less than 10% of trades. Consider raising the probability threshold for better selectivity.');
    }

    if (trading.sharpeImprovement < 0) {
      recommendations.push('ML filtering is reducing Sharpe ratio. Consider using the baseline strategy without ML filtering.');
    } else if (trading.sharpeImprovement > 50) {
      recommendations.push('Strong Sharpe improvement detected. ML filtering is highly effective for this strategy.');
    }

    if (optimalThreshold.threshold !== 0.5 && optimalThreshold.improvement > 10) {
      recommendations.push(
        `Consider using threshold ${(optimalThreshold.threshold * 100).toFixed(0)}% instead of 50% for ${optimalThreshold.improvement.toFixed(1)}% improvement.`
      );
    }

    if (trading.falseNegativeRate > 0.3) {
      recommendations.push('High false negative rate. ML may be rejecting good trades. Consider lowering the threshold.');
    }

    if (trading.falsePositiveRate > 0.5) {
      recommendations.push('High false positive rate. ML is accepting too many losing trades.');
    }

    if (recommendations.length === 0) {
      recommendations.push('ML enhancement is performing well. No specific adjustments recommended.');
    }

    return recommendations;
  }
}
