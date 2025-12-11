/**
 * Evaluation Module
 *
 * Future implementations:
 * - Model performance metrics
 * - Backtesting integration
 * - A/B testing framework
 * - Model comparison
 */

export interface EvaluationResult {
  modelName: string;
  modelVersion: string;
  testPeriod: { start: Date; end: Date };
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    auc: number;
  };
  backtestResults?: {
    totalTrades: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export interface ConfusionMatrix {
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
}

export const calculateAccuracy = (cm: ConfusionMatrix): number => {
  const total = cm.truePositive + cm.trueNegative + cm.falsePositive + cm.falseNegative;
  return total === 0 ? 0 : (cm.truePositive + cm.trueNegative) / total;
};

export const calculatePrecision = (cm: ConfusionMatrix): number => {
  const denominator = cm.truePositive + cm.falsePositive;
  return denominator === 0 ? 0 : cm.truePositive / denominator;
};

export const calculateRecall = (cm: ConfusionMatrix): number => {
  const denominator = cm.truePositive + cm.falseNegative;
  return denominator === 0 ? 0 : cm.truePositive / denominator;
};

export const calculateF1Score = (cm: ConfusionMatrix): number => {
  const precision = calculatePrecision(cm);
  const recall = calculateRecall(cm);
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
};
