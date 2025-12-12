import type { SetupType, TradingSetup } from '@marketmind/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SetupDetectionConfig } from './setupConfig';
import { createDefaultSetupDetectionConfig, mergeSetupConfigs } from './setupConfig';

const PERCENTAGE_MULTIPLIER = 100;

export interface SetupPerformanceStats {
  totalSetups: number;
  executedSetups: number;
  winningSetups: number;
  losingSetups: number;
  winRate: number;
  avgRiskReward: number;
  totalProfit: number;
  totalLoss: number;
  expectancy: number;
  largestWin: number;
  largestLoss: number;
  avgWin: number;
  avgLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
}

export interface SetupExecution {
  setupId: string;
  setupType: SetupType;
  timestamp: number;
  openTime?: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  exitPrice?: number;
  exitTimestamp?: number;
  status: 'pending' | 'active' | 'won' | 'lost' | 'cancelled';
  pnl?: number;
  riskReward: number;
  confidence: number;
}

interface SetupStoreState {
  config: SetupDetectionConfig;
  isAutoTradingActive: boolean;
  detectedSetups: TradingSetup[];
  setupHistory: SetupExecution[];
  performanceByType: Record<SetupType, SetupPerformanceStats>;
  globalPerformance: SetupPerformanceStats;

  setConfig: (config: Partial<SetupDetectionConfig>) => void;
  resetConfigToDefaults: () => void;
  toggleAutoTrading: () => void;

  addDetectedSetup: (setup: TradingSetup) => void;
  removeDetectedSetup: (id: string) => void;
  clearDetectedSetups: () => void;
  getDetectedSetup: (id: string) => TradingSetup | undefined;
  updateSetup: (id: string, updates: Partial<TradingSetup>) => void;
  cancelSetup: (id: string, reason: TradingSetup['cancellationReason']) => void;
  triggerSetup: (id: string) => void;

  executeSetup: (setupId: string) => void;
  updateExecution: (
    setupId: string,
    updates: Partial<SetupExecution>,
  ) => void;
  closeExecution: (setupId: string, exitPrice: number) => void;
  cancelExecution: (setupId: string) => void;

  getPerformanceByType: (setupType: SetupType) => SetupPerformanceStats;
  getGlobalPerformance: () => SetupPerformanceStats;
  calculatePerformance: () => void;

  clearHistory: () => void;
  exportHistory: () => SetupExecution[];
}

const createEmptyPerformanceStats = (): SetupPerformanceStats => ({
  totalSetups: 0,
  executedSetups: 0,
  winningSetups: 0,
  losingSetups: 0,
  winRate: 0,
  avgRiskReward: 0,
  totalProfit: 0,
  totalLoss: 0,
  expectancy: 0,
  largestWin: 0,
  largestLoss: 0,
  avgWin: 0,
  avgLoss: 0,
  consecutiveWins: 0,
  consecutiveLosses: 0,
  maxConsecutiveWins: 0,
  maxConsecutiveLosses: 0,
});

const calculateStatsFromExecutions = (
  executions: SetupExecution[],
): SetupPerformanceStats => {
  const stats = createEmptyPerformanceStats();

  stats.totalSetups = executions.length;
  stats.executedSetups = executions.filter(
    (e) => e.status === 'won' || e.status === 'lost',
  ).length;

  if (stats.executedSetups === 0) return stats;

  const closedExecutions = executions.filter(
    (e) => e.status === 'won' || e.status === 'lost',
  );

  stats.winningSetups = closedExecutions.filter((e) => e.status === 'won').length;
  stats.losingSetups = closedExecutions.filter((e) => e.status === 'lost').length;
  stats.winRate = (stats.winningSetups / stats.executedSetups) * PERCENTAGE_MULTIPLIER;

  const rrSum = closedExecutions.reduce((sum, e) => sum + e.riskReward, 0);
  stats.avgRiskReward = rrSum / closedExecutions.length;

  closedExecutions.forEach((execution) => {
    if (execution.pnl === undefined) return;

    if (execution.pnl > 0) {
      stats.totalProfit += execution.pnl;
      if (execution.pnl > stats.largestWin) {
        stats.largestWin = execution.pnl;
      }
    } else {
      stats.totalLoss += Math.abs(execution.pnl);
      if (Math.abs(execution.pnl) > stats.largestLoss) {
        stats.largestLoss = Math.abs(execution.pnl);
      }
    }
  });

  if (stats.winningSetups > 0) {
    stats.avgWin = stats.totalProfit / stats.winningSetups;
  }

  if (stats.losingSetups > 0) {
    stats.avgLoss = stats.totalLoss / stats.losingSetups;
  }

  stats.expectancy =
    stats.winRate / PERCENTAGE_MULTIPLIER * stats.avgWin - 
    (1 - stats.winRate / PERCENTAGE_MULTIPLIER) * stats.avgLoss;

  let consecutiveWins = 0;
  let consecutiveLosses = 0;

  closedExecutions.forEach((execution) => {
    if (execution.status === 'won') {
      consecutiveWins++;
      consecutiveLosses = 0;
      if (consecutiveWins > stats.maxConsecutiveWins) {
        stats.maxConsecutiveWins = consecutiveWins;
      }
    } else {
      consecutiveLosses++;
      consecutiveWins = 0;
      if (consecutiveLosses > stats.maxConsecutiveLosses) {
        stats.maxConsecutiveLosses = consecutiveLosses;
      }
    }
  });

  stats.consecutiveWins = consecutiveWins;
  stats.consecutiveLosses = consecutiveLosses;

  return stats;
};

