import type { Kline, TradingSetup } from '@marketmind/types';
import { logger } from '../logger';
import { PineStrategyRunner } from '../pine/PineStrategyRunner';
import { PineStrategyLoader } from '../pine/PineStrategyLoader';
import type { PineStrategy, PineRunOptions } from '../pine/types';

export interface SetupDetectionConfig {
  setupCooldownPeriod?: number;
  pineDirectories?: string[];
  minConfidence?: number;
  minRiskReward?: number;
  maxFibonacciEntryProgressPercentLong?: number;
  maxFibonacciEntryProgressPercentShort?: number;
  fibonacciSwingRange?: 'extended' | 'nearest';
  initialStopMode?: 'fibo_target' | 'nearest_swing';
  silent?: boolean;
}

const DEBUG_ENABLED = process.env['DEBUG_SETUPS'] === 'true';
const PRICE_DECIMAL_PLACES = 2;
const DEFAULT_SETUP_COOLDOWN = 10;
const MIN_KLINES_FOR_DETECTION = 50;
const DEFAULT_MIN_CONFIDENCE = 50;
const DEFAULT_MIN_RISK_REWARD = 1.0;
const MAX_DETECTION_INDEX_ENTRIES = 500;

export class SetupDetectionService {
  private config: SetupDetectionConfig;
  private lastDetectionIndex: Map<string, number> = new Map();
  private pineStrategies: Map<string, PineStrategy> = new Map();
  private pineRunner: PineStrategyRunner = new PineStrategyRunner();

  private debugLog(...args: unknown[]): void {
    if (!DEBUG_ENABLED) return;
    logger.trace({ args }, '[SetupDetection]');
  }

  constructor(config?: Partial<SetupDetectionConfig>) {
    this.config = {
      setupCooldownPeriod: config?.setupCooldownPeriod ?? DEFAULT_SETUP_COOLDOWN,
      pineDirectories: config?.pineDirectories,
      minConfidence: config?.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
      minRiskReward: config?.minRiskReward ?? DEFAULT_MIN_RISK_REWARD,
      maxFibonacciEntryProgressPercentLong: config?.maxFibonacciEntryProgressPercentLong,
      maxFibonacciEntryProgressPercentShort: config?.maxFibonacciEntryProgressPercentShort,
      fibonacciSwingRange: config?.fibonacciSwingRange,
      initialStopMode: config?.initialStopMode,
      silent: config?.silent,
    };
  }

  async loadStrategiesFromDirectory(directory: string): Promise<void> {
    const loader = new PineStrategyLoader([directory]);
    const strategies = await loader.loadAllCached();
    for (const strategy of strategies) {
      this.loadPineStrategy(strategy);
    }
    this.debugLog(`Loaded ${strategies.length} Pine strategies from ${directory}`);
  }

  loadPineStrategy(pineStrategy: PineStrategy): void {
    this.pineStrategies.set(pineStrategy.metadata.id, pineStrategy);
    this.debugLog(`Loaded Pine strategy: ${pineStrategy.metadata.id} (${pineStrategy.metadata.name})`);
  }

  unloadStrategy(strategyId: string): boolean {
    const removed = this.pineStrategies.delete(strategyId);
    if (removed) {
      this.debugLog(`Unloaded strategy: ${strategyId}`);
    }
    return removed;
  }

  getLoadedStrategies(): string[] {
    return [...this.pineStrategies.keys()];
  }

  getStrategy(id: string): PineStrategy | undefined {
    return this.pineStrategies.get(id);
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

  async detectSetups(klines: Kline[]): Promise<TradingSetup[]> {
    if (klines.length === 0) return [];
    if (klines.length < MIN_KLINES_FOR_DETECTION) return [];

    const currentIndex = klines.length - 1;
    const { setups } = await this.detectPineSetups(klines, currentIndex, currentIndex);

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
    const { setups } = await this.detectPineSetups(klines, startIndex, endIndex);
    setups.sort((a, b) => b.confidence - a.confidence);
    return setups;
  }

  async detectSetupsWithExitSignals(
    klines: Kline[],
    startIndex: number,
    endIndex: number,
  ): Promise<{ setups: TradingSetup[]; exitSignalsMap: Map<string, (number | null)[]> }> {
    const { setups, exitSignalsMap } = await this.detectPineSetups(klines, startIndex, endIndex);
    setups.sort((a, b) => b.confidence - a.confidence);
    return { setups, exitSignalsMap };
  }

  private async detectPineSetups(
    klines: Kline[],
    startIndex: number,
    endIndex: number,
  ): Promise<{ setups: TradingSetup[]; exitSignalsMap: Map<string, (number | null)[]> }> {
    const setups: TradingSetup[] = [];
    const exitSignalsMap = new Map<string, (number | null)[]>();

    if (this.pineStrategies.size === 0) return { setups, exitSignalsMap };

    const pineOptions: PineRunOptions = {
      minConfidence: this.config.minConfidence ?? DEFAULT_MIN_CONFIDENCE,
      minRiskReward: this.config.minRiskReward ?? DEFAULT_MIN_RISK_REWARD,
    };

    for (const [strategyId, pineStrategy] of this.pineStrategies) {
      const results = await this.pineRunner.detectSignals(pineStrategy, klines, pineOptions);

      if (results.length > 0 && results[0]?.exitSignals) {
        exitSignalsMap.set(strategyId, results[0].exitSignals);
      }

      for (const result of results) {
        if (!result.setup) continue;
        const idx = result.triggerKlineIndex ?? -1;
        if (idx < startIndex || idx > endIndex) continue;
        if (!this.canDetectSetup(strategyId, idx)) continue;
        setups.push(result.setup);
        this.markSetupDetected(strategyId, idx);
      }
    }

    return { setups, exitSignalsMap };
  }

  updateConfig(config: Partial<SetupDetectionConfig>): void {
    if (config.setupCooldownPeriod !== undefined) this.config.setupCooldownPeriod = config.setupCooldownPeriod;
    if (config.minConfidence !== undefined) this.config.minConfidence = config.minConfidence;
    if (config.minRiskReward !== undefined) this.config.minRiskReward = config.minRiskReward;
  }

  getConfig(): SetupDetectionConfig {
    return { ...this.config };
  }
}

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => ({
  setupCooldownPeriod: DEFAULT_SETUP_COOLDOWN,
  minConfidence: DEFAULT_MIN_CONFIDENCE,
  minRiskReward: DEFAULT_MIN_RISK_REWARD,
});
