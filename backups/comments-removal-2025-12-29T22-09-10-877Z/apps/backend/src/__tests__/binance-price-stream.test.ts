import { describe, expect, it } from 'vitest';

interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

const parseTradeMessage = (data: unknown): PriceUpdate | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const message = data as Record<string, unknown>;

  if (message['e'] === 'trade' && typeof message['s'] === 'string') {
    const symbol = message['s'];
    const price = parseFloat(message['p'] as string);
    const timestamp = message['T'] as number;

    return { symbol, price, timestamp };
  }

  return null;
};

const normalizeSymbol = (symbol: string): string => {
  return symbol.toLowerCase();
};

const shouldSubscribe = (
  symbol: string,
  subscribedSymbols: Set<string>
): boolean => {
  return !subscribedSymbols.has(symbol);
};

const shouldUnsubscribe = (
  symbol: string,
  activeSymbols: Set<string>,
  subscribedSymbols: Set<string>
): boolean => {
  return subscribedSymbols.has(symbol) && !activeSymbols.has(symbol);
};

const getSymbolsToSubscribe = (
  activePositionSymbols: string[],
  subscribedSymbols: Set<string>
): string[] => {
  return activePositionSymbols.filter(s => !subscribedSymbols.has(s));
};

const getSymbolsToUnsubscribe = (
  activePositionSymbols: Set<string>,
  subscribedSymbols: Set<string>
): string[] => {
  return Array.from(subscribedSymbols).filter(s => !activePositionSymbols.has(s));
};

