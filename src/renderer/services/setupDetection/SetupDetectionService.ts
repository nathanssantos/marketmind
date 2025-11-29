import { calculateEMA } from '@renderer/utils/indicators/ema';
import type { Candle, TradingSetup } from '@shared/types';
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

export interface SetupDetectionConfig {
  setup91: ReturnType<typeof createDefault91Config>;
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

export class SetupDetectionService {
  private config: SetupDetectionConfig;
  private setup91Detector: Setup91Detector;
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

  constructor(config?: Partial<SetupDetectionConfig>) {
    this.config = {
      setup91: config?.setup91 ?? createDefault91Config(),
      pattern123: config?.pattern123 ?? createDefault123Config(),
      bullTrap: config?.bullTrap ?? createDefaultBullTrapConfig(),
      bearTrap: config?.bearTrap ?? createDefaultBearTrapConfig(),
      breakoutRetest: config?.breakoutRetest ?? createDefaultBreakoutRetestConfig(),
      enableTrendFilter: config?.enableTrendFilter ?? false,
      allowCounterTrend: config?.allowCounterTrend ?? true,
      trendEmaPeriod: config?.trendEmaPeriod ?? 200,
      setupCooldownPeriod: config?.setupCooldownPeriod ?? 10,
    };

    this.setup91Detector = new Setup91Detector(this.config.setup91);
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

  private getTrend(candles: Candle[], currentIndex: number): 'bullish' | 'bearish' | 'neutral' {
    if (!this.config.enableTrendFilter || currentIndex < this.config.trendEmaPeriod) {
      return 'neutral';
    }

    const ema200 = calculateEMA(candles, this.config.trendEmaPeriod);
    const current = candles[currentIndex];
    const ema200Current = ema200[currentIndex];

    if (!current || ema200Current === undefined || isNaN(ema200Current)) {
      return 'neutral';
    }

    if (current.close > ema200Current) return 'bullish';
    if (current.close < ema200Current) return 'bearish';
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

  detectSetups(candles: Candle[]): TradingSetup[] {
    if (candles.length === 0) return [];

    const setups: TradingSetup[] = [];
    const MIN_CANDLES_FOR_DETECTION = 50;

    if (candles.length < MIN_CANDLES_FOR_DETECTION) return [];

    const currentIndex = candles.length - 1;
    const trend = this.getTrend(candles, currentIndex);

    if (this.config.setup91.enabled) {
      this.debugLog('\n--- Setup 9.1 ---');
      const canDetect = this.canDetectSetup('setup91', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.setup91Detector.detect(candles, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('setup91', currentIndex);
            this.debugLog('✅ Setup 9.1 DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (confidence too low or pattern not formed)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('setup91');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} candles)`);
      }
    } else {
      this.debugLog('\n--- Setup 9.1 ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.pattern123.enabled) {
      this.debugLog('\n--- Pattern 1-2-3 ---');
      const canDetect = this.canDetectSetup('pattern123', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.pattern123Detector.detect(candles, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('pattern123', currentIndex);
            this.debugLog('✅ Pattern 1-2-3 DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (not enough pivots or breakout not confirmed)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('pattern123');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} candles)`);
      }
    } else {
      this.debugLog('\n--- Pattern 1-2-3 ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.bullTrap.enabled) {
      this.debugLog('\n--- Bull Trap ---');
      const canDetect = this.canDetectSetup('bullTrap', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.bullTrapDetector.detect(candles, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('bullTrap', currentIndex);
            this.debugLog('✅ Bull Trap DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (no fake breakout or reversal not strong enough)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('bullTrap');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} candles)`);
      }
    } else {
      this.debugLog('\n--- Bull Trap ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.bearTrap.enabled) {
      this.debugLog('\n--- Bear Trap ---');
      const canDetect = this.canDetectSetup('bearTrap', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.bearTrapDetector.detect(candles, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('bearTrap', currentIndex);
            this.debugLog('✅ Bear Trap DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (no fake breakdown or reversal not strong enough)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('bearTrap');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} candles)`);
      }
    } else {
      this.debugLog('\n--- Bear Trap ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.breakoutRetest.enabled) {
      this.debugLog('\n--- Breakout Retest ---');
      const canDetect = this.canDetectSetup('breakoutRetest', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.breakoutRetestDetector.detect(candles, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('breakoutRetest', currentIndex);
            this.debugLog('✅ Breakout Retest DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (no breakout or retest not confirmed)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('breakoutRetest');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} candles)`);
      }
    } else {
      this.debugLog('\n--- Breakout Retest ---');
      this.debugLog('❌ Disabled in config');
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    return setups;
  }

  detectSetupsInRange(
    candles: Candle[],
    startIndex: number,
    endIndex: number,
  ): TradingSetup[] {
    const setups: TradingSetup[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (this.config.setup91.enabled) {
        const result = this.setup91Detector.detect(candles, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.pattern123.enabled) {
        const result = this.pattern123Detector.detect(candles, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.bullTrap.enabled) {
        const result = this.bullTrapDetector.detect(candles, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.bearTrap.enabled) {
        const result = this.bearTrapDetector.detect(candles, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.breakoutRetest.enabled) {
        const result = this.breakoutRetestDetector.detect(candles, i);
        if (result.setup) setups.push(result.setup);
      }
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    this.debugLog('\n=== Detection Summary ===');
    this.debugLog('Total Setups Found:', setups.length);
    if (setups.length > 0) {
      setups.forEach(setup => {
        this.debugLog(`  - ${setup.type}: ${setup.direction} @ ${setup.entryPrice.toFixed(2)} (Confidence: ${setup.confidence}%)`);
      });
    }
    this.debugLog('===========================\n');

    return setups;
  }

  updateConfig(config: Partial<SetupDetectionConfig>): void {
    if (config.setup91) {
      this.config.setup91 = { ...this.config.setup91, ...config.setup91 };
      this.setup91Detector = new Setup91Detector(this.config.setup91);
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
      this.breakoutRetestDetector = new BreakoutRetestDetector(this.config.breakoutRetest);
    }
  }

  getConfig(): SetupDetectionConfig {
    return { ...this.config };
  }
}

export const createDefaultSetupDetectionConfig =
  (): SetupDetectionConfig => ({
    setup91: createDefault91Config(),
    pattern123: createDefault123Config(),
    bullTrap: createDefaultBullTrapConfig(),
    bearTrap: createDefaultBearTrapConfig(),
    breakoutRetest: createDefaultBreakoutRetestConfig(),
    enableTrendFilter: false,
    allowCounterTrend: true,
    trendEmaPeriod: 200,
    setupCooldownPeriod: 10,
  });
