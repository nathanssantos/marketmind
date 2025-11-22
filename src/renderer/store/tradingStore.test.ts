import { beforeEach, describe, expect, it } from 'vitest';
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
        subType: 'limit',
        status: 'pending',
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
        subType: 'limit',
        status: 'pending',
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
        subType: 'limit',
        status: 'pending',
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
        subType: 'limit',
        status: 'pending',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      cancelOrder(orderId);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('cancelled');
    });

    it('should close an order', () => {
      const { addOrder, updateOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        subType: 'limit',
        status: 'pending',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      updateOrder(orderId, { status: 'active', filledAt: new Date() });
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

    it('should close all orders in a grouped position when one is closed', () => {
      const { addWallet, addOrder, closeOrder } = useTradingStore.getState();
      
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      const walletId = useTradingStore.getState().wallets[0].id;

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        subType: 'limit',
        status: 'active',
        entryPrice: 50000,
        quantity: 0.1,
        filledAt: new Date(),
      });

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        subType: 'limit',
        status: 'active',
        entryPrice: 51000,
        quantity: 0.1,
        filledAt: new Date(),
      });

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        subType: 'limit',
        status: 'active',
        entryPrice: 49000,
        quantity: 0.1,
        filledAt: new Date(),
      });

      const orders = useTradingStore.getState().orders;
      expect(orders.length).toBe(3);
      expect(orders.every(o => o.status === 'active')).toBe(true);

      const firstOrderId = orders[0].id;
      closeOrder(firstOrderId, 52000);

      const updatedOrders = useTradingStore.getState().orders;
      expect(updatedOrders.every(o => o.status === 'closed')).toBe(true);
      
      const wallet = useTradingStore.getState().wallets.find(w => w.id === walletId);
      expect(wallet?.balance).toBeGreaterThan(10000);
    });

    it('should activate pending order at market price', () => {
      const { addWallet, addOrder, activateOrder } = useTradingStore.getState();
      
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      const walletId = useTradingStore.getState().wallets[0].id;

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        subType: 'stop',
        entryPrice: 51000,
        quantity: 0.1,
        status: 'pending',
        currentPrice: 50000,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      const marketPrice = 50500;

      activateOrder(orderId, marketPrice);

      const order = useTradingStore.getState().orders.find(o => o.id === orderId);
      expect(order?.status).toBe('active');
      expect(order?.entryPrice).toBe(marketPrice);
      expect(order?.currentPrice).toBe(marketPrice);
      expect(order?.filledAt).toBeDefined();
    });
  });

  describe('Clear Data', () => {
    it('should clear all wallets and orders', () => {
      const { addWallet, addOrder, clearAllData } = useTradingStore.getState();
      
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      const walletId = useTradingStore.getState().wallets[0].id;

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        type: 'long',
        subType: 'limit',
        status: 'pending',
        entryPrice: 50000,
        quantity: 0.1,
      });

      clearAllData();

      const state = useTradingStore.getState();
      expect(state.wallets).toHaveLength(0);
      expect(state.orders).toHaveLength(0);
      expect(state.activeWalletId).toBeNull();
    });
  });
});
