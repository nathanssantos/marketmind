export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  auc: number;
  confusionMatrix: {
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
  };
  specificity: number;
  sensitivity: number;
  mcc: number;
}

export interface ROCPoint {
  fpr: number;
  tpr: number;
  threshold: number;
}

export interface ClassificationReport {
  metrics: ClassificationMetrics;
  rocCurve?: ROCPoint[];
  calibrationScore?: number;
  classDistribution: {
    positive: number;
    negative: number;
  };
  sampleSize: number;
}

export class ClassificationEvaluator {
  evaluate(predictions: number[], labels: number[], probabilities?: number[]): ClassificationMetrics {
    const tp = this.countMatches(predictions, labels, 1, 1);
    const tn = this.countMatches(predictions, labels, 0, 0);
    const fp = this.countMatches(predictions, labels, 1, 0);
    const fn = this.countMatches(predictions, labels, 0, 1);

    const total = tp + tn + fp + fn;
    const accuracy = total > 0 ? (tp + tn) / total : 0;
    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;
    const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const mcc = this.calculateMCC(tp, tn, fp, fn);
    const auc = probabilities ? this.calculateAUC(probabilities, labels) : 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      auc,
      confusionMatrix: {
        truePositives: tp,
        trueNegatives: tn,
        falsePositives: fp,
        falseNegatives: fn,
      },
      specificity,
      sensitivity: recall,
      mcc,
    };
  }

  generateReport(
    predictions: number[],
    labels: number[],
    probabilities?: number[]
  ): ClassificationReport {
    const metrics = this.evaluate(predictions, labels, probabilities);
    const rocCurve = probabilities ? this.generateROCCurve(probabilities, labels) : undefined;
    const calibrationScore = probabilities ? this.calculateCalibration(probabilities, labels) : undefined;

    return {
      metrics,
      rocCurve,
      calibrationScore,
      classDistribution: {
        positive: labels.filter((l) => l === 1).length,
        negative: labels.filter((l) => l === 0).length,
      },
      sampleSize: labels.length,
    };
  }

  private countMatches(
    predictions: number[],
    labels: number[],
    predValue: number,
    labelValue: number
  ): number {
    let count = 0;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i] === predValue && labels[i] === labelValue) {
        count++;
      }
    }
    return count;
  }

  private calculateMCC(tp: number, tn: number, fp: number, fn: number): number {
    const numerator = tp * tn - fp * fn;
    const denominator = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
    return denominator > 0 ? numerator / denominator : 0;
  }

  calculateAUC(probabilities: number[], labels: number[]): number {
    const pairs = probabilities.map((p, i) => ({ prob: p, label: labels[i] }));
    pairs.sort((a, b) => b.prob - a.prob);

    let auc = 0;
    let tpCount = 0;
    const totalPositives = labels.filter((l) => l === 1).length;
    const totalNegatives = labels.filter((l) => l === 0).length;

    if (totalPositives === 0 || totalNegatives === 0) return 0;

    for (const pair of pairs) {
      if (pair.label === 1) {
        tpCount++;
      } else {
        auc += tpCount;
      }
    }

    return auc / (totalPositives * totalNegatives);
  }

  generateROCCurve(probabilities: number[], labels: number[]): ROCPoint[] {
    const pairs = probabilities.map((p, i) => ({ prob: p, label: labels[i] }));
    pairs.sort((a, b) => b.prob - a.prob);

    const totalPositives = labels.filter((l) => l === 1).length;
    const totalNegatives = labels.filter((l) => l === 0).length;

    if (totalPositives === 0 || totalNegatives === 0) return [];

    const rocPoints: ROCPoint[] = [{ fpr: 0, tpr: 0, threshold: 1 }];
    let tp = 0;
    let fp = 0;

    const thresholds = [...new Set(pairs.map((p) => p.prob))].sort((a, b) => b - a);

    for (const threshold of thresholds) {
      for (const pair of pairs) {
        if (pair.prob >= threshold && pair.prob < (rocPoints.length > 1 ? rocPoints[rocPoints.length - 1]!.threshold : Infinity)) {
          if (pair.label === 1) tp++;
          else fp++;
        }
      }

      const tpr = tp / totalPositives;
      const fpr = fp / totalNegatives;

      if (rocPoints.length === 0 || rocPoints[rocPoints.length - 1]!.tpr !== tpr || rocPoints[rocPoints.length - 1]!.fpr !== fpr) {
        rocPoints.push({ fpr, tpr, threshold });
      }
    }

    rocPoints.push({ fpr: 1, tpr: 1, threshold: 0 });
    return rocPoints;
  }

  private calculateCalibration(probabilities: number[], labels: number[]): number {
    const bins = 10;
    const binCounts: number[] = new Array(bins).fill(0);
    const binCorrect: number[] = new Array(bins).fill(0);
    const binProbSum: number[] = new Array(bins).fill(0);

    for (let i = 0; i < probabilities.length; i++) {
      const prob = probabilities[i]!;
      const label = labels[i]!;
      const binIdx = Math.min(Math.floor(prob * bins), bins - 1);

      binCounts[binIdx] = (binCounts[binIdx] ?? 0) + 1;
      binCorrect[binIdx] = (binCorrect[binIdx] ?? 0) + label;
      binProbSum[binIdx] = (binProbSum[binIdx] ?? 0) + prob;
    }

    let calibrationError = 0;
    let totalSamples = 0;

    for (let i = 0; i < bins; i++) {
      if (binCounts[i]! > 0) {
        const avgProb = binProbSum[i]! / binCounts[i]!;
        const actualProb = binCorrect[i]! / binCounts[i]!;
        calibrationError += binCounts[i]! * Math.abs(avgProb - actualProb);
        totalSamples += binCounts[i]!;
      }
    }

    return totalSamples > 0 ? 1 - calibrationError / totalSamples : 0;
  }

  findOptimalThreshold(
    probabilities: number[],
    labels: number[],
    metric: 'f1' | 'accuracy' | 'youden' = 'f1'
  ): { threshold: number; score: number } {
    const thresholds = [...new Set(probabilities)].sort((a, b) => a - b);
    let bestThreshold = 0.5;
    let bestScore = -Infinity;

    for (const threshold of thresholds) {
      const predictions = probabilities.map((p) => (p >= threshold ? 1 : 0));
      const metrics = this.evaluate(predictions, labels);

      let score: number;
      switch (metric) {
        case 'f1':
          score = metrics.f1Score;
          break;
        case 'accuracy':
          score = metrics.accuracy;
          break;
        case 'youden':
          score = metrics.sensitivity + metrics.specificity - 1;
          break;
      }

      if (score > bestScore) {
        bestScore = score;
        bestThreshold = threshold;
      }
    }

    return { threshold: bestThreshold, score: bestScore };
  }
}
