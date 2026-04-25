import { logger } from './logger';

export interface FearGreedData {
  value: number;
  valueClassification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  timestamp: number;
  timeUntilUpdate: string;
}

export interface FearGreedResult {
  current: FearGreedData | null;
  yesterday: FearGreedData | null;
  lastWeek: FearGreedData | null;
  lastMonth: FearGreedData | null;
  history: FearGreedData[];
}

const ALTERNATIVE_ME_URL = 'https://api.alternative.me/fng/';

export class FearGreedDataService {
  private cache: { data: FearGreedResult | null; timestamp: number } = { data: null, timestamp: 0 };
  private cacheTTL: number = 300000;

  async getFearGreedIndex(): Promise<FearGreedResult> {
    const cached = this.getFromCache();
    if (cached) return cached;

    try {
      const response = await fetch(`${ALTERNATIVE_ME_URL}?limit=31`, {
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch Fear & Greed Index');
        return this.getEmptyResult();
      }

      const json = await response.json();

      if (!json.data || json.data.length === 0) {
        logger.warn('Invalid Fear & Greed response format');
        return this.getEmptyResult();
      }

      const mapEntry = (entry: { value: string; value_classification: string; timestamp: string; time_until_update?: string }): FearGreedData => ({
        value: parseInt(entry.value, 10),
        valueClassification: entry.value_classification as FearGreedData['valueClassification'],
        timestamp: parseInt(entry.timestamp, 10) * 1000,
        timeUntilUpdate: entry.time_until_update ?? '',
      });

      const history: FearGreedData[] = json.data.map(mapEntry).reverse();

      const result: FearGreedResult = {
        current: json.data[0] ? mapEntry(json.data[0]) : null,
        yesterday: json.data[1] ? mapEntry(json.data[1]) : null,
        lastWeek: json.data[7] ? mapEntry(json.data[7]) : null,
        lastMonth: json.data[30] ? mapEntry(json.data[30]) : null,
        history,
      };

      this.setCache(result);
      return result;
    } catch (error) {
      logger.error({ error }, 'Error fetching Fear & Greed Index');
      return this.getEmptyResult();
    }
  }

  private getEmptyResult(): FearGreedResult {
    return {
      current: null,
      yesterday: null,
      lastWeek: null,
      lastMonth: null,
      history: [],
    };
  }

  private getFromCache(): FearGreedResult | null {
    if (this.cache.data && Date.now() - this.cache.timestamp < this.cacheTTL) {
      return this.cache.data;
    }
    return null;
  }

  private setCache(data: FearGreedResult): void {
    this.cache = { data, timestamp: Date.now() };
  }

  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }
}

let fearGreedDataService: FearGreedDataService | null = null;

export const getFearGreedDataService = (): FearGreedDataService => {
  fearGreedDataService ??= new FearGreedDataService();
  return fearGreedDataService;
};

export default FearGreedDataService;
