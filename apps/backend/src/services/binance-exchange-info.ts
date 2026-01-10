import type { MarketType } from '@marketmind/types';

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

const TOP_MARKET_CAP_SYMBOLS = [
  // Top 1-10
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'TRXUSDT',
  'LINKUSDT',
  // Top 11-20
  'DOTUSDT',
  'LTCUSDT',
  'MATICUSDT',
  'SHIBUSDT',
  'ATOMUSDT',
  'UNIUSDT',
  'XLMUSDT',
  'NEARUSDT',
  'AAVEUSDT',
  'APTUSDT',
  // Top 21-30
  'ICPUSDT',
  'ETCUSDT',
  'FILUSDT',
  'STXUSDT',
  'IMXUSDT',
  'INJUSDT',
  'RNDRUSDT',
  'VETUSDT',
  'OPUSDT',
  'ARBUSDT',
  // Top 31-40
  'MKRUSDT',
  'GRTUSDT',
  'THETAUSDT',
  'FTMUSDT',
  'ALGOUSDT',
  'RUNEUSDT',
  'LDOUSDT',
  'TIAUSDT',
  'SEIUSDT',
  'SUIUSDT',
  // Top 41-50
  'PENDLEUSDT',
  'JUPUSDT',
  'WLDUSDT',
  'ONDOUSDT',
  'ENAUSDT',
  'PYTHUSDT',
  'STRKUSDT',
  'JASMYUSDT',
  'BONKUSDT',
  'WIFUSDT',
  // Extra buffer
  'FLOKIUSDT',
  'PEPEUSDT',
  'FETUSDT',
  'AGIXUSDT',
  'OCEANUSDT',
] as const;

const validateSymbolsExist = async (
  symbols: string[],
  marketType: MarketType
): Promise<string[]> => {
  const available = await getAvailableSymbols(marketType);
  const availableSet = new Set(available);
  return symbols.filter((s) => availableSet.has(s));
};

export const getTopSymbolsByMarketCap = async (
  marketType: MarketType = 'SPOT',
  limit: number = 12
): Promise<string[]> => {
  const candidates = [...TOP_MARKET_CAP_SYMBOLS].slice(0, Math.min(limit + 5, TOP_MARKET_CAP_SYMBOLS.length));
  const validSymbols = await validateSymbolsExist(candidates, marketType);
  return validSymbols.slice(0, limit);
};

export const getTopSymbolsByVolume = async (
  marketType: MarketType = 'SPOT',
  limit: number = 12
): Promise<string[]> => {
  return getTopSymbolsByMarketCap(marketType, limit);
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
