import { hash } from '@node-rs/argon2';
import { FILTER_DEFAULTS } from '@marketmind/types';
import * as schema from '../../db/schema';
import { generateEntityId, generateSessionId } from '../../utils/id';
import { getTestDatabase } from './test-db';

type User = typeof schema.users.$inferSelect;
type Session = typeof schema.sessions.$inferSelect;
type Wallet = typeof schema.wallets.$inferSelect;
type TradingProfile = typeof schema.tradingProfiles.$inferSelect;
type TradeExecution = typeof schema.tradeExecutions.$inferSelect;
type ActiveWatcher = typeof schema.activeWatchers.$inferSelect;
type Kline = typeof schema.klines.$inferSelect;
type SetupDetection = typeof schema.setupDetections.$inferSelect;
type Order = typeof schema.orders.$inferSelect;
type AutoTradingConfig = typeof schema.autoTradingConfig.$inferSelect;

export interface CreateUserOptions {
  email?: string;
  password?: string;
}

export interface CreateWalletOptions {
  userId: string;
  name?: string;
  walletType?: 'live' | 'testnet' | 'paper';
  initialBalance?: string;
  currency?: string;
  apiKey?: string;
  apiSecret?: string;
}

export interface CreateTradingProfileOptions {
  userId: string;
  name?: string;
  enabledSetupTypes?: string[];
  maxPositionSize?: string | null;
  maxConcurrentPositions?: number | null;
  isDefault?: boolean;
}

export interface CreateSessionOptions {
  userId: string;
  expiresAt?: Date;
}

export interface CreateTradeExecutionOptions {
  userId: string;
  walletId: string;
  symbol?: string;
  side?: 'LONG' | 'SHORT';
  entryPrice?: string;
  quantity?: string;
  stopLoss?: string | null;
  stopLossAlgoId?: number | null;
  stopLossOrderId?: number | null;
  takeProfit?: string | null;
  takeProfitAlgoId?: number | null;
  takeProfitOrderId?: number | null;
  status?: 'pending' | 'open' | 'closed' | 'cancelled';
  setupType?: string;
  marketType?: 'SPOT' | 'FUTURES';
  leverage?: number;
}

export interface CreateActiveWatcherOptions {
  userId: string;
  walletId: string;
  profileId?: string;
  symbol?: string;
  interval?: string;
  marketType?: 'SPOT' | 'FUTURES';
  isManual?: boolean;
}

export interface CreateKlinesOptions {
  symbol?: string;
  interval?: string;
  marketType?: 'SPOT' | 'FUTURES';
  count?: number;
  startTime?: Date;
  basePrice?: number;
}

export interface CreateSetupDetectionOptions {
  userId: string;
  symbol?: string;
  interval?: string;
  setupType?: string;
  direction?: 'LONG' | 'SHORT';
  entryPrice?: string;
  stopLoss?: string;
  takeProfit?: string;
  confidence?: number;
  expiresAt?: Date;
}

export interface CreateOrderOptions {
  userId: string;
  walletId: string;
  orderId?: number;
  symbol?: string;
  side?: 'BUY' | 'SELL';
  type?: string;
  price?: string;
  origQty?: string;
  executedQty?: string;
  status?: string;
  marketType?: 'SPOT' | 'FUTURES';
}

export interface CreateAutoTradingConfigOptions {
  userId: string;
  walletId: string;
  isEnabled?: boolean;
  maxConcurrentPositions?: number;
  maxPositionSize?: string;
  dailyLossLimit?: string;
  enabledSetupTypes?: string[];
  leverage?: number;
  marginType?: 'ISOLATED' | 'CROSSED';
}

export const DEFAULT_PYRAMID_CONFIG = {
  pyramidingEnabled: false,
  pyramidingMode: 'static' as const,
  maxPyramidEntries: 3,
  pyramidProfitThreshold: '0.01',
  pyramidScaleFactor: '0.8',
  pyramidMinDistance: '0.005',
  pyramidUseAtr: false,
  pyramidUseAdx: false,
  pyramidUseRsi: false,
  pyramidAdxThreshold: 25,
  pyramidRsiLowerBound: 30,
  pyramidRsiUpperBound: 70,
  pyramidFiboLevels: '["1","1.618"]',
  leverageAwarePyramid: true,
  useDirectionFilter: false,
  enableLongInBearMarket: false,
  enableShortInBullMarket: false,
};

export const DEFAULT_TRAILING_STOP_USER_CONFIG = {
  trailingActivationPercentLong: '1.0',
  trailingActivationPercentShort: '0.886',
  trailingDistancePercent: '0.4',
  useAdaptiveTrailing: true,
};

export const DEFAULT_VOLUME_FILTER_CONFIG = {
  volumeFilterObvLookbackLong: FILTER_DEFAULTS.volumeFilterObvLookbackLong,
  volumeFilterObvLookbackShort: FILTER_DEFAULTS.volumeFilterObvLookbackShort,
  useObvCheckLong: FILTER_DEFAULTS.useObvCheckLong,
  useObvCheckShort: FILTER_DEFAULTS.useObvCheckShort,
};

