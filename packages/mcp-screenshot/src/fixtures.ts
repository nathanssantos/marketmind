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
    id: 'watcher-1',
    userId: 'e2e-user',
    walletId: DEMO_WALLET.id,
    symbol: 'BTCUSDT',
    interval: '1h',
    profileId: 'profile-1',
    marketType: 'FUTURES',
    isActive: true,
    createdAt: '2026-04-20T00:00:00.000Z',
    lastSetupAt: '2026-04-26T15:30:00.000Z',
    setupCount24h: 2,
  },
  {
    id: 'watcher-2',
    userId: 'e2e-user',
    walletId: DEMO_WALLET.id,
    symbol: 'ETHUSDT',
    interval: '1h',
    profileId: 'profile-1',
    marketType: 'FUTURES',
    isActive: true,
    createdAt: '2026-04-22T00:00:00.000Z',
    lastSetupAt: '2026-04-27T12:00:00.000Z',
    setupCount24h: 1,
  },
  {
    id: 'watcher-3',
    userId: 'e2e-user',
    walletId: DEMO_WALLET.id,
    symbol: 'SOLUSDT',
    interval: '30m',
    profileId: 'profile-1',
    marketType: 'FUTURES',
    isActive: true,
    createdAt: '2026-04-25T00:00:00.000Z',
    lastSetupAt: null,
    setupCount24h: 0,
  },
];

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
  { path: 'autoTrading.getWatcherStatus', value: ACTIVE_WATCHERS },
  // Analytics
  { path: 'analytics.getPerformance', value: PERFORMANCE_SUMMARY },
  { path: 'analytics.getEquityCurve', value: EQUITY_POINTS },
  // analytics.getDailyPerformance — empty array to surface "no data" state cleanly.
  // TODO: align with the full DailyPerformance shape (pnlPercent, tradesCount,
  // wins, losses, grossProfit, grossLoss) once the renderer's null-safety is
  // verified in Phase 6.2.
  { path: 'analytics.getDailyPerformance', value: [] },
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
