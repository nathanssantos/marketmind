/**
 * Default fixtures for visual review captures. Mirrors the shape of the
 * production tRPC procedures so the renderer renders populated states.
 *
 * These are intentionally generous (5 wallets, ~12 closed executions, an
 * auto-trading config) — Phase 6 needs the screens to look like a real user
 * day, not a fresh install.
 */
import LAYOUT_FIXTURE from './layoutFixture.json' with { type: 'json' };

const NOW = '2026-04-27T19:00:00.000Z';

// Synthetic kline generator — deterministic seeded RNG so screenshots are
// reproducible across runs. Mirrors the e2e helper in
// apps/electron/e2e/helpers/klineFixtures.ts; copied here to avoid a
// cross-package import (mcp-screenshot ships standalone).
interface SyntheticKline {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
}

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '30m': 30 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const generateKlines = (
  symbol: string,
  interval: string,
  count: number,
  basePrice: number,
  seed: number,
  volatility = 0.004,
): SyntheticKline[] => {
  const intervalMs = INTERVAL_MS[interval] ?? 60_000;
  const endTime = Math.floor(new Date(NOW).getTime() / intervalMs) * intervalMs;
  const rng = mulberry32(seed);
  const klines: SyntheticKline[] = [];
  let price = basePrice;
  // Mild upward drift so the chart looks alive (slight uptrend bias).
  const driftBias = 0.0003;
  for (let i = 0; i < count; i++) {
    const openTime = endTime - (count - 1 - i) * intervalMs;
    const closeTime = openTime + intervalMs - 1;
    const drift = (rng() - 0.5) * 2 * volatility + driftBias;
    const open = price;
    const close = price * (1 + drift);
    const wick = Math.abs(drift) * price * 1.5;
    const high = Math.max(open, close) + wick * rng();
    const low = Math.min(open, close) - wick * rng();
    const volume = 100 + rng() * 900;
    const quoteVolume = volume * ((open + close) / 2);
    const trades = Math.floor(50 + rng() * 450);
    const takerBuyBase = volume * (0.4 + rng() * 0.2);
    klines.push({
      symbol,
      interval,
      openTime,
      closeTime,
      open,
      high,
      low,
      close,
      volume,
      quoteVolume,
      trades,
      takerBuyBaseVolume: takerBuyBase,
      takerBuyQuoteVolume: takerBuyBase * ((open + close) / 2),
    });
    price = close;
  }
  return klines;
};

// 500 candles per (symbol, interval) — enough for the chart to not look
// thin while keeping the fixture payload reasonable. Seeds vary per
// symbol so the curves don't visually align across panels.
const SYNTHETIC_KLINES: Record<string, Record<string, SyntheticKline[]>> = {
  BTCUSDT: {
    '1m': generateKlines('BTCUSDT', '1m', 500, 67_000, 1001),
    '5m': generateKlines('BTCUSDT', '5m', 500, 66_000, 1002),
    '15m': generateKlines('BTCUSDT', '15m', 500, 65_000, 1003),
    '1h': generateKlines('BTCUSDT', '1h', 500, 62_000, 1004),
    '4h': generateKlines('BTCUSDT', '4h', 500, 55_000, 1005),
    '1d': generateKlines('BTCUSDT', '1d', 500, 35_000, 1006, 0.012),
  },
  ETHUSDT: {
    '1m': generateKlines('ETHUSDT', '1m', 500, 3_460, 2001),
    '5m': generateKlines('ETHUSDT', '5m', 500, 3_400, 2002),
    '15m': generateKlines('ETHUSDT', '15m', 500, 3_350, 2003),
    '1h': generateKlines('ETHUSDT', '1h', 500, 3_200, 2004),
    '4h': generateKlines('ETHUSDT', '4h', 500, 2_900, 2005),
    '1d': generateKlines('ETHUSDT', '1d', 500, 2_400, 2006, 0.012),
  },
  SOLUSDT: {
    '1m': generateKlines('SOLUSDT', '1m', 500, 171, 3001),
    '5m': generateKlines('SOLUSDT', '5m', 500, 168, 3002),
    '15m': generateKlines('SOLUSDT', '15m', 500, 165, 3003),
    '1h': generateKlines('SOLUSDT', '1h', 500, 158, 3004),
    '4h': generateKlines('SOLUSDT', '4h', 500, 140, 3005),
    '1d': generateKlines('SOLUSDT', '1d', 500, 110, 3006, 0.012),
  },
};

