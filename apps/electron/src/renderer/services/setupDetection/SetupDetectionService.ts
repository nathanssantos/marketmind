import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Kline, TradingSetup } from '@shared/types';
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
    DivergenceDetector,
    createDefaultDivergenceConfig,
} from './DivergenceDetector';
import {
    LiquiditySweepDetector,
    createDefaultLiquiditySweepConfig,
} from './LiquiditySweepDetector';
import {
    OrderBlockFVGDetector,
    createDefaultOrderBlockFVGConfig,
} from './OrderBlockFVGDetector';
import {
    Pattern123Detector,
    createDefault123Config,
} from './Pattern123Detector';
import {
    PinInsideDetector,
    createDefaultPinInsideConfig,
} from './PinInsideDetector';
import { Setup91Detector, createDefault91Config } from './Setup91Detector';
import { Setup92Detector, createDefault92Config } from './Setup92Detector';
import { Setup93Detector, createDefault93Config } from './Setup93Detector';
import { Setup94Detector, createDefault94Config } from './Setup94Detector';
import {
    VWAPEMACrossDetector,
    createDefaultVWAPEMACrossConfig,
} from './VWAPEMACrossDetector';

export interface SetupDetectionConfig {
  setup91: ReturnType<typeof createDefault91Config>;
  setup92: ReturnType<typeof createDefault92Config>;
  setup93: ReturnType<typeof createDefault93Config>;
  setup94: ReturnType<typeof createDefault94Config>;
  pattern123: ReturnType<typeof createDefault123Config>;
  bullTrap: ReturnType<typeof createDefaultBullTrapConfig>;
  bearTrap: ReturnType<typeof createDefaultBearTrapConfig>;
  breakoutRetest: ReturnType<typeof createDefaultBreakoutRetestConfig>;
  pinInside: ReturnType<typeof createDefaultPinInsideConfig>;
  orderBlockFVG: ReturnType<typeof createDefaultOrderBlockFVGConfig>;
  vwapEmaCross: ReturnType<typeof createDefaultVWAPEMACrossConfig>;
  divergence: ReturnType<typeof createDefaultDivergenceConfig>;
  liquiditySweep: ReturnType<typeof createDefaultLiquiditySweepConfig>;
  enableTrendFilter: boolean;
  allowCounterTrend: boolean;
  trendEmaPeriod: number;
  setupCooldownPeriod: number;
}

