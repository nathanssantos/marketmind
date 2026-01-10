import type { MarketType } from '@marketmind/types';

interface Ticker24hr {
  symbol: string;
  quoteVolume: string;
}

const BINANCE_SPOT_API = 'https://api.binance.com';
const BINANCE_FUTURES_API = 'https://fapi.binance.com';

const EXCLUDED_SYMBOLS = new Set([
  'USDCUSDT',
  'BUSDUSDT',
  'TUSDUSDT',
  'USDPUSDT',
  'FDUSDUSDT',
  'DAIUSDT',
  'EURUSDT',
]);

export const getTopSymbolsByVolume = async (
  marketType: MarketType = 'SPOT',
  limit: number = 12
): Promise<string[]> => {
  const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
  const endpoint = marketType === 'FUTURES' ? '/fapi/v1/ticker/24hr' : '/api/v3/ticker/24hr';

  const response = await fetch(`${baseUrl}${endpoint}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch ticker data: ${response.statusText}`);
  }

  const tickers: Ticker24hr[] = await response.json();

  const usdtPairs = tickers
    .filter((t) => t.symbol.endsWith('USDT') && !EXCLUDED_SYMBOLS.has(t.symbol))
    .map((t) => ({
      symbol: t.symbol,
      quoteVolume: parseFloat(t.quoteVolume),
    }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume);

  return usdtPairs.slice(0, limit).map((t) => t.symbol);
};

export const getAvailableSymbols = async (marketType: MarketType = 'SPOT'): Promise<string[]> => {
  const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
  const endpoint = marketType === 'FUTURES' ? '/fapi/v1/exchangeInfo' : '/api/v3/exchangeInfo';

  const response = await fetch(`${baseUrl}${endpoint}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange info: ${response.statusText}`);
  }

  const data = await response.json();
  const symbols: Array<{ symbol: string; status: string }> = data.symbols;

  return symbols
    .filter((s) => s.status === 'TRADING' && s.symbol.endsWith('USDT') && !EXCLUDED_SYMBOLS.has(s.symbol))
    .map((s) => s.symbol)
    .sort();
};
