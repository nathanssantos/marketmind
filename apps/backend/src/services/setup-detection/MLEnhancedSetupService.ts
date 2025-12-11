import type { Kline, TradingSetup } from '@marketmind/types';
import type { MarketContext, EnhancedSetup } from '@marketmind/ml';
import { SetupDetectionService, SetupDetectionConfig } from './SetupDetectionService';
import { mlService } from '../ml';

export interface MLEnhancedSetupConfig extends SetupDetectionConfig {
  enableMLEnhancement?: boolean;
  mlBlendWeight?: number;
  mlMinProbability?: number;
  mlAutoInitialize?: boolean;
}

const DEFAULT_ML_CONFIG: Required<Pick<MLEnhancedSetupConfig, 'enableMLEnhancement' | 'mlBlendWeight' | 'mlMinProbability' | 'mlAutoInitialize'>> = {
  enableMLEnhancement: false,
  mlBlendWeight: 0.4,
  mlMinProbability: 0.5,
  mlAutoInitialize: false,
};

export class MLEnhancedSetupService {
  private setupDetectionService: SetupDetectionService;
  private config: MLEnhancedSetupConfig;
  private mlInitialized = false;

  constructor(config?: Partial<MLEnhancedSetupConfig>) {
    this.config = {
      ...DEFAULT_ML_CONFIG,
      ...config,
    };

    this.setupDetectionService = new SetupDetectionService(config);
  }

  async initialize(): Promise<void> {
    if (this.config.enableMLEnhancement && this.config.mlAutoInitialize) {
      await this.initializeML();
    }
  }

  async initializeML(): Promise<void> {
    if (this.mlInitialized) return;

    try {
      await mlService.initialize('setup-classifier');
      this.mlInitialized = true;
    } catch (error) {
      console.error('Failed to initialize ML service:', error);
      this.mlInitialized = false;
    }
  }

  detectSetups(klines: Kline[]): TradingSetup[] {
    return this.setupDetectionService.detectSetups(klines);
  }

  async detectAndEnhanceSetups(
    klines: Kline[],
    marketContext?: MarketContext
  ): Promise<EnhancedSetup[]> {
    const setups = this.setupDetectionService.detectSetups(klines);

    if (!this.config.enableMLEnhancement || setups.length === 0) {
      return setups.map((setup) => ({
        ...setup,
        originalConfidence: setup.confidence,
        mlConfidence: undefined,
        blendedConfidence: setup.confidence,
      }));
    }

    if (!this.mlInitialized) {
      await this.initializeML();
    }

    if (!mlService.isReady()) {
      return setups.map((setup) => ({
        ...setup,
        originalConfidence: setup.confidence,
        mlConfidence: undefined,
        blendedConfidence: setup.confidence,
      }));
    }

    try {
      const marketContexts = marketContext
        ? new Map(setups.map((setup) => [setup.openTime, marketContext]))
        : undefined;

      const enhanced = await mlService.enhanceSetups(
        klines,
        setups,
        marketContexts,
        this.config.mlBlendWeight
      );

      return enhanced;
    } catch (error) {
      console.error('ML enhancement failed, returning original setups:', error);
      return setups.map((setup) => ({
        ...setup,
        originalConfidence: setup.confidence,
        mlConfidence: undefined,
        blendedConfidence: setup.confidence,
      }));
    }
  }

  async detectAndFilterSetups(
    klines: Kline[],
    _marketContext?: MarketContext
  ): Promise<TradingSetup[]> {
    const setups = this.setupDetectionService.detectSetups(klines);

    if (!this.config.enableMLEnhancement || setups.length === 0) {
      return setups;
    }

    if (!this.mlInitialized) {
      await this.initializeML();
    }

    if (!mlService.isReady()) {
      return setups;
    }

    try {
      const filtered = await mlService.filterByMLConfidence(
        klines,
        setups,
        this.config.mlMinProbability ?? 0.5
      );

      return filtered;
    } catch (error) {
      console.error('ML filtering failed, returning original setups:', error);
      return setups;
    }
  }

  async detectAndRankSetups(
    klines: Kline[]
  ): Promise<Array<{ setup: TradingSetup; rank: number; probability?: number }>> {
    const setups = this.setupDetectionService.detectSetups(klines);

    if (!this.config.enableMLEnhancement || setups.length === 0) {
      return setups.map((setup, index) => ({
        setup,
        rank: index + 1,
        probability: undefined,
      }));
    }

    if (!this.mlInitialized) {
      await this.initializeML();
    }

    if (!mlService.isReady()) {
      return setups.map((setup, index) => ({
        setup,
        rank: index + 1,
        probability: undefined,
      }));
    }

    try {
      const ranked = await mlService.rankSetups(klines, setups);

      return ranked.map((r, index) => ({
        setup: r.setup,
        rank: index + 1,
        probability: r.prediction.probability,
      }));
    } catch (error) {
      console.error('ML ranking failed, returning original order:', error);
      return setups.map((setup, index) => ({
        setup,
        rank: index + 1,
        probability: undefined,
      }));
    }
  }

  detectSetupsInRange(
    klines: Kline[],
    startIndex: number,
    endIndex: number
  ): TradingSetup[] {
    return this.setupDetectionService.detectSetupsInRange(klines, startIndex, endIndex);
  }

  loadStrategy(definition: Parameters<typeof this.setupDetectionService.loadStrategy>[0], params?: Record<string, number>): void {
    this.setupDetectionService.loadStrategy(definition, params);
  }

  unloadStrategy(strategyId: string): boolean {
    return this.setupDetectionService.unloadStrategy(strategyId);
  }

  getLoadedStrategies(): string[] {
    return this.setupDetectionService.getLoadedStrategies();
  }

  updateConfig(config: Partial<MLEnhancedSetupConfig>): void {
    if (config.enableMLEnhancement !== undefined) {
      this.config.enableMLEnhancement = config.enableMLEnhancement;
    }

    if (config.mlBlendWeight !== undefined) {
      this.config.mlBlendWeight = config.mlBlendWeight;
    }

    if (config.mlMinProbability !== undefined) {
      this.config.mlMinProbability = config.mlMinProbability;
    }

    this.setupDetectionService.updateConfig(config);
  }

  getConfig(): MLEnhancedSetupConfig {
    return {
      ...this.setupDetectionService.getConfig(),
      enableMLEnhancement: this.config.enableMLEnhancement,
      mlBlendWeight: this.config.mlBlendWeight,
      mlMinProbability: this.config.mlMinProbability,
      mlAutoInitialize: this.config.mlAutoInitialize,
    };
  }

  isMLReady(): boolean {
    return this.mlInitialized && mlService.isReady();
  }

  async disposeML(): Promise<void> {
    if (this.mlInitialized) {
      await mlService.dispose();
      this.mlInitialized = false;
    }
  }
}