const DEBUG_ENABLED = import.meta.env.VITE_DEBUG_SETUPS === 'true';
const PRICE_DECIMAL_PLACES = 2;
const DEFAULT_TREND_EMA_PERIOD = 200;
const DEFAULT_SETUP_COOLDOWN = 10;

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
  private pinInsideDetector: PinInsideDetector;
  private orderBlockFVGDetector: OrderBlockFVGDetector;
  private vwapEmaCrossDetector: VWAPEMACrossDetector;
  private divergenceDetector: DivergenceDetector;
  private liquiditySweepDetector: LiquiditySweepDetector;
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
      pinInside: config?.pinInside ?? createDefaultPinInsideConfig(),
      orderBlockFVG: config?.orderBlockFVG ?? createDefaultOrderBlockFVGConfig(),
      vwapEmaCross: config?.vwapEmaCross ?? createDefaultVWAPEMACrossConfig(),
      divergence: config?.divergence ?? createDefaultDivergenceConfig(),
      liquiditySweep: config?.liquiditySweep ?? createDefaultLiquiditySweepConfig(),
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
    this.pinInsideDetector = new PinInsideDetector(this.config.pinInside);
    this.orderBlockFVGDetector = new OrderBlockFVGDetector(this.config.orderBlockFVG);
    this.vwapEmaCrossDetector = new VWAPEMACrossDetector(this.config.vwapEmaCross);
    this.divergenceDetector = new DivergenceDetector(this.config.divergence);
    this.liquiditySweepDetector = new LiquiditySweepDetector(this.config.liquiditySweep);
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

    const setups: TradingSetup[] = [];
    const MIN_KLINES_FOR_DETECTION = 50;

    if (klines.length < MIN_KLINES_FOR_DETECTION) return [];

    const currentIndex = klines.length - 1;
    const trend = this.getTrend(klines, currentIndex);

    if (this.config.setup91.enabled) {
      this.debugLog('\n--- Setup 9.1 ---');
      const canDetect = this.canDetectSetup('setup91', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.setup91Detector.detect(klines, currentIndex);
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
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Setup 9.1 ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.setup92.enabled) {
      this.debugLog('\n--- Setup 9.2 ---');
      const canDetect = this.canDetectSetup('setup92', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.setup92Detector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('setup92', currentIndex);
            this.debugLog('✅ Setup 9.2 DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (confidence too low or pattern not formed)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('setup92');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Setup 9.2 ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.setup93.enabled) {
      this.debugLog('\n--- Setup 9.3 ---');
      const canDetect = this.canDetectSetup('setup93', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.setup93Detector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('setup93', currentIndex);
            this.debugLog('✅ Setup 9.3 DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (confidence too low or pattern not formed)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('setup93');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Setup 9.3 ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.setup94.enabled) {
      this.debugLog('\n--- Setup 9.4 ---');
      const canDetect = this.canDetectSetup('setup94', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.setup94Detector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('setup94', currentIndex);
            this.debugLog('✅ Setup 9.4 DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (confidence too low or pattern not formed)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('setup94');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Setup 9.4 ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.pattern123.enabled) {
      this.debugLog('\n--- Pattern 1-2-3 ---');
      const canDetect = this.canDetectSetup('pattern123', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.pattern123Detector.detect(klines, currentIndex);
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
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
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
        const result = this.bullTrapDetector.detect(klines, currentIndex);
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
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
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
        const result = this.bearTrapDetector.detect(klines, currentIndex);
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
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
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
        const result = this.breakoutRetestDetector.detect(klines, currentIndex);
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
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Breakout Retest ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.pinInside.enabled) {
      this.debugLog('\n--- Pin + Inside Bar Combo ---');
      const canDetect = this.canDetectSetup('pinInside', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.pinInsideDetector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('pinInside', currentIndex);
            this.debugLog('✅ Pin + Inside Bar Combo DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (pattern not valid or at S/R)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('pinInside');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Pin + Inside Bar Combo ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.orderBlockFVG.enabled) {
      this.debugLog('\n--- Order Block + FVG ---');
      const canDetect = this.canDetectSetup('orderBlockFVG', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.orderBlockFVGDetector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('orderBlockFVG', currentIndex);
            this.debugLog('✅ Order Block + FVG DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (no order block + FVG confluence)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('orderBlockFVG');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Order Block + FVG ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.vwapEmaCross.enabled) {
      this.debugLog('\n--- VWAP + EMA Cross ---');
      const canDetect = this.canDetectSetup('vwapEmaCross', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.vwapEmaCrossDetector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('vwapEmaCross', currentIndex);
            this.debugLog('✅ VWAP + EMA Cross DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (no VWAP cross + pullback)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('vwapEmaCross');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- VWAP + EMA Cross ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.divergence.enabled) {
      this.debugLog('\n--- RSI/MACD Divergence ---');
      const canDetect = this.canDetectSetup('divergence', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.divergenceDetector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('divergence', currentIndex);
            this.debugLog('✅ Divergence DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (no divergence pattern)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('divergence');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- RSI/MACD Divergence ---');
      this.debugLog('❌ Disabled in config');
    }

    if (this.config.liquiditySweep.enabled) {
      this.debugLog('\n--- Liquidity Sweep ---');
      const canDetect = this.canDetectSetup('liquiditySweep', currentIndex);
      this.debugLog('Can Detect (Cooldown):', canDetect);
      
      if (canDetect) {
        const result = this.liquiditySweepDetector.detect(klines, currentIndex);
        this.debugLog('Detection Result:', { hasSetup: !!result.setup, confidence: result.confidence });
        
        if (result.setup) {
          const aligned = this.isTrendAligned(result.setup.direction, trend);
          this.debugLog('Trend Aligned:', aligned, `(${result.setup.direction} vs ${trend})`);
          
          if (aligned) {
            setups.push(result.setup);
            this.markSetupDetected('liquiditySweep', currentIndex);
            this.debugLog('✅ Liquidity Sweep DETECTED');
          } else {
            this.debugLog('❌ Rejected by Trend Filter');
          }
        } else {
          this.debugLog('❌ No setup found (no sweep pattern)');
        }
      } else {
        const lastDetection = this.lastDetectionIndex.get('liquiditySweep');
        this.debugLog(`❌ Cooldown active (last: ${lastDetection}, need: ${this.config.setupCooldownPeriod} klines)`);
      }
    } else {
      this.debugLog('\n--- Liquidity Sweep ---');
      this.debugLog('❌ Disabled in config');
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    return setups;
  }

  detectSetupsInRange(
    klines: Kline[],
    startIndex: number,
    endIndex: number,
  ): TradingSetup[] {
    const setups: TradingSetup[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (this.config.setup91.enabled) {
        const result = this.setup91Detector.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.pattern123.enabled) {
        const result = this.pattern123Detector.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.bullTrap.enabled) {
        const result = this.bullTrapDetector.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.bearTrap.enabled) {
        const result = this.bearTrapDetector.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }

      if (this.config.breakoutRetest.enabled) {
        const result = this.breakoutRetestDetector.detect(klines, i);
        if (result.setup) setups.push(result.setup);
      }
    }

    setups.sort((a, b) => b.confidence - a.confidence);

    this.debugLog('\n=== Detection Summary ===');
    this.debugLog('Total Setups Found:', setups.length);
    if (setups.length > 0) {
      setups.forEach(setup => {
        this.debugLog(`  - ${setup.type}: ${setup.direction} @ ${setup.entryPrice.toFixed(PRICE_DECIMAL_PLACES)} (Confidence: ${setup.confidence}%)`);
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
    setup92: createDefault92Config(),
    setup93: createDefault93Config(),
    setup94: createDefault94Config(),
    pattern123: createDefault123Config(),
    bullTrap: createDefaultBullTrapConfig(),
    bearTrap: createDefaultBearTrapConfig(),
    breakoutRetest: createDefaultBreakoutRetestConfig(),
    pinInside: createDefaultPinInsideConfig(),
    orderBlockFVG: createDefaultOrderBlockFVGConfig(),
    vwapEmaCross: createDefaultVWAPEMACrossConfig(),
    divergence: createDefaultDivergenceConfig(),
    liquiditySweep: createDefaultLiquiditySweepConfig(),
    enableTrendFilter: false,
    allowCounterTrend: true,
    trendEmaPeriod: 200,
    setupCooldownPeriod: 10,
  });
