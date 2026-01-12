import type { MarketType } from '@marketmind/types';
import { getAvailableSymbols } from './binance-exchange-info';

const COINGECKO_TO_BINANCE: Record<string, string> = {
  bitcoin: 'BTCUSDT',
  ethereum: 'ETHUSDT',
  binancecoin: 'BNBUSDT',
  solana: 'SOLUSDT',
  ripple: 'XRPUSDT',
  dogecoin: 'DOGEUSDT',
  cardano: 'ADAUSDT',
  avalanche: 'AVAXUSDT',
  tron: 'TRXUSDT',
  chainlink: 'LINKUSDT',
  polkadot: 'DOTUSDT',
  litecoin: 'LTCUSDT',
  'matic-network': 'MATICUSDT',
  shiba: 'SHIBUSDT',
  cosmos: 'ATOMUSDT',
  uniswap: 'UNIUSDT',
  stellar: 'XLMUSDT',
  near: 'NEARUSDT',
  aave: 'AAVEUSDT',
  aptos: 'APTUSDT',
  'internet-computer': 'ICPUSDT',
  'ethereum-classic': 'ETCUSDT',
  filecoin: 'FILUSDT',
  stacks: 'STXUSDT',
  immutable: 'IMXUSDT',
  injective: 'INJUSDT',
  render: 'RNDRUSDT',
  vechain: 'VETUSDT',
  optimism: 'OPUSDT',
  arbitrum: 'ARBUSDT',
  maker: 'MKRUSDT',
  'the-graph': 'GRTUSDT',
  theta: 'THETAUSDT',
  fantom: 'FTMUSDT',
  algorand: 'ALGOUSDT',
  thorchain: 'RUNEUSDT',
  'lido-dao': 'LDOUSDT',
  celestia: 'TIAUSDT',
  sei: 'SEIUSDT',
  sui: 'SUIUSDT',
  pendle: 'PENDLEUSDT',
  jupiter: 'JUPUSDT',
  worldcoin: 'WLDUSDT',
  ondo: 'ONDOUSDT',
  ethena: 'ENAUSDT',
  pyth: 'PYTHUSDT',
  starknet: 'STRKUSDT',
  jasmycoin: 'JASMYUSDT',
  bonk: 'BONKUSDT',
  dogwifhat: 'WIFUSDT',
  floki: 'FLOKIUSDT',
  pepe: 'PEPEUSDT',
  'fetch-ai': 'FETUSDT',
  singularitynet: 'AGIXUSDT',
  ocean: 'OCEANUSDT',
  hedera: 'HBARUSDT',
  'the-sandbox': 'SANDUSDT',
  decentraland: 'MANAUSDT',
  axie: 'AXSUSDT',
  gala: 'GALAUSDT',
  enjin: 'ENJUSDT',
  flow: 'FLOWUSDT',
  mina: 'MINAUSDT',
  kava: 'KAVAUSDT',
  neo: 'NEOUSDT',
  zilliqa: 'ZILUSDT',
  iota: 'IOTAUSDT',
  eos: 'EOSUSDT',
  astar: 'ASTRUSDT',
  conflux: 'CFXUSDT',
  blur: 'BLURUSDT',
  '1inch': '1INCHUSDT',
  curve: 'CRVUSDT',
  compound: 'COMPUSDT',
  synthetix: 'SNXUSDT',
  yearn: 'YFIUSDT',
  pancakeswap: 'CAKEUSDT',
  sushiswap: 'SUSHIUSDT',
  dydx: 'DYDXUSDT',
  gmx: 'GMXUSDT',
  frax: 'FRAXUSDT',
  rocket: 'RPLETHUSDT',
  mask: 'MASKUSDT',
  ankr: 'ANKRUSDT',
  livepeer: 'LPTUSDT',
  bittensor: 'TAOUSDT',
  kaspa: 'KASUSDT',
  'core-dao': 'COREUSDT',
  beam: 'BEAMUSDT',
  oasis: 'ROSEUSDT',
  harmony: 'ONEUSDT',
  celo: 'CELOUSDT',
  qtum: 'QTUMUSDT',
  iost: 'IOSTUSDT',
  ontology: 'ONTUSDT',
  waves: 'WAVESUSDT',
  dash: 'DASHUSDT',
  zcash: 'ZECUSDT',
  decred: 'DCRUSDT',
  ravencoin: 'RVNUSDT',
  horizen: 'ZENUSDT',
  elrond: 'EGLDUSDT',
  tezos: 'XTZUSDT',
};

let availableSymbolsCache: { symbols: Set<string>; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

const getAvailableSymbolsSet = async (marketType: MarketType): Promise<Set<string>> => {
  const now = Date.now();
  if (availableSymbolsCache && now - availableSymbolsCache.timestamp < CACHE_TTL) {
    return availableSymbolsCache.symbols;
  }

  const symbols = await getAvailableSymbols(marketType);
  availableSymbolsCache = { symbols: new Set(symbols), timestamp: now };
  return availableSymbolsCache.symbols;
};

export const mapCoinGeckoToBinance = (coingeckoId: string): string | null => {
  const mapped = COINGECKO_TO_BINANCE[coingeckoId.toLowerCase()];
  if (mapped) return mapped;

  const normalized = coingeckoId.replace(/-/g, '').toUpperCase() + 'USDT';
  return normalized;
};

export const mapCoinGeckoSymbolToBinance = (symbol: string): string => {
  return symbol.toUpperCase() + 'USDT';
};

export interface MappedSymbol {
  coingeckoId: string;
  coingeckoSymbol: string;
  binanceSymbol: string;
  isAvailable: boolean;
}

export const mapAndValidateSymbols = async (
  coins: Array<{ id: string; symbol: string }>,
  marketType: MarketType
): Promise<MappedSymbol[]> => {
  const available = await getAvailableSymbolsSet(marketType);

  return coins.map((coin) => {
    const mappedFromId = mapCoinGeckoToBinance(coin.id);
    const mappedFromSymbol = mapCoinGeckoSymbolToBinance(coin.symbol);

    const binanceSymbol = available.has(mappedFromId ?? '')
      ? mappedFromId!
      : available.has(mappedFromSymbol)
        ? mappedFromSymbol
        : null;

    return {
      coingeckoId: coin.id,
      coingeckoSymbol: coin.symbol,
      binanceSymbol: binanceSymbol ?? mappedFromSymbol,
      isAvailable: binanceSymbol !== null,
    };
  });
};

export const getValidBinanceSymbols = async (
  coins: Array<{ id: string; symbol: string }>,
  marketType: MarketType
): Promise<string[]> => {
  const mapped = await mapAndValidateSymbols(coins, marketType);
  return mapped.filter((m) => m.isAvailable).map((m) => m.binanceSymbol);
};

export const clearSymbolCache = (): void => {
  availableSymbolsCache = null;
};
