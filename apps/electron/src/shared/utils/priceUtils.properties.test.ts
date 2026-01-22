import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addPrice,
  averagePrice,
  calculatePnL,
  calculatePnLPercent,
  calculateQuoteQty,
  comparePrice,
  dividePrice,
  formatPrice,
  maxPrice,
  minPrice,
  multiplyPrice,
  parsePrice,
  subtractPrice,
} from './priceUtils';

const positiveDoubleArb = fc.double({ min: 0.01, max: 1000000, noNaN: true });
const priceStringArb = positiveDoubleArb.map((n) => n.toFixed(8));
const qtyStringArb = fc.double({ min: 0.0001, max: 10000, noNaN: true }).map((n) => n.toFixed(8));
const sideArb = fc.constantFrom('BUY' as const, 'SELL' as const);

describe('Property-Based Testing: Price Utils', () => {
  describe('parsePrice Properties', () => {
    it('should be identity for number input', () => {
      fc.assert(
        fc.property(positiveDoubleArb, (price) => {
          return parsePrice(price) === price;
        }),
        { numRuns: 100 }
      );
    });

    it('should parse string back to original number (within precision)', () => {
      fc.assert(
        fc.property(positiveDoubleArb, (price) => {
          const str = price.toFixed(8);
          const parsed = parsePrice(str);
          return Math.abs(parsed - price) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('formatPrice Properties', () => {
    it('should return string with correct decimal places', () => {
      fc.assert(
        fc.property(positiveDoubleArb, fc.integer({ min: 0, max: 10 }), (price, precision) => {
          const formatted = formatPrice(price, precision);
          const parts = formatted.split('.');
          return parts.length === 1 ? precision === 0 : parts[1]?.length === precision;
        }),
        { numRuns: 100 }
      );
    });

    it('should round-trip correctly', () => {
      fc.assert(
        fc.property(positiveDoubleArb, (price) => {
          const formatted = formatPrice(price, 8);
          const parsed = parseFloat(formatted);
          return Math.abs(parsed - price) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('calculatePnL Properties', () => {
    it('BUY and SELL should have opposite PnL for same price movement', () => {
      fc.assert(
        fc.property(priceStringArb, priceStringArb, qtyStringArb, (entry, exit, qty) => {
          const buyPnL = parseFloat(calculatePnL(entry, exit, qty, 'BUY'));
          const sellPnL = parseFloat(calculatePnL(entry, exit, qty, 'SELL'));
          return Math.abs(buyPnL + sellPnL) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('PnL should be zero when entry equals exit', () => {
      fc.assert(
        fc.property(priceStringArb, qtyStringArb, sideArb, (price, qty, side) => {
          const pnl = parseFloat(calculatePnL(price, price, qty, side));
          return Math.abs(pnl) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('PnL should scale linearly with quantity', () => {
      fc.assert(
        fc.property(
          priceStringArb,
          priceStringArb,
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          fc.double({ min: 1.5, max: 3, noNaN: true }),
          sideArb,
          (entry, exit, qty, multiplier, side) => {
            const pnl1 = parseFloat(calculatePnL(entry, exit, qty.toFixed(8), side));
            const pnl2 = parseFloat(calculatePnL(entry, exit, (qty * multiplier).toFixed(8), side));
            if (Math.abs(pnl1) < 0.00001) return true;
            const ratio = pnl2 / pnl1;
            return Math.abs(ratio - multiplier) < 0.01;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('BUY profit when exit > entry, loss when exit < entry', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000, noNaN: true }),
          fc.double({ min: 1, max: 50, noNaN: true }),
          qtyStringArb,
          (entry, priceDelta, qty) => {
            const profitExit = (entry + priceDelta).toFixed(8);
            const lossExit = (entry - priceDelta).toFixed(8);
            const entryStr = entry.toFixed(8);

            const profitPnL = parseFloat(calculatePnL(entryStr, profitExit, qty, 'BUY'));
            const lossPnL = parseFloat(calculatePnL(entryStr, lossExit, qty, 'BUY'));

            return profitPnL > 0 && lossPnL < 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('SELL profit when exit < entry, loss when exit > entry', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000, noNaN: true }),
          fc.double({ min: 1, max: 50, noNaN: true }),
          qtyStringArb,
          (entry, priceDelta, qty) => {
            const profitExit = (entry - priceDelta).toFixed(8);
            const lossExit = (entry + priceDelta).toFixed(8);
            const entryStr = entry.toFixed(8);

            const profitPnL = parseFloat(calculatePnL(entryStr, profitExit, qty, 'SELL'));
            const lossPnL = parseFloat(calculatePnL(entryStr, lossExit, qty, 'SELL'));

            return profitPnL > 0 && lossPnL < 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('calculatePnLPercent Properties', () => {
    it('should return zero when entry equals exit', () => {
      fc.assert(
        fc.property(priceStringArb, sideArb, (price, side) => {
          const percent = parseFloat(calculatePnLPercent(price, price, side));
          return Math.abs(percent) < 0.01;
        }),
        { numRuns: 100 }
      );
    });

    it('BUY and SELL should have opposite percent for same price movement', () => {
      fc.assert(
        fc.property(priceStringArb, priceStringArb, (entry, exit) => {
          const buyPercent = parseFloat(calculatePnLPercent(entry, exit, 'BUY'));
          const sellPercent = parseFloat(calculatePnLPercent(entry, exit, 'SELL'));
          return Math.abs(buyPercent + sellPercent) < 0.01;
        }),
        { numRuns: 100 }
      );
    });

    it('10% price increase should give ~10% BUY profit', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 100, max: 10000, noNaN: true }),
          fc.double({ min: 0.01, max: 0.5, noNaN: true }),
          (entry, percentChange) => {
            const exit = entry * (1 + percentChange);
            const percent = parseFloat(calculatePnLPercent(entry.toFixed(8), exit.toFixed(8), 'BUY'));
            return Math.abs(percent - percentChange * 100) < 0.1;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('calculateQuoteQty Properties', () => {
    it('should equal price * qty (within floating point tolerance)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 100000, noNaN: true }),
          fc.double({ min: 0.001, max: 1000, noNaN: true }),
          (price, qty) => {
            const priceStr = price.toFixed(8);
            const qtyStr = qty.toFixed(8);
            const quoteQty = parseFloat(calculateQuoteQty(priceStr, qtyStr));
            const expected = parseFloat(priceStr) * parseFloat(qtyStr);
            const tolerance = Math.max(0.01, expected * 0.00001);
            return Math.abs(quoteQty - expected) < tolerance;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be commutative (in terms of result, not params)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000, noNaN: true }),
          fc.double({ min: 1, max: 1000, noNaN: true }),
          (a, b) => {
            const result1 = parseFloat(calculateQuoteQty(a.toFixed(8), b.toFixed(8)));
            const result2 = parseFloat(calculateQuoteQty(b.toFixed(8), a.toFixed(8)));
            return Math.abs(result1 - result2) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Price Arithmetic Properties', () => {
    it('addPrice should be commutative', () => {
      fc.assert(
        fc.property(priceStringArb, priceStringArb, (a, b) => {
          const sum1 = parseFloat(addPrice(a, b));
          const sum2 = parseFloat(addPrice(b, a));
          return Math.abs(sum1 - sum2) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('add and subtract should be inverse operations', () => {
      fc.assert(
        fc.property(priceStringArb, priceStringArb, (a, b) => {
          const sum = addPrice(a, b);
          const result = parseFloat(subtractPrice(sum, b));
          const expected = parseFloat(a);
          return Math.abs(result - expected) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('multiply and divide should be inverse operations', () => {
      fc.assert(
        fc.property(
          priceStringArb,
          fc.double({ min: 0.1, max: 100, noNaN: true }),
          (price, multiplier) => {
            const product = multiplyPrice(price, multiplier);
            const result = parseFloat(dividePrice(product, multiplier));
            const expected = parseFloat(price);
            return Math.abs(result - expected) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('comparePrice should be consistent with numeric comparison', () => {
      fc.assert(
        fc.property(priceStringArb, priceStringArb, (a, b) => {
          const cmp = comparePrice(a, b);
          const aNum = parseFloat(a);
          const bNum = parseFloat(b);
          if (aNum > bNum) return cmp > 0;
          if (aNum < bNum) return cmp < 0;
          return cmp === 0;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Price Aggregation Properties', () => {
    it('averagePrice should be between min and max', () => {
      fc.assert(
        fc.property(fc.array(priceStringArb, { minLength: 1, maxLength: 20 }), (prices) => {
          const avg = parseFloat(averagePrice(prices));
          const nums = prices.map(parseFloat);
          const min = Math.min(...nums);
          const max = Math.max(...nums);
          return avg >= min - 0.00000001 && avg <= max + 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('averagePrice of single element should equal that element', () => {
      fc.assert(
        fc.property(priceStringArb, (price) => {
          const avg = parseFloat(averagePrice([price]));
          return Math.abs(avg - parseFloat(price)) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('maxPrice should return the maximum value', () => {
      fc.assert(
        fc.property(fc.array(priceStringArb, { minLength: 1, maxLength: 20 }), (prices) => {
          const max = parseFloat(maxPrice(prices));
          const nums = prices.map(parseFloat);
          const expected = Math.max(...nums);
          return Math.abs(max - expected) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('minPrice should return the minimum value', () => {
      fc.assert(
        fc.property(fc.array(priceStringArb, { minLength: 1, maxLength: 20 }), (prices) => {
          const min = parseFloat(minPrice(prices));
          const nums = prices.map(parseFloat);
          const expected = Math.min(...nums);
          return Math.abs(min - expected) < 0.00000001;
        }),
        { numRuns: 100 }
      );
    });

    it('minPrice <= averagePrice <= maxPrice', () => {
      fc.assert(
        fc.property(fc.array(priceStringArb, { minLength: 1, maxLength: 20 }), (prices) => {
          const min = parseFloat(minPrice(prices));
          const avg = parseFloat(averagePrice(prices));
          const max = parseFloat(maxPrice(prices));
          return min <= avg + 0.00000001 && avg <= max + 0.00000001;
        }),
        { numRuns: 100 }
      );
    });
  });
});
