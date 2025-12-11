import type { Kline, TradingSetup, BacktestTrade } from '@marketmind/types';
import type {
  MLFeatureVector as _MLFeatureVector,
  NormalizedFeatureVector as _NormalizedFeatureVector,
  MarketContext,
  TrainingDataset,
  TradeOutcome as _TradeOutcome,
} from '../types';

export type { _MLFeatureVector, _NormalizedFeatureVector, _TradeOutcome };
import { FeatureExtractor } from '../features/FeatureExtractor';
import { LabelGenerator } from '../features/LabelGenerator';

export interface DatasetConfig {
  symbols: string[];
  intervals: string[];
  startDate: string;
  endDate: string;
  setupTypes?: string[];
  minSamplesPerSetup?: number;
  balanceClasses?: boolean;
}

export interface BacktestResult {
  trades: BacktestTrade[];
  setupDetections?: TradingSetup[];
}

export class DatasetBuilder {
  private featureExtractor: FeatureExtractor;
  private labelGenerator: LabelGenerator;

  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.labelGenerator = new LabelGenerator();
  }

  buildFromBacktests(
    backtestResults: Map<string, BacktestResult>,
    klinesMap: Map<string, Kline[]>,
    marketContexts?: Map<string, Map<number, MarketContext>>
  ): TrainingDataset {
    const allFeatures: Float32Array[] = [];
    const allLabels: number[] = [];
    const allTimestamps: number[] = [];
    const allSetupIds: string[] = [];
    const allSetupTypes: string[] = [];
    const allSymbols: string[] = [];

    const symbolDistribution: Record<string, number> = {};
    const setupTypeDistribution: Record<string, number> = {};

    for (const [key, result] of backtestResults) {
      const [symbol] = key.split(':');
      const klines = klinesMap.get(key);

      if (!klines || !symbol) continue;

      const outcomes = this.labelGenerator.generateLabels(
        result.setupDetections ?? [],
        result.trades
      );

      const contexts = marketContexts?.get(key);

      this.featureExtractor.precompute(klines);

      for (const setup of result.setupDetections ?? []) {
        const outcome = outcomes.get(setup.id);
        if (!outcome) continue;

        const marketContext = contexts?.get(setup.openTime);
        const features = this.featureExtractor.extractForSetup(
          klines,
          setup,
          marketContext
        );

        const label = this.labelGenerator.toBinaryLabel(outcome);

        allFeatures.push(features.features);
        allLabels.push(label);
        allTimestamps.push(setup.openTime);
        allSetupIds.push(setup.id);
        allSetupTypes.push(setup.type);
        allSymbols.push(symbol);

        symbolDistribution[symbol] = (symbolDistribution[symbol] ?? 0) + 1;
        setupTypeDistribution[setup.type] = (setupTypeDistribution[setup.type] ?? 0) + 1;
      }
    }

    const positiveCount = allLabels.filter((l) => l === 1).length;
    const negativeCount = allLabels.filter((l) => l === 0).length;

    return {
      features: allFeatures,
      labels: allLabels,
      timestamps: allTimestamps,
      setupIds: allSetupIds,
      setupTypes: allSetupTypes,
      symbols: allSymbols,
      featureNames: this.featureExtractor.getFeatureNames(),
      metadata: {
        totalSamples: allFeatures.length,
        positiveCount,
        negativeCount,
        symbolDistribution,
        setupTypeDistribution,
      },
    };
  }

  buildFromTrades(
    trades: BacktestTrade[],
    setups: TradingSetup[],
    klines: Kline[],
    symbol: string,
    marketContexts?: Map<number, MarketContext>
  ): TrainingDataset {
    const allFeatures: Float32Array[] = [];
    const allLabels: number[] = [];
    const allTimestamps: number[] = [];
    const allSetupIds: string[] = [];
    const allSetupTypes: string[] = [];
    const allSymbols: string[] = [];

    const symbolDistribution: Record<string, number> = {};
    const setupTypeDistribution: Record<string, number> = {};

    const outcomes = this.labelGenerator.generateLabels(setups, trades);

    this.featureExtractor.precompute(klines);

    for (const setup of setups) {
      const outcome = outcomes.get(setup.id);
      if (!outcome) continue;

      const marketContext = marketContexts?.get(setup.openTime);
      const features = this.featureExtractor.extractForSetup(klines, setup, marketContext);

      const label = this.labelGenerator.toBinaryLabel(outcome);

      allFeatures.push(features.features);
      allLabels.push(label);
      allTimestamps.push(setup.openTime);
      allSetupIds.push(setup.id);
      allSetupTypes.push(setup.type);
      allSymbols.push(symbol);

      symbolDistribution[symbol] = (symbolDistribution[symbol] ?? 0) + 1;
      setupTypeDistribution[setup.type] = (setupTypeDistribution[setup.type] ?? 0) + 1;
    }

    const positiveCount = allLabels.filter((l) => l === 1).length;
    const negativeCount = allLabels.filter((l) => l === 0).length;

    return {
      features: allFeatures,
      labels: allLabels,
      timestamps: allTimestamps,
      setupIds: allSetupIds,
      setupTypes: allSetupTypes,
      symbols: allSymbols,
      featureNames: this.featureExtractor.getFeatureNames(),
      metadata: {
        totalSamples: allFeatures.length,
        positiveCount,
        negativeCount,
        symbolDistribution,
        setupTypeDistribution,
      },
    };
  }

  toJSON(dataset: TrainingDataset): object[] {
    return dataset.features.map((features, i) => {
      const row: Record<string, number | string> = {};

      dataset.featureNames.forEach((name, j) => {
        row[name] = features[j] ?? 0;
      });

      row['label'] = dataset.labels[i] ?? 0;
      row['timestamp'] = dataset.timestamps[i] ?? 0;
      row['setup_id'] = dataset.setupIds[i] ?? '';
      row['setup_type'] = dataset.setupTypes[i] ?? '';
      row['symbol'] = dataset.symbols[i] ?? '';

      return row;
    });
  }

  toCSV(dataset: TrainingDataset): string {
    const headers = [
      ...dataset.featureNames,
      'label',
      'timestamp',
      'setup_id',
      'setup_type',
      'symbol',
    ];

    const rows = dataset.features.map((features, i) => {
      const values = [
        ...Array.from(features),
        dataset.labels[i],
        dataset.timestamps[i],
        dataset.setupIds[i],
        dataset.setupTypes[i],
        dataset.symbols[i],
      ];
      return values.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  balanceClasses(dataset: TrainingDataset): TrainingDataset {
    const positiveIndices: number[] = [];
    const negativeIndices: number[] = [];

    dataset.labels.forEach((label, i) => {
      if (label === 1) {
        positiveIndices.push(i);
      } else {
        negativeIndices.push(i);
      }
    });

    const minCount = Math.min(positiveIndices.length, negativeIndices.length);

    const shuffledPositive = this.shuffleArray([...positiveIndices]).slice(0, minCount);
    const shuffledNegative = this.shuffleArray([...negativeIndices]).slice(0, minCount);

    const selectedIndices = [...shuffledPositive, ...shuffledNegative].sort((a, b) => a - b);

    return {
      features: selectedIndices.map((i) => dataset.features[i]!),
      labels: selectedIndices.map((i) => dataset.labels[i]!),
      timestamps: selectedIndices.map((i) => dataset.timestamps[i]!),
      setupIds: selectedIndices.map((i) => dataset.setupIds[i]!),
      setupTypes: selectedIndices.map((i) => dataset.setupTypes[i]!),
      symbols: selectedIndices.map((i) => dataset.symbols[i]!),
      featureNames: dataset.featureNames,
      metadata: {
        totalSamples: selectedIndices.length,
        positiveCount: minCount,
        negativeCount: minCount,
        symbolDistribution: this.recalculateDistribution(
          selectedIndices.map((i) => dataset.symbols[i]!)
        ),
        setupTypeDistribution: this.recalculateDistribution(
          selectedIndices.map((i) => dataset.setupTypes[i]!)
        ),
      },
    };
  }

  splitTimeSeries(
    dataset: TrainingDataset,
    trainRatio: number = 0.8
  ): { train: TrainingDataset; test: TrainingDataset } {
    const sortedIndices = dataset.timestamps
      .map((t, i) => ({ timestamp: t, index: i }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((x) => x.index);

    const splitIndex = Math.floor(sortedIndices.length * trainRatio);
    const trainIndices = sortedIndices.slice(0, splitIndex);
    const testIndices = sortedIndices.slice(splitIndex);

    return {
      train: this.selectByIndices(dataset, trainIndices),
      test: this.selectByIndices(dataset, testIndices),
    };
  }

  private selectByIndices(dataset: TrainingDataset, indices: number[]): TrainingDataset {
    const positiveCount = indices.filter((i) => dataset.labels[i] === 1).length;
    const negativeCount = indices.length - positiveCount;

    return {
      features: indices.map((i) => dataset.features[i]!),
      labels: indices.map((i) => dataset.labels[i]!),
      timestamps: indices.map((i) => dataset.timestamps[i]!),
      setupIds: indices.map((i) => dataset.setupIds[i]!),
      setupTypes: indices.map((i) => dataset.setupTypes[i]!),
      symbols: indices.map((i) => dataset.symbols[i]!),
      featureNames: dataset.featureNames,
      metadata: {
        totalSamples: indices.length,
        positiveCount,
        negativeCount,
        symbolDistribution: this.recalculateDistribution(
          indices.map((i) => dataset.symbols[i]!)
        ),
        setupTypeDistribution: this.recalculateDistribution(
          indices.map((i) => dataset.setupTypes[i]!)
        ),
      },
    };
  }

  private recalculateDistribution(values: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const value of values) {
      distribution[value] = (distribution[value] ?? 0) + 1;
    }
    return distribution;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled;
  }

  getDatasetStats(dataset: TrainingDataset): object {
    return {
      totalSamples: dataset.metadata.totalSamples,
      positiveCount: dataset.metadata.positiveCount,
      negativeCount: dataset.metadata.negativeCount,
      positiveRate: dataset.metadata.positiveCount / dataset.metadata.totalSamples,
      featureCount: dataset.featureNames.length,
      symbolDistribution: dataset.metadata.symbolDistribution,
      setupTypeDistribution: dataset.metadata.setupTypeDistribution,
      timestampRange: {
        start: Math.min(...dataset.timestamps),
        end: Math.max(...dataset.timestamps),
      },
    };
  }
}