const SYNTHETIC_USER = {
  id: 'e2e-user',
  email: 'demo@marketmind.app',
  name: 'Demo Account',
  emailVerified: true,
  twoFactorEnabled: false,
  avatarColor: '#5b8def',
  hasAvatar: false,
  createdAt: '2026-01-15T00:00:00.000Z',
};

const DEMO_WALLET = {
  id: 'wallet-demo-1',
  userId: 'e2e-user',
  name: 'Demo Paper Wallet',
  walletType: 'paper' as const,
  marketType: 'FUTURES' as const,
  exchange: 'BINANCE',
  initialBalance: '10000',
  currentBalance: '12473.42',
  totalWalletBalance: '12473.42',
  currency: 'USDT',
  isActive: true,
  createdAt: '2026-01-20T10:00:00.000Z',
  updatedAt: NOW,
};

const PAPER_BTC_WALLET = {
  ...DEMO_WALLET,
  id: 'wallet-demo-2',
  name: 'BTC Strategies',
  initialBalance: '5000',
  currentBalance: '5847.10',
  totalWalletBalance: '5847.10',
};

const closedExecutions = [
  { sym: 'BTCUSDT', side: 'long', qty: 0.05, entry: 67_200, exit: 68_350, pnl: 57.5, daysAgo: 1 },
  { sym: 'ETHUSDT', side: 'long', qty: 1.2, entry: 3_410, exit: 3_465, pnl: 66.0, daysAgo: 2 },
  { sym: 'SOLUSDT', side: 'short', qty: 8, entry: 178.4, exit: 174.2, pnl: 33.6, daysAgo: 3 },
  { sym: 'BTCUSDT', side: 'long', qty: 0.04, entry: 66_900, exit: 66_410, pnl: -19.6, daysAgo: 4 },
  { sym: 'ETHUSDT', side: 'short', qty: 0.8, entry: 3_525, exit: 3_488, pnl: 29.6, daysAgo: 5 },
  { sym: 'BNBUSDT', side: 'long', qty: 2, entry: 612.3, exit: 624.7, pnl: 24.8, daysAgo: 6 },
  { sym: 'SOLUSDT', side: 'long', qty: 6, entry: 168.2, exit: 172.9, pnl: 28.2, daysAgo: 7 },
  { sym: 'BTCUSDT', side: 'short', qty: 0.03, entry: 68_100, exit: 67_540, pnl: 16.8, daysAgo: 9 },
  { sym: 'ETHUSDT', side: 'long', qty: 1, entry: 3_400, exit: 3_348, pnl: -52.0, daysAgo: 11 },
  { sym: 'BTCUSDT', side: 'long', qty: 0.06, entry: 65_800, exit: 67_120, pnl: 79.2, daysAgo: 14 },
  { sym: 'SOLUSDT', side: 'short', qty: 10, entry: 175, exit: 169, pnl: 60, daysAgo: 18 },
  { sym: 'BNBUSDT', side: 'long', qty: 1.5, entry: 605, exit: 615, pnl: 15, daysAgo: 21 },
];

const TRADE_EXECUTIONS = closedExecutions.map((t, i) => {
  const closedAt = new Date(Date.now() - t.daysAgo * 86_400_000).toISOString();
  const openedAt = new Date(Date.now() - t.daysAgo * 86_400_000 - 3_600_000).toISOString();
  return {
    id: `exec-${String(i + 1).padStart(3, '0')}`,
    userId: 'e2e-user',
    walletId: DEMO_WALLET.id,
    setupId: 'breakout-retest',
    setupType: 'breakout-retest',
    symbol: t.sym,
    side: t.side,
    entryPrice: String(t.entry),
    exitPrice: String(t.exit),
    quantity: String(t.qty),
    pnl: String(t.pnl),
    pnlPercent: ((t.pnl / (t.entry * t.qty)) * 100).toFixed(2),
    fees: '0.50',
    entryFee: '0.25',
    exitFee: '0.25',
    accumulatedFunding: '0',
    leverage: 5,
    marketType: 'FUTURES',
    status: 'closed',
    exitReason: t.pnl > 0 ? 'take_profit' : 'stop_loss',
    openedAt,
    closedAt,
    createdAt: openedAt,
    updatedAt: closedAt,
  };
});

