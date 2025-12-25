import type { AITrade, AITradingConfig, AITradingStats } from '@marketmind/types';
import { create } from 'zustand';

const DEFAULT_TRADING_CONFIG: AITradingConfig = {
  enabled: false,
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

const DEFAULT_TRADING_STATS: AITradingStats = {
  totalTrades: 0,
  openTrades: 0,
  closedTrades: 0,
  winningTrades: 0,
  losingTrades: 0,
  winRate: 0,
  totalProfit: 0,
  totalLoss: 0,
  netProfit: 0,
  avgProfit: 0,
  avgLoss: 0,
  profitFactor: 0,
  largestWin: 0,
  largestLoss: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  maxConsecutiveWins: 0,
  maxConsecutiveLosses: 0,
  totalTokensUsed: 0,
  estimatedCost: 0,
  avgHoldingTime: 0,
  bestTrade: undefined,
  worstTrade: undefined,
  patternSuccess: new Map(),
};

export interface AITradingState {
  isAutoTradingActive: boolean;
  tradingConfig: AITradingConfig;
  trades: AITrade[];
  tradingStats: AITradingStats | null;
  lastAnalysisTime: Date | null;
  lastTradeTime: Date | null;
  analysisInProgress: boolean;
  tradingError: string | null;

  toggleAutoTrading: () => void;
  updateTradingConfig: (config: Partial<AITradingConfig>) => void;
  addTrade: (trade: AITrade) => void;
  updateTrade: (tradeId: string, updates: Partial<AITrade>) => void;
  setTradingAnalysisProgress: (inProgress: boolean) => void;
  setTradingError: (error: string | null) => void;
  calculateTradingStats: () => void;
  clearTradingHistory: () => void;

  loadFromStorage: (data: Partial<AITradingState>) => void;
  getStorageData: () => Pick<AITradingState, 'isAutoTradingActive' | 'tradingConfig' | 'trades' | 'tradingStats'>;
}

export const useAITradingStore = create<AITradingState>((set, get) => ({
  isAutoTradingActive: false,
  tradingConfig: DEFAULT_TRADING_CONFIG,
  trades: [],
  tradingStats: DEFAULT_TRADING_STATS,
  lastAnalysisTime: null,
  lastTradeTime: null,
  analysisInProgress: false,
  tradingError: null,

  toggleAutoTrading: () =>
    set((state) => ({
      isAutoTradingActive: !state.isAutoTradingActive,
      tradingError: null,
    })),

  updateTradingConfig: (config) =>
    set((state) => ({
      tradingConfig: { ...state.tradingConfig, ...config },
    })),

  addTrade: (trade) =>
    set((state) => ({
      trades: [...state.trades, trade],
      lastTradeTime: new Date(),
    })),

  updateTrade: (tradeId, updates) =>
    set((state) => ({
      trades: state.trades.map((trade) =>
        trade.id === tradeId ? { ...trade, ...updates } : trade
      ),
    })),

  setTradingAnalysisProgress: (inProgress) => set({ analysisInProgress: inProgress }),

  setTradingError: (error) => set({ tradingError: error }),

  calculateTradingStats: () =>
    set((state) => {
      const trades = state.trades;
      const closedTrades = trades.filter((t) => t.status !== 'open');
      const winningTrades = closedTrades.filter((t) => (t.pnl || 0) > 0);
      const losingTrades = closedTrades.filter((t) => (t.pnl || 0) < 0);

      const totalProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const totalLoss = Math.abs(
        losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
      );
      const netProfit = totalProfit - totalLoss;

      const patternSuccess = new Map<
        string,
        { wins: number; losses: number; winRate: number }
      >();
      closedTrades.forEach((trade) => {
        trade.patterns.forEach((pattern) => {
          const current = patternSuccess.get(pattern) || {
            wins: 0,
            losses: 0,
            winRate: 0,
          };
          if ((trade.pnl || 0) > 0) {
            current.wins++;
          } else {
            current.losses++;
          }
          current.winRate =
            (current.wins / (current.wins + current.losses)) * 100;
          patternSuccess.set(pattern, current);
        });
      });

      let consecutiveWins = 0;
      let consecutiveLosses = 0;
      let maxConsecutiveWins = 0;
      let maxConsecutiveLosses = 0;

      closedTrades.forEach((trade) => {
        if ((trade.pnl || 0) > 0) {
          consecutiveWins++;
          consecutiveLosses = 0;
          maxConsecutiveWins = Math.max(maxConsecutiveWins, consecutiveWins);
        } else {
          consecutiveLosses++;
          consecutiveWins = 0;
          maxConsecutiveLosses = Math.max(
            maxConsecutiveLosses,
            consecutiveLosses
          );
        }
      });

      const totalHoldingTime = closedTrades.reduce((sum, trade) => {
        if (trade.closedAt) {
          return sum + (trade.closedAt.getTime() - trade.openTime.getTime());
        }
        return sum;
      }, 0);

      const bestTrade: AITrade | undefined =
        winningTrades.length > 0
          ? winningTrades.reduce((best, t) =>
              (t.pnl || 0) > (best.pnl || 0) ? t : best
            )
          : undefined;

      const worstTrade: AITrade | undefined =
        losingTrades.length > 0
          ? losingTrades.reduce((worst, t) =>
              (t.pnl || 0) < (worst.pnl || 0) ? t : worst
            )
          : undefined;

      const newStats: AITradingStats = {
        totalTrades: trades.length,
        openTrades: trades.filter((t) => t.status === 'open').length,
        closedTrades: closedTrades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate:
          closedTrades.length > 0
            ? (winningTrades.length / closedTrades.length) * 100
            : 0,
        totalProfit,
        totalLoss,
        netProfit,
        avgProfit:
          winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
        avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
        profitFactor:
          totalLoss > 0
            ? totalProfit / totalLoss
            : totalProfit > 0
              ? Infinity
              : 0,
        largestWin: Math.max(...winningTrades.map((t) => t.pnl || 0), 0),
        largestLoss: Math.abs(
          Math.min(...losingTrades.map((t) => t.pnl || 0), 0)
        ),
        consecutiveWins,
        consecutiveLosses,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        totalTokensUsed: trades.reduce((sum, t) => sum + t.analysisTokens, 0),
        estimatedCost: trades.reduce(
          (sum, t) => sum + t.analysisTokens * 0.000003,
          0
        ),
        avgHoldingTime:
          closedTrades.length > 0 ? totalHoldingTime / closedTrades.length : 0,
        bestTrade,
        worstTrade,
        patternSuccess,
      };

      return { tradingStats: newStats };
    }),

  clearTradingHistory: () =>
    set({
      trades: [],
      tradingStats: DEFAULT_TRADING_STATS,
      lastTradeTime: null,
    }),

  loadFromStorage: (data) => set(data),

  getStorageData: () => {
    const state = get();
    return {
      isAutoTradingActive: state.isAutoTradingActive,
      tradingConfig: state.tradingConfig,
      trades: state.trades,
      tradingStats: state.tradingStats,
    };
  },
}));

export { DEFAULT_TRADING_CONFIG, DEFAULT_TRADING_STATS };
