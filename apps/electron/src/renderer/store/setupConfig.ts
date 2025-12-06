import type {
    BearTrapConfig,
    BreakoutRetestConfig,
    BullTrapConfig,
    DivergenceConfig,
    GridTradingConfig,
    LiquiditySweepConfig,
    MarketMakingConfig,
    MeanReversionConfig,
    OrderBlockFVGConfig,
    Pattern123Config,
    PinInsideConfig,
    Setup91Config,
    Setup92Config,
    Setup93Config,
    Setup94Config,
    VWAPEMACrossConfig,
} from '@renderer/services/setupDetection';
import {
    createDefault123Config,
    createDefault91Config,
    createDefault92Config,
    createDefault93Config,
    createDefault94Config,
    createDefaultBearTrapConfig,
    createDefaultBreakoutRetestConfig,
    createDefaultBullTrapConfig,
    createDefaultDivergenceConfig,
    createDefaultGridTradingConfig,
    createDefaultLiquiditySweepConfig,
    createDefaultMarketMakingConfig,
    createDefaultMeanReversionConfig,
    createDefaultOrderBlockFVGConfig,
    createDefaultPinInsideConfig,
    createDefaultVWAPEMACrossConfig,
} from '@renderer/services/setupDetection';

const DEFAULT_TREND_EMA_PERIOD = 200;
const DEFAULT_SETUP_COOLDOWN = 5;

export interface SetupDetectionConfig {
  setup91: Setup91Config;
  setup92: Setup92Config;
  setup93: Setup93Config;
  setup94: Setup94Config;
  pattern123: Pattern123Config;
  bullTrap: BullTrapConfig;
  bearTrap: BearTrapConfig;
  breakoutRetest: BreakoutRetestConfig;
  pinInside: PinInsideConfig;
  orderBlockFVG: OrderBlockFVGConfig;
  vwapEmaCross: VWAPEMACrossConfig;
  divergence: DivergenceConfig;
  liquiditySweep: LiquiditySweepConfig;
  meanReversion: MeanReversionConfig;
  gridTrading: GridTradingConfig;
  marketMaking: MarketMakingConfig;
  enableTrendFilter: boolean;
  allowCounterTrend: boolean;
  trendEmaPeriod: number;
  setupCooldownPeriod: number;
}

export const createDefaultSetupDetectionConfig = (): SetupDetectionConfig => ({
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
  meanReversion: createDefaultMeanReversionConfig(),
  gridTrading: createDefaultGridTradingConfig(),
  marketMaking: createDefaultMarketMakingConfig(),
  enableTrendFilter: false,
  allowCounterTrend: true,
  trendEmaPeriod: DEFAULT_TREND_EMA_PERIOD,
  setupCooldownPeriod: DEFAULT_SETUP_COOLDOWN,
});
