const BINANCE_USDT_BRL_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL';
const FALLBACK_USDT_BRL_RATE = 6.0;
const CACHE_TTL_MS = 60000;

interface CachedRate {
  rate: number;
  timestamp: number;
}

let cachedRate: CachedRate | null = null;

export const fetchUsdtBrlRate = async (): Promise<number> => {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL_MS) {
    return cachedRate.rate;
  }

  try {
    const response = await fetch(BINANCE_USDT_BRL_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const rate = parseFloat(data.price);

    if (isNaN(rate) || rate <= 0) throw new Error('Invalid rate');

    cachedRate = { rate, timestamp: Date.now() };
    return rate;
  } catch {
    if (cachedRate) return cachedRate.rate;
    return FALLBACK_USDT_BRL_RATE;
  }
};

export const getCachedRate = (): number | null => cachedRate?.rate ?? null;

export const clearRateCache = (): void => {
  cachedRate = null;
};
