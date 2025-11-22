import { describe, it, expect, beforeEach } from 'vitest';
import { useTradingStore } from './tradingStore';

describe('tradingStore', () => {
  beforeEach(() => {
    useTradingStore.setState({
      wallets: [],
      orders: [],
      isSimulatorActive: false,
      activeWalletId: null,
    });
  });

  describe('Wallet Management', () => {
    it('should add a wallet', () => {
      const { addWallet } = useTradingStore.getState();
      
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });

      const { wallets } = useTradingStore.getState();
      expect(wallets).toHaveLength(1);
      expect(wallets[0].id).toBeDefined();
      expect(wallets[0].name).toBe('Test Wallet');
      expect(wallets[0].balance).toBe(10000);
      expect(wallets[0].initialBalance).toBe(10000);
      expect(wallets[0].currency).toBe('USD');
    });

    it('should update a wallet', () => {
      const { addWallet, updateWallet } = useTradingStore.getState();
      
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      const walletId = useTradingStore.getState().wallets[0].id;

      updateWallet(walletId, { name: 'Updated Wallet' });

      const { wallets } = useTradingStore.getState();
      expect(wallets[0].name).toBe('Updated Wallet');
    });

    it('should delete a wallet and its orders', () => {
      const { addWallet, addOrder, deleteWallet } = useTradingStore.getState();
      
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      const walletId = useTradingStore.getState().wallets[0].id;

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        entryPrice: 50000,
        quantity: 0.1,
      });

      deleteWallet(walletId);

      const state = useTradingStore.getState();
      expect(state.wallets).toHaveLength(0);
      expect(state.orders).toHaveLength(0);
    });
  });

  describe('Order Management', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should add an order', () => {
      const { addOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const { orders } = useTradingStore.getState();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBeDefined();
      expect(orders[0].walletId).toBe(walletId);
      expect(orders[0].symbol).toBe('BTCUSDT');
      expect(orders[0].type).toBe('long');
      expect(orders[0].entryPrice).toBe(50000);
      expect(orders[0].quantity).toBe(0.1);
    });

    it('should update an order', () => {
      const { addOrder, updateOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      updateOrder(orderId, { stopLoss: 49000 });

      const { orders } = useTradingStore.getState();
      expect(orders[0].stopLoss).toBe(49000);
    });

    it('should cancel an order', () => {
      const { addOrder, cancelOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      cancelOrder(orderId);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('cancelled');
    });

    it('should close an order', () => {
      const { addOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 51000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('closed');
    });
  });

  describe('Simulator State', () => {
    it('should toggle simulator active state', () => {
      const { toggleSimulator } = useTradingStore.getState();
      
      toggleSimulator();
      expect(useTradingStore.getState().isSimulatorActive).toBe(true);
      
      toggleSimulator();
      expect(useTradingStore.getState().isSimulatorActive).toBe(false);
    });

    it('should set active wallet', () => {
      const { addWallet, setActiveWallet } = useTradingStore.getState();
      
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      const walletId = useTradingStore.getState().wallets[0].id;

      setActiveWallet(walletId);
      expect(useTradingStore.getState().activeWalletId).toBe(walletId);
    });
  });
});
