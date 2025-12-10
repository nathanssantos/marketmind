import { calculateEMA } from '@marketmind/indicators';
import type { Kline, TradingSetup } from '@marketmind/types';
import { getKlineClose } from '@shared/utils';
import {
    BearTrapDetector,
    createDefaultBearTrapConfig,
} from './BearTrapDetector';
import {
    BreakoutRetestDetector,
    createDefaultBreakoutRetestConfig,
} from './BreakoutRetestDetector';
import {
    BullTrapDetector,
    createDefaultBullTrapConfig,
} from './BullTrapDetector';
import {
    Pattern123Detector,
    createDefault123Config,
} from './Pattern123Detector';
import { Setup91Detector, createDefault91Config } from './Setup91Detector';
import { Setup92Detector, createDefault92Config } from './Setup92Detector';
import { Setup93Detector, createDefault93Config } from './Setup93Detector';
import { Setup94Detector, createDefault94Config } from './Setup94Detector';

export interface SetupDetectionConfig {
  setup91: ReturnType<typeof createDefault91Config>;
  setup92: ReturnType<typeof createDefault92Config>;
  setup93: ReturnType<typeof createDefault93Config>;
  setup94: ReturnType<typeof createDefault94Config>;
  pattern123: ReturnType<typeof createDefault123Config>;
  bullTrap: ReturnType<typeof createDefaultBullTrapConfig>;
  bearTrap: ReturnType<typeof createDefaultBearTrapConfig>;
  breakoutRetest: ReturnType<typeof createDefaultBreakoutRetestConfig>;
  enableTrendFilter: boolean;
  allowCounterTrend: boolean;
  trendEmaPeriod: number;
  setupCooldownPeriod: number;
}

const DEBUG_ENABLED = import.meta.env.VITE_DEBUG_SETUPS === 'true';
const PRICE_DECIMAL_PLACES = 2;
const DEFAULT_TREND_EMA_PERIOD = 200;
const DEFAULT_SETUP_COOLDOWN = 10;
const MIN_KLINES_FOR_DETECTION = 50;

export class SetupDetectionService {
  private config: SetupDetectionConfig;
  private setup91Detector: Setup91Detector;
  private setup92Detector: Setup92Detector;
  private setup93Detector: Setup93Detector;
  private setup94Detector: Setup94Detector;
  private pattern123Detector: Pattern123Detector;
  private bullTrapDetector: BullTrapDetector;
  private bearTrapDetector: BearTrapDetector;
  private breakoutRetestDetector: BreakoutRetestDetector;
  private lastDetectionIndex: Map<string, number> = new Map();