// 2 open positions — one LONG in profit, one SHORT in profit. Drawn on
// the chart as order lines + populate the Portfolio / Positions panels.
const OPEN_EXECUTIONS = [
  {
    id: 'exec-open-001',
    userId: 'e2e-user',
    walletId: DEMO_WALLET.id,
    setupId: 'breakout-retest',
    setupType: 'breakout-retest',
    symbol: 'BTCUSDT',
    side: 'long',
    entryPrice: '67200',
    exitPrice: null,
    quantity: '0.08',
    pnl: '124.0',
    pnlPercent: '2.31',
    fees: '0.25',
    entryFee: '0.25',
    exitFee: null,
    accumulatedFunding: '0',
    leverage: 10,
    marketType: 'FUTURES',
    status: 'open',
    stopLoss: '66800',
    takeProfit: '68500',
    exitReason: null,
    openedAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    closedAt: null,
    createdAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    updatedAt: NOW,
  },
  {
    id: 'exec-open-002',
    userId: 'e2e-user',
    walletId: DEMO_WALLET.id,
    setupId: 'pin-inside-combo',
    setupType: 'pin-inside-combo',
    symbol: 'ETHUSDT',
    side: 'short',
    entryPrice: '3478',
    exitPrice: null,
    quantity: '0.6',
    pnl: '18.6',
    pnlPercent: '0.89',
    fees: '0.20',
    entryFee: '0.20',
    exitFee: null,
    accumulatedFunding: '0',
    leverage: 5,
    marketType: 'FUTURES',
    status: 'open',
    stopLoss: '3520',
    takeProfit: '3420',
    exitReason: null,
    openedAt: new Date(Date.now() - 1 * 3_600_000).toISOString(),
    closedAt: null,
    createdAt: new Date(Date.now() - 1 * 3_600_000).toISOString(),
    updatedAt: NOW,
  },
];

const ALL_EXECUTIONS = [...OPEN_EXECUTIONS, ...TRADE_EXECUTIONS];

const PERFORMANCE_SUMMARY = {
  totalReturn: 24.7,
  netPnL: 339.1,
  grossPnL: 345.1,
  totalFees: 6.0,
  totalFunding: 0,
  winRate: 75,
  winningTrades: 9,
  losingTrades: 3,
  profitFactor: 2.4,
  avgWin: 45.5,
  avgLoss: -23.7,
  maxDrawdown: 4.2,
  largestWin: 79.2,
  largestLoss: -52.0,
};

const EQUITY_POINTS = TRADE_EXECUTIONS
  .slice()
  .reverse()
  .reduce<Array<{ timestamp: string; equity: number }>>((acc, t) => {
    const prev = acc[acc.length - 1]?.equity ?? 10_000;
    acc.push({ timestamp: t.closedAt!, equity: prev + Number(t.pnl) });
    return acc;
  }, []);

const DAILY_PERFORMANCE = closedExecutions
  .map((t) => {
    const closedAt = new Date(Date.now() - t.daysAgo * 86_400_000);
    const date = closedAt.toISOString().slice(0, 10);
    const pnl = t.pnl;
    return {
      date,
      pnl,
      pnlPercent: (pnl / 10_000) * 100,
      tradesCount: 1,
      closedPositions: 1,
      wins: pnl > 0 ? 1 : 0,
      losses: pnl < 0 ? 1 : 0,
      grossProfit: pnl > 0 ? pnl : 0,
      grossLoss: pnl < 0 ? Math.abs(pnl) : 0,
    };
  })
  .sort((a, b) => a.date.localeCompare(b.date));

