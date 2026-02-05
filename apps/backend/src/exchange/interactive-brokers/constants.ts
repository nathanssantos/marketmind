import type { MarketHours } from '../types';

export const IB_PORTS = {
  TWS_LIVE: 7496,
  TWS_PAPER: 7497,
  GATEWAY_LIVE: 4001,
  GATEWAY_PAPER: 4002,
} as const;

export const IB_DEFAULT_HOST = '127.0.0.1';
export const IB_DEFAULT_CLIENT_ID = 1;
export const IB_CONNECTION_TIMEOUT_MS = 5000;
export const IB_RECONNECT_DELAY_MS = 5000;
export const IB_MAX_RECONNECT_ATTEMPTS = 5;

export const IB_RATE_LIMITS = {
  GLOBAL_REQUESTS_PER_10_MIN: 58,
  GLOBAL_WINDOW_MS: 600_000,
  PER_CONTRACT_REQUESTS_PER_2_SEC: 5,
  PER_CONTRACT_WINDOW_MS: 2_000,
  MAX_CONCURRENT_REQUESTS: 45,
  PACING_VIOLATION_DELAY_MS: 15_000,
  IDENTICAL_REQUEST_COOLDOWN_MS: 15_000,
} as const;

export const IB_ACCOUNT_SUMMARY_TAGS = [
  'NetLiquidation',
  'BuyingPower',
  'AvailableFunds',
  'ExcessLiquidity',
  'InitMarginReq',
  'MaintMarginReq',
  'EquityWithLoanValue',
  'GrossPositionValue',
  'SMA',
  'Leverage',
  'Cushion',
  'DayTradesRemaining',
  'FullInitMarginReq',
  'FullMaintMarginReq',
  'FullAvailableFunds',
  'FullExcessLiquidity',
] as const;

export const IB_ORDER_TYPES = {
  MARKET: 'MKT',
  LIMIT: 'LMT',
  STOP: 'STP',
  STOP_LIMIT: 'STP LMT',
  TRAILING_STOP: 'TRAIL',
  TRAILING_STOP_LIMIT: 'TRAIL LIMIT',
} as const;

export const IB_ORDER_ACTIONS = {
  BUY: 'BUY',
  SELL: 'SELL',
  SSHORT: 'SSHORT',
} as const;

export const IB_TIME_IN_FORCE = {
  DAY: 'DAY',
  GTC: 'GTC',
  IOC: 'IOC',
  FOK: 'FOK',
  OPG: 'OPG',
  GTD: 'GTD',
  DTC: 'DTC',
} as const;

export const IB_BAR_SIZES = {
  '1m': '1 min',
  '5m': '5 mins',
  '15m': '15 mins',
  '30m': '30 mins',
  '1h': '1 hour',
  '2h': '2 hours',
  '4h': '4 hours',
  '1d': '1 day',
  '1w': '1 week',
  '1M': '1 month',
} as const;

export const IB_OPTIMAL_DURATION = {
  '1m': '1 D',
  '5m': '1 W',
  '15m': '2 W',
  '30m': '1 M',
  '1h': '1 M',
  '4h': '1 Y',
  '1d': '1 Y',
  '1w': '5 Y',
} as const;

export const IB_BARS_PER_REQUEST = {
  '1m': 390,
  '5m': 1950,
  '15m': 1300,
  '30m': 520,
  '1h': 168,
  '4h': 504,
  '1d': 252,
  '1w': 260,
} as const;

export const US_STOCK_MARKET_HOURS: MarketHours = {
  timezone: 'America/New_York',
  is24h: false,
  sessions: [
    { open: '04:00', close: '09:30' },
    { open: '09:30', close: '16:00' },
    { open: '16:00', close: '20:00' },
  ],
};

export const US_MARKET_REGULAR_SESSION = {
  open: '09:30',
  close: '16:00',
} as const;

export const US_MARKET_EXTENDED_HOURS = {
  preMarket: { open: '04:00', close: '09:30' },
  afterHours: { open: '16:00', close: '20:00' },
} as const;

export const NYSE_HOLIDAYS_2025 = [
  new Date('2025-01-01'),
  new Date('2025-01-20'),
  new Date('2025-02-17'),
  new Date('2025-04-18'),
  new Date('2025-05-26'),
  new Date('2025-06-19'),
  new Date('2025-07-04'),
  new Date('2025-09-01'),
  new Date('2025-11-27'),
  new Date('2025-12-25'),
] as const;

export const NYSE_EARLY_CLOSES_2025 = new Map([
  ['2025-07-03', '13:00'],
  ['2025-11-28', '13:00'],
  ['2025-12-24', '13:00'],
]);

export const IB_SHORTABILITY_THRESHOLDS = {
  UNAVAILABLE: 1.5,
  HARD_TO_BORROW: 2.5,
} as const;

export const IB_MARGIN_REQUIREMENTS = {
  INITIAL_MARGIN_LONG: 0.5,
  MAINTENANCE_MARGIN_LONG: 0.25,
  INITIAL_MARGIN_SHORT: 0.5,
  MAINTENANCE_MARGIN_SHORT: 0.3,
  DAY_TRADING_MARGIN: 0.25,
  PDT_MINIMUM_EQUITY: 25_000,
} as const;

export const IB_COMMISSION_RATES = {
  TIERED: {
    TIER_1: { maxShares: 300_000, rate: 0.0035, minCommission: 0.35 },
    TIER_2: { maxShares: 3_000_000, rate: 0.002 },
    TIER_3: { maxShares: 20_000_000, rate: 0.0015 },
    TIER_4: { rate: 0.0005 },
  },
  LITE: {
    US_STOCKS: 0,
  },
} as const;

export const IB_GENERIC_TICK_TYPES = {
  SHORTABLE_SHARES: 236,
  NEWS: 292,
  FUNDAMENTAL_RATIOS: 258,
} as const;