  private debugLog(...args: unknown[]): void {
    if (!DEBUG_ENABLED) return;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[SetupDetection ${timestamp}]`, ...args);
  }

  /**
   * @deprecated Use useSetupDetection hook instead for backend-powered setup detection with real-time updates.
   *
   * Migration Guide:
   * ```typescript
   * // Old approach (deprecated):
   * const setupService = new SetupDetectionService(setupConfig);
   * const setups = setupService.detectSetups(klines);
   *
   * // New approach (recommended):
   * const setupDetector = useSetupDetection({
   *   symbol: 'BTCUSDT',
   *   interval: '1h',
   *   enableRealtimeUpdates: true,
   * });
   * const setups = setupDetector.detectSetups(klines);
   * ```
   *
   * Benefits of migration:
   * - Real-time WebSocket updates when new setups are detected
   * - Persistent storage in PostgreSQL + TimescaleDB
   * - Automatic cache invalidation with React Query
   * - Type-safe tRPC API integration
   * - Historical setup tracking and analytics
   */
  constructor(config?: Partial<SetupDetectionConfig>) {
    this.config = {
      setup91: config?.setup91 ?? createDefault91Config(),
      setup92: config?.setup92 ?? createDefault92Config(),
      setup93: config?.setup93 ?? createDefault93Config(),
      setup94: config?.setup94 ?? createDefault94Config(),
      pattern123: config?.pattern123 ?? createDefault123Config(),
      bullTrap: config?.bullTrap ?? createDefaultBullTrapConfig(),
      bearTrap: config?.bearTrap ?? createDefaultBearTrapConfig(),
      breakoutRetest: config?.breakoutRetest ?? createDefaultBreakoutRetestConfig(),
      enableTrendFilter: config?.enableTrendFilter ?? false,
      allowCounterTrend: config?.allowCounterTrend ?? true,
      trendEmaPeriod: config?.trendEmaPeriod ?? DEFAULT_TREND_EMA_PERIOD,
      setupCooldownPeriod: config?.setupCooldownPeriod ?? DEFAULT_SETUP_COOLDOWN,
    };

    this.setup91Detector = new Setup91Detector(this.config.setup91);
    this.setup92Detector = new Setup92Detector(this.config.setup92);
    this.setup93Detector = new Setup93Detector(this.config.setup93);
    this.setup94Detector = new Setup94Detector(this.config.setup94);
    this.pattern123Detector = new Pattern123Detector(this.config.pattern123);
    this.bullTrapDetector = new BullTrapDetector(this.config.bullTrap);
    this.bearTrapDetector = new BearTrapDetector(this.config.bearTrap);
    this.breakoutRetestDetector = new BreakoutRetestDetector(this.config.breakoutRetest);
  }

  private canDetectSetup(setupType: string, currentIndex: number): boolean {
    const lastIndex = this.lastDetectionIndex.get(setupType);
    if (lastIndex === undefined) return true;
    return currentIndex - lastIndex >= this.config.setupCooldownPeriod;
  }

  private markSetupDetected(setupType: string, currentIndex: number): void {
    this.lastDetectionIndex.set(setupType, currentIndex);
  }

  private getTrend(klines: Kline[], currentIndex: number): 'bullish' | 'bearish' | 'neutral' {
    if (!this.config.enableTrendFilter || currentIndex < this.config.trendEmaPeriod) {
      return 'neutral';
    }

    const ema200 = calculateEMA(klines, this.config.trendEmaPeriod);
    const current = klines[currentIndex];
    const ema200Current = ema200[currentIndex];

    if (!current || ema200Current === null || ema200Current === undefined) {
      return 'neutral';
    }

    if (getKlineClose(current) > ema200Current) return 'bullish';
    if (getKlineClose(current) < ema200Current) return 'bearish';
    return 'neutral';
  }

  private isTrendAligned(setupDirection: 'LONG' | 'SHORT', trend: 'bullish' | 'bearish' | 'neutral'): boolean {
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

    const detectors = [
      {
        name: 'setup91',
        detector: this.setup91Detector,
        enabled: this.config.setup91.enabled,
        label: 'Setup 9.1',
      },
      {
        name: 'setup92',
        detector: this.setup92Detector,
        enabled: this.config.setup92.enabled,
        label: 'Setup 9.2',
      },
      {
        name: 'setup93',
        detector: this.setup93Detector,
        enabled: this.config.setup93.enabled,
        label: 'Setup 9.3',
      },
      {
        name: 'setup94',
        detector: this.setup94Detector,
        enabled: this.config.setup94.enabled,
        label: 'Setup 9.4',
      },
      {
        name: 'pattern123',
        detector: this.pattern123Detector,
        enabled: this.config.pattern123.enabled,
        label: 'Pattern 1-2-3',
      },
      {
        name: 'bullTrap',
        detector: this.bullTrapDetector,
        enabled: this.config.bullTrap.enabled,
        label: 'Bull Trap',
      },
      {
        name: 'bearTrap',
        detector: this.bearTrapDetector,
        enabled: this.config.bearTrap.enabled,
        label: 'Bear Trap',
      },
      {
        name: 'breakoutRetest',
        detector: this.breakoutRetestDetector,
        enabled: this.config.breakoutRetest.enabled,
        label: 'Breakout Retest',
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

    const detectors = [
      {
        detector: this.setup91Detector,
        enabled: this.config.setup91.enabled,
      },
      {
        detector: this.setup92Detector,
        enabled: this.config.setup92.enabled,
      },
      {
        detector: this.setup93Detector,
        enabled: this.config.setup93.enabled,
      },
      {
        detector: this.setup94Detector,
        enabled: this.config.setup94.enabled,
      },
      {
        detector: this.pattern123Detector,
        enabled: this.config.pattern123.enabled,
      },
      {
        detector: this.bullTrapDetector,
        enabled: this.config.bullTrap.enabled,
      },
      {
        detector: this.bearTrapDetector,
        enabled: this.config.bearTrap.enabled,
      },
      {
        detector: this.breakoutRetestDetector,
        enabled: this.config.breakoutRetest.enabled,
      },
    ];

    for (let i = startIndex; i <= endIndex; i += 1) {
      for (const { detector, enabled } of detectors) {
        if (!enabled) continue;
        const result = detector.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    return setups;
  }

  updateConfig(config: Partial<SetupDetectionConfig>): void {
    if (config.setup91) {
      this.config.setup91 = { ...this.config.setup91, ...config.setup91 };
      this.setup91Detector = new Setup91Detector(this.config.setup91);
    }

    if (config.setup92) {
      this.config.setup92 = { ...this.config.setup92, ...config.setup92 };
      this.setup92Detector = new Setup92Detector(this.config.setup92);
    }

    if (config.setup93) {
      this.config.setup93 = { ...this.config.setup93, ...config.setup93 };
      this.setup93Detector = new Setup93Detector(this.config.setup93);
    }

    if (config.setup94) {
      this.config.setup94 = { ...this.config.setup94, ...config.setup94 };
      this.setup94Detector = new Setup94Detector(this.config.setup94);
    }

    if (config.pattern123) {
      this.config.pattern123 = {
        ...this.config.pattern123,
        ...config.pattern123,
      };
      this.pattern123Detector = new Pattern123Detector(this.config.pattern123);
    }

    if (config.bullTrap) {
      this.config.bullTrap = {
        ...this.config.bullTrap,
        ...config.bullTrap,
      };
      this.bullTrapDetector = new BullTrapDetector(this.config.bullTrap);
    }

    if (config.bearTrap) {
      this.config.bearTrap = {
        ...this.config.bearTrap,
        ...config.bearTrap,
      };
      this.bearTrapDetector = new BearTrapDetector(this.config.bearTrap);
    }

    if (config.breakoutRetest) {
      this.config.breakoutRetest = {
        ...this.config.breakoutRetest,
        ...config.breakoutRetest,
      };
      this.breakoutRetestDetector = new BreakoutRetestDetector(
        this.config.breakoutRetest,
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
    setup91: createDefault91Config(),
    setup92: createDefault92Config(),
    setup93: createDefault93Config(),
    setup94: createDefault94Config(),
    pattern123: createDefault123Config(),
    bullTrap: createDefaultBullTrapConfig(),
    bearTrap: createDefaultBearTrapConfig(),
    breakoutRetest: createDefaultBreakoutRetestConfig(),
    enableTrendFilter: false,
    allowCounterTrend: true,
    trendEmaPeriod: DEFAULT_TREND_EMA_PERIOD,
    setupCooldownPeriod: DEFAULT_SETUP_COOLDOWN,
  });
