import { describe, it, expect, beforeEach } from 'vitest';
import { IBStockClient } from '../../exchange/interactive-brokers/stock-client';
import { IB_COMMISSION_RATES } from '../../exchange/interactive-brokers/constants';
import type { SpotOrderParams } from '../../exchange/spot-client';

describe('IB Stock Client', () => {
  describe('Initialization', () => {
    it('should create client with paper trading credentials', () => {
      const client = new IBStockClient({
        apiKey: '',
        apiSecret: '',
        testnet: true,
      });

      expect(client.exchangeId).toBe('INTERACTIVE_BROKERS');
    });

    it('should create client with live trading credentials', () => {
      const client = new IBStockClient({
        apiKey: '',
        apiSecret: '',
        testnet: false,
      });

      expect(client.exchangeId).toBe('INTERACTIVE_BROKERS');
    });
  });

  describe('Order Type Mapping', () => {
    it('should have valid commission rates defined', () => {
      expect(IB_COMMISSION_RATES.TIERED.TIER_1.rate).toBeGreaterThan(0);
      expect(IB_COMMISSION_RATES.TIERED.TIER_1.minCommission).toBeGreaterThan(0);
      expect(IB_COMMISSION_RATES.TIERED.TIER_1.maxShares).toBeGreaterThan(0);
    });
  });

  describe('Trade Fees', () => {
    it('should return default trade fees without connection', async () => {
      const client = new IBStockClient({
        apiKey: '',
        apiSecret: '',
        testnet: true,
      });

      const fees = await client.getTradeFees();

      expect(fees.length).toBe(1);
      expect(fees[0]?.symbol).toBe('DEFAULT');
      expect(fees[0]?.makerCommission).toBe(IB_COMMISSION_RATES.TIERED.TIER_1.rate);
      expect(fees[0]?.takerCommission).toBe(IB_COMMISSION_RATES.TIERED.TIER_1.rate);
    });
  });

  describe.skip('Integration Tests (require IB Gateway)', () => {
    let client: IBStockClient;

    beforeEach(() => {
      client = new IBStockClient({
        apiKey: '',
        apiSecret: '',
        testnet: true,
      });
    });

    it('should get account info', async () => {
      const accountInfo = await client.getAccountInfo();

      expect(accountInfo).toBeDefined();
      expect(accountInfo.canTrade).toBeDefined();
      expect(accountInfo.balances).toBeDefined();
      expect(Array.isArray(accountInfo.balances)).toBe(true);
    });

    it('should get account summary', async () => {
      const summary = await client.getAccountSummary();

      expect(summary.netLiquidation).toBeGreaterThanOrEqual(0);
      expect(summary.buyingPower).toBeGreaterThanOrEqual(0);
      expect(summary.availableFunds).toBeGreaterThanOrEqual(0);
      expect(summary.cushion).toBeGreaterThanOrEqual(0);
    });

    it('should submit a market buy order', async () => {
      const params: SpotOrderParams = {
        symbol: 'AAPL',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
      };

      const result = await client.submitOrder(params);

      expect(result.orderId).toBeDefined();
      expect(result.symbol).toBe('AAPL');
      expect(result.side).toBe('BUY');
      expect(result.status).toBe('SUBMITTED');
    });

    it('should submit a limit buy order', async () => {
      const params: SpotOrderParams = {
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
        price: 150.00,
      };

      const result = await client.submitOrder(params);

      expect(result.orderId).toBeDefined();
      expect(result.price).toBe('150');
    });

    it('should submit a stop loss order', async () => {
      const params: SpotOrderParams = {
        symbol: 'AAPL',
        side: 'SELL',
        type: 'STOP_LOSS',
        quantity: 1,
        stopPrice: 145.00,
      };

      const result = await client.submitOrder(params);

      expect(result.orderId).toBeDefined();
      expect(result.type).toBe('STOP_LOSS');
    });

    it('should get open orders', async () => {
      const orders = await client.getOpenOrders();

      expect(Array.isArray(orders)).toBe(true);
    });

    it('should get open orders for specific symbol', async () => {
      const orders = await client.getOpenOrders('AAPL');

      expect(Array.isArray(orders)).toBe(true);
      for (const order of orders) {
        expect(order.symbol).toBe('AAPL');
      }
    });

    it('should cancel an order', async () => {
      const params: SpotOrderParams = {
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
        price: 100.00,
      };

      const orderResult = await client.submitOrder(params);
      const cancelResult = await client.cancelOrder('AAPL', orderResult.orderId);

      expect(cancelResult.orderId).toBe(orderResult.orderId);
      expect(cancelResult.status).toBe('CANCELED');
    });

    it('should submit OCO order (bracket)', async () => {
      const result = await client.submitOcoOrder({
        symbol: 'AAPL',
        side: 'SELL',
        quantity: 1,
        price: 160.00,
        stopPrice: 145.00,
      });

      expect(result.orderListId).toBeDefined();
      expect(result.contingencyType).toBe('OCO');
      expect(result.orders.length).toBe(2);
    });

    it('should disconnect cleanly', async () => {
      await client.disconnect();
    });
  });

  describe.skip('Order Lifecycle Tests (require IB Gateway)', () => {
    let client: IBStockClient;

    beforeEach(() => {
      client = new IBStockClient({
        apiKey: '',
        apiSecret: '',
        testnet: true,
      });
    });

    it('should execute full buy-sell cycle', async () => {
      const buyOrder = await client.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
      });
      expect(buyOrder.orderId).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const sellOrder = await client.submitOrder({
        symbol: 'AAPL',
        side: 'SELL',
        type: 'MARKET',
        quantity: 1,
      });
      expect(sellOrder.orderId).toBeDefined();
    });

    it('should handle partial fills', async () => {
      const largeOrder = await client.submitOrder({
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1000,
        price: 150.00,
      });

      expect(largeOrder.orderId).toBeDefined();

      const orders = await client.getOpenOrders('AAPL');
      const order = orders.find((o) => o.orderId === largeOrder.orderId);
      expect(order).toBeDefined();

      await client.cancelOrder('AAPL', largeOrder.orderId);
    });
  });
});