// User indicator instances — one per default seed in trading-core. Stable
// IDs so checklist conditions can reference them.
const USER_INDICATORS = [
  { id: 'ui-ema9', userId: 'e2e-user', catalogType: 'ema', label: 'EMA 9', params: '{"period":9,"color":"#ff00ff","lineWidth":1}', isCustom: false, createdAt: NOW, updatedAt: NOW },
  { id: 'ui-ema21', userId: 'e2e-user', catalogType: 'ema', label: 'EMA 21', params: '{"period":21,"color":"#00e676","lineWidth":1}', isCustom: false, createdAt: NOW, updatedAt: NOW },
  { id: 'ui-ema200', userId: 'e2e-user', catalogType: 'ema', label: 'EMA 200', params: '{"period":200,"color":"#607d8b","lineWidth":3}', isCustom: false, createdAt: NOW, updatedAt: NOW },
  { id: 'ui-rsi2', userId: 'e2e-user', catalogType: 'rsi', label: 'RSI 2', params: '{"period":2,"color":"#ef5350","lineWidth":1}', isCustom: false, createdAt: NOW, updatedAt: NOW },
  { id: 'ui-stoch14', userId: 'e2e-user', catalogType: 'stoch', label: 'Stoch 14', params: '{"period":14,"smoothK":3,"smoothD":3,"color":"#2196f3","lineWidth":1}', isCustom: false, createdAt: NOW, updatedAt: NOW },
  { id: 'ui-volume', userId: 'e2e-user', catalogType: 'volume', label: 'Volume', params: '{"color":"#607d8b"}', isCustom: false, createdAt: NOW, updatedAt: NOW },
  { id: 'ui-vp', userId: 'e2e-user', catalogType: 'volumeProfile', label: 'Volume Profile', params: '{"numBuckets":100,"maxBarWidth":120,"opacity":30}', isCustom: false, createdAt: NOW, updatedAt: NOW },
];

// Mirrors the v1.13.x default checklist (RSI 2 + Stoch 14 ladder across
// 1m..1d, LONG = oversold, SHORT = overbought). Weights match the formula
// in @marketmind/trading-core/checklistDefaults.ts.
const TF_WEIGHTS: Record<string, number> = { '1m': 0, '5m': 0.5, '15m': 1.0, '1h': 1.5, '4h': 2.0, '1d': 2.5 };
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
const buildChecklistConditions = () => {
  const conditions: Array<Record<string, unknown>> = [];
  let order = 0;
  for (const ind of [
    { uid: 'ui-rsi2', base: 2.0, oversold: 7, overbought: 93 },
    { uid: 'ui-stoch14', base: 1.0, oversold: undefined, overbought: undefined },
  ]) {
    for (const tf of TIMEFRAMES) {
      const weight = ind.base + (TF_WEIGHTS[tf] ?? 0);
      // ~70% of conditions enabled so the checklist panel renders a
      // mix of evaluated rows + a few greyed-out (visual variety).
      const enabled = (order % 4) !== 3;
      conditions.push({
        id: `cond-${order}-long`, userIndicatorId: ind.uid, timeframe: tf,
        op: 'oversold', threshold: ind.oversold, tier: 'preferred',
        side: 'LONG', weight, enabled, order: order++,
      });
      conditions.push({
        id: `cond-${order}-short`, userIndicatorId: ind.uid, timeframe: tf,
        op: 'overbought', threshold: ind.overbought, tier: 'preferred',
        side: 'SHORT', weight, enabled, order: order++,
      });
    }
  }
  return conditions;
};

const CHECKLIST_CONDITIONS = buildChecklistConditions();