describe('Binance Price Stream - Pure Functions', () => {
  describe('parseTradeMessage', () => {
    it('should parse valid trade message', () => {
      const message = {
        e: 'trade',
        s: 'BTCUSDT',
        p: '100000.50',
        T: 1704067200000,
      };

      const result = parseTradeMessage(message);

      expect(result).toEqual({
        symbol: 'BTCUSDT',
        price: 100000.5,
        timestamp: 1704067200000,
      });
    });

    it('should return null for non-trade event', () => {
      const message = {
        e: 'kline',
        s: 'BTCUSDT',
      };

      const result = parseTradeMessage(message);

      expect(result).toBeNull();
    });

    it('should return null for null data', () => {
      const result = parseTradeMessage(null);

      expect(result).toBeNull();
    });

    it('should return null for non-object data', () => {
      expect(parseTradeMessage('string')).toBeNull();
      expect(parseTradeMessage(123)).toBeNull();
      expect(parseTradeMessage(undefined)).toBeNull();
    });

    it('should return null when symbol is not a string', () => {
      const message = {
        e: 'trade',
        s: 123,
        p: '100000.50',
        T: 1704067200000,
      };

      const result = parseTradeMessage(message);

      expect(result).toBeNull();
    });

    it('should parse price as float correctly', () => {
      const message = {
        e: 'trade',
        s: 'ETHUSDT',
        p: '3500.123456',
        T: 1704067200000,
      };

      const result = parseTradeMessage(message);

      expect(result?.price).toBeCloseTo(3500.123456, 6);
    });
  });

  describe('normalizeSymbol', () => {
    it('should convert symbol to lowercase', () => {
      expect(normalizeSymbol('BTCUSDT')).toBe('btcusdt');
      expect(normalizeSymbol('ETHUSDT')).toBe('ethusdt');
    });

    it('should handle already lowercase symbols', () => {
      expect(normalizeSymbol('btcusdt')).toBe('btcusdt');
    });

    it('should handle mixed case symbols', () => {
      expect(normalizeSymbol('BtCuSdT')).toBe('btcusdt');
    });
  });

  describe('shouldSubscribe', () => {
    it('should return true when symbol is not subscribed', () => {
      const subscribedSymbols = new Set(['ethusdt', 'solusdt']);

      expect(shouldSubscribe('btcusdt', subscribedSymbols)).toBe(true);
    });

    it('should return false when symbol is already subscribed', () => {
      const subscribedSymbols = new Set(['btcusdt', 'ethusdt']);

      expect(shouldSubscribe('btcusdt', subscribedSymbols)).toBe(false);
    });

    it('should return true for empty subscribed set', () => {
      const subscribedSymbols = new Set<string>();

      expect(shouldSubscribe('btcusdt', subscribedSymbols)).toBe(true);
    });
  });

  describe('shouldUnsubscribe', () => {
    it('should return true when symbol is subscribed but not active', () => {
      const activeSymbols = new Set(['ethusdt']);
      const subscribedSymbols = new Set(['btcusdt', 'ethusdt']);

      expect(shouldUnsubscribe('btcusdt', activeSymbols, subscribedSymbols)).toBe(true);
    });

    it('should return false when symbol is both subscribed and active', () => {
      const activeSymbols = new Set(['btcusdt', 'ethusdt']);
      const subscribedSymbols = new Set(['btcusdt', 'ethusdt']);

      expect(shouldUnsubscribe('btcusdt', activeSymbols, subscribedSymbols)).toBe(false);
    });

    it('should return false when symbol is not subscribed', () => {
      const activeSymbols = new Set(['ethusdt']);
      const subscribedSymbols = new Set(['ethusdt']);

      expect(shouldUnsubscribe('btcusdt', activeSymbols, subscribedSymbols)).toBe(false);
    });
  });

  describe('getSymbolsToSubscribe', () => {
    it('should return symbols that are active but not subscribed', () => {
      const activeSymbols = ['btcusdt', 'ethusdt', 'solusdt'];
      const subscribedSymbols = new Set(['btcusdt']);

      const result = getSymbolsToSubscribe(activeSymbols, subscribedSymbols);

      expect(result).toEqual(['ethusdt', 'solusdt']);
    });

    it('should return empty array when all symbols are subscribed', () => {
      const activeSymbols = ['btcusdt', 'ethusdt'];
      const subscribedSymbols = new Set(['btcusdt', 'ethusdt']);

      const result = getSymbolsToSubscribe(activeSymbols, subscribedSymbols);

      expect(result).toEqual([]);
    });

    it('should return all symbols when none are subscribed', () => {
      const activeSymbols = ['btcusdt', 'ethusdt'];
      const subscribedSymbols = new Set<string>();

      const result = getSymbolsToSubscribe(activeSymbols, subscribedSymbols);

      expect(result).toEqual(['btcusdt', 'ethusdt']);
    });

    it('should handle empty active symbols', () => {
      const activeSymbols: string[] = [];
      const subscribedSymbols = new Set(['btcusdt']);

      const result = getSymbolsToSubscribe(activeSymbols, subscribedSymbols);

      expect(result).toEqual([]);
    });
  });

  describe('getSymbolsToUnsubscribe', () => {
    it('should return symbols that are subscribed but not active', () => {
      const activeSymbols = new Set(['ethusdt']);
      const subscribedSymbols = new Set(['btcusdt', 'ethusdt', 'solusdt']);

      const result = getSymbolsToUnsubscribe(activeSymbols, subscribedSymbols);

      expect(result).toEqual(['btcusdt', 'solusdt']);
    });

    it('should return empty array when all subscribed symbols are active', () => {
      const activeSymbols = new Set(['btcusdt', 'ethusdt']);
      const subscribedSymbols = new Set(['btcusdt', 'ethusdt']);

      const result = getSymbolsToUnsubscribe(activeSymbols, subscribedSymbols);

      expect(result).toEqual([]);
    });

    it('should return all subscribed symbols when none are active', () => {
      const activeSymbols = new Set<string>();
      const subscribedSymbols = new Set(['btcusdt', 'ethusdt']);

      const result = getSymbolsToUnsubscribe(activeSymbols, subscribedSymbols);

      expect(result.sort()).toEqual(['btcusdt', 'ethusdt'].sort());
    });

    it('should handle empty subscribed set', () => {
      const activeSymbols = new Set(['btcusdt']);
      const subscribedSymbols = new Set<string>();

      const result = getSymbolsToUnsubscribe(activeSymbols, subscribedSymbols);

      expect(result).toEqual([]);
    });
  });

  describe('Price Update Integration Scenarios', () => {
    it('should handle rapid price updates for same symbol', () => {
      const updates = [
        { e: 'trade', s: 'BTCUSDT', p: '100000', T: 1000 },
        { e: 'trade', s: 'BTCUSDT', p: '100001', T: 1001 },
        { e: 'trade', s: 'BTCUSDT', p: '99999', T: 1002 },
      ];

      const results = updates.map(parseTradeMessage);

      expect(results.every(r => r !== null)).toBe(true);
      expect(results[0]?.price).toBe(100000);
      expect(results[1]?.price).toBe(100001);
      expect(results[2]?.price).toBe(99999);
    });

    it('should handle updates for multiple symbols', () => {
      const updates = [
        { e: 'trade', s: 'BTCUSDT', p: '100000', T: 1000 },
        { e: 'trade', s: 'ETHUSDT', p: '3500', T: 1001 },
        { e: 'trade', s: 'SOLUSDT', p: '150', T: 1002 },
      ];

      const results = updates.map(parseTradeMessage);

      expect(results[0]?.symbol).toBe('BTCUSDT');
      expect(results[1]?.symbol).toBe('ETHUSDT');
      expect(results[2]?.symbol).toBe('SOLUSDT');
    });

    it('should filter out non-trade messages mixed with trades', () => {
      const messages = [
        { e: 'trade', s: 'BTCUSDT', p: '100000', T: 1000 },
        { e: 'kline', s: 'BTCUSDT', k: {} },
        { e: 'trade', s: 'ETHUSDT', p: '3500', T: 1002 },
        { e: 'depth', s: 'BTCUSDT' },
      ];

      const results = messages.map(parseTradeMessage).filter(r => r !== null);

      expect(results.length).toBe(2);
      expect(results[0]?.symbol).toBe('BTCUSDT');
      expect(results[1]?.symbol).toBe('ETHUSDT');
    });
  });

  describe('Subscription Management Scenarios', () => {
    it('should correctly manage subscriptions when positions open and close', () => {
      let subscribedSymbols = new Set<string>();

      const activeRound1 = ['btcusdt', 'ethusdt'];
      const toSubscribe1 = getSymbolsToSubscribe(activeRound1, subscribedSymbols);
      expect(toSubscribe1).toEqual(['btcusdt', 'ethusdt']);

      subscribedSymbols = new Set(activeRound1);

      const activeRound2 = new Set(['ethusdt', 'solusdt']);
      const toUnsubscribe = getSymbolsToUnsubscribe(activeRound2, subscribedSymbols);
      expect(toUnsubscribe).toEqual(['btcusdt']);

      const toSubscribe2 = getSymbolsToSubscribe(['ethusdt', 'solusdt'], subscribedSymbols);
      expect(toSubscribe2).toEqual(['solusdt']);

      subscribedSymbols = new Set(['ethusdt', 'solusdt']);

      const activeRound3 = new Set<string>();
      const toUnsubscribeFinal = getSymbolsToUnsubscribe(activeRound3, subscribedSymbols);
      expect(toUnsubscribeFinal.sort()).toEqual(['ethusdt', 'solusdt'].sort());
    });

    it('should handle duplicate symbols in active positions', () => {
      const activeSymbols = ['btcusdt', 'btcusdt', 'ethusdt'];
      const subscribedSymbols = new Set<string>();

      const toSubscribe = getSymbolsToSubscribe(activeSymbols, subscribedSymbols);

      expect(toSubscribe).toContain('btcusdt');
      expect(toSubscribe).toContain('ethusdt');
    });
  });
});
