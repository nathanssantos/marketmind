import { COINMETRICS_BASE_URL, MINING_COST_MODEL, ON_CHAIN_CACHE_TTL, ON_CHAIN_HISTORY_DAYS } from '../constants/on-chain';
import { logger } from './logger';

export interface MVRVDataPoint {
  timestamp: number;
  value: number;
}

export interface MVRVResult {
  current: number | null;
  history: MVRVDataPoint[];
}

export interface ProductionCostDataPoint {
  timestamp: number;
  productionCost: number;
  btcPrice: number;
}

export interface ProductionCostResult {
  currentCost: number | null;
  currentPrice: number | null;
  history: ProductionCostDataPoint[];
}

export interface OnChainResult {
  mvrv: MVRVResult;
  productionCost: ProductionCostResult;
}

interface CoinMetricsDataPoint {
  time: string;
  CapMVRVCur?: string;
  HashRate?: string;
  BlkCnt?: string;
  PriceUSD?: string;
}

interface CoinMetricsResponse {
  data: CoinMetricsDataPoint[];
}

const calculateProductionCost = (hashRateTHs: number, blockCount: number): number => {
  const totalPowerWatts = hashRateTHs * MINING_COST_MODEL.ASIC_EFFICIENCY_J_PER_TH;
  const dailyEnergyKWh = (totalPowerWatts * 24) / 1000;
  const dailyCostUSD = dailyEnergyKWh * MINING_COST_MODEL.ELECTRICITY_COST_PER_KWH;
  const btcMinedPerDay = blockCount * MINING_COST_MODEL.BLOCK_REWARD;
  if (btcMinedPerDay === 0) return 0;
  return dailyCostUSD / btcMinedPerDay;
};

export class OnChainDataService {
  private cache: { data: OnChainResult | null; timestamp: number } = { data: null, timestamp: 0 };

  async getOnChainMetrics(): Promise<OnChainResult> {
    const cached = this.getFromCache();
    if (cached) return cached;

    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - ON_CHAIN_HISTORY_DAYS);
      const startTime = startDate.toISOString().split('T')[0];

      const url = `${COINMETRICS_BASE_URL}/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur,HashRate,BlkCnt,PriceUSD&frequency=1d&start_time=${startTime}&page_size=370`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch CoinMetrics on-chain data');
        return this.getEmptyResult();
      }

      const json = (await response.json()) as CoinMetricsResponse;

      if (!json.data || json.data.length === 0) {
        logger.warn('Invalid CoinMetrics response format');
        return this.getEmptyResult();
      }

      const mvrvHistory: MVRVDataPoint[] = [];
      const productionCostHistory: ProductionCostDataPoint[] = [];

      for (const point of json.data) {
        const timestamp = new Date(point.time).getTime();
        const mvrv = point.CapMVRVCur ? parseFloat(point.CapMVRVCur) : null;
        const hashRate = point.HashRate ? parseFloat(point.HashRate) : null;
        const blockCount = point.BlkCnt ? parseFloat(point.BlkCnt) : null;
        const btcPrice = point.PriceUSD ? parseFloat(point.PriceUSD) : null;

        if (mvrv !== null && !isNaN(mvrv)) {
          mvrvHistory.push({ timestamp, value: mvrv });
        }

        if (hashRate !== null && blockCount !== null && btcPrice !== null && !isNaN(hashRate) && !isNaN(blockCount) && !isNaN(btcPrice) && blockCount > 0) {
          const productionCost = calculateProductionCost(hashRate, blockCount);
          productionCostHistory.push({ timestamp, productionCost, btcPrice });
        }
      }

      const lastMvrv = mvrvHistory.length > 0 ? mvrvHistory[mvrvHistory.length - 1] : null;
      const lastCost = productionCostHistory.length > 0 ? productionCostHistory[productionCostHistory.length - 1] : null;

      const result: OnChainResult = {
        mvrv: {
          current: lastMvrv?.value ?? null,
          history: mvrvHistory,
        },
        productionCost: {
          currentCost: lastCost?.productionCost ?? null,
          currentPrice: lastCost?.btcPrice ?? null,
          history: productionCostHistory,
        },
      };

      this.setCache(result);
      return result;
    } catch (error) {
      logger.error({ error }, 'Error fetching CoinMetrics on-chain data');
      return this.getEmptyResult();
    }
  }

  private getEmptyResult(): OnChainResult {
    return {
      mvrv: { current: null, history: [] },
      productionCost: { currentCost: null, currentPrice: null, history: [] },
    };
  }

  private getFromCache(): OnChainResult | null {
    if (this.cache.data && Date.now() - this.cache.timestamp < ON_CHAIN_CACHE_TTL) return this.cache.data;
    return null;
  }

  private setCache(data: OnChainResult): void {
    this.cache = { data, timestamp: Date.now() };
  }

  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}

let onChainDataService: OnChainDataService | null = null;

export const getOnChainDataService = (): OnChainDataService => {
  onChainDataService ??= new OnChainDataService();
  return onChainDataService;
};