// Synthetic evaluation result — each condition gets `evaluated: true` and
// a mock value/passed state so the panel paints check/X icons + numeric
// values instead of the empty-state placeholder.
const buildChecklistEvaluation = () => {
  const indicatorLabelByUid: Record<string, string> = {
    'ui-rsi2': 'RSI 2',
    'ui-stoch14': 'Stoch 14',
  };
  const catalogByUid: Record<string, string> = {
    'ui-rsi2': 'rsi',
    'ui-stoch14': 'stoch',
  };
  const results = CHECKLIST_CONDITIONS.map((c, i) => {
    const uid = c.userIndicatorId as string;
    const tf = c.timeframe as string;
    const side = c.side as string;
    // Synthetic value — RSI/Stoch oscillate 0-100. Bias toward
    // oversold readings on lower TFs (matching a "buy-the-dip" moment)
    // so the screenshot tells a story.
    const tfBias: Record<string, number> = { '1m': 25, '5m': 30, '15m': 38, '1h': 45, '4h': 60, '1d': 70 };
    const seed = (i * 13 + 7) % 100;
    const value = Math.max(2, Math.min(98, (tfBias[tf] ?? 50) + (seed - 50) * 0.4));
    // LONG passes when value < oversold (default 20 for RSI 14/Stoch,
    // 7 for RSI 2). SHORT passes when value > overbought (80 / 93).
    const oversold = (c.threshold as number | undefined) ?? 20;
    const overbought = c.op === 'overbought' ? ((c.threshold as number | undefined) ?? 80) : 80;
    const passed = c.op === 'oversold' ? value < oversold : value > overbought;
    return {
      conditionId: c.id,
      userIndicatorId: uid,
      indicatorLabel: indicatorLabelByUid[uid] ?? uid,
      catalogType: catalogByUid[uid] ?? 'rsi',
      timeframe: tf,
      resolvedTimeframe: tf,
      op: c.op,
      tier: c.tier,
      side,
      weight: c.weight,
      enabled: c.enabled,
      evaluated: !!c.enabled,
      passed: !!c.enabled && passed,
      value: Number(value.toFixed(2)),
      countedLong: side === 'LONG' || side === 'BOTH',
      countedShort: side === 'SHORT' || side === 'BOTH',
    };
  });

  const scoreFor = (sideFilter: 'LONG' | 'SHORT') => {
    const enabled = results.filter((r) => r.enabled && (r.side === sideFilter || r.side === 'BOTH'));
    const passed = enabled.filter((r) => r.passed);
    const wTotal = enabled.reduce((s, r) => s + (r.weight as number), 0);
    const wPassed = passed.reduce((s, r) => s + (r.weight as number), 0);
    return {
      requiredTotal: 0,
      requiredPassed: 0,
      requiredWeightTotal: 0,
      requiredWeightPassed: 0,
      requiredAllPassed: true,
      preferredTotal: enabled.length,
      preferredPassed: passed.length,
      preferredWeightTotal: wTotal,
      preferredWeightPassed: wPassed,
      score: wTotal > 0 ? Math.round((wPassed / wTotal) * 100) : 0,
    };
  };

  const scoreLong = scoreFor('LONG');
  const scoreShort = scoreFor('SHORT');
  return {
    results,
    score: scoreLong,
    scoreLong,
    scoreShort,
  };
};
const CHECKLIST_EVALUATION = buildChecklistEvaluation();

const TRADING_PROFILES = [
  {
    id: 'profile-1',
    userId: 'e2e-user',
    name: 'Default Profile',
    description: 'RSI 2 + Stoch 14 multi-timeframe ladder',
    isDefault: true,
    enabledSetupTypes: ['breakout-retest', 'golden-cross-sma', 'pin-inside-combo'],
    checklistConditions: CHECKLIST_CONDITIONS,
    riskPerTradePercent: '1.0',
    maxConcurrentPositions: 3,
    minRRLong: '1.8',
    minRRShort: '2.0',
    maxFibonacciEntryProgressPercentLong: '38.2',
    maxFibonacciEntryProgressPercentShort: '38.2',
    useTrendFilter: true,
    trendFilterEmaPeriod: 200,
    useFvgFilter: false,
    fvgFilterProximityPercent: '0.5',
    useTrailingStop: true,
    trailingStopAtrMultiplier: '2.5',
    createdAt: '2026-02-01T00:00:00.000Z',
    updatedAt: NOW,
  },
];

const ACTIVE_WATCHERS = [
  {
    watcherId: `${DEMO_WALLET.id}-BTCUSDT-1h`,
    symbol: 'BTCUSDT',
    interval: '1h',
    profileId: 'profile-1',
    profileName: 'Conservative Breakout',
    marketType: 'FUTURES' as const,
    isActive: true,
    lastUpdate: '2026-04-27T18:55:00.000Z',
    setupsDetected24h: 2,
  },
  {
    watcherId: `${DEMO_WALLET.id}-ETHUSDT-1h`,
    symbol: 'ETHUSDT',
    interval: '1h',
    profileId: 'profile-1',
    profileName: 'Conservative Breakout',
    marketType: 'FUTURES' as const,
    isActive: true,
    lastUpdate: '2026-04-27T18:50:00.000Z',
    setupsDetected24h: 1,
  },
  {
    watcherId: `${DEMO_WALLET.id}-SOLUSDT-30m`,
    symbol: 'SOLUSDT',
    interval: '30m',
    profileId: 'profile-1',
    profileName: 'Conservative Breakout',
    marketType: 'FUTURES' as const,
    isActive: true,
    lastUpdate: '2026-04-27T18:45:00.000Z',
    setupsDetected24h: 0,
  },
];

