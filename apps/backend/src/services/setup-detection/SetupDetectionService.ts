import { calculateEMA } from '@marketmind/indicators';
import type { Kline, TradingSetup, StrategyDefinition } from '@marketmind/types';
import { getKlineClose } from '../../utils/klineHelpers';
import {
    BearTrapDetector,
    createDefaultBearTrapConfig,
} from './BearTrapDetector';
import {
    MeanReversionDetector,
    createDefaultMeanReversionConfig,
} from './MeanReversionDetector';
import {
    Pattern123Detector,
    createDefault123Config,
} from './Pattern123Detector';
import { StrategyInterpreter, StrategyLoader } from './dynamic';

export interface SetupDetectionConfig {
  pattern123: ReturnType<typeof createDefault123Config>;
  bearTrap: ReturnType<typeof createDefaultBearTrapConfig>;
  meanReversion: ReturnType<typeof createDefaultMeanReversionConfig>;

  enableTrendFilter: boolean;
  allowCounterTrend: boolean;
  trendEmaPeriod: number;
  setupCooldownPeriod: number;

  enableLegacyDetectors?: boolean;  // Default: true
  strategyDirectory?: string;
  dynamicStrategies?: StrategyDefinition[];
}

const DEBUG_ENABLED = process.env['DEBUG_SETUPS'] === 'true';
const PRICE_DECIMAL_PLACES = 2;
const DEFAULT_TREND_EMA_PERIOD = 200;
const DEFAULT_SETUP_COOLDOWN = 10;
const MIN_KLINES_FOR_DETECTION = 50;

export class SetupDetectionService {
  private config: SetupDetectionConfig;
  private pattern123Detector: Pattern123Detector;
  private bearTrapDetector: BearTrapDetector;
  private meanReversionDetector: MeanReversionDetector;
  private lastDetectionIndex: Map<string, number> = new Map();

  private dynamicInterpreters: Map<string, StrategyInterpreter> = new Map();
  private strategyLoader: StrategyLoader | null = null;

