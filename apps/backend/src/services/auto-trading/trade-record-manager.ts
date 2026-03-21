import type { TradingSetup } from '@marketmind/types';
import { getDefaultFee, calculateLiquidationPrice } from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { BACKTEST_DEFAULTS } from '../../constants';
import { db } from '../../db';
import {
  autoTradingConfig,
  setupDetections,
  tradeExecutions,
  type Wallet,
} from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { cooldownService } from '../cooldown';
import { positionMonitorService } from '../position-monitor';
import { getWebSocketService } from '../websocket';
import { cancelAllOpenProtectionOrdersOnExchange, createStopLossOrder, createTakeProfitOrder } from '../protection-orders';
import { createBinanceFuturesClient, getPosition } from '../binance-futures-client';
import { logger } from '../logger';
import type { ActiveWatcher } from './types';
import { log } from './utils';
import type { WatcherLogBuffer } from '../watcher-batch-logger';
import type { LiveOrderResult } from './live-order-executor';
import type { PaperOrderResult } from './paper-order-executor';

export const createAndExecuteTrade = async (
  watcher: ActiveWatcher,
  setup: TradingSetup,
  effectiveTakeProfit: number | undefined,
  wallet: Wallet,
  config: typeof autoTradingConfig.$inferSelect,
  dynamicSize: { quantity: number; sizePercent: number; reason?: string },
  isLiveExecution: boolean,
  logBuffer: WatcherLogBuffer,
  sameDirectionPositions: (typeof tradeExecutions.$inferSelect)[],
  executeLiveOrderFn: (executionId: string, setupId: string) => Promise<LiveOrderResult | null>,
  executePaperOrderFn: (executionId: string, setupId: string) => Promise<PaperOrderResult | null>
): Promise<void> => {
  const setupId = `setup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await db.insert(setupDetections).values({
    id: setupId,
    userId: watcher.userId,
    symbol: watcher.symbol,
    interval: watcher.interval,
    setupType: setup.type,
    direction: setup.direction,
    entryPrice: setup.entryPrice.toString(),
    stopLoss: setup.stopLoss?.toString(),
    takeProfit: setup.takeProfit?.toString(),
    confidence: Math.round(setup.confidence),
    riskReward: setup.riskRewardRatio.toString(),
    detectedAt: new Date(),
    expiresAt,
  });

  log('> Created setup detection', { setupId });

  const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const quantityFormatted = dynamicSize.quantity.toFixed(8);
  const walletBalance = parseFloat(wallet.currentBalance ?? '0');
  const positionValue = dynamicSize.quantity * setup.entryPrice;

  log('> Final position size', {
    positionValue: positionValue.toFixed(2),
    entryPrice: setup.entryPrice,
    quantity: quantityFormatted,
    walletBalance: walletBalance.toFixed(2),
    sizePercent: dynamicSize.sizePercent.toFixed(2),
  });

  const SLIPPAGE_PERCENT = 0.1;
  const commissionRate = getDefaultFee(watcher.marketType ?? 'FUTURES', 'TAKER');
  const COMMISSION_PERCENT = commissionRate * 100;
  const slippageFactor = setup.direction === 'LONG' ? (1 + SLIPPAGE_PERCENT / 100) : (1 - SLIPPAGE_PERCENT / 100);
  const expectedEntryWithSlippage = setup.entryPrice * slippageFactor;

  let entryOrderId: string | null = null;
  let actualEntryPrice = isLiveExecution ? setup.entryPrice : expectedEntryWithSlippage;
  let actualQuantity = dynamicSize.quantity;
  let actualEntryFee: number | null = null;
  let stopLossOrderId: string | null = null;
  let takeProfitOrderId: string | null = null;
  let stopLossAlgoId: string | null = null;
  let takeProfitAlgoId: string | null = null;
  let stopLossIsAlgo = false;
  let takeProfitIsAlgo = false;
  let orderListId: string | null = null;

  if (isLiveExecution) {
    log('> Live execution - will use actual fill price from Binance', {
      setupEntry: setup.entryPrice,
      commissionPercent: COMMISSION_PERCENT,
      direction: setup.direction,
    });
  } else {
    log('> Paper trading - entry price adjusted for simulated slippage', {
      originalEntry: setup.entryPrice,
      expectedEntry: expectedEntryWithSlippage,
      slippagePercent: SLIPPAGE_PERCENT,
      commissionPercent: COMMISSION_PERCENT,
      direction: setup.direction,
    });
  }

  const useLimit = false;

  if (isLiveExecution) {
    const liveResult = await executeLiveOrderFn(executionId, setupId);
    if (!liveResult) return;

    entryOrderId = liveResult.entryOrderId;
    actualEntryPrice = liveResult.actualEntryPrice;
    actualQuantity = liveResult.actualQuantity;
    actualEntryFee = liveResult.actualEntryFee;
    stopLossOrderId = liveResult.stopLossOrderId;
    takeProfitOrderId = liveResult.takeProfitOrderId;
    stopLossAlgoId = liveResult.stopLossAlgoId;
    takeProfitAlgoId = liveResult.takeProfitAlgoId;
    stopLossIsAlgo = liveResult.stopLossIsAlgo;
    takeProfitIsAlgo = liveResult.takeProfitIsAlgo;
    orderListId = liveResult.orderListId;
  } else {
    const paperResult = await executePaperOrderFn(executionId, setupId);
    if (!paperResult) return;

    actualEntryPrice = paperResult.actualEntryPrice;
    actualQuantity = paperResult.actualQuantity;
  }

  if (!isLiveExecution && setup.stopLoss && effectiveTakeProfit) {
    let risk: number;
    let reward: number;

    if (setup.direction === 'LONG') {
      risk = actualEntryPrice - setup.stopLoss;
      reward = effectiveTakeProfit - actualEntryPrice;
    } else {
      risk = setup.stopLoss - actualEntryPrice;
      reward = actualEntryPrice - effectiveTakeProfit;
    }

    if (risk <= 0) {
      logBuffer.addRejection({
        setupType: setup.type,
        direction: setup.direction,
        reason: 'Invalid SL after slippage',
        details: { actualEntry: actualEntryPrice.toFixed(4), stopLoss: setup.stopLoss },
      });
      logBuffer.warn('✗', 'Invalid SL after slippage', { setup: setup.type, actualEntry: actualEntryPrice.toFixed(4) });
      return;
    }

    const finalRiskRewardRatio = reward / risk;

    const minRRLong = config.minRiskRewardRatioLong
      ? parseFloat(config.minRiskRewardRatioLong)
      : BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO_LONG;
    const minRRShort = config.minRiskRewardRatioShort
      ? parseFloat(config.minRiskRewardRatioShort)
      : BACKTEST_DEFAULTS.MIN_RISK_REWARD_RATIO_SHORT;
    const minRequired = setup.direction === 'LONG' ? minRRLong : minRRShort;

    if (finalRiskRewardRatio < minRequired) {
      logBuffer.addRejection({
        setupType: setup.type,
        direction: setup.direction,
        reason: 'R:R too low after slippage',
        details: {
          finalRR: finalRiskRewardRatio.toFixed(2),
          minRequired,
        },
      });
      logBuffer.warn('✗', 'R:R too low after slippage', { setup: setup.type, finalRR: finalRiskRewardRatio.toFixed(2) });
      return;
    }
  }

  try {
    const triggerCandle = setup.triggerCandleData?.find(c => c.offset === 0);
    const openedAtDate = new Date();
    const leverage = config.leverage ?? 1;
    const isFutures = watcher.marketType === 'FUTURES';
    const liqPrice = isFutures && leverage > 1
      ? calculateLiquidationPrice(actualEntryPrice, leverage, setup.direction).toString()
      : undefined;

    await db.insert(tradeExecutions).values({
      id: executionId,
      userId: watcher.userId,
      walletId: watcher.walletId,
      setupId,
      setupType: setup.type,
      symbol: watcher.symbol,
      side: setup.direction,
      entryPrice: actualEntryPrice.toString(),
      entryOrderId,
      entryFee: actualEntryFee?.toString(),
      stopLossOrderId,
      takeProfitOrderId,
      stopLossAlgoId,
      takeProfitAlgoId,
      stopLossIsAlgo,
      takeProfitIsAlgo,
      orderListId,
      quantity: actualQuantity.toFixed(8),
      stopLoss: setup.stopLoss?.toString(),
      takeProfit: effectiveTakeProfit?.toString(),
      openedAt: openedAtDate,
      status: 'open',
      entryOrderType: useLimit ? 'LIMIT' : 'MARKET',
      marketType: watcher.marketType,
      leverage,
      entryInterval: watcher.interval,
      originalStopLoss: setup.stopLoss?.toString(),
      highestPriceSinceEntry: actualEntryPrice.toString(),
      lowestPriceSinceEntry: actualEntryPrice.toString(),
      triggerKlineIndex: setup.triggerKlineIndex,
      triggerKlineOpenTime: triggerCandle?.openTime,
      triggerCandleData: setup.triggerCandleData ? JSON.stringify(setup.triggerCandleData) : null,
      triggerIndicatorValues: setup.triggerIndicatorValues ? JSON.stringify(setup.triggerIndicatorValues) : null,
      fibonacciProjection: setup.fibonacciProjection ? JSON.stringify(setup.fibonacciProjection) : null,
      liquidationPrice: liqPrice,
    });

    const isPyramid = sameDirectionPositions.length > 0;
    const primaryExecution = isPyramid ? sameDirectionPositions[0]! : null;

    if (isPyramid && primaryExecution && !useLimit) {
      await handlePyramidMerge(
        watcher, setup, wallet, executionId, actualEntryPrice, actualQuantity, primaryExecution, logBuffer
      );
    } else {
      emitNewPosition(
        watcher, setup, effectiveTakeProfit, executionId, actualEntryPrice, actualQuantity, useLimit, logBuffer
      );
    }
  } catch (dbError) {
    logBuffer.error('✗', 'Failed to insert trade execution', {
      executionId,
      error: serializeError(dbError),
    });
    throw dbError;
  }

  try {
    await cooldownService.setCooldown(
      setup.type,
      watcher.symbol,
      watcher.interval,
      watcher.walletId,
      executionId,
      15,
      'Trade executed'
    );
  } catch {
  }

  await positionMonitorService.invalidatePriceCache(watcher.symbol);
};

const handlePyramidMerge = async (
  watcher: ActiveWatcher,
  setup: TradingSetup,
  wallet: Wallet,
  executionId: string,
  actualEntryPrice: number,
  actualQuantity: number,
  primaryExecution: typeof tradeExecutions.$inferSelect,
  logBuffer: WatcherLogBuffer
): Promise<void> => {
  const oldQty = parseFloat(primaryExecution.quantity);
  const oldPrice = parseFloat(primaryExecution.entryPrice);
  let newTotalQty = oldQty + actualQuantity;
  let newAvgPrice = ((oldQty * oldPrice) + (actualQuantity * actualEntryPrice)) / newTotalQty;

  let pyramidLiqPrice: string | undefined;
  try {
    const rawClient = createBinanceFuturesClient(wallet);
    const exchangePos = await getPosition(rawClient, watcher.symbol);
    if (exchangePos) {
      const exchQty = Math.abs(parseFloat(exchangePos.positionAmt));
      const exchPrice = parseFloat(exchangePos.entryPrice);
      if (exchQty > 0) {
        newTotalQty = exchQty;
        newAvgPrice = exchPrice;
      }
      const lp = parseFloat(exchangePos.liquidationPrice || '0');
      if (lp > 0) pyramidLiqPrice = lp.toString();
    }
  } catch (_e) {
    logger.warn({ symbol: watcher.symbol }, '[OrderExecutor] Failed to sync position from exchange after pyramid');
  }

  await db.update(tradeExecutions).set({
    entryPrice: newAvgPrice.toString(),
    quantity: newTotalQty.toString(),
    liquidationPrice: pyramidLiqPrice ?? primaryExecution.liquidationPrice,
    updatedAt: new Date(),
  }).where(eq(tradeExecutions.id, primaryExecution.id));

  await db.delete(tradeExecutions).where(eq(tradeExecutions.id, executionId));

  if (primaryExecution.stopLoss || primaryExecution.takeProfit) {
    try {
      await cancelAllOpenProtectionOrdersOnExchange({ wallet, symbol: watcher.symbol, marketType: watcher.marketType ?? 'FUTURES' });
    } catch (_e) {
      logger.warn({ symbol: watcher.symbol }, '[OrderExecutor] Failed to cancel old protection orders after pyramid');
    }

    let newSlAlgoId: string | null = null;
    let newSlOrderId: string | null = null;
    let newSlIsAlgo = false;
    let newTpAlgoId: string | null = null;
    let newTpOrderId: string | null = null;
    let newTpIsAlgo = false;

    if (primaryExecution.stopLoss) {
      try {
        const slResult = await createStopLossOrder({ wallet, symbol: watcher.symbol, side: setup.direction, quantity: newTotalQty, triggerPrice: parseFloat(primaryExecution.stopLoss), marketType: watcher.marketType ?? 'FUTURES' });
        newSlAlgoId = slResult.isAlgoOrder ? (slResult.algoId ?? null) : null;
        newSlOrderId = !slResult.isAlgoOrder ? (slResult.orderId ?? null) : null;
        newSlIsAlgo = slResult.isAlgoOrder;
      } catch (e) {
        logger.error({ error: serializeError(e), symbol: watcher.symbol }, '[OrderExecutor] Failed to place SL after pyramid merge');
      }
    }

    if (primaryExecution.takeProfit) {
      try {
        const tpResult = await createTakeProfitOrder({ wallet, symbol: watcher.symbol, side: setup.direction, quantity: newTotalQty, triggerPrice: parseFloat(primaryExecution.takeProfit), marketType: watcher.marketType ?? 'FUTURES' });
        newTpAlgoId = tpResult.isAlgoOrder ? (tpResult.algoId ?? null) : null;
        newTpOrderId = !tpResult.isAlgoOrder ? (tpResult.orderId ?? null) : null;
        newTpIsAlgo = tpResult.isAlgoOrder;
      } catch (e) {
        logger.error({ error: serializeError(e), symbol: watcher.symbol }, '[OrderExecutor] Failed to place TP after pyramid merge');
      }
    }

    await db.update(tradeExecutions).set({
      stopLossAlgoId: newSlAlgoId,
      stopLossOrderId: newSlOrderId,
      stopLossIsAlgo: newSlIsAlgo,
      takeProfitAlgoId: newTpAlgoId,
      takeProfitOrderId: newTpOrderId,
      takeProfitIsAlgo: newTpIsAlgo,
      updatedAt: new Date(),
    }).where(eq(tradeExecutions.id, primaryExecution.id));
  }

  logBuffer.addTradeExecution({
    setupType: setup.type,
    direction: setup.direction,
    entryPrice: newAvgPrice.toFixed(6),
    quantity: newTotalQty.toFixed(8),
    stopLoss: primaryExecution.stopLoss ?? undefined,
    takeProfit: primaryExecution.takeProfit ?? undefined,
    orderType: 'MARKET',
    status: 'executed',
  });

  log('✓ Pyramided into existing position', {
    primaryId: primaryExecution.id,
    newAvgPrice: newAvgPrice.toFixed(6),
    newTotalQty: newTotalQty.toFixed(8),
    addedQty: actualQuantity.toFixed(8),
    addedPrice: actualEntryPrice.toFixed(6),
  });

  const wsServicePyramid = getWebSocketService();
  if (wsServicePyramid) {
    wsServicePyramid.emitPositionUpdate(watcher.walletId, {
      ...primaryExecution,
      entryPrice: newAvgPrice.toString(),
      quantity: newTotalQty.toString(),
    });

    const sideLabel = setup.direction === 'LONG' ? 'Long' : 'Short';
    wsServicePyramid.emitTradeNotification(watcher.walletId, {
      type: 'POSITION_OPENED',
      title: `${setup.type} pyramid (${sideLabel})`,
      body: `Added ${actualQuantity.toFixed(4)} ${watcher.symbol} @ ${actualEntryPrice.toFixed(2)} → total ${newTotalQty.toFixed(4)}`,
      urgency: 'normal',
      data: {
        executionId: primaryExecution.id,
        symbol: watcher.symbol,
        side: setup.direction,
        entryPrice: newAvgPrice.toString(),
        exitPrice: '',
        pnl: '',
        pnlPercent: '',
        exitReason: '',
      },
    });
  }
};

const emitNewPosition = (
  watcher: ActiveWatcher,
  setup: TradingSetup,
  effectiveTakeProfit: number | undefined,
  executionId: string,
  actualEntryPrice: number,
  actualQuantity: number,
  useLimit: boolean,
  logBuffer: WatcherLogBuffer
): void => {
  logBuffer.addTradeExecution({
    setupType: setup.type,
    direction: setup.direction,
    entryPrice: actualEntryPrice.toFixed(6),
    quantity: actualQuantity.toFixed(8),
    stopLoss: setup.stopLoss?.toFixed(6),
    takeProfit: effectiveTakeProfit?.toFixed(6),
    orderType: useLimit ? 'LIMIT' : 'MARKET',
    status: 'executed',
  });

  const wsServiceOpen = getWebSocketService();
  if (wsServiceOpen) {
    wsServiceOpen.emitPositionUpdate(watcher.walletId, {
      id: executionId,
      symbol: watcher.symbol,
      side: setup.direction,
      status: 'open',
      entryPrice: actualEntryPrice.toString(),
      quantity: actualQuantity.toFixed(8),
      stopLoss: setup.stopLoss?.toString(),
      takeProfit: effectiveTakeProfit?.toString(),
      setupType: setup.type,
      fibonacciProjection: setup.fibonacciProjection,
    });

    const sideLabel = setup.direction === 'LONG' ? 'Long' : 'Short';
    wsServiceOpen.emitTradeNotification(watcher.walletId, {
      type: 'POSITION_OPENED',
      title: `${setup.type} (${sideLabel})`,
      body: `${sideLabel} ${watcher.symbol} @ ${actualEntryPrice.toFixed(2)}`,
      urgency: 'normal',
      data: {
        executionId,
        symbol: watcher.symbol,
        side: setup.direction,
        entryPrice: actualEntryPrice.toString(),
        exitPrice: '',
        pnl: '',
        pnlPercent: '',
        exitReason: '',
      },
    });
  }
};
