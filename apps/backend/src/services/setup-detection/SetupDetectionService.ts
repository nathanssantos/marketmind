import type { Kline, StrategyDefinition, TradingSetup } from '@marketmind/types';
import { logger } from '../logger';
import { StrategyInterpreter, StrategyLoader } from './dynamic';

export interface SetupDetectionConfig {
  enableTrendFilter?: boolean;
  allowCounterTrend?: boolean;
  trendEmaPeriod?: number;
  setupCooldownPeriod?: number;
  strategyDirectory?: string;
  dynamicStrategies?: StrategyDefinition[];
  minConfidence?: number;
  minRiskReward?: number;
  maxFibonacciEntryProgressPercentLong?: number;
  maxFibonacciEntryProgressPercentShort?: number;
  fibonacciSwingRange?: 'extended' | 'nearest';
  silent?: boolean;
}

const DEBUG_ENABLED = process.env['DEBUG_SETUPS'] === 'true';
const PRICE_DECIMAL_PLACES = 2;
const DEFAULT_TREND_EMA_PERIOD = 200;
const DEFAULT_SETUP_COOLDOWN = 10;
const MIN_KLINES_FOR_DETECTION = 50;
const DEFAULT_MIN_CONFIDENCE = 50;
const DEFAULT_MIN_RISK_REWARD = 1.0;
const MAX_DETECTION_INDEX_ENTRIES = 500;

export class SetupDetectionService {
  private config: SetupDetectionConfig;
  private lastDetectionIndex: Map<string, number> = new Map();
  private dynamicInterpreters: Map<string, StrategyInterpreter> = new Map();
  private strategyLoader: StrategyLoader | null = null;

  private debugLog(...args: unknown[]): void {
    if (!DEBUG_ENABLED) return;
    logger.trace({ args }, '[SetupDetection]');
  }

  constructor(config?: Partial<SetupDetectionConfig>) {
    this.config = {
      enableTrendFilter: config?.enableTrendFilter ?? false,
      allowCounterTrend: config?.allowCounterTrend ?? true,
      trendEmaPeriod: config?.trendEmaPeriod ?? DEFAULT_TREND_EMA_PERIOD,
      setupCooldownPeriod: config?.setupCooldownPeriod ?? DEFAULT_SETUP_COOLDOWN,
      strategyDirectory: config?.strategyDirectory,
      dynamicStrategies: config?.dynamicStrategies,
      minConfidence: config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
      minRiskReward: config?.minRiskReward ?? DEFAULT_MIN_RISK_REWARD,
      maxFibonacciEntryProgressPercentLong: config?.maxFibonacciEntryProgressPercentLong,
      maxFibonacciEntryProgressPercentShort: config?.maxFibonacciEntryProgressPercentShort,
      silent: config?.silent,
    };

    if (this.config.dynamicStrategies) {
      this.loadInlineStrategies(this.config.dynamicStrategies);
    }

    if (this.config.strategyDirectory) {
      this.strategyLoader = new StrategyLoader([this.config.strategyDirectory]);
    }
  }

  async loadStrategiesFromDirectory(directory: string): Promise<void> {
    this.strategyLoader = new StrategyLoader([directory]);
    const strategies = await this.strategyLoader.loadAll();
    for (const strategy of strategies) {
      this.loadStrategy(strategy);
    }
    this.debugLog(`Loaded ${strategies.length} dynamic strategies from ${directory}`);
  }

  loadStrategy(definition: StrategyDefinition, params?: Record<string, number>): void {
    const interpreter = new StrategyInterpreter({
      enabled: true,
      minConfidence: this.config.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
      minRiskReward: this.config.minRiskReward ?? DEFAULT_MIN_RISK_REWARD,
      strategy: definition,
      parameterOverrides: params,
      maxFibonacciEntryProgressPercentLong: this.config.maxFibonacciEntryProgressPercentLong,
      maxFibonacciEntryProgressPercentShort: this.config.maxFibonacciEntryProgressPercentShort,
      fibonacciSwingRange: this.config.fibonacciSwingRange,
      silent: this.config.silent,
    });

    this.dynamicInterpreters.set(definition.id, interpreter);
    this.debugLog(`Loaded dynamic strategy: ${definition.id} (${definition.name})`);
  }

  loadStrategyFromJson(jsonContent: string, params?: Record<string, number>): StrategyDefinition {
    if (!this.strategyLoader) {
      this.strategyLoader = new StrategyLoader([]);
    }
    const definition = this.strategyLoader.loadFromString(jsonContent);
    this.loadStrategy(definition, params);
    return definition;
  }

