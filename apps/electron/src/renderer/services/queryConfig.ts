import type { QueryObserverOptions } from '@tanstack/react-query';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const QUERY_STALE_TIMES = {
  REAL_TIME: 30 * SECOND,
  SHORT: 1 * MINUTE,
  MEDIUM: 5 * MINUTE,
  LONG: 10 * MINUTE,
  VERY_LONG: 30 * MINUTE,
  STATIC: 1 * HOUR,
} as const;

export const QUERY_GC_TIMES = {
  SHORT: 1 * MINUTE,
  MEDIUM: 5 * MINUTE,
  LONG: 30 * MINUTE,
  VERY_LONG: 1 * HOUR,
  PERSISTENT: 24 * HOUR,
} as const;

export type QueryConfigKey =
  | 'klines'
  | 'klinesLatest'
  | 'wallets'
  | 'tradingProfiles'
  | 'autoTradingConfig'
  | 'tradeExecutions'
  | 'positions'
  | 'orders'
  | 'priceCache'
  | 'setupDetections'
  | 'analytics'
  | 'exchangeInfo'
  | 'default';

export interface QueryConfigOptions {
  staleTime: number;
  gcTime: number;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number | false;
}

export const QUERY_CONFIGS: Record<QueryConfigKey, QueryConfigOptions> = {
  klines: {
    staleTime: QUERY_STALE_TIMES.SHORT,
    gcTime: QUERY_GC_TIMES.MEDIUM,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  klinesLatest: {
    staleTime: QUERY_STALE_TIMES.REAL_TIME,
    gcTime: QUERY_GC_TIMES.SHORT,
    refetchOnWindowFocus: false,
    refetchInterval: 30 * SECOND,
  },

  wallets: {
    staleTime: QUERY_STALE_TIMES.MEDIUM,
    gcTime: QUERY_GC_TIMES.LONG,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  tradingProfiles: {
    staleTime: QUERY_STALE_TIMES.LONG,
    gcTime: QUERY_GC_TIMES.VERY_LONG,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  autoTradingConfig: {
    staleTime: QUERY_STALE_TIMES.MEDIUM,
    gcTime: QUERY_GC_TIMES.LONG,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  tradeExecutions: {
    staleTime: QUERY_STALE_TIMES.REAL_TIME,
    gcTime: QUERY_GC_TIMES.MEDIUM,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  positions: {
    staleTime: QUERY_STALE_TIMES.REAL_TIME,
    gcTime: QUERY_GC_TIMES.SHORT,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  orders: {
    staleTime: QUERY_STALE_TIMES.REAL_TIME,
    gcTime: QUERY_GC_TIMES.MEDIUM,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  priceCache: {
    staleTime: QUERY_STALE_TIMES.REAL_TIME,
    gcTime: QUERY_GC_TIMES.SHORT,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  setupDetections: {
    staleTime: QUERY_STALE_TIMES.MEDIUM,
    gcTime: QUERY_GC_TIMES.LONG,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  analytics: {
    staleTime: QUERY_STALE_TIMES.VERY_LONG,
    gcTime: QUERY_GC_TIMES.VERY_LONG,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  exchangeInfo: {
    staleTime: QUERY_STALE_TIMES.STATIC,
    gcTime: QUERY_GC_TIMES.PERSISTENT,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },

  default: {
    staleTime: QUERY_STALE_TIMES.MEDIUM,
    gcTime: QUERY_GC_TIMES.MEDIUM,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  },
} as const;

export const getQueryConfig = (key: QueryConfigKey): QueryConfigOptions =>
  QUERY_CONFIGS[key] ?? QUERY_CONFIGS.default;

export const createQueryOptions = <T>(
  key: QueryConfigKey,
  additionalOptions?: Partial<QueryObserverOptions<T>>
): Partial<QueryObserverOptions<T>> => ({
  ...getQueryConfig(key),
  ...additionalOptions,
});

export const getQueryKeyPrefix = (queryKey: unknown[]): QueryConfigKey => {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return 'default';

  const firstPart = queryKey[0];
  if (typeof firstPart !== 'string' && !Array.isArray(firstPart)) return 'default';

  const key = Array.isArray(firstPart) ? firstPart[0] : firstPart;

  const keyMap: Record<string, QueryConfigKey> = {
    kline: 'klines',
    'kline.list': 'klines',
    'kline.latest': 'klinesLatest',
    'kline.count': 'klines',
    wallet: 'wallets',
    'wallet.list': 'wallets',
    'wallet.getById': 'wallets',
    tradingProfiles: 'tradingProfiles',
    'tradingProfiles.list': 'tradingProfiles',
    autoTrading: 'autoTradingConfig',
    'autoTrading.getConfig': 'autoTradingConfig',
    tradeExecution: 'tradeExecutions',
    'tradeExecution.list': 'tradeExecutions',
    position: 'positions',
    'position.list': 'positions',
    order: 'orders',
    'order.list': 'orders',
    price: 'priceCache',
    'price.get': 'priceCache',
    setupDetection: 'setupDetections',
    'setupDetection.list': 'setupDetections',
    analytics: 'analytics',
    exchange: 'exchangeInfo',
    'exchange.info': 'exchangeInfo',
  };

  if (typeof key === 'string' && key in keyMap) {
    return keyMap[key] as QueryConfigKey;
  }

  return 'default';
};
