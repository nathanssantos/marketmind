import { describe, expect, it, beforeEach } from 'vitest';
import {
  ClassificationEvaluator,
  calculateAccuracy,
  calculatePrecision,
  calculateRecall,
  calculateF1Score,
  type ConfusionMatrix,
} from '../evaluation';

describe('ML Evaluation Metrics', () => {
  describe('ConfusionMatrix Utility Functions', () => {
    const perfectMatrix: ConfusionMatrix = {
      truePositive: 50,
      trueNegative: 50,
      falsePositive: 0,
      falseNegative: 0,
    };

    const imbalancedMatrix: ConfusionMatrix = {
      truePositive: 40,
      trueNegative: 30,
      falsePositive: 20,
      falseNegative: 10,
    };

    const emptyMatrix: ConfusionMatrix = {
      truePositive: 0,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
    };

    describe('calculateAccuracy', () => {
      it('should return 1 for perfect predictions', () => {
        expect(calculateAccuracy(perfectMatrix)).toBe(1);
      });

      it('should calculate accuracy correctly', () => {
        expect(calculateAccuracy(imbalancedMatrix)).toBe(0.7);
      });

      it('should return 0 for empty matrix', () => {
        expect(calculateAccuracy(emptyMatrix)).toBe(0);
      });

      it('should handle all wrong predictions', () => {
        const allWrong: ConfusionMatrix = {
          truePositive: 0,
          trueNegative: 0,
          falsePositive: 50,
          falseNegative: 50,
        };
        expect(calculateAccuracy(allWrong)).toBe(0);
      });
    });

    describe('calculatePrecision', () => {
      it('should return 1 for perfect precision', () => {
        expect(calculatePrecision(perfectMatrix)).toBe(1);
      });

      it('should calculate precision correctly', () => {
        expect(calculatePrecision(imbalancedMatrix)).toBeCloseTo(0.667, 2);
      });

      it('should return 0 when no positive predictions', () => {
        const noPositivePreds: ConfusionMatrix = {
          truePositive: 0,
          trueNegative: 80,
          falsePositive: 0,
          falseNegative: 20,
        };
        expect(calculatePrecision(noPositivePreds)).toBe(0);
      });
    });

    describe('calculateRecall', () => {
      it('should return 1 for perfect recall', () => {
        expect(calculateRecall(perfectMatrix)).toBe(1);
      });

      it('should calculate recall correctly', () => {
        expect(calculateRecall(imbalancedMatrix)).toBe(0.8);
      });

      it('should return 0 when no actual positives', () => {
        const noActualPositives: ConfusionMatrix = {
          truePositive: 0,
          trueNegative: 80,
          falsePositive: 20,
          falseNegative: 0,
        };
        expect(calculateRecall(noActualPositives)).toBe(0);
      });
    });

    describe('calculateF1Score', () => {
      it('should return 1 for perfect predictions', () => {
        expect(calculateF1Score(perfectMatrix)).toBe(1);
      });

      it('should calculate F1 correctly', () => {
        const precision = 40 / (40 + 20);
        const recall = 40 / (40 + 10);
        const expectedF1 = (2 * precision * recall) / (precision + recall);
        expect(calculateF1Score(imbalancedMatrix)).toBeCloseTo(expectedF1, 4);
      });

      it('should return 0 for empty matrix', () => {
        expect(calculateF1Score(emptyMatrix)).toBe(0);
      });

      it('should return 0 when precision and recall are 0', () => {
        const zeroPrecisionRecall: ConfusionMatrix = {
          truePositive: 0,
          trueNegative: 100,
          falsePositive: 0,
          falseNegative: 0,
        };
        expect(calculateF1Score(zeroPrecisionRecall)).toBe(0);
      });
    });
  });

  describe('ClassificationEvaluator', () => {
    let evaluator: ClassificationEvaluator;

    beforeEach(() => {
      evaluator = new ClassificationEvaluator();
    });

    describe('evaluate', () => {
      it('should evaluate perfect predictions', () => {
        const predictions = [1, 1, 0, 0, 1, 0];
        const labels = [1, 1, 0, 0, 1, 0];
        const result = evaluator.evaluate(predictions, labels);

        expect(result.accuracy).toBe(1);
        expect(result.precision).toBe(1);
        expect(result.recall).toBe(1);
        expect(result.f1Score).toBe(1);
      });

      it('should evaluate with some errors', () => {
        const predictions = [1, 1, 1, 0, 0, 0];
        const labels = [1, 0, 1, 0, 1, 0];
        const result = evaluator.evaluate(predictions, labels);

        expect(result.accuracy).toBeCloseTo(0.667, 2);
        expect(result.confusionMatrix.truePositives).toBe(2);
        expect(result.confusionMatrix.trueNegatives).toBe(2);
        expect(result.confusionMatrix.falsePositives).toBe(1);
        expect(result.confusionMatrix.falseNegatives).toBe(1);
      });

      it('should calculate MCC correctly', () => {
        const predictions = [1, 1, 0, 0];
        const labels = [1, 0, 0, 1];
        const result = evaluator.evaluate(predictions, labels);

        expect(result.mcc).toBe(0);
      });

      it('should handle empty arrays', () => {
        const result = evaluator.evaluate([], []);
        expect(result.accuracy).toBe(0);
        expect(result.precision).toBe(0);
        expect(result.recall).toBe(0);
      });
    });

    describe('calculateAUC', () => {
      it('should return perfect AUC for perfectly separated classes', () => {
        const probabilities = [0.9, 0.8, 0.3, 0.2];
        const labels = [1, 1, 0, 0];
        const auc = evaluator.calculateAUC(probabilities, labels);

        expect(auc).toBe(1);
      });

      it('should handle tied probabilities', () => {
        const probabilities = [0.5, 0.5, 0.5, 0.5];
        const labels = [1, 0, 1, 0];
        const auc = evaluator.calculateAUC(probabilities, labels);

        expect(auc).toBeGreaterThanOrEqual(0);
        expect(auc).toBeLessThanOrEqual(1);
      });

      it('should return 0 when no positives or negatives', () => {
        const probabilities = [0.5, 0.5];
        const allPositives = [1, 1];
        const allNegatives = [0, 0];

        expect(evaluator.calculateAUC(probabilities, allPositives)).toBe(0);
        expect(evaluator.calculateAUC(probabilities, allNegatives)).toBe(0);
      });
    });

    describe('generateROCCurve', () => {
      it('should generate ROC curve points', () => {
        const probabilities = [0.9, 0.8, 0.3, 0.2];
        const labels = [1, 1, 0, 0];
        const rocCurve = evaluator.generateROCCurve(probabilities, labels);

        expect(rocCurve.length).toBeGreaterThan(0);
        expect(rocCurve[0]).toEqual({ fpr: 0, tpr: 0, threshold: 1 });
        expect(rocCurve[rocCurve.length - 1]?.fpr).toBe(1);
        expect(rocCurve[rocCurve.length - 1]?.tpr).toBe(1);
      });

      it('should return empty array when no positives or negatives', () => {
        const probabilities = [0.5, 0.5];
        const allPositives = [1, 1];

        expect(evaluator.generateROCCurve(probabilities, allPositives)).toEqual([]);
      });
    });

    describe('findOptimalThreshold', () => {
      it('should find optimal threshold for F1', () => {
        const probabilities = [0.9, 0.7, 0.4, 0.2];
        const labels = [1, 1, 0, 0];
        const result = evaluator.findOptimalThreshold(probabilities, labels, 'f1');

        expect(result.threshold).toBeGreaterThan(0);
        expect(result.threshold).toBeLessThan(1);
        expect(result.score).toBeGreaterThan(0);
      });

      it('should find optimal threshold for accuracy', () => {
        const probabilities = [0.9, 0.7, 0.4, 0.2];
        const labels = [1, 1, 0, 0];
        const result = evaluator.findOptimalThreshold(probabilities, labels, 'accuracy');

        expect(result.score).toBeGreaterThan(0);
      });

      it('should find optimal threshold using Youden index', () => {
        const probabilities = [0.9, 0.7, 0.4, 0.2];
        const labels = [1, 1, 0, 0];
        const result = evaluator.findOptimalThreshold(probabilities, labels, 'youden');

        expect(result.threshold).toBeDefined();
        expect(result.score).toBeDefined();
      });
    });

    describe('generateReport', () => {
      it('should generate complete classification report', () => {
        const predictions = [1, 1, 0, 0];
        const labels = [1, 0, 0, 1];
        const probabilities = [0.8, 0.7, 0.3, 0.2];

        const report = evaluator.generateReport(predictions, labels, probabilities);

        expect(report.metrics).toBeDefined();
        expect(report.rocCurve).toBeDefined();
        expect(report.calibrationScore).toBeDefined();
        expect(report.classDistribution.positive).toBe(2);
        expect(report.classDistribution.negative).toBe(2);
        expect(report.sampleSize).toBe(4);
      });

      it('should work without probabilities', () => {
        const predictions = [1, 1, 0, 0];
        const labels = [1, 0, 0, 1];

        const report = evaluator.generateReport(predictions, labels);

        expect(report.metrics).toBeDefined();
        expect(report.rocCurve).toBeUndefined();
        expect(report.calibrationScore).toBeUndefined();
      });
    });
  });
});
