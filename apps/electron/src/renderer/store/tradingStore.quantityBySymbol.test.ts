import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTradingStore } from './tradingStore';

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: vi.fn(),
  },
}));

describe('TradingStore - Quantity Per Symbol', () => {
  beforeEach(() => {
    const state = useTradingStore.getState();
    state.clearAllData();
  });

  describe('getQuantityForSymbol', () => {
    it('should return default quantity when symbol not set', () => {
      const state = useTradingStore.getState();
      state.setDefaultQuantity(10);

      const quantity = state.getQuantityForSymbol('BTCUSDT');
      expect(quantity).toBe(10);
    });

    it('should return symbol-specific quantity when set', () => {
      const state = useTradingStore.getState();
      state.setDefaultQuantity(10);
      state.setQuantityForSymbol('BTCUSDT', 5);

      const quantity = state.getQuantityForSymbol('BTCUSDT');
      expect(quantity).toBe(5);
    });

    it('should return default quantity for different symbol', () => {
      const state = useTradingStore.getState();
      state.setDefaultQuantity(10);
      state.setQuantityForSymbol('BTCUSDT', 5);

      const ethQuantity = state.getQuantityForSymbol('ETHUSDT');
      expect(ethQuantity).toBe(10);
    });
  });

  describe('setQuantityForSymbol', () => {
    it('should set quantity for specific symbol', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTCUSDT', 7);

      const updatedState = useTradingStore.getState();
      expect(updatedState.quantityBySymbol.BTCUSDT).toBe(7);
    });

    it('should update existing symbol quantity', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTCUSDT', 5);
      state.setQuantityForSymbol('BTCUSDT', 15);

      const updatedState = useTradingStore.getState();
      expect(updatedState.quantityBySymbol.BTCUSDT).toBe(15);
    });

    it('should handle multiple symbols independently', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTCUSDT', 5);
      state.setQuantityForSymbol('ETHUSDT', 10);
      state.setQuantityForSymbol('BNBUSDT', 20);

      const updatedState = useTradingStore.getState();
      expect(updatedState.quantityBySymbol.BTCUSDT).toBe(5);
      expect(updatedState.quantityBySymbol.ETHUSDT).toBe(10);
      expect(updatedState.quantityBySymbol.BNBUSDT).toBe(20);
    });

    it('should not affect other symbols when updating one', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTCUSDT', 5);
      state.setQuantityForSymbol('ETHUSDT', 10);

      state.setQuantityForSymbol('BTCUSDT', 7);

      const updatedState = useTradingStore.getState();
      expect(updatedState.quantityBySymbol.BTCUSDT).toBe(7);
      expect(updatedState.quantityBySymbol.ETHUSDT).toBe(10);
    });
  });

  describe('clearAllData', () => {
    it('should reset quantityBySymbol to empty object', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTCUSDT', 5);
      state.setQuantityForSymbol('ETHUSDT', 10);

      state.clearAllData();

      expect(state.quantityBySymbol).toEqual({});
    });

    it('should fallback to default quantity after clearing', () => {
      const state = useTradingStore.getState();
      state.setDefaultQuantity(10);
      state.setQuantityForSymbol('BTCUSDT', 5);

      state.clearAllData();
      state.setDefaultQuantity(10);

      const quantity = state.getQuantityForSymbol('BTCUSDT');
      expect(quantity).toBe(10);
    });
  });

  describe('persistence behavior', () => {
    it('should maintain quantityBySymbol in state', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTCUSDT', 5);
      state.setQuantityForSymbol('ETHUSDT', 10);

      const currentState = useTradingStore.getState();
      expect(currentState.quantityBySymbol).toEqual({
        BTCUSDT: 5,
        ETHUSDT: 10,
      });
    });

    it('should handle edge case with zero quantity', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTCUSDT', 0);

      const quantity = state.getQuantityForSymbol('BTCUSDT');
      expect(quantity).toBe(0);
    });

    it('should handle symbols with special characters', () => {
      const state = useTradingStore.getState();
      state.setQuantityForSymbol('BTC-USDT', 5);
      state.setQuantityForSymbol('ETH_USDT', 10);

      const updatedState = useTradingStore.getState();
      expect(updatedState.quantityBySymbol['BTC-USDT']).toBe(5);
      expect(updatedState.quantityBySymbol['ETH_USDT']).toBe(10);
    });
  });

  describe('integration with default quantity', () => {
    it('should fallback to updated default quantity', () => {
      const state = useTradingStore.getState();
      state.setDefaultQuantity(10);

      let quantity = state.getQuantityForSymbol('BTCUSDT');
      expect(quantity).toBe(10);

      state.setDefaultQuantity(20);
      quantity = state.getQuantityForSymbol('BTCUSDT');
      expect(quantity).toBe(20);
    });

    it('should prioritize symbol-specific over default', () => {
      const state = useTradingStore.getState();
      state.setDefaultQuantity(10);
      state.setQuantityForSymbol('BTCUSDT', 5);

      state.setDefaultQuantity(20);

      const btcQuantity = state.getQuantityForSymbol('BTCUSDT');
      const ethQuantity = state.getQuantityForSymbol('ETHUSDT');

      expect(btcQuantity).toBe(5);
      expect(ethQuantity).toBe(20);
    });
  });
});
