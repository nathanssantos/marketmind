import type { TradeExecution, Wallet } from '../../db/schema';
import { getFuturesClient } from '../../exchange';
import { calculateGrossPnl, roundToDecimals } from '../../utils/formatters';
import { serializeError } from '../../utils/errors';
import { logger } from '../logger';

export interface FeeReconciliationResult {
  actualExitPrice: number;
  actualEntryFee: number;
  actualExitFee: number;
  actualFees: number;
  actualPnl: number;
  actualPnlPercent: number;
}

const recalcPnl = (
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: 'LONG' | 'SHORT',
  fees: number,
  accumulatedFunding: number,
): { pnl: number; pnlPercent: number } => {
  const grossPnl = calculateGrossPnl(entryPrice, exitPrice, quantity, side);
  const pnl = roundToDecimals(grossPnl - fees + accumulatedFunding, 8);
  const pnlPercentCalc = roundToDecimals(((exitPrice - entryPrice) / entryPrice) * 100, 4);
  const pnlPercent = side === 'LONG' ? pnlPercentCalc : -pnlPercentCalc;
  return { pnl, pnlPercent };
};

export const fetchActualFeesFromExchange = async (
  wallet: Wallet,
  execution: TradeExecution,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  accumulatedFunding: number,
  actualEntryFeeFromRecord: number,
  estimatedExitFee: number,
): Promise<FeeReconciliationResult> => {
  let actualExitPrice = exitPrice;
  let actualEntryFee = actualEntryFeeFromRecord;
  let actualExitFee = estimatedExitFee;
  let actualFees = actualEntryFee + actualExitFee;
  const initial = recalcPnl(entryPrice, exitPrice, quantity, execution.side, actualFees, accumulatedFunding);
  let actualPnl = initial.pnl;
  let actualPnlPercent = initial.pnlPercent;

  try {
    const client = getFuturesClient(wallet);
    const openedAt = execution.openedAt?.getTime() || execution.createdAt.getTime();
    const allFees = await client.getAllTradeFeesForPosition(execution.symbol, execution.side, openedAt);

    if (allFees) {
      actualExitPrice = allFees.exitPrice || exitPrice;
      actualEntryFee = allFees.entryFee;
      actualExitFee = allFees.exitFee;
      actualFees = allFees.totalFees;

      const r = recalcPnl(entryPrice, actualExitPrice, quantity, execution.side, actualFees, accumulatedFunding);
      actualPnl = r.pnl;
      actualPnlPercent = r.pnlPercent;

      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        originalExitPrice: exitPrice,
        actualExitPrice,
        actualEntryFee,
        actualExitFee,
        actualFees,
        actualPnl,
        binanceRealizedPnl: allFees.realizedPnl,
      }, '[PositionMonitor] Fetched actual trade fees from Binance (entry + exit)');
    } else {
      const closingTrade = await client.getLastClosingTrade(execution.symbol, execution.side, openedAt);
      if (closingTrade) {
        actualExitPrice = closingTrade.price;
        actualExitFee = closingTrade.commission;

        if (actualEntryFee === 0 && execution.entryOrderId) {
          try {
            const entryFeeResult = await client.getOrderEntryFee(execution.symbol, execution.entryOrderId);
            if (entryFeeResult) actualEntryFee = entryFeeResult.entryFee;
          } catch (_e) { /* best-effort */ }
        }

        actualFees = actualEntryFee + actualExitFee;
        const r = recalcPnl(entryPrice, actualExitPrice, quantity, execution.side, actualFees, accumulatedFunding);
        actualPnl = r.pnl;
        actualPnlPercent = r.pnlPercent;

        logger.info({
          executionId: execution.id,
          symbol: execution.symbol,
          actualExitPrice,
          actualEntryFee,
          actualExitFee,
          actualFees,
          actualPnl,
        }, '[PositionMonitor] Fetched exit fee from Binance (fallback)');
      }
    }
  } catch (fetchError) {
    logger.warn({
      executionId: execution.id,
      error: serializeError(fetchError),
    }, '[PositionMonitor] Failed to fetch actual fees from Binance, using detected values');
  }

  return { actualExitPrice, actualEntryFee, actualExitFee, actualFees, actualPnl, actualPnlPercent };
};

export const fetchMissingEntryFee = async (
  wallet: Wallet,
  execution: TradeExecution,
  currentValues: {
    actualEntryFee: number;
    actualExitFee: number;
    actualExitPrice: number;
    accumulatedFunding: number;
    entryPrice: number;
    quantity: number;
  }
): Promise<{ actualEntryFee: number; actualFees: number; actualPnl: number }> => {
  const { actualExitFee, actualExitPrice, accumulatedFunding, entryPrice, quantity } = currentValues;
  let { actualEntryFee } = currentValues;
  let actualFees = actualEntryFee + actualExitFee;
  let actualPnl = recalcPnl(entryPrice, actualExitPrice, quantity, execution.side, actualFees, accumulatedFunding).pnl;

  try {
    const client = getFuturesClient(wallet);
    const entryFeeResult = await client.getOrderEntryFee(execution.symbol, execution.entryOrderId!);
    if (entryFeeResult) {
      actualEntryFee = entryFeeResult.entryFee;
      actualFees = actualEntryFee + actualExitFee;
      actualPnl = recalcPnl(entryPrice, actualExitPrice, quantity, execution.side, actualFees, accumulatedFunding).pnl;
      logger.info({
        executionId: execution.id,
        symbol: execution.symbol,
        actualEntryFee,
        actualFees,
      }, '[PositionMonitor] Fetched missing entry fee from Binance');
    }
  } catch (_e) { /* best-effort */ }

  return { actualEntryFee, actualFees, actualPnl };
};