  unloadStrategy(strategyId: string): boolean {
    const removed = this.dynamicInterpreters.delete(strategyId);
    if (removed) {
      this.debugLog(`Unloaded dynamic strategy: ${strategyId}`);
    }
    return removed;
  }

  getLoadedStrategies(): string[] {
    return Array.from(this.dynamicInterpreters.keys());
  }

  private loadInlineStrategies(strategies: StrategyDefinition[]): void {
    for (const strategy of strategies) {
      this.loadStrategy(strategy);
    }
  }

  private canDetectSetup(setupType: string, currentIndex: number): boolean {
    if (!this.config.setupCooldownPeriod) return true;
    const lastIndex = this.lastDetectionIndex.get(setupType);
    if (lastIndex === undefined) return true;
    return currentIndex - lastIndex >= this.config.setupCooldownPeriod;
  }

  private markSetupDetected(setupType: string, currentIndex: number): void {
    if (this.lastDetectionIndex.size >= MAX_DETECTION_INDEX_ENTRIES) {
      const firstKey = this.lastDetectionIndex.keys().next().value;
      if (firstKey) this.lastDetectionIndex.delete(firstKey);
    }
    this.lastDetectionIndex.set(setupType, currentIndex);
  }

  detectSetups(klines: Kline[]): TradingSetup[] {
    if (klines.length === 0) return [];
    if (klines.length < MIN_KLINES_FOR_DETECTION) return [];

    const setups: TradingSetup[] = [];
    const currentIndex = klines.length - 1;

    for (const [strategyId, interpreter] of this.dynamicInterpreters) {
      this.debugLog(`\n--- Dynamic: ${strategyId} ---`);

      const canDetect = this.canDetectSetup(strategyId, currentIndex);
      if (!canDetect) {
        this.debugLog('Cooldown active');
        continue;
      }

      const result = interpreter.detect(klines, currentIndex);
      this.debugLog('Detection Result:', {
        hasSetup: !!result.setup,
        confidence: result.confidence,
      });

      if (result.setup) {
        setups.push(result.setup);
        this.markSetupDetected(strategyId, currentIndex);
        this.debugLog(`${strategyId} DETECTED`);
      }
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    this.debugLog('\n=== Detection Summary ===');
    this.debugLog('Total Setups Found:', setups.length);
    if (setups.length > 0) {
      setups.forEach((setup) => {
        this.debugLog(
          `  - ${setup.type}: ${setup.direction} @ ${setup.entryPrice.toFixed(PRICE_DECIMAL_PLACES)} (Confidence: ${setup.confidence}%)`,
        );
      });
    }
    this.debugLog('===========================\n');

    return setups;
  }

  async detectSetupsInRange(
    klines: Kline[],
    startIndex: number,
    endIndex: number,
  ): Promise<TradingSetup[]> {
    const setups: TradingSetup[] = [];
    const YIELD_INTERVAL = 500;
    let iterationCount = 0;

    for (let i = startIndex; i <= endIndex; i += 1) {
      for (const interpreter of this.dynamicInterpreters.values()) {
        const result = interpreter.detect(klines, i);
        if (result.setup) setups.push(result.setup);
        iterationCount++;
        if (iterationCount % YIELD_INTERVAL === 0) {
          await new Promise<void>((resolve) => setImmediate(resolve));
        }
      }
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    return setups;
  }

  updateConfig(config: Partial<SetupDetectionConfig>): void {
    if (config.enableTrendFilter !== undefined) {
      this.config.enableTrendFilter = config.enableTrendFilter;
    }

    if (config.allowCounterTrend !== undefined) {
      this.config.allowCounterTrend = config.allowCounterTrend;
    }

    if (config.trendEmaPeriod !== undefined) {
      this.config.trendEmaPeriod = config.trendEmaPeriod;
    }

    if (config.setupCooldownPeriod !== undefined) {
      this.config.setupCooldownPeriod = config.setupCooldownPeriod;
    }

    if (config.minConfidence !== undefined) {
      this.config.minConfidence = config.minConfidence;
    }

    if (config.minRiskReward !== undefined) {
      this.config.minRiskReward = config.minRiskReward;
    }
  }

  getConfig(): SetupDetectionConfig {
    return { ...this.config };
  }
}

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => ({
  enableTrendFilter: false,
  allowCounterTrend: true,
  trendEmaPeriod: DEFAULT_TREND_EMA_PERIOD,
  setupCooldownPeriod: DEFAULT_SETUP_COOLDOWN,
  minConfidence: DEFAULT_MIN_CONFIDENCE,
  minRiskReward: DEFAULT_MIN_RISK_REWARD,
});
