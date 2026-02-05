import { describe, it, expect } from 'vitest';
import type { IBSymbolSearchResult } from '../../exchange/interactive-brokers/types';

const sortSearchResults = (results: IBSymbolSearchResult[]): IBSymbolSearchResult[] => {
  return results.sort((a, b) => {
    if (a.symbol.length !== b.symbol.length) {
      return a.symbol.length - b.symbol.length;
    }
    return a.symbol.localeCompare(b.symbol);
  });
};

const isLikelyETF = (result: IBSymbolSearchResult): boolean => {
  const etfExchanges = ['ARCA', 'BATS', 'NYSE'];
  const symbol = result.symbol.toUpperCase();

  if (symbol.length <= 4 && etfExchanges.includes(result.primaryExchange)) {
    return true;
  }

  const etfKeywords = ['ETF', 'FUND', 'INDEX', 'TRUST', 'ISHARES', 'VANGUARD', 'SPDR'];
  const description = (result.description ?? '').toUpperCase();
  return etfKeywords.some((keyword) => description.includes(keyword));
};

const createMockSearchResult = (overrides: Partial<IBSymbolSearchResult> = {}): IBSymbolSearchResult => ({
  conId: 12345,
  symbol: 'AAPL',
  secType: 'STK',
  primaryExchange: 'NASDAQ',
  currency: 'USD',
  description: 'APPLE INC',
  ...overrides,
});

describe('IBSymbolSearch', () => {
  describe('sortSearchResults', () => {
    it('should sort results by symbol length first', () => {
      const results: IBSymbolSearchResult[] = [
        createMockSearchResult({ symbol: 'AAPL' }),
        createMockSearchResult({ symbol: 'AA' }),
        createMockSearchResult({ symbol: 'A' }),
      ];

      const sorted = sortSearchResults(results);

      expect(sorted[0]?.symbol).toBe('A');
      expect(sorted[1]?.symbol).toBe('AA');
      expect(sorted[2]?.symbol).toBe('AAPL');
    });

    it('should sort alphabetically for same length symbols', () => {
      const results: IBSymbolSearchResult[] = [
        createMockSearchResult({ symbol: 'MSFT' }),
        createMockSearchResult({ symbol: 'AAPL' }),
        createMockSearchResult({ symbol: 'GOOG' }),
      ];

      const sorted = sortSearchResults(results);

      expect(sorted[0]?.symbol).toBe('AAPL');
      expect(sorted[1]?.symbol).toBe('GOOG');
      expect(sorted[2]?.symbol).toBe('MSFT');
    });

    it('should handle empty array', () => {
      const sorted = sortSearchResults([]);
      expect(sorted).toHaveLength(0);
    });

    it('should handle single element', () => {
      const results = [createMockSearchResult({ symbol: 'AAPL' })];
      const sorted = sortSearchResults(results);
      expect(sorted).toHaveLength(1);
      expect(sorted[0]?.symbol).toBe('AAPL');
    });
  });

  describe('isLikelyETF', () => {
    it('should identify ETF by exchange (ARCA)', () => {
      const result = createMockSearchResult({
        symbol: 'SPY',
        primaryExchange: 'ARCA',
      });

      expect(isLikelyETF(result)).toBe(true);
    });

    it('should identify ETF by exchange (BATS)', () => {
      const result = createMockSearchResult({
        symbol: 'VTI',
        primaryExchange: 'BATS',
      });

      expect(isLikelyETF(result)).toBe(true);
    });

    it('should identify ETF by description keyword (ETF)', () => {
      const result = createMockSearchResult({
        symbol: 'SCHD',
        primaryExchange: 'NASDAQ',
        description: 'Schwab US Dividend Equity ETF',
      });

      expect(isLikelyETF(result)).toBe(true);
    });

    it('should identify ETF by description keyword (ISHARES)', () => {
      const result = createMockSearchResult({
        symbol: 'IVV',
        primaryExchange: 'NASDAQ',
        description: 'iShares Core S&P 500',
      });

      expect(isLikelyETF(result)).toBe(true);
    });

    it('should identify ETF by description keyword (VANGUARD)', () => {
      const result = createMockSearchResult({
        symbol: 'VOO',
        primaryExchange: 'NASDAQ',
        description: 'Vanguard S&P 500',
      });

      expect(isLikelyETF(result)).toBe(true);
    });

    it('should identify ETF by description keyword (SPDR)', () => {
      const result = createMockSearchResult({
        symbol: 'XLK',
        primaryExchange: 'NASDAQ',
        description: 'SPDR Technology Select Sector',
      });

      expect(isLikelyETF(result)).toBe(true);
    });

    it('should not identify regular stock as ETF', () => {
      const result = createMockSearchResult({
        symbol: 'AAPL',
        primaryExchange: 'NASDAQ',
        description: 'APPLE INC',
      });

      expect(isLikelyETF(result)).toBe(false);
    });

    it('should not identify stock with long symbol on ETF exchange as ETF', () => {
      const result = createMockSearchResult({
        symbol: 'GOOGL',
        primaryExchange: 'ARCA',
        description: 'ALPHABET INC',
      });

      expect(isLikelyETF(result)).toBe(false);
    });

    it('should handle missing description', () => {
      const result = createMockSearchResult({
        symbol: 'TEST',
        primaryExchange: 'NASDAQ',
        description: undefined,
      });

      expect(isLikelyETF(result)).toBe(false);
    });
  });

  describe('IBSymbolSearchResult structure', () => {
    it('should have all required fields', () => {
      const result = createMockSearchResult();

      expect(result).toHaveProperty('conId');
      expect(result).toHaveProperty('symbol');
      expect(result).toHaveProperty('secType');
      expect(result).toHaveProperty('primaryExchange');
      expect(result).toHaveProperty('currency');
    });

    it('should allow optional description', () => {
      const withDesc = createMockSearchResult({ description: 'Test' });
      const withoutDesc = createMockSearchResult({ description: undefined });

      expect(withDesc.description).toBe('Test');
      expect(withoutDesc.description).toBeUndefined();
    });

    it('should allow optional derivativeSecTypes', () => {
      const withDerivatives = createMockSearchResult();
      (withDerivatives as IBSymbolSearchResult & { derivativeSecTypes?: string[] }).derivativeSecTypes = ['OPT', 'FUT'];

      expect((withDerivatives as IBSymbolSearchResult & { derivativeSecTypes?: string[] }).derivativeSecTypes).toEqual(['OPT', 'FUT']);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in symbol', () => {
      const result = createMockSearchResult({ symbol: 'BRK.B' });
      expect(result.symbol).toBe('BRK.B');
    });

    it('should handle empty symbol', () => {
      const result = createMockSearchResult({ symbol: '' });
      expect(result.symbol).toBe('');
    });

    it('should handle non-USD currency', () => {
      const result = createMockSearchResult({
        symbol: 'SHOP',
        currency: 'CAD',
        primaryExchange: 'TSE',
      });

      expect(result.currency).toBe('CAD');
      expect(isLikelyETF(result)).toBe(false);
    });
  });
});