export const DEFAULT_ADDITIONAL_FILTERS_CONFIG = {
  useChoppinessFilter: false,
  choppinessThresholdHigh: '61.80',
  choppinessThresholdLow: '38.20',
  choppinessPeriod: 14,
  useSessionFilter: false,
  sessionStartUtc: 13,
  sessionEndUtc: 16,
  useBollingerSqueezeFilter: false,
  bollingerSqueezeThreshold: '0.100',
  bollingerSqueezePeriod: 20,
  bollingerSqueezeStdDev: '2.00',
  useVwapFilter: false,
  useSuperTrendFilter: false,
  superTrendPeriod: 10,
  superTrendMultiplier: '3.00',
};

export const DEFAULT_AUTO_TRADING_CONFIG_EXTRAS = {
  ...DEFAULT_PYRAMID_CONFIG,
  ...DEFAULT_TRAILING_STOP_USER_CONFIG,
  ...DEFAULT_VOLUME_FILTER_CONFIG,
  ...DEFAULT_ADDITIONAL_FILTERS_CONFIG,
};

const hashPassword = async (password: string): Promise<string> => {
  return hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });
};

export const createTestUser = async (options: CreateUserOptions = {}): Promise<{ user: User; password: string }> => {
  const db = getTestDatabase();
  const {
    email = `test-${Date.now()}@example.com`,
    password = 'Test123!@#',
  } = options;

  const userId = generateEntityId();
  const passwordHash = await hashPassword(password);

  const [user] = await db.insert(schema.users).values({
    id: userId,
    email,
    passwordHash,
  }).returning();

  if (!user) throw new Error('Failed to create test user');

  return { user, password };
};

export const createTestSession = async (options: CreateSessionOptions): Promise<Session> => {
  const db = getTestDatabase();
  const {
    userId,
    expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  } = options;

  const sessionId = generateSessionId();

  const [session] = await db.insert(schema.sessions).values({
    id: sessionId,
    userId,
    expiresAt,
  }).returning();

  if (!session) throw new Error('Failed to create test session');

  return session;
};

export const createTestWallet = async (options: CreateWalletOptions): Promise<Wallet> => {
  const db = getTestDatabase();
  const {
    userId,
    name = 'Test Wallet',
    walletType = 'paper',
    initialBalance = '10000',
    currency = 'USDT',
    apiKey = 'paper-trading',
    apiSecret = 'paper-trading',
  } = options;

  const walletId = generateEntityId();

  const [wallet] = await db.insert(schema.wallets).values({
    id: walletId,
    userId,
    name,
    walletType,
    apiKeyEncrypted: apiKey,
    apiSecretEncrypted: apiSecret,
    initialBalance,
    currentBalance: initialBalance,
    currency,
    isActive: true,
  }).returning();

  if (!wallet) throw new Error('Failed to create test wallet');

  return wallet;
};

export const createTestTradingProfile = async (options: CreateTradingProfileOptions): Promise<TradingProfile> => {
  const db = getTestDatabase();
  const {
    userId,
    name = 'Test Profile',
    enabledSetupTypes = ['larry-williams-9.1'],
    maxPositionSize = null,
    maxConcurrentPositions = null,
    isDefault = false,
  } = options;

  const profileId = generateEntityId();

  const [profile] = await db.insert(schema.tradingProfiles).values({
    id: profileId,
    userId,
    name,
    enabledSetupTypes: JSON.stringify(enabledSetupTypes),
    maxPositionSize,
    maxConcurrentPositions,
    isDefault,
  }).returning();

  if (!profile) throw new Error('Failed to create test trading profile');

  return profile;
};

export const createAuthenticatedUser = async (options: CreateUserOptions = {}): Promise<{ user: User; password: string; session: Session }> => {
  const { user, password } = await createTestUser(options);
  const session = await createTestSession({ userId: user.id });

  return { user, password, session };
};

export const createTestOrder = async (options: CreateOrderOptions): Promise<Order> => {
  const db = getTestDatabase();
  const {
    userId,
    walletId,
    orderId = Date.now(),
    symbol = 'BTCUSDT',
    side = 'BUY',
    type = 'MARKET',
    price = '50000',
    origQty = '0.01',
    executedQty = '0.01',
    status = 'FILLED',
    marketType = 'SPOT',
  } = options;

  const [order] = await db.insert(schema.orders).values({
    orderId,
    userId,
    walletId,
    symbol,
    side,
    type,
    price,
    origQty,
    executedQty,
    status,
    marketType,
    time: Date.now(),
    updateTime: Date.now(),
  }).returning();

  if (!order) throw new Error('Failed to create test order');

  return order;
};

