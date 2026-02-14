import { describe, expect, it } from 'vitest';
import type { TradeExecution } from '../db/schema';

const createMockExecution = (overrides: Partial<TradeExecution> = {}): TradeExecution => ({
  id: 'test-id-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  setupId: 'test-setup',
  setupType: 'bear-trap',
  symbol: 'BTCUSDT',
  side: 'LONG',
  entryOrderId: null,
  stopLossOrderId: null,
  takeProfitOrderId: null,
  orderListId: null,
  exitOrderId: null,
  entryPrice: '100000',
  exitPrice: null,
  quantity: '0.1',
  stopLoss: null,
  originalStopLoss: null,
  takeProfit: null,
  pnl: null,
  pnlPercent: null,
  fees: '0',
  exitSource: null,
  exitReason: null,
  openedAt: new Date(),
  closedAt: null,
  status: 'open',
  entryOrderType: 'MARKET',
  limitEntryPrice: null,
  expiresAt: null,
  marketType: 'SPOT',
  leverage: 1,
  liquidationPrice: null,
  accumulatedFunding: '0',
  positionSide: 'BOTH',
  marginTopUpCount: 0,
  triggerKlineIndex: null,
  triggerKlineOpenTime: null,
  triggerCandleData: null,
  triggerIndicatorValues: null,
  fibonacciProjection: null,
  entryFee: null,
  exitFee: null,
  commissionAsset: null,
  trailingStopAlgoId: null,
  trailingStopMode: null,
  stopLossAlgoId: null,
  takeProfitAlgoId: null,
  stopLossIsAlgo: false,
  takeProfitIsAlgo: false,
  entryInterval: null,
  barsInTrade: 0,
  lastPriceMovementBar: 0,
  highestPriceSinceEntry: null,
  lowestPriceSinceEntry: null,
  trailingActivatedAt: null,
  highestPriceSinceTrailingActivation: null,
  lowestPriceSinceTrailingActivation: null,
  opportunityCostAlertSentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const calculateConsolidatedStopLoss = (
  executions: TradeExecution[],
  isLong: boolean
): number | null => {
  const stopLosses = executions
    .filter(e => e.stopLoss !== null)
    .map(e => parseFloat(e.stopLoss!));

  if (stopLosses.length === 0) return null;
  return isLong ? Math.max(...stopLosses) : Math.min(...stopLosses);
};

const calculateConsolidatedTakeProfit = (
  executions: TradeExecution[],
  isLong: boolean
): number | null => {
  const takeProfits = executions
    .filter(e => e.takeProfit !== null)
    .map(e => parseFloat(e.takeProfit!));

  if (takeProfits.length === 0) return null;
  return isLong ? Math.min(...takeProfits) : Math.max(...takeProfits);
};

const groupExecutionsBySymbolAndSide = (
  executions: TradeExecution[]
): Map<string, TradeExecution[]> => {
  const groups = new Map<string, TradeExecution[]>();

  for (const execution of executions) {
    const key = `${execution.symbol}-${execution.side}`;
    const existing = groups.get(key) || [];
    existing.push(execution);
    groups.set(key, existing);
  }

  return groups;
};

const checkShouldTriggerStopLoss = (
  consolidatedSL: number | null,
  currentPrice: number,
  isLong: boolean
): boolean => {
  if (consolidatedSL === null) return false;
  return isLong ? currentPrice <= consolidatedSL : currentPrice >= consolidatedSL;
};

const checkShouldTriggerTakeProfit = (
  consolidatedTP: number | null,
  currentPrice: number,
  isLong: boolean
): boolean => {
  if (consolidatedTP === null) return false;
  return isLong ? currentPrice >= consolidatedTP : currentPrice <= consolidatedTP;
};

describe('Position Monitor - Consolidated Stop Loss/Take Profit', () => {
  describe('calculateConsolidatedStopLoss', () => {
    it('should return null when no executions have stop loss', () => {
      const executions = [
        createMockExecution({ id: '1', stopLoss: null }),
        createMockExecution({ id: '2', stopLoss: null }),
      ];
      expect(calculateConsolidatedStopLoss(executions, true)).toBeNull();
      expect(calculateConsolidatedStopLoss(executions, false)).toBeNull();
    });

    it('should return the highest SL for LONG positions (tightest)', () => {
      const executions = [
        createMockExecution({ id: '1', stopLoss: '95000', side: 'LONG' }),
        createMockExecution({ id: '2', stopLoss: '97000', side: 'LONG' }),
        createMockExecution({ id: '3', stopLoss: '96000', side: 'LONG' }),
      ];
      expect(calculateConsolidatedStopLoss(executions, true)).toBe(97000);
    });

    it('should return the lowest SL for SHORT positions (tightest)', () => {
      const executions = [
        createMockExecution({ id: '1', stopLoss: '105000', side: 'SHORT' }),
        createMockExecution({ id: '2', stopLoss: '103000', side: 'SHORT' }),
        createMockExecution({ id: '3', stopLoss: '104000', side: 'SHORT' }),
      ];
      expect(calculateConsolidatedStopLoss(executions, false)).toBe(103000);
    });

    it('should ignore executions without stop loss', () => {
      const executions = [
        createMockExecution({ id: '1', stopLoss: '95000', side: 'LONG' }),
        createMockExecution({ id: '2', stopLoss: null, side: 'LONG' }),
        createMockExecution({ id: '3', stopLoss: '97000', side: 'LONG' }),
      ];
      expect(calculateConsolidatedStopLoss(executions, true)).toBe(97000);
    });

    it('should handle single execution', () => {
      const executions = [
        createMockExecution({ id: '1', stopLoss: '95000', side: 'LONG' }),
      ];
      expect(calculateConsolidatedStopLoss(executions, true)).toBe(95000);
    });

    it('should handle empty array', () => {
      expect(calculateConsolidatedStopLoss([], true)).toBeNull();
      expect(calculateConsolidatedStopLoss([], false)).toBeNull();
    });
  });

  describe('calculateConsolidatedTakeProfit', () => {
    it('should return null when no executions have take profit', () => {
      const executions = [
        createMockExecution({ id: '1', takeProfit: null }),
        createMockExecution({ id: '2', takeProfit: null }),
      ];
      expect(calculateConsolidatedTakeProfit(executions, true)).toBeNull();
      expect(calculateConsolidatedTakeProfit(executions, false)).toBeNull();
    });

    it('should return the lowest TP for LONG positions (closest/tightest)', () => {
      const executions = [
        createMockExecution({ id: '1', takeProfit: '110000', side: 'LONG' }),
        createMockExecution({ id: '2', takeProfit: '105000', side: 'LONG' }),
        createMockExecution({ id: '3', takeProfit: '108000', side: 'LONG' }),
      ];
      expect(calculateConsolidatedTakeProfit(executions, true)).toBe(105000);
    });

    it('should return the highest TP for SHORT positions (closest/tightest)', () => {
      const executions = [
        createMockExecution({ id: '1', takeProfit: '90000', side: 'SHORT' }),
        createMockExecution({ id: '2', takeProfit: '95000', side: 'SHORT' }),
        createMockExecution({ id: '3', takeProfit: '92000', side: 'SHORT' }),
      ];
      expect(calculateConsolidatedTakeProfit(executions, false)).toBe(95000);
    });

    it('should ignore executions without take profit', () => {
      const executions = [
        createMockExecution({ id: '1', takeProfit: '110000', side: 'LONG' }),
        createMockExecution({ id: '2', takeProfit: null, side: 'LONG' }),
        createMockExecution({ id: '3', takeProfit: '105000', side: 'LONG' }),
      ];
      expect(calculateConsolidatedTakeProfit(executions, true)).toBe(105000);
    });

    it('should handle single execution', () => {
      const executions = [
        createMockExecution({ id: '1', takeProfit: '110000', side: 'LONG' }),
      ];
      expect(calculateConsolidatedTakeProfit(executions, true)).toBe(110000);
    });

    it('should handle empty array', () => {
      expect(calculateConsolidatedTakeProfit([], true)).toBeNull();
      expect(calculateConsolidatedTakeProfit([], false)).toBeNull();
    });
  });

  describe('groupExecutionsBySymbolAndSide', () => {
    it('should group executions by symbol and side', () => {
      const executions = [
        createMockExecution({ id: '1', symbol: 'BTCUSDT', side: 'LONG' }),
        createMockExecution({ id: '2', symbol: 'BTCUSDT', side: 'LONG' }),
        createMockExecution({ id: '3', symbol: 'BTCUSDT', side: 'SHORT' }),
        createMockExecution({ id: '4', symbol: 'ETHUSDT', side: 'LONG' }),
      ];

      const groups = groupExecutionsBySymbolAndSide(executions);

      expect(groups.size).toBe(3);
      expect(groups.get('BTCUSDT-LONG')?.length).toBe(2);
      expect(groups.get('BTCUSDT-SHORT')?.length).toBe(1);
      expect(groups.get('ETHUSDT-LONG')?.length).toBe(1);
    });

    it('should handle empty array', () => {
      const groups = groupExecutionsBySymbolAndSide([]);
      expect(groups.size).toBe(0);
    });

    it('should handle single execution', () => {
      const executions = [
        createMockExecution({ id: '1', symbol: 'BTCUSDT', side: 'LONG' }),
      ];

      const groups = groupExecutionsBySymbolAndSide(executions);

      expect(groups.size).toBe(1);
      expect(groups.get('BTCUSDT-LONG')?.length).toBe(1);
    });

    it('should preserve execution data in groups', () => {
      const executions = [
        createMockExecution({ id: '1', symbol: 'BTCUSDT', side: 'LONG', stopLoss: '95000' }),
        createMockExecution({ id: '2', symbol: 'BTCUSDT', side: 'LONG', stopLoss: '97000' }),
      ];

      const groups = groupExecutionsBySymbolAndSide(executions);
      const btcLongGroup = groups.get('BTCUSDT-LONG');

      expect(btcLongGroup?.[0]?.stopLoss).toBe('95000');
      expect(btcLongGroup?.[1]?.stopLoss).toBe('97000');
    });
  });

  describe('checkShouldTriggerStopLoss', () => {
    it('should return false when consolidatedSL is null', () => {
      expect(checkShouldTriggerStopLoss(null, 100000, true)).toBe(false);
      expect(checkShouldTriggerStopLoss(null, 100000, false)).toBe(false);
    });

    it('should trigger LONG SL when price <= stopLoss', () => {
      expect(checkShouldTriggerStopLoss(95000, 95000, true)).toBe(true);
      expect(checkShouldTriggerStopLoss(95000, 94000, true)).toBe(true);
    });

    it('should not trigger LONG SL when price > stopLoss', () => {
      expect(checkShouldTriggerStopLoss(95000, 96000, true)).toBe(false);
    });

    it('should trigger SHORT SL when price >= stopLoss', () => {
      expect(checkShouldTriggerStopLoss(105000, 105000, false)).toBe(true);
      expect(checkShouldTriggerStopLoss(105000, 106000, false)).toBe(true);
    });

    it('should not trigger SHORT SL when price < stopLoss', () => {
      expect(checkShouldTriggerStopLoss(105000, 104000, false)).toBe(false);
    });
  });

  describe('checkShouldTriggerTakeProfit', () => {
    it('should return false when consolidatedTP is null', () => {
      expect(checkShouldTriggerTakeProfit(null, 100000, true)).toBe(false);
      expect(checkShouldTriggerTakeProfit(null, 100000, false)).toBe(false);
    });

    it('should trigger LONG TP when price >= takeProfit', () => {
      expect(checkShouldTriggerTakeProfit(110000, 110000, true)).toBe(true);
      expect(checkShouldTriggerTakeProfit(110000, 111000, true)).toBe(true);
    });

    it('should not trigger LONG TP when price < takeProfit', () => {
      expect(checkShouldTriggerTakeProfit(110000, 109000, true)).toBe(false);
    });

    it('should trigger SHORT TP when price <= takeProfit', () => {
      expect(checkShouldTriggerTakeProfit(90000, 90000, false)).toBe(true);
      expect(checkShouldTriggerTakeProfit(90000, 89000, false)).toBe(true);
    });

    it('should not trigger SHORT TP when price > takeProfit', () => {
      expect(checkShouldTriggerTakeProfit(90000, 91000, false)).toBe(false);
    });
  });

  describe('Consolidated Position Group Scenarios', () => {
    it('should trigger SL for all positions when tightest SL is hit (LONG)', () => {
      const executions = [
        createMockExecution({ id: '1', symbol: 'BTCUSDT', side: 'LONG', entryPrice: '100000', stopLoss: '95000' }),
        createMockExecution({ id: '2', symbol: 'BTCUSDT', side: 'LONG', entryPrice: '99000', stopLoss: '97000' }),
        createMockExecution({ id: '3', symbol: 'BTCUSDT', side: 'LONG', entryPrice: '98000', stopLoss: '96000' }),
      ];

      const consolidatedSL = calculateConsolidatedStopLoss(executions, true);
      expect(consolidatedSL).toBe(97000);

      const currentPrice = 97000;
      const shouldTrigger = checkShouldTriggerStopLoss(consolidatedSL, currentPrice, true);
      expect(shouldTrigger).toBe(true);
    });

    it('should NOT trigger SL when price is above tightest SL (LONG)', () => {
      const executions = [
        createMockExecution({ id: '1', symbol: 'BTCUSDT', side: 'LONG', stopLoss: '95000' }),
        createMockExecution({ id: '2', symbol: 'BTCUSDT', side: 'LONG', stopLoss: '97000' }),
      ];

      const consolidatedSL = calculateConsolidatedStopLoss(executions, true);
      expect(consolidatedSL).toBe(97000);

      const currentPrice = 98000;
      const shouldTrigger = checkShouldTriggerStopLoss(consolidatedSL, currentPrice, true);
      expect(shouldTrigger).toBe(false);
    });

    it('should trigger SL for all positions when tightest SL is hit (SHORT)', () => {
      const executions = [
        createMockExecution({ id: '1', symbol: 'BTCUSDT', side: 'SHORT', entryPrice: '100000', stopLoss: '105000' }),
        createMockExecution({ id: '2', symbol: 'BTCUSDT', side: 'SHORT', entryPrice: '101000', stopLoss: '103000' }),
        createMockExecution({ id: '3', symbol: 'BTCUSDT', side: 'SHORT', entryPrice: '102000', stopLoss: '104000' }),
      ];

      const consolidatedSL = calculateConsolidatedStopLoss(executions, false);
      expect(consolidatedSL).toBe(103000);

      const currentPrice = 103000;
      const shouldTrigger = checkShouldTriggerStopLoss(consolidatedSL, currentPrice, false);
      expect(shouldTrigger).toBe(true);
    });

    it('should trigger TP for all positions when tightest TP is hit (LONG)', () => {
      const executions = [
        createMockExecution({ id: '1', symbol: 'BTCUSDT', side: 'LONG', entryPrice: '100000', takeProfit: '110000' }),
        createMockExecution({ id: '2', symbol: 'BTCUSDT', side: 'LONG', entryPrice: '99000', takeProfit: '105000' }),
      ];

      const consolidatedTP = calculateConsolidatedTakeProfit(executions, true);
      expect(consolidatedTP).toBe(105000);

      const currentPrice = 105000;
      const shouldTrigger = checkShouldTriggerTakeProfit(consolidatedTP, currentPrice, true);
      expect(shouldTrigger).toBe(true);
    });

    it('should handle mixed SL and null TP executions', () => {
      const executions = [
        createMockExecution({ id: '1', stopLoss: '95000', takeProfit: '110000' }),
        createMockExecution({ id: '2', stopLoss: '97000', takeProfit: null }),
        createMockExecution({ id: '3', stopLoss: null, takeProfit: '108000' }),
      ];

      const consolidatedSL = calculateConsolidatedStopLoss(executions, true);
      const consolidatedTP = calculateConsolidatedTakeProfit(executions, true);

      expect(consolidatedSL).toBe(97000);
      expect(consolidatedTP).toBe(108000);
    });

    it('should handle real-world scenario with multiple BTC LONG positions', () => {
      const executions = [
        createMockExecution({
          id: 'btc-1',
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '100000',
          quantity: '0.1',
          stopLoss: '95000',
          takeProfit: '110000',
        }),
        createMockExecution({
          id: 'btc-2',
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '101000',
          quantity: '0.05',
          stopLoss: '97000',
          takeProfit: '112000',
        }),
        createMockExecution({
          id: 'btc-3',
          symbol: 'BTCUSDT',
          side: 'LONG',
          entryPrice: '99500',
          quantity: '0.08',
          stopLoss: '96000',
          takeProfit: '108000',
        }),
      ];

      const consolidatedSL = calculateConsolidatedStopLoss(executions, true);
      const consolidatedTP = calculateConsolidatedTakeProfit(executions, true);

      expect(consolidatedSL).toBe(97000);
      expect(consolidatedTP).toBe(108000);

      expect(checkShouldTriggerStopLoss(consolidatedSL, 97000, true)).toBe(true);
      expect(checkShouldTriggerStopLoss(consolidatedSL, 97500, true)).toBe(false);

      expect(checkShouldTriggerTakeProfit(consolidatedTP, 108000, true)).toBe(true);
      expect(checkShouldTriggerTakeProfit(consolidatedTP, 107500, true)).toBe(false);
    });
  });
});
