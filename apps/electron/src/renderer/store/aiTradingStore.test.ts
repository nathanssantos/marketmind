import type { AITrade } from '@marketmind/types';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_TRADING_CONFIG, DEFAULT_TRADING_STATS, useAITradingStore } from './aiTradingStore';

const createMockTrade = (overrides: Partial<AITrade> = {}): AITrade => ({
  id: `trade-${Date.now()}`,
  openTime: new Date(),
  symbol: 'BTCUSDT',
  side: 'long',
  entryPrice: 50000,
  currentPrice: 51000,
  stopLoss: 49000,
  takeProfit: 52000,
  positionSize: 0.1,
  patterns: ['bullish-engulfing'],
  confidence: 0.8,
  riskReward: 2.0,
  analysisTokens: 100,
  status: 'open',
  ...overrides,
});

describe('aiTradingStore', () => {
  beforeEach(() => {
    act(() => {
      useAITradingStore.setState({
        isAutoTradingActive: false,
        tradingConfig: DEFAULT_TRADING_CONFIG,
        trades: [],
        tradingStats: DEFAULT_TRADING_STATS,
        lastAnalysisTime: null,
        lastTradeTime: null,
        analysisInProgress: false,
        tradingError: null,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useAITradingStore.getState().clearTradingHistory();
    });
  });

  it('should have default state', () => {
    const { result } = renderHook(() => useAITradingStore());
    expect(result.current.isAutoTradingActive).toBe(false);
    expect(result.current.tradingConfig).toEqual(DEFAULT_TRADING_CONFIG);
    expect(result.current.trades).toHaveLength(0);
  });

  it('should toggle auto trading', () => {
    const { result } = renderHook(() => useAITradingStore());
    expect(result.current.isAutoTradingActive).toBe(false);
    act(() => {
      result.current.toggleAutoTrading();
    });
    expect(result.current.isAutoTradingActive).toBe(true);
    expect(result.current.tradingError).toBeNull();
    act(() => {
      result.current.toggleAutoTrading();
    });
    expect(result.current.isAutoTradingActive).toBe(false);
  });

  it('should update trading config', () => {
    const { result } = renderHook(() => useAITradingStore());
    act(() => {
      result.current.updateTradingConfig({ maxPositionSize: 20, maxTradesPerDay: 5 });
    });
    expect(result.current.tradingConfig.maxPositionSize).toBe(20);
    expect(result.current.tradingConfig.maxTradesPerDay).toBe(5);
    expect(result.current.tradingConfig.riskProfile).toBe('moderate');
  });

  it('should add trade', () => {
    const { result } = renderHook(() => useAITradingStore());
    const trade = createMockTrade();
    act(() => {
      result.current.addTrade(trade);
    });
    expect(result.current.trades).toHaveLength(1);
    expect(result.current.trades[0].symbol).toBe('BTCUSDT');
    expect(result.current.lastTradeTime).not.toBeNull();
  });

  it('should update trade', () => {
    const { result } = renderHook(() => useAITradingStore());
    const trade = createMockTrade({ id: 'test-trade' });
    act(() => {
      result.current.addTrade(trade);
      result.current.updateTrade('test-trade', { status: 'closed', pnl: 100 });
    });
    expect(result.current.trades[0].status).toBe('closed');
    expect(result.current.trades[0].pnl).toBe(100);
  });

  it('should set trading analysis progress', () => {
    const { result } = renderHook(() => useAITradingStore());
    expect(result.current.analysisInProgress).toBe(false);
    act(() => {
      result.current.setTradingAnalysisProgress(true);
    });
    expect(result.current.analysisInProgress).toBe(true);
  });

  it('should set trading error', () => {
    const { result } = renderHook(() => useAITradingStore());
    act(() => {
      result.current.setTradingError('API error');
    });
    expect(result.current.tradingError).toBe('API error');
    act(() => {
      result.current.setTradingError(null);
    });
    expect(result.current.tradingError).toBeNull();
  });

  it('should calculate trading stats', () => {
    const { result } = renderHook(() => useAITradingStore());
    const winTrade = createMockTrade({ id: 'win', status: 'closed', pnl: 100 });
    const loseTrade = createMockTrade({ id: 'lose', status: 'closed', pnl: -50 });
    act(() => {
      result.current.addTrade(winTrade);
      result.current.addTrade(loseTrade);
      result.current.calculateTradingStats();
    });
    expect(result.current.tradingStats?.totalTrades).toBe(2);
    expect(result.current.tradingStats?.closedTrades).toBe(2);
    expect(result.current.tradingStats?.winningTrades).toBe(1);
    expect(result.current.tradingStats?.losingTrades).toBe(1);
    expect(result.current.tradingStats?.winRate).toBe(50);
  });

  it('should clear trading history', () => {
    const { result } = renderHook(() => useAITradingStore());
    act(() => {
      result.current.addTrade(createMockTrade());
      result.current.clearTradingHistory();
    });
    expect(result.current.trades).toHaveLength(0);
    expect(result.current.lastTradeTime).toBeNull();
  });

  it('should get storage data', () => {
    const { result } = renderHook(() => useAITradingStore());
    const trade = createMockTrade();
    act(() => {
      result.current.addTrade(trade);
      result.current.toggleAutoTrading();
    });
    const storageData = result.current.getStorageData();
    expect(storageData.isAutoTradingActive).toBe(true);
    expect(storageData.trades).toHaveLength(1);
    expect(storageData.tradingConfig).toEqual(expect.objectContaining({ enabled: false }));
  });
});