export const createTestTradeExecution = async (options: CreateTradeExecutionOptions): Promise<TradeExecution> => {
  const db = getTestDatabase();
  const {
    userId,
    walletId,
    symbol = 'BTCUSDT',
    side = 'LONG',
    entryPrice = '50000',
    quantity = '0.01',
    stopLoss,
    stopLossAlgoId,
    stopLossOrderId,
    takeProfit,
    takeProfitAlgoId,
    takeProfitOrderId,
    status = 'open',
    setupType = 'larry-williams-9.1',
    marketType = 'SPOT',
    leverage = 1,
  } = options;

  const executionId = generateEntityId();

  const [execution] = await db.insert(schema.tradeExecutions).values({
    id: executionId,
    userId,
    walletId,
    symbol,
    side,
    entryPrice,
    quantity,
    stopLoss: stopLoss ?? null,
    stopLossAlgoId: stopLossAlgoId ?? null,
    stopLossOrderId: stopLossOrderId ?? null,
    takeProfit: takeProfit ?? null,
    takeProfitAlgoId: takeProfitAlgoId ?? null,
    takeProfitOrderId: takeProfitOrderId ?? null,
    status,
    setupType,
    marketType,
    leverage,
    openedAt: new Date(),
  }).returning();

  if (!execution) throw new Error('Failed to create test trade execution');

  return execution;
};

export const createTestActiveWatcher = async (options: CreateActiveWatcherOptions): Promise<ActiveWatcher> => {
  const db = getTestDatabase();
  const {
    userId,
    walletId,
    profileId,
    symbol = 'BTCUSDT',
    interval = '1h',
    marketType = 'SPOT',
    isManual = true,
  } = options;

  const watcherId = generateEntityId();

  const [watcher] = await db.insert(schema.activeWatchers).values({
    id: watcherId,
    userId,
    walletId,
    profileId,
    symbol,
    interval,
    marketType,
    isManual,
    startedAt: new Date(),
  }).returning();

  if (!watcher) throw new Error('Failed to create test active watcher');

  return watcher;
};

export const createTestKlines = async (options: CreateKlinesOptions = {}): Promise<Kline[]> => {
  const db = getTestDatabase();
  const {
    symbol = 'BTCUSDT',
    interval = '1h',
    marketType = 'SPOT',
    count = 100,
    startTime = new Date(Date.now() - count * 60 * 60 * 1000),
    basePrice = 50000,
  } = options;

  const klines: Kline[] = [];
  const intervalMs = getIntervalMs(interval);

  for (let i = 0; i < count; i++) {
    const openTime = new Date(startTime.getTime() + i * intervalMs);
    const closeTime = new Date(openTime.getTime() + intervalMs - 1);

    const volatility = 0.02;
    const change = (Math.random() - 0.5) * 2 * volatility;
    const open = basePrice * (1 + change);
    const close = open * (1 + (Math.random() - 0.5) * volatility);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
    const volume = 100 + Math.random() * 900;

    const [kline] = await db.insert(schema.klines).values({
      symbol,
      interval,
      marketType,
      openTime,
      closeTime,
      open: open.toFixed(8),
      high: high.toFixed(8),
      low: low.toFixed(8),
      close: close.toFixed(8),
      volume: volume.toFixed(8),
      quoteVolume: (volume * close).toFixed(8),
      trades: Math.floor(100 + Math.random() * 500),
      takerBuyBaseVolume: (volume * 0.5).toFixed(8),
      takerBuyQuoteVolume: (volume * close * 0.5).toFixed(8),
    }).returning();

    if (kline) klines.push(kline);
  }

  return klines;
};

export const createTestSetupDetection = async (options: CreateSetupDetectionOptions): Promise<SetupDetection> => {
  const db = getTestDatabase();
  const {
    userId,
    symbol = 'BTCUSDT',
    interval = '1h',
    setupType = 'larry-williams-9.1',
    direction = 'LONG',
    entryPrice = '50000',
    stopLoss = '49000',
    takeProfit = '52000',
    confidence = 75,
    expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000),
  } = options;

  const detectionId = generateEntityId();

  const [detection] = await db.insert(schema.setupDetections).values({
    id: detectionId,
    userId,
    symbol,
    interval,
    setupType,
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    confidence,
    expiresAt,
    riskReward: '2.00',
    detectedAt: new Date(),
  }).returning();

  if (!detection) throw new Error('Failed to create test setup detection');

  return detection;
};

export const createTestAutoTradingConfig = async (options: CreateAutoTradingConfigOptions): Promise<AutoTradingConfig> => {
  const db = getTestDatabase();
  const {
    userId,
    walletId,
    isEnabled = false,
    maxConcurrentPositions = 5,
    maxPositionSize = '15',
    dailyLossLimit = '5',
    enabledSetupTypes = ['larry-williams-9.1'],
    leverage = 1,
    marginType = 'ISOLATED',
  } = options;

  const configId = generateEntityId();

  const [config] = await db.insert(schema.autoTradingConfig).values({
    id: configId,
    userId,
    walletId,
    isEnabled,
    maxConcurrentPositions,
    maxPositionSize,
    dailyLossLimit,
    enabledSetupTypes: JSON.stringify(enabledSetupTypes),
    leverage,
    marginType,
  }).returning();

  if (!config) throw new Error('Failed to create test auto trading config');

  return config;
};

const getIntervalMs = (interval: string): number => {
  const units: Record<string, number> = {
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match) return 60 * 60 * 1000;

  const value = parseInt(match[1] ?? '1', 10);
  const unit = match[2] ?? 'h';
  return value * (units[unit] ?? 60 * 60 * 1000);
};
