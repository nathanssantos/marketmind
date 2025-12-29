
const DEFAULT_PRICE_PRECISION = 8;
const DEFAULT_QTY_PRECISION = 8;
const PERCENT_PRECISION = 2;
const PERCENT_MULTIPLIER = 100;

export const parsePrice = (price: string | number): number =>
  typeof price === 'string' ? parseFloat(price) : price;

export const formatPrice = (price: number, precision = DEFAULT_PRICE_PRECISION): string =>
  price.toFixed(precision);

export const parseQty = (qty: string | number): number =>
  typeof qty === 'string' ? parseFloat(qty) : qty;

export const formatQty = (qty: number, precision = DEFAULT_QTY_PRECISION): string =>
  qty.toFixed(precision);

export const parseVolume = (volume: string | number): number =>
  typeof volume === 'string' ? parseFloat(volume) : volume;

export const formatVolume = (volume: number, precision = DEFAULT_QTY_PRECISION): string =>
  volume.toFixed(precision);

export const calculateQuoteQty = (price: string, qty: string): string => {
  const priceNum = parsePrice(price);
  const qtyNum = parseQty(qty);
  return formatPrice(priceNum * qtyNum);
};

export const calculatePnL = (
  entryPrice: string,
  exitPrice: string,
  qty: string,
  side: 'BUY' | 'SELL',
): string => {
  const entry = parsePrice(entryPrice);
  const exit = parsePrice(exitPrice);
  const quantity = parseQty(qty);
  
  const pnl = side === 'BUY' 
    ? (exit - entry) * quantity 
    : (entry - exit) * quantity;
    
  return formatPrice(pnl);
};

export const calculatePnLPercent = (
  entryPrice: string,
  exitPrice: string,
  side: 'BUY' | 'SELL',
): string => {
  const entry = parsePrice(entryPrice);
  const exit = parsePrice(exitPrice);
  
  const percent = side === 'BUY'
    ? ((exit - entry) / entry) * PERCENT_MULTIPLIER
    : ((entry - exit) / entry) * PERCENT_MULTIPLIER;
    
  return formatPrice(percent, PERCENT_PRECISION);
};

export const isValidPrice = (price: string): boolean => {
  const num = parsePrice(price);
  return !isNaN(num) && num > 0;
};

export const isValidQty = (qty: string): boolean => {
  const num = parseQty(qty);
  return !isNaN(num) && num > 0;
};

export const comparePrice = (a: string, b: string): number => {
  const aNum = parsePrice(a);
  const bNum = parsePrice(b);
  return aNum - bNum;
};

export const addPrice = (a: string, b: string): string => {
  const aNum = parsePrice(a);
  const bNum = parsePrice(b);
  return formatPrice(aNum + bNum);
};

export const subtractPrice = (a: string, b: string): string => {
  const aNum = parsePrice(a);
  const bNum = parsePrice(b);
  return formatPrice(aNum - bNum);
};

export const multiplyPrice = (price: string, multiplier: number): string => {
  const priceNum = parsePrice(price);
  return formatPrice(priceNum * multiplier);
};

export const dividePrice = (price: string, divisor: number): string => {
  const priceNum = parsePrice(price);
  return formatPrice(priceNum / divisor);
};

export const averagePrice = (prices: string[]): string => {
  if (prices.length === 0) return '0';
  const sum = prices.reduce((acc, p) => acc + parsePrice(p), 0);
  return formatPrice(sum / prices.length);
};

export const maxPrice = (prices: string[]): string => {
  if (prices.length === 0) return '0';
  const nums = prices.map(parsePrice);
  return formatPrice(Math.max(...nums));
};

export const minPrice = (prices: string[]): string => {
  if (prices.length === 0) return '0';
  const nums = prices.map(parsePrice);
  return formatPrice(Math.min(...nums));
};

export const normalizeSymbol = (symbol: string): string =>
  symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const parseSymbol = (symbol: string): { base: string; quote: string } | null => {
  const normalized = normalizeSymbol(symbol);
  const commonQuotes = ['USDT', 'BUSD', 'BTC', 'ETH', 'BNB', 'USD', 'EUR', 'BRL'];
  
  for (const quote of commonQuotes) {
    if (normalized.endsWith(quote)) {
      const base = normalized.slice(0, -quote.length);
      if (base.length > 0) {
        return { base, quote };
      }
    }
  }
  
  return null;
};

const MIN_SYMBOL_LENGTH = 6;

export const isValidSymbol = (symbol: string): boolean => {
  const normalized = normalizeSymbol(symbol);
  return normalized.length >= MIN_SYMBOL_LENGTH && parseSymbol(symbol) !== null;
};