const WATCHER_STATUS = {
  active: true,
  watchers: ACTIVE_WATCHERS.length,
  activeWatchers: ACTIVE_WATCHERS,
  persistedWatchers: ACTIVE_WATCHERS.length,
};

const DAILY_TICKERS = [
  { symbol: 'BTCUSDT', priceChangePercent: '-2.27', lastPrice: '67450.5', volume: '125000' },
  { symbol: 'ETHUSDT', priceChangePercent: '1.42', lastPrice: '3478.2', volume: '480000' },
  { symbol: 'SOLUSDT', priceChangePercent: '-0.85', lastPrice: '171.4', volume: '2200000' },
  { symbol: 'BNBUSDT', priceChangePercent: '0.34', lastPrice: '618.9', volume: '95000' },
];

export interface Fixture {
  path: string;
  value: unknown;
}

const buildHistory = (count: number, base: number, jitter: number): Array<{ timestamp: string; value: number }> => {
  const now = Date.now();
  const dayMs = 86_400_000;
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(now - (count - i) * dayMs).toISOString(),
    value: base + (Math.sin(i / 3) * jitter),
  }));
};

const MARKET_INDICATORS = {
  fearGreed: {
    current: { value: 62, valueClassification: 'Greed' },
    history: buildHistory(30, 60, 12),
  },
  btcDominance: {
    current: 56.4,
    change24h: 0.42,
    history: buildHistory(30, 56, 1.5),
  },
  mvrv: {
    current: 2.1,
    history: buildHistory(30, 2.0, 0.2),
  },
  btcProductionCost: {
    currentCost: 41_500,
    currentPrice: 67_450,
    history: buildHistory(30, 67_000, 1_200),
  },
  openInterest: {
    current: 28_400_000_000,
    change24h: 1.24,
    history: buildHistory(30, 28_000_000_000, 600_000_000),
  },
  longShortRatio: {
    global: { longAccount: 0.58, shortAccount: 0.42 },
    topTraders: { longAccount: 0.61, shortAccount: 0.39 },
    globalHistory: buildHistory(30, 0.58, 0.05),
  },
  altcoinSeason: {
    seasonType: 'Bitcoin Season',
    altSeasonIndex: 38,
    change24h: -2.1,
    altsOutperformingBtc: 19,
    totalAltsAnalyzed: 50,
    btcPerformance24h: 1.4,
    topPerformers: [
      { symbol: 'SOLUSDT', performance: 4.8 },
      { symbol: 'ETHUSDT', performance: 1.4 },
      { symbol: 'BNBUSDT', performance: 0.3 },
    ],
    history: buildHistory(30, 38, 8),
  },
  adxTrendStrength: {
    adx: 26.4,
    isChoppy: false,
    isStrongTrend: true,
    change24h: 0.6,
    plusDI: 22.1,
    minusDI: 14.7,
    isBullish: true,
    isBearish: false,
    history: buildHistory(30, 25, 4),
  },
  orderBook: {
    pressure: 'Buy',
    imbalanceRatio: 1.18,
    bidVolume: 48_500_000,
    askVolume: 41_200_000,
    spreadPercent: 0.012,
    bidWalls: [],
    askWalls: [],
  },
  fundingRates: [
    { symbol: 'BTCUSDT', rate: 0.0001, isExtreme: false },
    { symbol: 'ETHUSDT', rate: 0.00012, isExtreme: false },
    { symbol: 'SOLUSDT', rate: 0.00031, isExtreme: false },
    { symbol: 'BNBUSDT', rate: 0.00008, isExtreme: false },
  ],
};

