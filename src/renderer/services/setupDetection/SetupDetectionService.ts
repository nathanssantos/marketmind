import type { Candle, TradingSetup } from '@shared/types';
import { Setup91Detector, createDefault91Config } from './Setup91Detector';
import {
  Pattern123Detector,
  createDefault123Config,
} from './Pattern123Detector';

export interface SetupDetectionConfig {
  setup91: ReturnType<typeof createDefault91Config>;
  pattern123: ReturnType<typeof createDefault123Config>;
}

export class SetupDetectionService {
  private config: SetupDetectionConfig;
  private setup91Detector: Setup91Detector;
  private pattern123Detector: Pattern123Detector;

  constructor(config?: Partial<SetupDetectionConfig>) {
    this.config = {
      setup91: config?.setup91 ?? createDefault91Config(),
      pattern123: config?.pattern123 ?? createDefault123Config(),
    };

    this.setup91Detector = new Setup91Detector(this.config.setup91);
    this.pattern123Detector = new Pattern123Detector(this.config.pattern123);
  }

  detectSetups(candles: Candle[]): TradingSetup[] {
    if (candles.length === 0) return [];

    const setups: TradingSetup[] = [];
    const MIN_CANDLES_FOR_DETECTION = 50;

    if (candles.length < MIN_CANDLES_FOR_DETECTION) return [];

    const currentIndex = candles.length - 1;

    if (this.config.setup91.enabled) {
      const result = this.setup91Detector.detect(candles, currentIndex);
      if (result.setup) setups.push(result.setup);
    }

    if (this.config.pattern123.enabled) {
      const result = this.pattern123Detector.detect(candles, currentIndex);
      if (result.setup) setups.push(result.setup);
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
    }

    setups.sort((a, b) => b.confidence - a.confidence);

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
  }

  getConfig(): SetupDetectionConfig {
    return { ...this.config };
  }
}

export const createDefaultSetupDetectionConfig =
  (): SetupDetectionConfig => ({
    setup91: createDefault91Config(),
    pattern123: createDefault123Config(),
  });
