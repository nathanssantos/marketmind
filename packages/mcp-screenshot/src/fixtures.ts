/**
 * Default fixtures for visual review captures. Mirrors the shape of the
 * production tRPC procedures so the renderer renders populated states.
 *
 * These are intentionally generous (5 wallets, ~12 closed executions, an
 * auto-trading config) — Phase 6 needs the screens to look like a real user
 * day, not a fresh install.
 */

const NOW = '2026-04-27T19:00:00.000Z';

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

const TRADING_PROFILES = [
  {
    id: 'profile-1',
    userId: 'e2e-user',
    name: 'Conservative Breakout',
    description: 'Long-only, 1% risk, EMA200 trend filter',
    isDefault: true,
    enabledSetupTypes: ['breakout-retest', 'golden-cross-sma', 'pin-inside-combo'],
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
  { path: 'trading.getPositions', value: [] },
  { path: 'trading.getTradeExecutions', value: TRADE_EXECUTIONS },
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
  { path: 'userIndicators.list', value: [] },
  { path: 'setup.getConfig', value: null },
  { path: 'signalSuggestions.list', value: [] },
  { path: 'preferences.getByCategory', value: [] },
  { path: 'preferences.getAll', value: [] },
  { path: 'drawing.list', value: [] },
  { path: 'layout.get', value: null },
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
