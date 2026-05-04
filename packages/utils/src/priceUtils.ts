const DEFAULT_PRICE_PRECISION = 8;
const DEFAULT_QTY_PRECISION = 8;
const MIN_SYMBOL_LENGTH = 6;

export const parsePrice = (price: string | number): number =>
  typeof price === 'string' ? parseFloat(price) : price;

export const formatPriceExact = (price: number, precision = DEFAULT_PRICE_PRECISION): string =>
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
  return formatPriceExact(priceNum * qtyNum);
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
  return formatPriceExact(aNum + bNum);
};

export const subtractPrice = (a: string, b: string): string => {
  const aNum = parsePrice(a);
  const bNum = parsePrice(b);
  return formatPriceExact(aNum - bNum);
};

export const multiplyPrice = (price: string, multiplier: number): string => {
  const priceNum = parsePrice(price);
  return formatPriceExact(priceNum * multiplier);
};

export const dividePrice = (price: string, divisor: number): string => {
  const priceNum = parsePrice(price);
  return formatPriceExact(priceNum / divisor);
};

export const averagePrice = (prices: string[]): string => {
  if (prices.length === 0) return '0';
  const sum = prices.reduce((acc, p) => acc + parsePrice(p), 0);
  return formatPriceExact(sum / prices.length);
};

export const maxPrice = (prices: string[]): string => {
  if (prices.length === 0) return '0';
  const nums = prices.map(parsePrice);
  return formatPriceExact(Math.max(...nums));
};

export const minPrice = (prices: string[]): string => {
  if (prices.length === 0) return '0';
  const nums = prices.map(parsePrice);
  return formatPriceExact(Math.min(...nums));
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

export const isValidSymbol = (symbol: string): boolean => {
  const normalized = normalizeSymbol(symbol);
  return normalized.length >= MIN_SYMBOL_LENGTH && parseSymbol(symbol) !== null;
};

export const roundTradingPrice = (price: number): string => {
  if (price >= 1000) return price.toFixed(2);
  if (price >= 10) return price.toFixed(3);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(5);
  return price.toFixed(6);
};

// Floor (truncate) qty to a digit count, never round up. The ticket
// computes `(balance × leverage × pct) / price` and submits to the
// exchange — if we round nearest with toFixed(), small float drift can
// push the requested qty 1 step over the percentage the user
// configured. The exchange will then either reject (insufficient
// margin) or fill at a smaller-than-intended size when its lot-size
// filter floors. Either path frustrates scalpers who need 100% to
// MEAN 100% (or just under), never over.
//
// `floorToDigits(0.4659999999, 4) === '0.4659'` (vs toFixed(4)
// returning '0.4660' which over-allocates by 0.0001 BTC).
const floorToDigits = (qty: number, digits: number): string => {
  if (!Number.isFinite(qty) || qty <= 0) return (0).toFixed(digits);
  const factor = 10 ** digits;
  const floored = Math.floor(qty * factor) / factor;
  return floored.toFixed(digits);
};

export const roundTradingQty = (qty: number, stepSize?: number): string => {
  // Defend against non-finite inputs up front so downstream branches
  // can assume qty is a real positive number. Returning the
  // highest-precision zero matches the contract (caller can parseFloat
  // and get 0).
  if (!Number.isFinite(qty) || qty <= 0) return (0).toFixed(6);
  // When the caller knows the exchange's lot-size filter (Binance
  // SYMBOL_FILTER LOT_SIZE), prefer that — guarantees the qty is
  // accepted by the exchange and the user's percentage is honored
  // exactly (just under, never over).
  if (stepSize && stepSize > 0) {
    const steps = Math.floor(qty / stepSize);
    const snapped = steps * stepSize;
    // Derive precision from stepSize: 0.001 → 3, 0.01 → 2, 1 → 0, etc.
    const stepDigits = Math.max(0, -Math.floor(Math.log10(stepSize)));
    return snapped.toFixed(stepDigits);
  }
  // Fallback when stepSize isn't available — pick a digit count by
  // magnitude. Truncate (floor) instead of round nearest so we never
  // overshoot the user's percentage.
  if (qty >= 100) return floorToDigits(qty, 0);
  if (qty >= 1) return floorToDigits(qty, 2);
  if (qty >= 0.001) return floorToDigits(qty, 4);
  return floorToDigits(qty, 6);
};
