import type { Kline, TradingSetup } from '@marketmind/types';
import type {
  MLFeatureVector,
  NormalizedFeatureVector,
  MarketContext,
  FeatureNormalizationConfig,
} from '../types';
import { TechnicalFeatures } from './TechnicalFeatures';
import { MarketFeatures } from './MarketFeatures';
import { TemporalFeatures } from './TemporalFeatures';
import { SetupFeatures } from './SetupFeatures';
import { Normalizer } from './Normalizer';

export interface FeatureConfig {
  technical?: unknown;
  market?: unknown;
  temporal?: unknown;
  setup?: unknown;
  normalization?: Partial<FeatureNormalizationConfig>;
}

export class FeatureExtractor {
  private technicalFeatures: TechnicalFeatures;
  private marketFeatures: MarketFeatures;
  private temporalFeatures: TemporalFeatures;
  private setupFeatures: SetupFeatures;
  private normalizer: Normalizer;

  constructor(config?: FeatureConfig) {
    this.technicalFeatures = new TechnicalFeatures(config?.technical);
    this.marketFeatures = new MarketFeatures(config?.market);
    this.temporalFeatures = new TemporalFeatures(config?.temporal);
    this.setupFeatures = new SetupFeatures(config?.setup);
    this.normalizer = new Normalizer(config?.normalization);
  }

  extractForSetup(
    klines: Kline[],
    setup: TradingSetup,
    marketContext?: MarketContext
  ): NormalizedFeatureVector {
    const klineIndex = setup.klineIndex;

    const technical = this.technicalFeatures.extract(klines, klineIndex);
    const market = this.marketFeatures.extract(klines, klineIndex, marketContext);
    const temporal = this.temporalFeatures.extract(klines[klineIndex]!);
    const setupFeats = this.setupFeatures.extract(setup, klines, klineIndex);

    const rawFeatures: MLFeatureVector = {
      technical,
      market,
      temporal,
      setup: setupFeats,
    };

    return this.normalizer.normalize(rawFeatures);
  }

  extractRaw(
    klines: Kline[],
    setup: TradingSetup,
    marketContext?: MarketContext
  ): MLFeatureVector {
    const klineIndex = setup.klineIndex;

    const technical = this.technicalFeatures.extract(klines, klineIndex);
    const market = this.marketFeatures.extract(klines, klineIndex, marketContext);
    const temporal = this.temporalFeatures.extract(klines[klineIndex]!);
    const setupFeats = this.setupFeatures.extract(setup, klines, klineIndex);

    return {
      technical,
      market,
      temporal,
      setup: setupFeats,
    };
  }

  extractBatch(
    klines: Kline[],
    setups: TradingSetup[],
    marketContexts?: Map<number, MarketContext>
  ): NormalizedFeatureVector[] {
    this.technicalFeatures.precompute(klines);

    return setups.map((setup) => {
      const marketContext = marketContexts?.get(setup.openTime);
      return this.extractForSetup(klines, setup, marketContext);
    });
  }

  extractBatchRaw(
    klines: Kline[],
    setups: TradingSetup[],
    marketContexts?: Map<number, MarketContext>
  ): MLFeatureVector[] {
    this.technicalFeatures.precompute(klines);

    return setups.map((setup) => {
      const marketContext = marketContexts?.get(setup.openTime);
      return this.extractRaw(klines, setup, marketContext);
    });
  }

  precompute(klines: Kline[]): void {
    this.technicalFeatures.precompute(klines);
  }

  fit(klines: Kline[], setups: TradingSetup[]): void {
    const rawFeatures = this.extractBatchRaw(klines, setups);
    this.normalizer.fit(rawFeatures);
  }

  getFeatureNames(): string[] {
    return [
      ...this.technicalFeatures.getFeatureNames(),
      ...this.marketFeatures.getFeatureNames(),
      ...this.temporalFeatures.getFeatureNames(),
      ...this.setupFeatures.getFeatureNames(),
    ];
  }

  getFeatureCount(): number {
    return this.getFeatureNames().length;
  }

  getNormalizationConfig(): FeatureNormalizationConfig {
    return this.normalizer.getConfig();
  }

  setNormalizationConfig(config: FeatureNormalizationConfig): void {
    this.normalizer.setConfig(config);
  }

  recordSetupOutcome(setupType: string, isWinner: boolean): void {
    this.setupFeatures.recordSetupOutcome(setupType, isWinner);
  }
}
