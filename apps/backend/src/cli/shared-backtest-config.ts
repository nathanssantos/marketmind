import { FILTER_DEFAULTS } from '@marketmind/types';
import type { MultiWatcherBacktestConfig } from '@marketmind/types';

export const ENABLED_SETUPS = [
  'breakout-retest',
  'bear-trap',
  'ema5-momentum-crypto',
  'tema-momentum',
  '7day-momentum-crypto',
  'chaikin-money-flow',
  'pattern-123-reversal',
  'rsi50-momentum-crossover',
  'momentum-breakout-2025',
  'tsi-momentum',
  'larry-williams-9-1',
  'larry-williams-9-3',
  'klinger-oscillator',
  'vwap-pullback',
  'supertrend-follow',
  'parabolic-sar-crypto',
  'macd-divergence',
  'triple-ema-confluence',
  'nr7-breakout',
  'larry-williams-9-4',
  'golden-cross-sma',
] as const;

export const DEFAULT_BACKTEST_PARAMS = {
  initialCapital: 1000,
  leverage: 1,
  positionSizePercent: 10,
  cooldownMinutes: 15,
  marketType: 'FUTURES' as const,
} as const;

export const VOLUME_FILTER_CONFIG = {
  longConfig: {
    useObvCheck: FILTER_DEFAULTS.useObvCheckLong,
    obvLookback: FILTER_DEFAULTS.volumeFilterObvLookbackLong,
  },
  shortConfig: {
    useObvCheck: FILTER_DEFAULTS.useObvCheckShort,
    obvLookback: FILTER_DEFAULTS.volumeFilterObvLookbackShort,
  },
};

export type BaseBacktestConfig = Omit<MultiWatcherBacktestConfig, 'watchers' | 'startDate' | 'endDate'>;

export const createBaseConfig = (): BaseBacktestConfig => ({
  initialCapital: DEFAULT_BACKTEST_PARAMS.initialCapital,
  positionSizePercent: DEFAULT_BACKTEST_PARAMS.positionSizePercent,
  minRiskRewardRatio: 0.75,
  setupTypes: [...ENABLED_SETUPS],
  useSharedExposure: true,
  marketType: DEFAULT_BACKTEST_PARAMS.marketType,
  leverage: DEFAULT_BACKTEST_PARAMS.leverage,

  useCooldown: true,
  cooldownMinutes: DEFAULT_BACKTEST_PARAMS.cooldownMinutes,

  useVolumeFilter: true,
  volumeFilterConfig: VOLUME_FILTER_CONFIG,

  useMomentumTimingFilter: true,
  useMtfFilter: false,
  useMarketRegimeFilter: false,

  useStochasticFilter: false,
  useAdxFilter: false,
  useTrendFilter: false,
  maxFibonacciEntryProgressPercent: 100,
  useFundingFilter: false,
  useBtcCorrelationFilter: true,
  useConfluenceScoring: false,
  trendFilterPeriod: 21,

  tpCalculationMode: 'fibonacci',
  fibonacciTargetLevel: 'auto',
  fibonacciTargetLevelLong: '2',
  fibonacciTargetLevelShort: '1.272',
});

export const parseCliArgs = () => {
  const symbolArg = process.argv.find(arg => arg.startsWith('--symbol='));
  const intervalArg = process.argv.find(arg => arg.startsWith('--interval='));
  const startDateArg = process.argv.find(arg => arg.startsWith('--start='));
  const endDateArg = process.argv.find(arg => arg.startsWith('--end='));

  return {
    symbol: symbolArg ? symbolArg.split('=')[1]! : 'BTCUSDT',
    interval: intervalArg ? intervalArg.split('=')[1]! : '4h',
    startDate: startDateArg ? startDateArg.split('=')[1]! : '2023-01-01',
    endDate: endDateArg ? endDateArg.split('=')[1]! : '2026-01-01',
  };
};

export const formatCurrency = (value: number): string =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatPercent = (value: number): string => value.toFixed(2) + '%';

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
};

export const printConfig = () => {
  console.log('> CONFIGURAÇÃO DO BACKTEST:');
  console.log(`   • Capital: $${formatCurrency(DEFAULT_BACKTEST_PARAMS.initialCapital)}`);
  console.log(`   • Leverage: ${DEFAULT_BACKTEST_PARAMS.leverage}x`);
  console.log(`   • Setups: ${ENABLED_SETUPS.length} estratégias`);
  console.log('   • BTC Correlation Filter: ON');
  console.log('   • Volume Filter: ON (OBV LONG=off, SHORT=on)');
  console.log('   • Momentum Timing Filter: ON');
  console.log('   • EMA Trend Filter: OFF');
  console.log('   • ADX Filter: OFF');
  console.log('   • TP Mode: Fibonacci (auto)');
  console.log(`   • Cooldown: ${DEFAULT_BACKTEST_PARAMS.cooldownMinutes} min\n`);
};

export interface DirectionalMetrics {
  pnl: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

export const calculateDirectionalMetrics = (
  trades: Array<{ side: 'LONG' | 'SHORT'; pnl?: number }>
): DirectionalMetrics => {
  if (trades.length === 0) return { pnl: 0, trades: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0 };

  const completedTrades = trades.filter(t => t.pnl !== undefined);
  if (completedTrades.length === 0) return { pnl: 0, trades: 0, winRate: 0, profitFactor: 0, avgWin: 0, avgLoss: 0 };

  const wins = completedTrades.filter(t => t.pnl! > 0);
  const losses = completedTrades.filter(t => t.pnl! <= 0);
  const totalPnl = completedTrades.reduce((sum, t) => sum + t.pnl!, 0);
  const totalWins = wins.reduce((sum, t) => sum + t.pnl!, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0));

  return {
    pnl: totalPnl,
    trades: completedTrades.length,
    winRate: (wins.length / completedTrades.length) * 100,
    profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
    avgWin: wins.length > 0 ? totalWins / wins.length : 0,
    avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
  };
};
