import { describe, expect, it } from 'vitest';
import { IBExchangeProvider } from '../../exchange/interactive-brokers/provider';
import {
  IB_PORTS,
  IB_ACCOUNT_SUMMARY_TAGS,
  IB_ORDER_TYPES,
  IB_BAR_SIZES,
  US_STOCK_MARKET_HOURS,
  US_MARKET_REGULAR_SESSION,
  IB_COMMISSION_RATES,
  IB_MARGIN_REQUIREMENTS,
} from '../../exchange/interactive-brokers/constants';

describe('Interactive Brokers Integration', () => {
  describe('IBExchangeProvider', () => {
    const provider = new IBExchangeProvider();

    it('should have correct exchange ID', () => {
      expect(provider.exchangeId).toBe('INTERACTIVE_BROKERS');
    });

    it('should support EQUITY and ETF asset classes', () => {
      expect(provider.capabilities.supportedAssetClasses).toContain('EQUITY');
      expect(provider.capabilities.supportedAssetClasses).toContain('ETF');
    });

    it('should support required order types', () => {
      const orderTypes = provider.capabilities.supportedOrderTypes;
      expect(orderTypes).toContain('LIMIT');
      expect(orderTypes).toContain('MARKET');
      expect(orderTypes).toContain('STOP_LOSS');
      expect(orderTypes).toContain('STOP_LOSS_LIMIT');
      expect(orderTypes).toContain('TRAILING_STOP_MARKET');
    });

    it('should support OCO and algo orders', () => {
      expect(provider.capabilities.supportsOco).toBe(true);
      expect(provider.capabilities.supportsAlgoOrders).toBe(true);
    });

    it('should support leverage via margin accounts', () => {
      expect(provider.capabilities.supportsLeverage).toBe(true);
      expect(provider.capabilities.supportsIsolatedMargin).toBe(false);
    });

    it('should support WebSocket', () => {
      expect(provider.capabilities.supportsWebSocket).toBe(true);
    });

    it('should normalize symbols to uppercase', () => {
      expect(provider.normalizeSymbol('aapl')).toBe('AAPL');
      expect(provider.normalizeSymbol('MSFT')).toBe('MSFT');
      expect(provider.normalizeSymbol('gOoGl')).toBe('GOOGL');
    });

    it('should return correct market hours', () => {
      const hours = provider.getMarketHours();
      expect(hours.timezone).toBe('America/New_York');
      expect(hours.is24h).toBe(false);
      expect(hours.sessions).toHaveLength(3);
    });

    it('should throw when creating futures client', () => {
      expect(() => provider.createFuturesClient({
        apiKey: 'test',
        apiSecret: 'test',
        testnet: true,
      })).toThrow('Interactive Brokers futures trading not yet implemented');
    });
  });

  describe('IB Constants', () => {
    describe('Ports', () => {
      it('should have correct port values', () => {
        expect(IB_PORTS.TWS_LIVE).toBe(7496);
        expect(IB_PORTS.TWS_PAPER).toBe(7497);
        expect(IB_PORTS.GATEWAY_LIVE).toBe(4001);
        expect(IB_PORTS.GATEWAY_PAPER).toBe(4002);
      });
    });

    describe('Account Summary Tags', () => {
      it('should include all required margin tags', () => {
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('NetLiquidation');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('BuyingPower');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('AvailableFunds');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('ExcessLiquidity');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('InitMarginReq');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('MaintMarginReq');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('Cushion');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('Leverage');
        expect(IB_ACCOUNT_SUMMARY_TAGS).toContain('DayTradesRemaining');
      });

      it('should have correct number of tags', () => {
        expect(IB_ACCOUNT_SUMMARY_TAGS.length).toBe(16);
      });
    });

    describe('Order Types', () => {
      it('should have correct IB order type mappings', () => {
        expect(IB_ORDER_TYPES.MARKET).toBe('MKT');
        expect(IB_ORDER_TYPES.LIMIT).toBe('LMT');
        expect(IB_ORDER_TYPES.STOP).toBe('STP');
        expect(IB_ORDER_TYPES.STOP_LIMIT).toBe('STP LMT');
        expect(IB_ORDER_TYPES.TRAILING_STOP).toBe('TRAIL');
        expect(IB_ORDER_TYPES.TRAILING_STOP_LIMIT).toBe('TRAIL LIMIT');
      });
    });

    describe('Bar Sizes', () => {
      it('should map intervals to IB bar size strings', () => {
        expect(IB_BAR_SIZES['1m']).toBe('1 min');
        expect(IB_BAR_SIZES['5m']).toBe('5 mins');
        expect(IB_BAR_SIZES['15m']).toBe('15 mins');
        expect(IB_BAR_SIZES['1h']).toBe('1 hour');
        expect(IB_BAR_SIZES['1d']).toBe('1 day');
        expect(IB_BAR_SIZES['1w']).toBe('1 week');
      });
    });
  });

  describe('Market Hours Configuration', () => {
    it('should use America/New_York timezone', () => {
      expect(US_STOCK_MARKET_HOURS.timezone).toBe('America/New_York');
    });

    it('should not be 24h market', () => {
      expect(US_STOCK_MARKET_HOURS.is24h).toBe(false);
    });

    it('should have 3 sessions (pre-market, regular, after-hours)', () => {
      expect(US_STOCK_MARKET_HOURS.sessions).toHaveLength(3);
    });

    it('should have correct regular session hours', () => {
      expect(US_MARKET_REGULAR_SESSION.open).toBe('09:30');
      expect(US_MARKET_REGULAR_SESSION.close).toBe('16:00');
    });
  });

  describe('Commission Rates', () => {
    it('should have correct tiered commission rates', () => {
      expect(IB_COMMISSION_RATES.TIERED.TIER_1.rate).toBe(0.0035);
      expect(IB_COMMISSION_RATES.TIERED.TIER_1.minCommission).toBe(0.35);
      expect(IB_COMMISSION_RATES.TIERED.TIER_1.maxShares).toBe(300_000);
    });

    it('should have decreasing rates for higher tiers', () => {
      expect(IB_COMMISSION_RATES.TIERED.TIER_2.rate).toBeLessThan(IB_COMMISSION_RATES.TIERED.TIER_1.rate);
      expect(IB_COMMISSION_RATES.TIERED.TIER_3.rate).toBeLessThan(IB_COMMISSION_RATES.TIERED.TIER_2.rate);
      expect(IB_COMMISSION_RATES.TIERED.TIER_4.rate).toBeLessThan(IB_COMMISSION_RATES.TIERED.TIER_3.rate);
    });

    it('should have zero commission for IBKR Lite', () => {
      expect(IB_COMMISSION_RATES.LITE.US_STOCKS).toBe(0);
    });
  });

  describe('Margin Requirements', () => {
    it('should have correct Reg-T margin requirements', () => {
      expect(IB_MARGIN_REQUIREMENTS.INITIAL_MARGIN_LONG).toBe(0.5);
      expect(IB_MARGIN_REQUIREMENTS.MAINTENANCE_MARGIN_LONG).toBe(0.25);
      expect(IB_MARGIN_REQUIREMENTS.INITIAL_MARGIN_SHORT).toBe(0.5);
      expect(IB_MARGIN_REQUIREMENTS.MAINTENANCE_MARGIN_SHORT).toBe(0.3);
    });

    it('should have correct PDT minimum equity', () => {
      expect(IB_MARGIN_REQUIREMENTS.PDT_MINIMUM_EQUITY).toBe(25_000);
    });

    it('should have correct day trading margin', () => {
      expect(IB_MARGIN_REQUIREMENTS.DAY_TRADING_MARGIN).toBe(0.25);
    });
  });
});
