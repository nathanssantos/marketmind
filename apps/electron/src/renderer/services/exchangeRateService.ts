const BINANCE_TICKER_URL = 'https://api.binance.com/api/v3/ticker/price';
const CACHE_TTL_MS = 60000;

const BINANCE_PAIRS: Record<string, string> = {
  'USDT:BRL': 'USDTBRL',
  'BTC:USDT': 'BTCUSDT',
  'ETH:USDT': 'ETHUSDT',
  'BTC:BRL': 'BTCBRL',
  'ETH:BRL': 'ETHBRL',
};

const FALLBACK_RATES: Record<string, number> = {
  'USDT:BRL': 6.0,
  'USD:BRL': 6.0,
  'EUR:BRL': 6.5,
  'BTC:USDT': 100000,
  'ETH:USDT': 3000,
};

interface CachedRate {
  rate: number;
  timestamp: number;
}

const rateCache = new Map<string, CachedRate>();

const makePairKey = (from: string, to: string): string => `${from}:${to}`;

const fetchBinanceRate = async (symbol: string): Promise<number> => {
  const response = await fetch(`${BINANCE_TICKER_URL}?symbol=${symbol}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const rate = parseFloat(data.price);
  if (isNaN(rate) || rate <= 0) throw new Error('Invalid rate');
  return rate;
};

export const fetchExchangeRate = async (from: string, to: string): Promise<number> => {
  if (from === to) return 1;

  const pairKey = makePairKey(from, to);
  const reversePairKey = makePairKey(to, from);

  const cached = rateCache.get(pairKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.rate;

  try {
    let rate: number;

    const binanceSymbol = BINANCE_PAIRS[pairKey];
    const reverseBinanceSymbol = BINANCE_PAIRS[reversePairKey];

    if (binanceSymbol) {
      rate = await fetchBinanceRate(binanceSymbol);
    } else if (reverseBinanceSymbol) {
      rate = 1 / await fetchBinanceRate(reverseBinanceSymbol);
    } else if (from === 'USD' && to === 'BRL') {
      rate = await fetchBinanceRate('USDTBRL');
    } else if (from === 'BRL' && to === 'USD') {
      rate = 1 / await fetchBinanceRate('USDTBRL');
    } else if (from === 'EUR') {
      const eurUsd = await fetchCrossRate('EUR', 'USD');
      const usdTo = await fetchExchangeRate('USD', to);
      rate = eurUsd * usdTo;
    } else {
      rate = FALLBACK_RATES[pairKey] ?? 1;
    }

    rateCache.set(pairKey, { rate, timestamp: Date.now() });
    return rate;
  } catch {
    const cached = rateCache.get(pairKey);
    if (cached) return cached.rate;
    return FALLBACK_RATES[pairKey] ?? 1;
  }
};

const fetchCrossRate = async (from: string, to: string): Promise<number> => {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${from}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const rate = data.rates?.[to];
    if (typeof rate !== 'number' || rate <= 0) throw new Error('Invalid rate');
    return rate;
  } catch {
    return FALLBACK_RATES[makePairKey(from, to)] ?? 1;
  }
};

export const fetchUsdtBrlRate = (): Promise<number> => fetchExchangeRate('USDT', 'BRL');

export const getCachedRate = (from = 'USDT', to = 'BRL'): number | null =>
  rateCache.get(makePairKey(from, to))?.rate ?? null;

export const clearRateCache = (): void => {
  rateCache.clear();
};
