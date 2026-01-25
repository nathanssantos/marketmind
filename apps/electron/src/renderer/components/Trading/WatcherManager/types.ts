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
  useMomentumTimingFilter?: boolean | null;
  useStochasticFilter?: boolean | null;
  useAdxFilter?: boolean | null;
  useVolumeFilter?: boolean | null;
  useFundingFilter?: boolean | null;
  useConfluenceScoring?: boolean | null;
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
  leverageSettings: boolean;
  trailingStop: boolean;
  tpMode: boolean;
  filters: boolean;
  opportunityCost: boolean;
  pyramiding: boolean;
}