export const VISUAL_REVIEW_FIXTURES: Fixture[] = [
  // Auth
  { path: 'auth.me', value: SYNTHETIC_USER },
  { path: 'auth.getAvatar', value: null },
  { path: 'auth.listSessions', value: [
      {
        id: 'session-current',
        createdAt: '2026-04-25T10:00:00.000Z',
        expiresAt: '2026-05-25T10:00:00.000Z',
        userAgent: 'Chrome on macOS',
        ip: '192.168.1.10',
        isCurrent: true,
      },
    ],
  },
  // Wallets
  { path: 'wallet.list', value: [DEMO_WALLET, PAPER_BTC_WALLET] },
  { path: 'wallet.listActive', value: [DEMO_WALLET, PAPER_BTC_WALLET] },
  // Trading
  { path: 'trading.getOrders', value: [] },
  { path: 'trading.getPositions', value: OPEN_EXECUTIONS },
  { path: 'trading.getTradeExecutions', value: ALL_EXECUTIONS },
  { path: 'trading.evaluateChecklist', value: CHECKLIST_EVALUATION },
  { path: 'trading.getTickerPrices', value: Object.fromEntries(DAILY_TICKERS.map((t) => [t.symbol, t.lastPrice])) },
  { path: 'futuresTrading.getOpenOrders', value: [] },
  { path: 'futuresTrading.getOpenAlgoOrders', value: [] },
  { path: 'futuresTrading.getOpenDbOrderIds', value: [] },
  // Auto-trading
  { path: 'autoTrading.getConfig', value: {
      walletId: DEMO_WALLET.id,
      isEnabled: true,
      enabledSetupTypes: ['breakout-retest', 'golden-cross-sma'],
      maxConcurrentPositions: 3,
      riskPerTradePercent: '1.0',
      activeProfileId: 'profile-1',
    },
  },
  { path: 'autoTrading.getActiveExecutions', value: [] },
  { path: 'autoTrading.getExecutionHistory', value: TRADE_EXECUTIONS.slice(0, 5) },
  { path: 'autoTrading.getRecentLogs', value: [
      { id: 1, level: 'info', message: 'Watcher BTCUSDT 1h started', createdAt: '2026-04-27T18:55:00.000Z' },
      { id: 2, level: 'info', message: 'Setup detected: breakout-retest on BTCUSDT', createdAt: '2026-04-27T18:50:00.000Z' },
      { id: 3, level: 'info', message: 'Skipped: trend filter (EMA200) blocked counter-trend entry', createdAt: '2026-04-27T18:45:00.000Z' },
    ],
  },
  { path: 'autoTrading.getWatcherStatus', value: WATCHER_STATUS },
  // Analytics
  { path: 'analytics.getPerformance', value: PERFORMANCE_SUMMARY },
  { path: 'analytics.getEquityCurve', value: EQUITY_POINTS },
  { path: 'analytics.getDailyPerformance', value: DAILY_PERFORMANCE },
  { path: 'analytics.getTradeStats', value: PERFORMANCE_SUMMARY },
  // Misc
  { path: 'ticker.getDailyBatch', value: DAILY_TICKERS },
  { path: 'customSymbol.list', value: [] },
  { path: 'userIndicators.list', value: USER_INDICATORS },
  // Special path: dispatched by the trpcMock to return klines per
  // (symbol, interval) when the renderer calls `kline.list`.
  {
    path: '_klineMap',
    value: {
      'BTCUSDT:1m': SYNTHETIC_KLINES.BTCUSDT['1m'],
      'BTCUSDT:5m': SYNTHETIC_KLINES.BTCUSDT['5m'],
      'BTCUSDT:15m': SYNTHETIC_KLINES.BTCUSDT['15m'],
      'BTCUSDT:1h': SYNTHETIC_KLINES.BTCUSDT['1h'],
      'BTCUSDT:4h': SYNTHETIC_KLINES.BTCUSDT['4h'],
      'BTCUSDT:1d': SYNTHETIC_KLINES.BTCUSDT['1d'],
      'ETHUSDT:1m': SYNTHETIC_KLINES.ETHUSDT['1m'],
      'ETHUSDT:5m': SYNTHETIC_KLINES.ETHUSDT['5m'],
      'ETHUSDT:15m': SYNTHETIC_KLINES.ETHUSDT['15m'],
      'ETHUSDT:1h': SYNTHETIC_KLINES.ETHUSDT['1h'],
      'ETHUSDT:4h': SYNTHETIC_KLINES.ETHUSDT['4h'],
      'ETHUSDT:1d': SYNTHETIC_KLINES.ETHUSDT['1d'],
      'SOLUSDT:1m': SYNTHETIC_KLINES.SOLUSDT['1m'],
      'SOLUSDT:5m': SYNTHETIC_KLINES.SOLUSDT['5m'],
      'SOLUSDT:15m': SYNTHETIC_KLINES.SOLUSDT['15m'],
      'SOLUSDT:1h': SYNTHETIC_KLINES.SOLUSDT['1h'],
      'SOLUSDT:4h': SYNTHETIC_KLINES.SOLUSDT['4h'],
      'SOLUSDT:1d': SYNTHETIC_KLINES.SOLUSDT['1d'],
    },
  },
  { path: 'setup.getConfig', value: null },
  { path: 'signalSuggestions.list', value: [] },
  { path: 'preferences.getByCategory', value: [] },
  { path: 'preferences.getAll', value: [] },
  { path: 'drawing.list', value: [] },
  // The user's full saved layouts (9 presets: 6 trading multi-tf
   // variants + Auto-Trading + Auto-Scalping + Market Indicators).
   // Cloned from local DB; lets the marketing-screenshots script switch
   // between presets via `setActiveLayout(tabId, presetId)`. The
   // `layout.get` router parses `data` server-side and returns the
   // already-unwrapped state — fixture mirrors that.
  { path: 'layout.get', value: LAYOUT_FIXTURE },
  { path: 'screener.getPresets', value: [] },
  { path: 'screener.getSavedScreeners', value: [] },
  { path: 'fees.getUserFees', value: null },
  { path: 'orderSync.getStatus', value: { lastSyncAt: '2026-04-27T18:30:00.000Z', isRunning: false } },
  { path: 'heatmap.getAlwaysCollectSymbols', value: [] },
  // Trading profiles + watchers
  { path: 'tradingProfiles.list', value: TRADING_PROFILES },
  { path: 'tradingProfiles.getDefault', value: TRADING_PROFILES[0] },
  { path: 'autoTrading.listWatchers', value: ACTIVE_WATCHERS },
  // Market sidebar indicators
  { path: 'autoTrading.getMinActiveWatcherInterval', value: { halfIntervalMs: 30 * 60 * 1000 } },
  { path: 'autoTrading.getFearGreedIndex', value: MARKET_INDICATORS.fearGreed },
  { path: 'autoTrading.getBtcDominance', value: MARKET_INDICATORS.btcDominance },
  { path: 'autoTrading.getMvrvRatio', value: MARKET_INDICATORS.mvrv },
  { path: 'autoTrading.getBtcProductionCost', value: MARKET_INDICATORS.btcProductionCost },
  { path: 'autoTrading.getOpenInterest', value: MARKET_INDICATORS.openInterest },
  { path: 'autoTrading.getLongShortRatio', value: MARKET_INDICATORS.longShortRatio },
  { path: 'autoTrading.getAltcoinSeasonIndex', value: MARKET_INDICATORS.altcoinSeason },
  { path: 'autoTrading.getBtcAdxTrendStrength', value: MARKET_INDICATORS.adxTrendStrength },
  { path: 'autoTrading.getOrderBookAnalysis', value: MARKET_INDICATORS.orderBook },
  { path: 'autoTrading.getBatchFundingRates', value: MARKET_INDICATORS.fundingRates },
  // Auth mutations (acks)
  { path: 'auth.changePassword', value: { success: true } },
  { path: 'auth.uploadAvatar', value: { success: true } },
  { path: 'auth.deleteAvatar', value: { success: true } },
  { path: 'auth.updateProfile', value: { success: true } },
  { path: 'auth.revokeSession', value: { success: true } },
  { path: 'auth.revokeAllOtherSessions', value: { success: true } },
  { path: 'auth.resendVerificationEmail', value: { success: true } },
  { path: 'auth.toggleTwoFactor', value: { success: true, enabled: true } },
];
