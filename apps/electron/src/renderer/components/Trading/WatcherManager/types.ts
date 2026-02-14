import type { FibonacciTargetLevel } from '@marketmind/fibonacci';
import type { MarketType, TimeInterval, TradingProfile } from '@marketmind/types';

export interface WatcherConfig {
  tpCalculationMode?: 'default' | 'fibonacci' | null;
  fibonacciTargetLevel?: FibonacciTargetLevel | null;
  useDynamicSymbolSelection?: boolean | null;
  enableAutoRotation?: boolean | null;
  leverage?: number | null;
  marginType?: 'ISOLATED' | 'CROSSED' | null;
  useMtfFilter?: boolean | null;
  useBtcCorrelationFilter?: boolean | null;
  useMarketRegimeFilter?: boolean | null;
  useTrendFilter?: boolean | null;
  useDirectionFilter?: boolean | null;
  directionMode?: 'auto' | 'long_only' | 'short_only' | null;
  useMomentumTimingFilter?: boolean | null;
  useStochasticFilter?: boolean | null;
  useStochasticRecoveryFilter?: boolean | null;
  useAdxFilter?: boolean | null;
  useVolumeFilter?: boolean | null;
  useFundingFilter?: boolean | null;
  useConfluenceScoring?: boolean | null;
  useChoppinessFilter?: boolean | null;
  useSessionFilter?: boolean | null;
  useBollingerSqueezeFilter?: boolean | null;
  useVwapFilter?: boolean | null;
  useSuperTrendFilter?: boolean | null;
  opportunityCostEnabled?: boolean | null;
  maxHoldingPeriodBars?: number | null;
  stalePriceThresholdPercent?: string | null;
  staleTradeAction?: 'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE' | null;
  timeBasedStopTighteningEnabled?: boolean | null;
  timeTightenAfterBars?: number | null;
  timeTightenPercentPerBar?: string | null;
  pyramidingEnabled?: boolean | null;
  pyramidingMode?: 'static' | 'dynamic' | 'fibonacci' | null;
  maxPyramidEntries?: number | null;
  pyramidScaleFactor?: string | null;
  pyramidUseAdx?: boolean | null;
  pyramidAdxThreshold?: number | null;
  pyramidUseAtr?: boolean | null;
  pyramidUseRsi?: boolean | null;
  leverageAwarePyramid?: boolean | null;
  pyramidFiboLevels?: string | null;
  enableLongInBearMarket?: boolean | null;
  enableShortInBullMarket?: boolean | null;
  confluenceMinScore?: number | null;
  maxDrawdownEnabled?: boolean | null;
  maxDrawdownPercent?: string | null;
  marginTopUpEnabled?: boolean | null;
  marginTopUpThreshold?: string | null;
  marginTopUpPercent?: string | null;
  marginTopUpMaxCount?: number | null;
  positionMode?: 'ONE_WAY' | 'HEDGE' | null;
}

export interface ActiveWatcher {
  watcherId: string;
  symbol: string;
  interval: string;
  profileId?: string;
  profileName?: string;
  marketType?: 'SPOT' | 'FUTURES';
}

export interface WatcherManagerProps {
  walletId: string;
  config: WatcherConfig | undefined;
  profiles: TradingProfile[];
  activeWatchers: ActiveWatcher[];
  persistedWatchers: number;
  isLoading: boolean;
}

export interface QuickStartState {
  count: number;
  timeframe: TimeInterval;
  marketType: MarketType;
}

export interface SectionExpandedState {
  watchers: boolean;
  dynamicSelection: boolean;
  positionSize: boolean;
  leverageSettings: boolean;
  riskManagement: boolean;
  trailingStop: boolean;
  tpMode: boolean;
  entrySettings: boolean;
  filters: boolean;
  opportunityCost: boolean;
  pyramiding: boolean;
}
