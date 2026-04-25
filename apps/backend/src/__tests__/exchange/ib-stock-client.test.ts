import { describe, it, expect } from 'vitest';
import { IBStockClient } from '../../exchange/interactive-brokers/stock-client';
import { IB_COMMISSION_RATES } from '../../exchange/interactive-brokers/constants';

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

});
