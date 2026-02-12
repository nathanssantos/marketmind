import { TIME_MS } from '@marketmind/types';

export const COINMETRICS_BASE_URL = 'https://community-api.coinmetrics.io/v4';

export const ON_CHAIN_CACHE_TTL = 30 * TIME_MS.MINUTE;

export const ON_CHAIN_HISTORY_DAYS = 365;

export const MINING_COST_MODEL = {
  ASIC_EFFICIENCY_J_PER_TH: 25,
  ELECTRICITY_COST_PER_KWH: 0.05,
  BLOCK_REWARD: 3.125,
} as const;

export type MiningCostModelConfig = typeof MINING_COST_MODEL;