  private debugLog(...args: unknown[]): void {
    if (!DEBUG_ENABLED) return;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SetupDetection ${timestamp}]`, ...args);
  }

  constructor(config?: Partial<SetupDetectionConfig>) {
    this.config = {
      pattern123: config?.pattern123 ?? createDefault123Config(),
      bearTrap: config?.bearTrap ?? createDefaultBearTrapConfig(),
      meanReversion:
        config?.meanReversion ?? createDefaultMeanReversionConfig(),
      enableTrendFilter: config?.enableTrendFilter ?? false,
      allowCounterTrend: config?.allowCounterTrend ?? true,
      trendEmaPeriod: config?.trendEmaPeriod ?? DEFAULT_TREND_EMA_PERIOD,
      setupCooldownPeriod:
        config?.setupCooldownPeriod ?? DEFAULT_SETUP_COOLDOWN,
      enableLegacyDetectors: config?.enableLegacyDetectors ?? true,
      strategyDirectory: config?.strategyDirectory,
      dynamicStrategies: config?.dynamicStrategies,
    };

    this.pattern123Detector = new Pattern123Detector(this.config.pattern123);
    this.bearTrapDetector = new BearTrapDetector(this.config.bearTrap);
    this.meanReversionDetector = new MeanReversionDetector(
      this.config.meanReversion,
    );

    if (this.config.dynamicStrategies) {
      this.loadInlineStrategies(this.config.dynamicStrategies);
    }

    if (this.config.strategyDirectory) {
      this.strategyLoader = new StrategyLoader([this.config.strategyDirectory]);
    }
  }

  /**
   * Load strategies from a directory
   */
  async loadStrategiesFromDirectory(directory: string): Promise<void> {
    this.strategyLoader = new StrategyLoader([directory]);
    const strategies = await this.strategyLoader.loadAll();
    for (const strategy of strategies) {
      this.loadStrategy(strategy);
    }
    this.debugLog(`Loaded ${strategies.length} dynamic strategies from ${directory}`);
  }

  /**
   * Load a single strategy definition
   */
  loadStrategy(definition: StrategyDefinition, params?: Record<string, number>): void {
    const interpreter = new StrategyInterpreter({
      enabled: true,
      minConfidence: definition.filters?.minConfidence ?? 50,
      minRiskReward: definition.filters?.minRiskReward ?? 1.0,
      strategy: definition,
      parameterOverrides: params,
    });

    this.dynamicInterpreters.set(definition.id, interpreter);
    this.debugLog(`Loaded dynamic strategy: ${definition.id} (${definition.name})`);
  }

  /**
   * Load a strategy from JSON string (for copy/paste support)
   */
  loadStrategyFromJson(jsonContent: string, params?: Record<string, number>): StrategyDefinition {
    if (!this.strategyLoader) {
      this.strategyLoader = new StrategyLoader([]);
    }
    const definition = this.strategyLoader.loadFromString(jsonContent);
    this.loadStrategy(definition, params);
    return definition;
  }

  /**
   * Unload a dynamic strategy
   */
  unloadStrategy(strategyId: string): boolean {
    const removed = this.dynamicInterpreters.delete(strategyId);
    if (removed) {
      this.debugLog(`Unloaded dynamic strategy: ${strategyId}`);
    }
    return removed;
  }

  /**
   * Get list of loaded strategy IDs
   */
  getLoadedStrategies(): string[] {
    return Array.from(this.dynamicInterpreters.keys());
  }

  /**
   * Load inline strategies from config
   */
  private loadInlineStrategies(strategies: StrategyDefinition[]): void {
    for (const strategy of strategies) {
      this.loadStrategy(strategy);
    }
  }

  private canDetectSetup(setupType: string, currentIndex: number): boolean {
    const lastIndex = this.lastDetectionIndex.get(setupType);
    if (lastIndex === undefined) return true;
    return currentIndex - lastIndex >= this.config.setupCooldownPeriod;
  }

  private markSetupDetected(setupType: string, currentIndex: number): void {
    this.lastDetectionIndex.set(setupType, currentIndex);
  }

  private getTrend(
    klines: Kline[],
    currentIndex: number,
  ): 'bullish' | 'bearish' | 'neutral' {
    if (
      !this.config.enableTrendFilter ||
      currentIndex < this.config.trendEmaPeriod
    ) {
      return 'neutral';
    }

    const ema200 = calculateEMA(klines, this.config.trendEmaPeriod);
    const current = klines[currentIndex];
    const ema200Current = ema200[currentIndex];

    if (
      !current ||
      ema200Current === null ||
      ema200Current === undefined ||
      isNaN(ema200Current)
    ) {
      return 'neutral';
    }

    if (getKlineClose(current) > ema200Current) return 'bullish';
    if (getKlineClose(current) < ema200Current) return 'bearish';
    return 'neutral';
  }

  private isTrendAligned(
    setupDirection: 'LONG' | 'SHORT',
    trend: 'bullish' | 'bearish' | 'neutral',
  ): boolean {
    if (!this.config.enableTrendFilter) return true;
    if (trend === 'neutral') return true;
    if (this.config.allowCounterTrend) return true;

    if (setupDirection === 'LONG' && trend === 'bullish') return true;
    if (setupDirection === 'SHORT' && trend === 'bearish') return true;

    return false;
  }

  detectSetups(klines: Kline[]): TradingSetup[] {
    if (klines.length === 0) return [];
    if (klines.length < MIN_KLINES_FOR_DETECTION) return [];

    const setups: TradingSetup[] = [];
    const currentIndex = klines.length - 1;
    const trend = this.getTrend(klines, currentIndex);

    if (this.config.enableLegacyDetectors !== false) {
      const detectors = [
        {
          name: 'pattern123',
          detector: this.pattern123Detector,
          enabled: this.config.pattern123.enabled,
          label: 'Pattern 1-2-3',
        },
        {
          name: 'bearTrap',
          detector: this.bearTrapDetector,
          enabled: this.config.bearTrap.enabled,
          label: 'Bear Trap',
        },
        {
          name: 'meanReversion',
          detector: this.meanReversionDetector,
          enabled: this.config.meanReversion.enabled,
          label: 'Mean Reversion',
        },
      ];

      for (const { name, detector, enabled, label } of detectors) {
        this.debugLog(`\n--- ${label} ---`);

        if (!enabled) {
          this.debugLog('Disabled in config');
          continue;
        }

        const canDetect = this.canDetectSetup(name, currentIndex);
        this.debugLog('Can Detect (Cooldown):', canDetect);

        if (!canDetect) {
          const lastDetection = this.lastDetectionIndex.get(name);
          this.debugLog(
            `Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`,
          );
          continue;
        }

        const result = detector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', {
          hasSetup: !!result.setup,
          confidence: result.confidence,
        });

        if (!result.setup) {
          this.debugLog('No setup found');
          continue;
        }

        const aligned = this.isTrendAligned(result.setup.direction, trend);
        this.debugLog(
          'Trend Aligned:',
          aligned,
          `(${result.setup.direction} vs ${trend})`,
        );

        if (aligned) {
          setups.push(result.setup);
          this.markSetupDetected(name, currentIndex);
          this.debugLog(`${label} DETECTED`);
        } else {
          this.debugLog('Rejected by Trend Filter');
        }
      }
    }

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

      if (!result.setup) {
        continue;
      }

      const aligned = this.isTrendAligned(result.setup.direction, trend);
      if (aligned) {
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

  detectSetupsInRange(
    klines: Kline[],
    startIndex: number,
    endIndex: number,
  ): TradingSetup[] {
    const setups: TradingSetup[] = [];

    const legacyDetectors = this.config.enableLegacyDetectors !== false
      ? [
          {
            detector: this.pattern123Detector,
            enabled: this.config.pattern123.enabled,
          },
          {
            detector: this.bearTrapDetector,
            enabled: this.config.bearTrap.enabled,
          },
          {
            detector: this.meanReversionDetector,
            enabled: this.config.meanReversion.enabled,
          },
        ]
      : [];

    for (let i = startIndex; i <= endIndex; i += 1) {
      for (const { detector, enabled } of legacyDetectors) {
        if (!enabled) continue;
        const result = detector.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }

      for (const interpreter of this.dynamicInterpreters.values()) {
        const result = interpreter.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    return setups;
  }

  updateConfig(config: Partial<SetupDetectionConfig>): void {
    if (config.pattern123) {
      this.config.pattern123 = {
        ...this.config.pattern123,
        ...config.pattern123,
      };
      this.pattern123Detector = new Pattern123Detector(this.config.pattern123);
    }

    if (config.bearTrap) {
      this.config.bearTrap = {
        ...this.config.bearTrap,
        ...config.bearTrap,
      };
      this.bearTrapDetector = new BearTrapDetector(this.config.bearTrap);
    }

    if (config.meanReversion) {
      this.config.meanReversion = {
        ...this.config.meanReversion,
        ...config.meanReversion,
      };
      this.meanReversionDetector = new MeanReversionDetector(
        this.config.meanReversion,
      );
    }

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
  }

  getConfig(): SetupDetectionConfig {
    return { ...this.config };
  }
}

export const createDefaultSetupDetectionConfig =
  (): SetupDetectionConfig => ({
    pattern123: createDefault123Config(),
    bearTrap: createDefaultBearTrapConfig(),
    meanReversion: createDefaultMeanReversionConfig(),
    enableTrendFilter: false,
    allowCounterTrend: true,
    trendEmaPeriod: DEFAULT_TREND_EMA_PERIOD,
    setupCooldownPeriod: DEFAULT_SETUP_COOLDOWN,
  });