export const useSetupStore = create<SetupStoreState>()(
  persist(
    (set, get) => ({
      config: createDefaultSetupDetectionConfig(),
      isAutoTradingActive: false,
      detectedSetups: [],
      setupHistory: [],
      performanceByType: {} as Record<SetupType, SetupPerformanceStats>,
      globalPerformance: createEmptyPerformanceStats(),

      setConfig: (config) =>
        set((state) => ({
          config: { ...createDefaultSetupDetectionConfig(), ...state.config, ...config },
        })),

      resetConfigToDefaults: () =>
        set({
          config: createDefaultSetupDetectionConfig(),
        }),

      toggleAutoTrading: () =>
        set((state) => {
          const newState = !state.isAutoTradingActive;
          console.log(`[Auto-Trading] ${newState ? '🟢 ENABLED' : '🔴 DISABLED'}`);
          return {
            isAutoTradingActive: newState,
          };
        }),

      addDetectedSetup: (setup) =>
        set((state) => ({
          detectedSetups: [...state.detectedSetups, setup],
        })),

      removeDetectedSetup: (id) =>
        set((state) => ({
          detectedSetups: state.detectedSetups.filter((s) => s.id !== id),
        })),

      clearDetectedSetups: () => set({ detectedSetups: [] }),

      getDetectedSetup: (id) => {
        const state = get();
        return state.detectedSetups.find((s) => s.id === id);
      },

      updateSetup: (id, updates) =>
        set((state) => ({
          detectedSetups: state.detectedSetups.map((s) =>
            s.id === id ? { ...s, ...updates } : s,
          ),
        })),

      cancelSetup: (id, reason) =>
        set((state) => ({
          detectedSetups: state.detectedSetups.map((s) => {
            if (s.id !== id) return s;
            const updated: TradingSetup = {
              ...s,
              isCancelled: true,
              cancelledAt: Date.now(),
            };
            if (reason) {
              updated.cancellationReason = reason;
            }
            return updated;
          }),
        })),

      triggerSetup: (id) =>
        set((state) => ({
          detectedSetups: state.detectedSetups.map((s) =>
            s.id === id
              ? {
                  ...s,
                  isTriggered: true,
                  triggeredAt: Date.now(),
                }
              : s,
          ),
        })),

      executeSetup: (setupId) => {
        const state = get();
        const setup = state.detectedSetups.find((s) => s.id === setupId);
        if (!setup) return;

        const execution: SetupExecution = {
          setupId: setup.id,
          setupType: setup.type,
          timestamp: Date.now(),
          openTime: Date.now(),
          entryPrice: setup.entryPrice,
          stopLoss: setup.stopLoss,
          takeProfit: setup.takeProfit,
          status: 'active',
          riskReward: setup.riskRewardRatio,
          confidence: setup.confidence,
        };

        set((state) => ({
          setupHistory: [...state.setupHistory, execution],
        }));
      },

      updateExecution: (setupId, updates) =>
        set((state) => ({
          setupHistory: state.setupHistory.map((e) =>
            e.setupId === setupId ? { ...e, ...updates } : e,
          ),
        })),

      closeExecution: (setupId, exitPrice) => {
        const state = get();
        const execution = state.setupHistory.find((e) => e.setupId === setupId);
        if (!execution) return;

        const pnl = exitPrice - execution.entryPrice;
        const status = pnl > 0 ? 'won' : 'lost';

        set((state) => ({
          setupHistory: state.setupHistory.map((e) =>
            e.setupId === setupId
              ? {
                  ...e,
                  exitPrice,
                  exitTimestamp: Date.now(),
                  status,
                  pnl,
                }
              : e,
          ),
        }));

        get().calculatePerformance();
      },

      cancelExecution: (setupId) => {
        set((state) => ({
          setupHistory: state.setupHistory.map((e) =>
            e.setupId === setupId ? { ...e, status: 'cancelled' as const } : e,
          ),
        }));
      },

      getPerformanceByType: (setupType) => {
        const state = get();
        return (
          state.performanceByType[setupType] || createEmptyPerformanceStats()
        );
      },

      getGlobalPerformance: () => get().globalPerformance,

      calculatePerformance: () => {
        const state = get();
        const { setupHistory } = state;

        const globalStats = calculateStatsFromExecutions(setupHistory);

        const statsByType: Record<SetupType, SetupPerformanceStats> =
          {} as Record<SetupType, SetupPerformanceStats>;

        const setupTypes = new Set(setupHistory.map((e) => e.setupType));
        setupTypes.forEach((type) => {
          const typeExecutions = setupHistory.filter(
            (e) => e.setupType === type,
          );
          statsByType[type] = calculateStatsFromExecutions(typeExecutions);
        });

        set({
          globalPerformance: globalStats,
          performanceByType: statsByType,
        });
      },

      clearHistory: () =>
        set({
          setupHistory: [],
          performanceByType: {} as Record<SetupType, SetupPerformanceStats>,
          globalPerformance: createEmptyPerformanceStats(),
        }),

      exportHistory: () => get().setupHistory,
    }),
    {
      name: 'marketmind-setup-storage',
      partialize: (state) => ({
        config: state.config,
        isAutoTradingActive: state.isAutoTradingActive,
        detectedSetups: state.detectedSetups,
        setupHistory: state.setupHistory,
        performanceByType: state.performanceByType,
        globalPerformance: state.globalPerformance,
      }),
      merge: (persistedState, currentState) => {
        const defaults = createDefaultSetupDetectionConfig();
        const persisted = persistedState as Partial<SetupStoreState>;
        return {
          ...currentState,
          ...persisted,
          config: mergeSetupConfigs(defaults, persisted.config),
        };
      },
    },
  ),
);
