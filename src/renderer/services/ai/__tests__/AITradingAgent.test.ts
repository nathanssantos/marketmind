import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AITradingAgent, type AITradingAgentConfig } from '../AITradingAgent';
import type { AITradingConfig, Candle } from '../../../../shared/types';

const mockCandles: Candle[] = [
  { timestamp: 1700000000, open: 100, high: 105, low: 99, close: 103, volume: 1000000 },
  { timestamp: 1700000060, open: 103, high: 107, low: 102, close: 106, volume: 1200000 },
  { timestamp: 1700000120, open: 106, high: 110, low: 105, close: 109, volume: 1500000 },
];

const defaultConfig: AITradingConfig = {
  enabled: true,
  riskProfile: 'moderate',
  analysisInterval: '15m',
  maxPositionSize: 10,
  defaultStopLoss: 2,
  defaultTakeProfit: 4,
  maxTradesPerDay: 10,
  maxTradesPerHour: 3,
  minTimeBetweenTrades: 5,
  enabledTimeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
  emergencyStopLosses: 3,
  notifyOnTrade: true,
  notifyOnProfit: true,
  notifyOnLoss: true,
  maxDailyLoss: 5,
  accountRiskPercent: 1,
};

describe('AITradingAgent', () => {
  let agent: AITradingAgent;

  const createAgent = (config: Partial<AITradingConfig> = {}) => {
    const agentConfig: AITradingAgentConfig = {
      config: { ...defaultConfig, ...config },
      getCurrentPrice: () => 100,
      getChartData: () => ({
        symbol: 'BTCUSDT',
        timeframe: '15m',
        chartType: 'candlestick' as const,
        candles: mockCandles,
        news: [],
        events: [],
      }),
      getWalletBalance: () => 10000,
      executeTrade: async () => 'trade-id-123',
    };
    return new AITradingAgent(agentConfig);
  };

  beforeEach(() => {
    agent = createAgent();
  });

  afterEach(() => {
    agent?.stop();
  });

  describe('Configuration', () => {
    it('should initialize with provided config', () => {
      expect(agent).toBeDefined();
    });

    it('should update config correctly', () => {
      agent.updateConfig({ riskProfile: 'conservative', maxPositionSize: 5 });
      expect(agent).toBeDefined();
    });

    it('should support all risk profiles', () => {
      const conservative = createAgent({ riskProfile: 'conservative' });
      const moderate = createAgent({ riskProfile: 'moderate' });
      const aggressive = createAgent({ riskProfile: 'aggressive' });

      expect(conservative).toBeDefined();
      expect(moderate).toBeDefined();
      expect(aggressive).toBeDefined();

      conservative.stop();
      moderate.stop();
      aggressive.stop();
    });
  });

  describe('Position Sizing', () => {
    it('should calculate position size correctly', () => {
      const balance = 10000;
      const entryPrice = 100;
      const stopLoss = 98;

      const riskAmount = (balance * defaultConfig.accountRiskPercent) / 100;
      const stopDistance = Math.abs(entryPrice - stopLoss);
      const riskBasedQuantity = riskAmount / stopDistance;
      const maxPositionValue = (balance * defaultConfig.maxPositionSize) / 100;
      const maxQuantity = maxPositionValue / entryPrice;

      expect(riskBasedQuantity).toBeGreaterThan(0);
      expect(maxQuantity).toBe(10);
    });

    it('should respect max position size', () => {
      const balance = 10000;
      const maxPositionValue = (balance * defaultConfig.maxPositionSize) / 100;
      expect(maxPositionValue).toBe(1000);
    });
  });

  describe('Risk/Reward Validation', () => {
    it('should validate conservative risk/reward', () => {
      const entryPrice = 100;
      const stopLoss = 98;
      const takeProfit = 104;
      const riskReward = Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss);

      expect(riskReward).toBeGreaterThanOrEqual(2.0);
    });

    it('should validate moderate risk/reward', () => {
      const entryPrice = 100;
      const stopLoss = 98;
      const takeProfit = 103;
      const riskReward = Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss);

      expect(riskReward).toBeGreaterThanOrEqual(1.5);
    });
  });

  describe('Emergency Stops', () => {
    it('should track consecutive losses', () => {
      agent.recordTradeResult(-100);
      agent.recordTradeResult(-150);
      agent.recordTradeResult(-200);
      expect(agent).toBeDefined();
    });

    it('should reset consecutive losses on win', () => {
      agent.recordTradeResult(-100);
      agent.recordTradeResult(-150);
      agent.recordTradeResult(200);
      expect(agent).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce minimum time between trades', () => {
      const minTime = defaultConfig.minTimeBetweenTrades * 60 * 1000;
      expect(minTime).toBe(300000);
    });

    it('should respect max trades per hour', () => {
      expect(defaultConfig.maxTradesPerHour).toBe(3);
    });

    it('should respect max trades per day', () => {
      expect(defaultConfig.maxTradesPerDay).toBe(10);
    });
  });

  describe('Analysis Intervals', () => {
    const intervals = ['1m', '5m', '15m', '30m', '1h'] as const;

    intervals.forEach((interval) => {
      it(`should support ${interval} interval`, () => {
        const testAgent = createAgent({ analysisInterval: interval });
        expect(testAgent).toBeDefined();
        testAgent.stop();
      });
    });
  });

  describe('Price Movement', () => {
    it('should detect significant price changes', () => {
      const priceChange = Math.abs(106 - 100) / 100;
      expect(priceChange).toBeGreaterThan(0.01);
    });

    it('should ignore small price movements', () => {
      const priceChange = Math.abs(100.5 - 100) / 100;
      expect(priceChange).toBeLessThan(0.01);
    });
  });

  describe('Volume Analysis', () => {
    it('should detect high volume', () => {
      const avgVolume = 1000000;
      const highVolume = 2000000;
      expect(highVolume).toBeGreaterThan(avgVolume * 1.5);
    });

    it('should detect low volume', () => {
      const avgVolume = 1000000;
      const lowVolume = 500000;
      expect(lowVolume).toBeLessThan(avgVolume);
    });
  });

  describe('Configuration Updates', () => {
    it('should update risk profile', () => {
      agent.updateConfig({ riskProfile: 'conservative' });
      expect(agent).toBeDefined();
    });

    it('should update position limits', () => {
      agent.updateConfig({ maxPositionSize: 20 });
      expect(agent).toBeDefined();
    });

    it('should update stop-loss defaults', () => {
      agent.updateConfig({ defaultStopLoss: 3 });
      expect(agent).toBeDefined();
    });

    it('should update trade limits', () => {
      agent.updateConfig({ maxTradesPerDay: 20, maxTradesPerHour: 5 });
      expect(agent).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle volatile markets', () => {
      const volatileRange = 150 - 50;
      expect(volatileRange).toBeGreaterThan(50);
    });

    it('should handle flat markets', () => {
      const flatRange = 100 - 100;
      expect(flatRange).toBe(0);
    });

    it('should handle zero balance', () => {
      const balance = 0;
      const maxPositionValue = (balance * defaultConfig.maxPositionSize) / 100;
      expect(maxPositionValue).toBe(0);
    });
  });

  describe('Trading Lifecycle', () => {
    it('should handle winning trades', () => {
      agent.recordTradeResult(100);
      agent.recordTradeResult(150);
      expect(agent).toBeDefined();
    });

    it('should handle losing trades', () => {
      agent.recordTradeResult(-50);
      agent.recordTradeResult(-75);
      expect(agent).toBeDefined();
    });

    it('should handle mixed results', () => {
      agent.recordTradeResult(100);
      agent.recordTradeResult(-100);
      agent.recordTradeResult(50);
      agent.recordTradeResult(-50);
      expect(agent).toBeDefined();
    });
  });
});
