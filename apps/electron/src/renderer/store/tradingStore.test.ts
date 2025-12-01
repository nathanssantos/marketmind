import { isOrderActive, isOrderClosed } from '@shared/utils/orderUtils';
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
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
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
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const { orders } = useTradingStore.getState();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBeDefined();
      expect(orders[0].walletId).toBe(walletId);
      expect(orders[0].symbol).toBe('BTCUSDT');
      expect(orders[0].orderDirection).toBe('long');
      expect(orders[0].entryPrice).toBe(50000);
      expect(orders[0].quantity).toBe(0.1);
    });

    it('should update an order', () => {
      const { addOrder, updateOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
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
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
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
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      updateOrder(orderId, { status: 'FILLED', filledAt: new Date() });
      closeOrder(orderId, 51000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('FILLED');
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
        orderDirection: 'long',
        subType: 'limit',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
        filledAt: new Date(),
      });

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'FILLED',
        entryPrice: 51000,
        quantity: 0.1,
        filledAt: new Date(),
      });

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'FILLED',
        entryPrice: 49000,
        quantity: 0.1,
        filledAt: new Date(),
      });

      const orders = useTradingStore.getState().orders;
      expect(orders.length).toBe(3);
      expect(orders.every(o => o.status === 'FILLED')).toBe(true);

      const firstOrderId = orders[0].id;
      closeOrder(firstOrderId, 52000);

      const updatedOrders = useTradingStore.getState().orders;
      expect(updatedOrders.every(o => o.closedAt !== undefined)).toBe(true);
      
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
        orderDirection: 'long',
        subType: 'stop',
        entryPrice: 51000,
        quantity: 0.1,
        status: 'NEW',
        currentPrice: 50000,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      const marketPrice = 50500;

      activateOrder(orderId, marketPrice);

      const order = useTradingStore.getState().orders.find(o => o.id === orderId);
      expect(order?.status).toBe('FILLED');
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
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
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

  describe('Position Netting System', () => {
    let walletId: string;
    const appLoadTime = Date.now() - 1000;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    describe('Partial Position Reduction', () => {
      it('should reduce long position when short is activated (long 10 -> short 5 = long 5)', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 10,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 51000,
          quantity: 5,
        });

        fillPendingOrders('BTCUSDT', 51000, 50900, appLoadTime);

        const orders = useTradingStore.getState().orders;
        const activeOrders = orders.filter(isOrderActive);
        const closedOrders = orders.filter(isOrderClosed);

        expect(activeOrders).toHaveLength(1);
        expect(activeOrders[0].orderDirection).toBe('long');
        expect(activeOrders[0].quantity).toBe(5);
        expect(activeOrders[0].entryPrice).toBe(50000);

        expect(closedOrders).toHaveLength(1);
        expect(closedOrders[0].orderDirection).toBe('short');
      });

      it('should reduce short position when long is activated (short 10 -> long 5 = short 5)', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 10,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 49000,
          quantity: 5,
        });

        fillPendingOrders('BTCUSDT', 49000, 49100, appLoadTime);

        const orders = useTradingStore.getState().orders;
        const activeOrders = orders.filter(isOrderActive);
        const closedOrders = orders.filter(isOrderClosed);

        expect(activeOrders).toHaveLength(1);
        expect(activeOrders[0].orderDirection).toBe('short');
        expect(activeOrders[0].quantity).toBe(5);
        expect(activeOrders[0].entryPrice).toBe(50000);

        expect(closedOrders).toHaveLength(1);
        expect(closedOrders[0].orderDirection).toBe('long');
      });
    });

    describe('Full Position Closure', () => {
      it('should close entire position when opposite order equals position size', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 10,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 51000,
          quantity: 10,
        });

        fillPendingOrders('BTCUSDT', 51000, 50900, appLoadTime);

        const orders = useTradingStore.getState().orders;
        const activeOrders = orders.filter(isOrderActive);
        const closedOrders = orders.filter(isOrderClosed);

        expect(activeOrders).toHaveLength(0);
        expect(closedOrders).toHaveLength(2);

        const longOrder = closedOrders.find(o => o.orderDirection === 'long');
        expect(longOrder?.pnl).toBeDefined();
        expect(parseFloat(longOrder?.pnl || '0')).toBeGreaterThan(0);
      });
    });

    describe('Position Reversal', () => {
      it('should reverse position when opposite order exceeds current position', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 5,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 51000,
          quantity: 10,
        });

        fillPendingOrders('BTCUSDT', 51000, 50900, appLoadTime);

        const orders = useTradingStore.getState().orders;
        const activeOrders = orders.filter(isOrderActive);
        const closedOrders = orders.filter(isOrderClosed);

        expect(activeOrders).toHaveLength(1);
        expect(activeOrders[0].orderDirection).toBe('short');
        expect(activeOrders[0].quantity).toBe(5);
        expect(activeOrders[0].entryPrice).toBe(51000);

        expect(closedOrders).toHaveLength(1);
        expect(closedOrders[0].orderDirection).toBe('long');
      });
    });

    describe('PnL Calculation on Netting', () => {
      it('should calculate correct PnL when closing long position with profit', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        const initialBalance = useTradingStore.getState().wallets[0].balance;
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 1,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 52000,
          quantity: 1,
        });

        fillPendingOrders('BTCUSDT', 52000, 51900, appLoadTime);

        const closedOrders = useTradingStore.getState().orders.filter(isOrderClosed);
        const longOrder = closedOrders.find(o => o.orderDirection === 'long');

        expect(parseFloat(longOrder?.pnl || '0')).toBe(2000);
        expect(longOrder?.pnlPercent).toBeCloseTo(4, 1);

        const wallet = useTradingStore.getState().wallets[0];
        expect(wallet.balance).toBeGreaterThan(initialBalance);
      });

      it('should calculate correct PnL when closing short position with loss', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 1,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 51000,
          quantity: 1,
        });

        fillPendingOrders('BTCUSDT', 51000, 50900, appLoadTime);

        const closedOrders = useTradingStore.getState().orders.filter(isOrderClosed);
        const shortOrder = closedOrders.find(o => o.orderDirection === 'short');

        expect(parseFloat(shortOrder?.pnl || '0')).toBe(-1000);
        expect(shortOrder?.pnlPercent).toBeCloseTo(-2, 1);
      });
    });

    describe('Multiple Orders Netting', () => {
      it('should net against multiple opposite orders', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 3,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 51000,
          quantity: 4,
          filledAt: new Date(),
          currentPrice: 51000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 52000,
          quantity: 5,
        });

        fillPendingOrders('BTCUSDT', 52000, 51900, appLoadTime);

        const orders = useTradingStore.getState().orders;
        const activeOrders = orders.filter(isOrderActive);
        const closedOrders = orders.filter(isOrderClosed);

        expect(closedOrders).toHaveLength(2);
        expect(closedOrders.filter(o => o.orderDirection === 'long')).toHaveLength(1);
        expect(closedOrders.filter(o => o.orderDirection === 'short')).toHaveLength(1);

        expect(activeOrders).toHaveLength(1);
        expect(activeOrders[0].orderDirection).toBe('long');
        expect(activeOrders[0].quantity).toBe(2);
      });
    });

    describe('No Netting When No Opposite Orders', () => {
      it('should not net when no opposite orders exist', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'FILLED',
          entryPrice: 50000,
          quantity: 10,
          filledAt: new Date(),
          currentPrice: 50000,
        });

        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 51000,
          quantity: 5,
        });

        fillPendingOrders('BTCUSDT', 51000, 50900, appLoadTime);

        const orders = useTradingStore.getState().orders;
        const activeOrders = orders.filter(isOrderActive);

        expect(activeOrders).toHaveLength(2);
        expect(activeOrders.every(o => o.orderDirection === 'long')).toBe(true);
      });
    });

    describe('Price Crossing Detection', () => {
      it('should not activate order if price has not crossed', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 51000,
          quantity: 1,
        });

        fillPendingOrders('BTCUSDT', 50500, 50000, appLoadTime);

        const orders = useTradingStore.getState().orders;
        expect(orders[0].status).toBe('NEW');
      });

      it('should activate limit order when price crosses down', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'long',
          subType: 'limit',
          status: 'NEW',
          entryPrice: 49000,
          quantity: 1,
        });

        fillPendingOrders('BTCUSDT', 49000, 49500, appLoadTime);

        const orders = useTradingStore.getState().orders;
        expect(orders[0].status).toBe('FILLED');
      });

      it('should activate stop order when price crosses up', () => {
        const { addOrder, fillPendingOrders } = useTradingStore.getState();
        
        addOrder({
          walletId,
          symbol: 'BTCUSDT',
          orderDirection: 'short',
          subType: 'stop',
          status: 'NEW',
          entryPrice: 51000,
          quantity: 1,
        });

        fillPendingOrders('BTCUSDT', 51000, 50500, appLoadTime);

        const orders = useTradingStore.getState().orders;
        expect(orders[0].status).toBe('FILLED');
      });
    });
  });

  describe('Stop Loss and Take Profit', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should close long order when price hits stop loss', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
        stopLoss: 49000,
      });

      fillPendingOrders('BTCUSDT', 48000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('FILLED');
      expect(orders[0].exitPrice).toBe(49000);
      expect(parseFloat(orders[0].pnl || '0')).toBeLessThan(0);
    });

    it('should close long order when price hits take profit', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
        takeProfit: 52000,
      });

      fillPendingOrders('BTCUSDT', 53000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('FILLED');
      expect(orders[0].exitPrice).toBe(52000);
      expect(parseFloat(orders[0].pnl || '0')).toBeGreaterThan(0);
    });

    it('should close short order when price hits stop loss', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'short',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
        stopLoss: 51000,
      });

      fillPendingOrders('BTCUSDT', 52000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('FILLED');
      expect(orders[0].exitPrice).toBe(51000);
      expect(parseFloat(orders[0].pnl || '0')).toBeLessThan(0);
    });

    it('should close short order when price hits take profit', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'short',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
        takeProfit: 48000,
      });

      fillPendingOrders('BTCUSDT', 47000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('FILLED');
      expect(orders[0].exitPrice).toBe(48000);
      expect(parseFloat(orders[0].pnl || '0')).toBeGreaterThan(0);
    });

    it('should prioritize stop loss over take profit when both are hit', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
        stopLoss: 49000,
        takeProfit: 52000,
      });

      fillPendingOrders('BTCUSDT', 48000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].exitPrice).toBe(49000);
    });
  });

  describe('Order Expiration', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should cancel expired pending orders', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      
      const pastTime = Date.now() - 1000;
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 50000,
        quantity: 0.1,
        expiresAt: pastTime,
      });

      fillPendingOrders('BTCUSDT', 49000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('EXPIRED');
    });

    it('should not cancel orders without expiration', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 50000,
        quantity: 0.1,
      });

      fillPendingOrders('BTCUSDT', 49000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].status).toBe('NEW');
    });
  });

  describe('Commission Calculation', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should calculate commission on order activation', () => {
      const { addOrder, fillPendingOrders } = useTradingStore.getState();
      const appLoadTime = Date.now() - 10000;
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 50000,
        quantity: 0.1,
        commissionRate: 0.001,
      });

      fillPendingOrders('BTCUSDT', 50000, 49000, appLoadTime);

      const { orders } = useTradingStore.getState();
      const expectedCommission = 50000 * 0.1 * 0.001;
      expect(orders[0].commission).toBe(expectedCommission);
    });

    it('should deduct commission from wallet balance', () => {
      const { addOrder, fillPendingOrders, wallets } = useTradingStore.getState();
      const initialBalance = wallets[0].balance;
      const appLoadTime = Date.now() - 10000;
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 50000,
        quantity: 0.1,
        commissionRate: 0.001,
      });

      fillPendingOrders('BTCUSDT', 50000, 49000, appLoadTime);

      const { wallets: updatedWallets, orders } = useTradingStore.getState();
      const investment = 50000 * 0.1;
      const commission = orders[0].commission || 0;
      const expectedBalance = initialBalance - investment - commission;
      
      expect(updatedWallets[0].balance).toBe(expectedBalance);
    });
  });

  describe('Grouped Positions', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 100000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should calculate total PnL across grouped orders', () => {
      const { addOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
      });

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 51000,
        quantity: 0.1,
      });

      const { orders } = useTradingStore.getState();
      const firstOrderId = orders[0].id;

      closeOrder(firstOrderId, 52000);

      const { orders: closedOrders } = useTradingStore.getState();
      const totalPnl = closedOrders.reduce((sum, o) => sum + (parseFloat(o.pnl || '0')), 0);
      const expectedPnl = (52000 - 50000) * 0.1 + (52000 - 51000) * 0.1;
      
      expect(totalPnl).toBeCloseTo(expectedPnl, 1);
    });
  });

  describe('Edge Cases', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should handle zero quantity orders', () => {
      const { addOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0,
      });

      const { orders } = useTradingStore.getState();
      expect(orders[0].quantity).toBe(0);
    });

    it('should handle updating non-existent order', () => {
      const { updateOrder } = useTradingStore.getState();
      
      updateOrder('non-existent-id', { quantity: 1 });

      const { orders } = useTradingStore.getState();
      expect(orders).toHaveLength(0);
    });

    it('should handle canceling non-existent order', () => {
      const { cancelOrder } = useTradingStore.getState();
      
      cancelOrder('non-existent-id');

      const { orders } = useTradingStore.getState();
      expect(orders).toHaveLength(0);
    });

    it('should handle closing non-existent order', () => {
      const { closeOrder } = useTradingStore.getState();
      
      closeOrder('non-existent-id', 50000);

      const { orders } = useTradingStore.getState();
      expect(orders).toHaveLength(0);
    });

    it('should handle deleting non-existent wallet', () => {
      const { deleteWallet, wallets } = useTradingStore.getState();
      const initialLength = wallets.length;
      
      deleteWallet('non-existent-id');

      const { wallets: updatedWallets } = useTradingStore.getState();
      expect(updatedWallets).toHaveLength(initialLength);
    });

    it('should handle updating non-existent wallet', () => {
      const { updateWallet } = useTradingStore.getState();
      
      updateWallet('non-existent-id', { name: 'Updated' });

      const { wallets } = useTradingStore.getState();
      expect(wallets.every(w => w.name !== 'Updated')).toBe(true);
    });
  });

  describe('Wallet Performance Tracking', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should initialize wallet with performance point', () => {
      const { wallets } = useTradingStore.getState();
      const wallet = wallets.find(w => w.id === walletId);

      expect(wallet?.performance).toHaveLength(1);
      expect(wallet?.performance[0].balance).toBe(10000);
      expect(wallet?.performance[0].pnl).toBe(0);
      expect(wallet?.performance[0].pnlPercent).toBe(0);
    });

    it('should record wallet performance with profit', () => {
      const { addOrder, closeOrder, recordWalletPerformance } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 55000);

      recordWalletPerformance(walletId);

      const { wallets } = useTradingStore.getState();
      const wallet = wallets.find(w => w.id === walletId);

      expect(wallet?.performance).toHaveLength(2);
      expect(wallet?.performance[1].balance).toBeGreaterThan(10000);
      expect(wallet?.performance[1].pnl).toBeGreaterThan(0);
      expect(wallet?.performance[1].pnlPercent).toBeGreaterThan(0);
    });

    it('should record wallet performance with loss', () => {
      const { addOrder, closeOrder, recordWalletPerformance, wallets: initialWallets } = useTradingStore.getState();
      const initialBalance = initialWallets.find(w => w.id === walletId)?.balance || 0;
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 45000);

      recordWalletPerformance(walletId);

      const { wallets } = useTradingStore.getState();
      const wallet = wallets.find(w => w.id === walletId);
      
      const investment = 50000 * 0.1;
      const tradePnl = (45000 - 50000) * 0.1;
      const expectedBalance = initialBalance + investment + tradePnl;
      const expectedTotalPnl = expectedBalance - initialBalance;

      expect(wallet?.performance).toHaveLength(2);
      expect(wallet?.performance[1].balance).toBe(expectedBalance);
      expect(wallet?.performance[1].pnl).toBe(expectedTotalPnl);
      expect(wallet?.performance[1].pnlPercent).toBeCloseTo((expectedTotalPnl / initialBalance) * 100, 1);
    });

    it('should record multiple performance points', () => {
      const { recordWalletPerformance } = useTradingStore.getState();
      
      recordWalletPerformance(walletId);
      recordWalletPerformance(walletId);
      recordWalletPerformance(walletId);

      const { wallets } = useTradingStore.getState();
      const wallet = wallets.find(w => w.id === walletId);

      expect(wallet?.performance).toHaveLength(4);
    });
  });

  describe('Position Calculations', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 100000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should calculate positions correctly for single order', () => {
      const { addOrder, getPositions } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
        currentPrice: 52000,
      });

      const positions = getPositions(walletId);

      expect(positions).toHaveLength(1);
      expect(positions[0].symbol).toBe('BTCUSDT');
      expect(positions[0].quantity).toBe(1);
      expect(positions[0].avgPrice).toBe(50000);
      expect(positions[0].currentPrice).toBe(52000);
      expect(parseFloat(String(positions[0].pnl || 0))).toBe(2000);
      expect(positions[0].pnlPercent).toBeCloseTo(4, 1);
    });

    it('should calculate positions for multiple orders on same symbol', () => {
      const { addOrder, getPositions } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
        currentPrice: 52000,
      });

      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 51000,
        quantity: 1,
        currentPrice: 52000,
      });

      const positions = getPositions(walletId);

      expect(positions).toHaveLength(1);
      expect(positions[0].quantity).toBe(2);
      expect(positions[0].avgPrice).toBe(50500);
      expect(parseFloat(String(positions[0].pnl || 0))).toBe(3000);
    });

    it('should get position by symbol', () => {
      const { addOrder, getPositionBySymbol } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
        currentPrice: 52000,
      });

      addOrder({
        walletId,
        symbol: 'ETHUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 3000,
        quantity: 5,
        currentPrice: 3100,
      });

      const btcPosition = getPositionBySymbol('BTCUSDT', walletId);
      const ethPosition = getPositionBySymbol('ETHUSDT', walletId);

      expect(btcPosition?.symbol).toBe('BTCUSDT');
      expect(ethPosition?.symbol).toBe('ETHUSDT');
      expect(btcPosition?.quantity).toBe(1);
      expect(ethPosition?.quantity).toBe(5);
    });

    it('should return null for non-existent position', () => {
      const { getPositionBySymbol } = useTradingStore.getState();
      
      const position = getPositionBySymbol('BTCUSDT', walletId);

      expect(position).toBeNull();
    });
  });

  describe('Order Filtering', () => {
    let wallet1Id: string;
    let wallet2Id: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Wallet 1', initialBalance: 10000, currency: 'USD' });
      addWallet({ name: 'Wallet 2', initialBalance: 20000, currency: 'USD' });
      const wallets = useTradingStore.getState().wallets;
      wallet1Id = wallets[0].id;
      wallet2Id = wallets[1].id;
    });

    it('should get orders by symbol', () => {
      const { addOrder, getOrdersBySymbol } = useTradingStore.getState();
      
      addOrder({
        walletId: wallet1Id,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      addOrder({
        walletId: wallet1Id,
        symbol: 'ETHUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 3000,
        quantity: 5,
      });

      addOrder({
        walletId: wallet2Id,
        symbol: 'BTCUSDT',
        orderDirection: 'short',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 51000,
        quantity: 0.5,
      });

      const btcOrders = getOrdersBySymbol('BTCUSDT');

      expect(btcOrders).toHaveLength(2);
      expect(btcOrders.every(o => o.symbol === 'BTCUSDT')).toBe(true);
    });

    it('should get orders by wallet', () => {
      const { addOrder, getOrdersByWallet } = useTradingStore.getState();
      
      addOrder({
        walletId: wallet1Id,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      addOrder({
        walletId: wallet1Id,
        symbol: 'ETHUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 3000,
        quantity: 5,
      });

      addOrder({
        walletId: wallet2Id,
        symbol: 'BTCUSDT',
        orderDirection: 'short',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 51000,
        quantity: 0.5,
      });

      const wallet1Orders = getOrdersByWallet(wallet1Id);
      const wallet2Orders = getOrdersByWallet(wallet2Id);

      expect(wallet1Orders).toHaveLength(2);
      expect(wallet2Orders).toHaveLength(1);
      expect(wallet1Orders.every(o => o.walletId === wallet1Id)).toBe(true);
      expect(wallet2Orders.every(o => o.walletId === wallet2Id)).toBe(true);
    });

    it('should get active orders only', () => {
      const { addOrder, cancelOrder, getActiveOrders } = useTradingStore.getState();
      
      addOrder({
        walletId: wallet1Id,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      addOrder({
        walletId: wallet1Id,
        symbol: 'ETHUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 3000,
        quantity: 5,
      });

      const orders = useTradingStore.getState().orders;
      cancelOrder(orders[1].id);

      const activeOrders = getActiveOrders();

      expect(activeOrders).toHaveLength(1);
      expect(activeOrders[0].status).toBe('FILLED');
    });
  });

  describe('Default Settings', () => {
    it('should set default quantity', () => {
      const { setDefaultQuantity, defaultQuantity: initial } = useTradingStore.getState();
      
      expect(initial).toBe(1);

      setDefaultQuantity(5);

      const { defaultQuantity } = useTradingStore.getState();
      expect(defaultQuantity).toBe(5);
    });

    it('should set default expiration', () => {
      const { setDefaultExpiration, defaultExpiration: initial } = useTradingStore.getState();
      
      expect(initial).toBe('gtc');

      setDefaultExpiration('day');

      const { defaultExpiration } = useTradingStore.getState();
      expect(defaultExpiration).toBe('day');
    });
  });

  describe('Price Updates', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 10000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should update prices for active orders', () => {
      const { addOrder, updatePrices } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      updatePrices('BTCUSDT', 52000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].currentPrice).toBe(52000);
    });

    it('should update prices for pending orders', () => {
      const { addOrder, updatePrices } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'limit',
        status: 'NEW',
        entryPrice: 49000,
        quantity: 1,
      });

      updatePrices('BTCUSDT', 50000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].currentPrice).toBe(50000);
    });

    it('should not update prices for closed orders', () => {
      const { addOrder, closeOrder, updatePrices } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
        currentPrice: 50000,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 52000);

      updatePrices('BTCUSDT', 55000);

      const { orders } = useTradingStore.getState();
      expect(orders[0].currentPrice).toBe(52000);
    });

    it('should only update orders for matching symbol', () => {
      const { addOrder, updatePrices } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      addOrder({
        walletId,
        symbol: 'ETHUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 3000,
        quantity: 5,
      });

      updatePrices('BTCUSDT', 52000);

      const { orders } = useTradingStore.getState();
      const btcOrder = orders.find(o => o.symbol === 'BTCUSDT');
      const ethOrder = orders.find(o => o.symbol === 'ETHUSDT');

      expect(btcOrder?.currentPrice).toBe(52000);
      expect(ethOrder?.currentPrice).toBeUndefined();
    });
  });

  describe('PnL Calculation Edge Cases', () => {
    let walletId: string;

    beforeEach(() => {
      const { addWallet } = useTradingStore.getState();
      addWallet({ name: 'Test Wallet', initialBalance: 1000000, currency: 'USD' });
      walletId = useTradingStore.getState().wallets[0].id;
    });

    it('should calculate PnL for very small quantities', () => {
      const { addOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 0.00000001,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 55000);

      const { orders } = useTradingStore.getState();
      const pnl = parseFloat(orders[0].pnl || '0');

      expect(pnl).toBeCloseTo(0.00005, 8);
    });

    it('should calculate PnL for large quantities', () => {
      const { addOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 10,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 55000);

      const { orders } = useTradingStore.getState();
      expect(parseFloat(orders[0].pnl || '0')).toBe(50000);
    });

    it('should calculate negative PnL correctly for shorts', () => {
      const { addOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'short',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 55000);

      const { orders } = useTradingStore.getState();
      expect(parseFloat(orders[0].pnl || '0')).toBe(-5000);
      expect(orders[0].pnlPercent).toBeCloseTo(-10, 1);
    });

    it('should calculate PnL with price at exact entry', () => {
      const { addOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 50000);

      const { orders } = useTradingStore.getState();
      expect(parseFloat(orders[0].pnl || '0')).toBe(0);
      expect(orders[0].pnlPercent).toBe(0);
    });

    it('should handle extreme price movements', () => {
      const { addOrder, closeOrder } = useTradingStore.getState();
      
      addOrder({
        walletId,
        symbol: 'BTCUSDT',
        orderDirection: 'long',
        subType: 'market',
        status: 'FILLED',
        entryPrice: 50000,
        quantity: 1,
      });

      const orderId = useTradingStore.getState().orders[0].id;
      closeOrder(orderId, 100000);

      const { orders } = useTradingStore.getState();
      expect(parseFloat(orders[0].pnl || '0')).toBe(50000);
      expect(orders[0].pnlPercent).toBe(100);
    });
  });
});

