import { and, eq, gte } from 'drizzle-orm';
import { db } from '../db';
import { autoTradingConfig, orders, tradeExecutions, wallets } from '../db/schema';
import { calculateTotalFees } from '@marketmind/types';
import type { FuturesOrder } from '@marketmind/types';
import { binanceApiCache } from './binance-api-cache';
import {
  createBinanceFuturesClient,
  isPaperWallet,
  getPositions,
  getOpenOrders,
  getOpenAlgoOrders,
  cancelFuturesAlgoOrder,
  getAccountInfo,
  getAllTradeFeesForPosition,
} from './binance-futures-client';
import type { FuturesAlgoOrder } from './binance-futures-client';
import { getBinanceFuturesDataService } from './binance-futures-data';
import { logger } from './logger';

export interface AuditSummary {
  walletId: string;
  fixed: number;
  warnings: string[];
  errors: string[];
  durationMs: number;
}

const FEES_DELTA_THRESHOLD = 0.01;
const BALANCE_DELTA_THRESHOLD = 1.0;
const FEES_AUDIT_CAP = 10;
const FEES_AUDIT_DAYS = 3;
const FEES_RATE_LIMIT_MS = 1500;
const PENDING_GRACE_PERIOD_MS = 5 * 60 * 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateExecutionId(): string {
  return `exec-audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function findProtectionOrders(
  symbol: string,
  openAlgoOrders: FuturesAlgoOrder[]
): { slAlgoId: number | null; tpAlgoId: number | null } {
  const symbolAlgoOrders = openAlgoOrders.filter(
    (o) => o.symbol === symbol && !o.reduceOnly && !o.closePosition
  );
  const slOrder = symbolAlgoOrders.find((o) => o.type === 'STOP_MARKET');
  const tpOrder = symbolAlgoOrders.find((o) => o.type === 'TAKE_PROFIT_MARKET');
  return {
    slAlgoId: slOrder?.algoId ?? null,
    tpAlgoId: tpOrder?.algoId ?? null,
  };
}

async function auditWallet(
  wallet: (typeof wallets.$inferSelect),
  dryRun: boolean
): Promise<AuditSummary> {
  const start = Date.now();
  const summary: AuditSummary = {
    walletId: wallet.id,
    fixed: 0,
    warnings: [],
    errors: [],
    durationMs: 0,
  };

  try {
    const client = createBinanceFuturesClient(wallet);

    logger.info({ walletId: wallet.id }, '[startup-audit] Starting audit for wallet');

    const [dbOpenExecutions, dbPendingExecutions, exchangePositions, openOrders, openAlgoOrders, accountInfo] =
      await Promise.all([
        db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, wallet.id),
              eq(tradeExecutions.status, 'open'),
              eq(tradeExecutions.marketType, 'FUTURES')
            )
          ),
        db
          .select()
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, wallet.id),
              eq(tradeExecutions.status, 'pending'),
              eq(tradeExecutions.marketType, 'FUTURES')
            )
          ),
        getPositions(client),
        getOpenOrders(client),
        getOpenAlgoOrders(client),
        getAccountInfo(client),
      ]);

    const exchangePositionsBySymbol = new Map(exchangePositions.map((p) => [p.symbol, p]));
    const openOrderIds = new Set(openOrders.map((o) => o.orderId));
    const openAlgoOrderIds = new Set(openAlgoOrders.map((o) => o.algoId));

    // Build set of algo IDs already linked to open executions (protection orders)
    const linkedAlgoIds = new Set<number>();
    for (const exec of dbOpenExecutions) {
      if (exec.stopLossAlgoId) linkedAlgoIds.add(exec.stopLossAlgoId);
      if (exec.takeProfitAlgoId) linkedAlgoIds.add(exec.takeProfitAlgoId);
    }

    // === Check 1 — Open Positions Reconciliation ===
    for (const dbExec of dbOpenExecutions) {
      const exchangePos = exchangePositionsBySymbol.get(dbExec.symbol);

      if (!exchangePos) {
        // Fix A — Orphaned execution (DB open, Binance does not have)
        logger.info(
          { walletId: wallet.id, symbol: dbExec.symbol, executionId: dbExec.id },
          '[startup-audit] Orphaned open execution — closing'
        );

        let exitPrice = 0;
        let pnl = 0;
        let pnlPercent = 0;
        let totalFees = 0;
        let estimatedExitFee = 0;
        const actualEntryFee = parseFloat(dbExec.entryFee || '0');
        const entryPrice = parseFloat(dbExec.entryPrice);
        const quantity = parseFloat(dbExec.quantity);
        const accumulatedFunding = parseFloat(dbExec.accumulatedFunding || '0');
        const leverage = dbExec.leverage || 1;

        try {
          const markPriceData = await getBinanceFuturesDataService().getMarkPrice(dbExec.symbol);
          if (markPriceData) {
            exitPrice = markPriceData.markPrice;
            const grossPnl =
              dbExec.side === 'LONG'
                ? (exitPrice - entryPrice) * quantity
                : (entryPrice - exitPrice) * quantity;
            const exitValue = exitPrice * quantity;
            const { exitFee } = calculateTotalFees(0, exitValue, { marketType: 'FUTURES' });
            estimatedExitFee = exitFee;
            totalFees = actualEntryFee + estimatedExitFee;
            pnl = grossPnl - totalFees + accumulatedFunding;
            const entryValue = entryPrice * quantity;
            const marginValue = entryValue / leverage;
            pnlPercent = marginValue > 0 ? (pnl / marginValue) * 100 : 0;
          }
        } catch {
          logger.warn(
            { walletId: wallet.id, symbol: dbExec.symbol },
            '[startup-audit] Failed to fetch mark price for orphaned execution'
          );
        }

        if (!dryRun) {
          if (exitPrice > 0) {
            const currentBalance = parseFloat(wallet.currentBalance || '0');
            const newBalance = currentBalance + pnl;
            await db
              .update(wallets)
              .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
              .where(eq(wallets.id, wallet.id));
            wallet.currentBalance = newBalance.toString();
          }

          await db
            .update(tradeExecutions)
            .set({
              status: 'closed',
              exitSource: 'AUDIT',
              exitReason: 'AUDIT_SYNC',
              exitPrice: exitPrice > 0 ? exitPrice.toString() : null,
              pnl: pnl !== 0 ? pnl.toString() : null,
              pnlPercent: pnlPercent !== 0 ? pnlPercent.toString() : null,
              fees: totalFees > 0 ? totalFees.toString() : null,
              entryFee: actualEntryFee > 0 ? actualEntryFee.toString() : null,
              exitFee: estimatedExitFee > 0 ? estimatedExitFee.toString() : null,
              stopLossAlgoId: null,
              stopLossOrderId: null,
              takeProfitAlgoId: null,
              takeProfitOrderId: null,
              closedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(tradeExecutions.id, dbExec.id));
        }

        logger.info(
          { walletId: wallet.id, symbol: dbExec.symbol, executionId: dbExec.id, exitPrice, pnl, dryRun },
          '[startup-audit] Closed orphaned execution (AUDIT_SYNC)'
        );
        summary.fixed++;
      } else {
        // Position found on exchange — remove from map (remaining entries are unknown positions)
        exchangePositionsBySymbol.delete(dbExec.symbol);
      }
    }

    // Fix B — Unknown positions (Binance has, DB does not)
    for (const [symbol, position] of exchangePositionsBySymbol) {
      const positionAmt = parseFloat(String(position.positionAmt));
      const entryPrice = parseFloat(String(position.entryPrice));
      const side: 'LONG' | 'SHORT' = positionAmt > 0 ? 'LONG' : 'SHORT';
      const executionId = generateExecutionId();

      // Link any unlinked protection algo orders for this symbol
      const { slAlgoId, tpAlgoId } = findProtectionOrders(symbol, openAlgoOrders);
      const slAlgoToLink = slAlgoId && !linkedAlgoIds.has(slAlgoId) ? slAlgoId : null;
      const tpAlgoToLink = tpAlgoId && !linkedAlgoIds.has(tpAlgoId) ? tpAlgoId : null;

      if (slAlgoToLink) linkedAlgoIds.add(slAlgoToLink);
      if (tpAlgoToLink) linkedAlgoIds.add(tpAlgoToLink);

      logger.info(
        { walletId: wallet.id, symbol, side, positionAmt, entryPrice, executionId, slAlgoToLink, tpAlgoToLink },
        '[startup-audit] Found unknown position — creating execution'
      );

      if (!dryRun) {
        await db.insert(tradeExecutions).values({
          id: executionId,
          userId: wallet.userId,
          walletId: wallet.id,
          symbol,
          side,
          entryPrice: entryPrice.toString(),
          quantity: Math.abs(positionAmt).toFixed(8),
          openedAt: new Date(),
          status: 'open',
          entryOrderType: 'MARKET',
          marketType: 'FUTURES',
          leverage: position.leverage || 1,
          highestPriceSinceEntry: entryPrice.toString(),
          lowestPriceSinceEntry: entryPrice.toString(),
          exitSource: 'MANUAL',
          stopLossAlgoId: slAlgoToLink,
          stopLossIsAlgo: slAlgoToLink !== null,
          takeProfitAlgoId: tpAlgoToLink,
          takeProfitIsAlgo: tpAlgoToLink !== null,
        });
      }

      logger.info(
        { walletId: wallet.id, symbol, executionId, side, slAlgoToLink, tpAlgoToLink, dryRun },
        '[startup-audit] Created missing execution'
      );
      summary.fixed++;
    }

    // === Check 2A — DB pending execution whose entry order no longer exists on Binance ===
    const now = Date.now();
    for (const dbPending of dbPendingExecutions) {
      const entryOrderId = dbPending.entryOrderId;
      if (!entryOrderId) continue;

      const createdAt = dbPending.createdAt.getTime();
      const age = now - createdAt;
      if (age < PENDING_GRACE_PERIOD_MS) continue;

      if (!openOrderIds.has(entryOrderId) && !openAlgoOrderIds.has(entryOrderId)) {
        logger.info(
          { walletId: wallet.id, symbol: dbPending.symbol, executionId: dbPending.id, entryOrderId },
          '[startup-audit] Cancelled orphaned pending execution (entry order gone)'
        );

        if (!dryRun) {
          await db
            .update(tradeExecutions)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(tradeExecutions.id, dbPending.id));
        }

        summary.fixed++;
      }
    }

    // === Check 2B — Binance has open LIMIT entry orders with no pending execution in DB ===
    const pendingEntryOrderIds = new Set(
      dbPendingExecutions.map((e) => e.entryOrderId).filter(Boolean) as number[]
    );

    const entryLimitOrders: FuturesOrder[] = openOrders.filter(
      (o) => !o.reduceOnly && !o.closePosition && o.type === 'LIMIT'
    );

    for (const openOrder of entryLimitOrders) {
      if (pendingEntryOrderIds.has(openOrder.orderId)) continue;

      // Verify no pending execution already exists by entryOrderId
      const [existingPending] = await db
        .select({ id: tradeExecutions.id })
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, wallet.id),
            eq(tradeExecutions.entryOrderId, openOrder.orderId)
          )
        )
        .limit(1);

      if (existingPending) continue;

      const side: 'LONG' | 'SHORT' = openOrder.side === 'BUY' ? 'LONG' : 'SHORT';
      const executionId = generateExecutionId();

      logger.info(
        { walletId: wallet.id, symbol: openOrder.symbol, orderId: openOrder.orderId, side, executionId },
        '[startup-audit] Open LIMIT entry order has no pending execution — creating'
      );

      if (!dryRun) {
        // Ensure orders record exists (FK requirement)
        const [existingOrder] = await db
          .select({ orderId: orders.orderId })
          .from(orders)
          .where(eq(orders.orderId, openOrder.orderId))
          .limit(1);

        if (!existingOrder) {
          await db.insert(orders).values({
            orderId: openOrder.orderId,
            userId: wallet.userId,
            walletId: wallet.id,
            symbol: openOrder.symbol,
            side: openOrder.side,
            type: openOrder.type,
            price: openOrder.price,
            origQty: openOrder.origQty,
            executedQty: openOrder.executedQty,
            status: openOrder.status,
            timeInForce: openOrder.timeInForce,
            time: openOrder.time,
            updateTime: openOrder.updateTime,
            marketType: 'FUTURES',
            reduceOnly: openOrder.reduceOnly,
          });
        }

        await db.insert(tradeExecutions).values({
          id: executionId,
          userId: wallet.userId,
          walletId: wallet.id,
          symbol: openOrder.symbol,
          side,
          entryOrderId: openOrder.orderId,
          entryPrice: openOrder.price,
          limitEntryPrice: openOrder.price,
          quantity: openOrder.origQty,
          status: 'pending',
          openedAt: new Date(openOrder.time ?? Date.now()),
          entryOrderType: 'LIMIT',
          marketType: 'FUTURES',
          exitSource: 'MANUAL',
        });
      }

      summary.fixed++;
    }

    // === Check 2C — Binance has open algo ENTRY orders (non-reduceOnly) with no pending execution ===
    const pendingAlgoEntryIds = new Set(
      dbPendingExecutions.map((e) => e.entryOrderId).filter(Boolean) as number[]
    );

    const algoEntryOrders: FuturesAlgoOrder[] = openAlgoOrders.filter(
      (o) =>
        !o.reduceOnly &&
        !o.closePosition &&
        (o.type === 'STOP_MARKET' || o.type === 'TAKE_PROFIT_MARKET') &&
        !linkedAlgoIds.has(o.algoId)
    );

    for (const algoOrder of algoEntryOrders) {
      if (pendingAlgoEntryIds.has(algoOrder.algoId)) continue;

      const [existingPending] = await db
        .select({ id: tradeExecutions.id })
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, wallet.id),
            eq(tradeExecutions.entryOrderId, algoOrder.algoId)
          )
        )
        .limit(1);

      if (existingPending) continue;

      const side: 'LONG' | 'SHORT' = algoOrder.side === 'BUY' ? 'LONG' : 'SHORT';
      const executionId = generateExecutionId();
      const entryOrderType = algoOrder.type === 'STOP_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';

      logger.info(
        { walletId: wallet.id, symbol: algoOrder.symbol, algoId: algoOrder.algoId, side, executionId, entryOrderType },
        '[startup-audit] Open algo entry order has no pending execution — creating'
      );

      if (!dryRun) {
        // Ensure orders record exists for FK (algoId used as orderId)
        const [existingOrder] = await db
          .select({ orderId: orders.orderId })
          .from(orders)
          .where(eq(orders.orderId, algoOrder.algoId))
          .limit(1);

        if (!existingOrder) {
          await db.insert(orders).values({
            orderId: algoOrder.algoId,
            userId: wallet.userId,
            walletId: wallet.id,
            symbol: algoOrder.symbol,
            side: algoOrder.side,
            type: algoOrder.type,
            price: algoOrder.triggerPrice ?? null,
            origQty: algoOrder.quantity,
            executedQty: '0',
            status: algoOrder.algoStatus ?? 'NEW',
            marketType: 'FUTURES',
            reduceOnly: algoOrder.reduceOnly,
          });
        }

        await db.insert(tradeExecutions).values({
          id: executionId,
          userId: wallet.userId,
          walletId: wallet.id,
          symbol: algoOrder.symbol,
          side,
          entryOrderId: algoOrder.algoId,
          entryPrice: algoOrder.triggerPrice ?? '0',
          limitEntryPrice: algoOrder.triggerPrice,
          quantity: algoOrder.quantity,
          status: 'pending',
          openedAt: new Date(algoOrder.createTime ?? Date.now()),
          entryOrderType,
          marketType: 'FUTURES',
          exitSource: 'MANUAL',
        });
      }

      summary.fixed++;
    }

    // === Check 3A — Stale protection order IDs (in DB but no longer on Binance) ===
    for (const dbExec of dbOpenExecutions) {
      let hasStaleIds = false;
      const protectionUpdates: {
        stopLossAlgoId?: null;
        stopLossIsAlgo?: null;
        takeProfitAlgoId?: null;
        takeProfitIsAlgo?: null;
        stopLossOrderId?: null;
        takeProfitOrderId?: null;
      } = {};

      if (dbExec.stopLossAlgoId && !openAlgoOrderIds.has(dbExec.stopLossAlgoId)) {
        logger.info(
          { walletId: wallet.id, symbol: dbExec.symbol, algoId: dbExec.stopLossAlgoId },
          '[startup-audit] Cleared stale SL algo ID'
        );
        protectionUpdates.stopLossAlgoId = null;
        protectionUpdates.stopLossIsAlgo = null;
        hasStaleIds = true;
      }

      if (dbExec.takeProfitAlgoId && !openAlgoOrderIds.has(dbExec.takeProfitAlgoId)) {
        logger.info(
          { walletId: wallet.id, symbol: dbExec.symbol, algoId: dbExec.takeProfitAlgoId },
          '[startup-audit] Cleared stale TP algo ID'
        );
        protectionUpdates.takeProfitAlgoId = null;
        protectionUpdates.takeProfitIsAlgo = null;
        hasStaleIds = true;
      }

      if (dbExec.stopLossOrderId && !openOrderIds.has(dbExec.stopLossOrderId)) {
        logger.info(
          { walletId: wallet.id, symbol: dbExec.symbol, orderId: dbExec.stopLossOrderId },
          '[startup-audit] Cleared stale SL order ID'
        );
        protectionUpdates.stopLossOrderId = null;
        hasStaleIds = true;
      }

      if (dbExec.takeProfitOrderId && !openOrderIds.has(dbExec.takeProfitOrderId)) {
        logger.info(
          { walletId: wallet.id, symbol: dbExec.symbol, orderId: dbExec.takeProfitOrderId },
          '[startup-audit] Cleared stale TP order ID'
        );
        protectionUpdates.takeProfitOrderId = null;
        hasStaleIds = true;
      }

      if (hasStaleIds) {
        if (!dryRun) {
          await db
            .update(tradeExecutions)
            .set({ ...protectionUpdates, updatedAt: new Date() })
            .where(eq(tradeExecutions.id, dbExec.id));
        }
        summary.fixed++;
      }
    }

    // === Check 3B — Open executions missing protection IDs but algo orders exist on Binance ===
    const executionsWithNoProtection = dbOpenExecutions.filter(
      (e) =>
        !e.stopLossAlgoId &&
        !e.takeProfitAlgoId &&
        !e.stopLossOrderId &&
        !e.takeProfitOrderId
    );

    for (const dbExec of executionsWithNoProtection) {
      const { slAlgoId, tpAlgoId } = findProtectionOrders(dbExec.symbol, openAlgoOrders);
      const slToLink = slAlgoId && openAlgoOrderIds.has(slAlgoId) && !linkedAlgoIds.has(slAlgoId) ? slAlgoId : null;
      const tpToLink = tpAlgoId && openAlgoOrderIds.has(tpAlgoId) && !linkedAlgoIds.has(tpAlgoId) ? tpAlgoId : null;

      if (!slToLink && !tpToLink) continue;

      if (slToLink) linkedAlgoIds.add(slToLink);
      if (tpToLink) linkedAlgoIds.add(tpToLink);

      logger.info(
        { walletId: wallet.id, symbol: dbExec.symbol, executionId: dbExec.id, slToLink, tpToLink },
        '[startup-audit] Linked orphan protection orders to open execution'
      );

      if (!dryRun) {
        await db
          .update(tradeExecutions)
          .set({
            stopLossAlgoId: slToLink,
            stopLossIsAlgo: slToLink !== null,
            takeProfitAlgoId: tpToLink,
            takeProfitIsAlgo: tpToLink !== null,
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, dbExec.id));
      }

      summary.fixed++;
    }

    // === Check 3C — Orphan protection algo orders for symbols with open positions ===
    // These are stale/duplicate SL or TP orders on Binance that are no longer linked to any DB execution.
    // Only runs if autoCancelOrphans is enabled in the wallet's config.
    const [walletConfig] = await db.select({ autoCancelOrphans: autoTradingConfig.autoCancelOrphans })
      .from(autoTradingConfig)
      .where(eq(autoTradingConfig.walletId, wallet.id))
      .limit(1);

    if (walletConfig?.autoCancelOrphans) {
      const openSymbols = new Set(dbOpenExecutions.map((e) => e.symbol));

      for (const algoOrder of openAlgoOrders) {
        if (linkedAlgoIds.has(algoOrder.algoId)) continue;
        if (!openSymbols.has(algoOrder.symbol)) continue;

        logger.info(
          { walletId: wallet.id, symbol: algoOrder.symbol, algoId: algoOrder.algoId, type: algoOrder.type, triggerPrice: algoOrder.triggerPrice },
          '[startup-audit] Cancelling orphan protection algo order'
        );

        if (!dryRun) {
          try {
            await cancelFuturesAlgoOrder(client, algoOrder.algoId);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            summary.warnings.push(`Failed to cancel orphan algo ${algoOrder.algoId} for ${algoOrder.symbol}: ${msg}`);
            logger.warn({ walletId: wallet.id, algoId: algoOrder.algoId, symbol: algoOrder.symbol, err: msg }, '[startup-audit] Failed to cancel orphan algo order');
          }
        }

        summary.fixed++;
      }
    }

    // === Check 4 — Recent Fees Correctness (last 7 days) ===
    const sevenDaysAgo = new Date(Date.now() - FEES_AUDIT_DAYS * 24 * 60 * 60 * 1000);
    const recentClosed = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.status, 'closed'),
          eq(tradeExecutions.marketType, 'FUTURES'),
          gte(tradeExecutions.closedAt, sevenDaysAgo)
        )
      );

    const feesAuditCandidates = recentClosed.slice(0, FEES_AUDIT_CAP);
    for (const exec of feesAuditCandidates) {
      if (!exec.closedAt) continue;
      if (binanceApiCache.isBanned()) break;

      await sleep(FEES_RATE_LIMIT_MS);

      const realFees = await getAllTradeFeesForPosition(
        client,
        exec.symbol,
        exec.side,
        exec.openedAt.getTime(),
        exec.closedAt.getTime()
      );

      if (!realFees) continue;

      const dbEntryFee = parseFloat(exec.entryFee || '0');
      const dbExitFee = parseFloat(exec.exitFee || '0');
      const entryFeeDelta = Math.abs(realFees.entryFee - dbEntryFee);
      const exitFeeDelta = Math.abs(realFees.exitFee - dbExitFee);

      if (entryFeeDelta <= FEES_DELTA_THRESHOLD && exitFeeDelta <= FEES_DELTA_THRESHOLD) continue;

      logger.info(
        {
          walletId: wallet.id,
          executionId: exec.id,
          symbol: exec.symbol,
          dbEntryFee,
          dbExitFee,
          realEntryFee: realFees.entryFee,
          realExitFee: realFees.exitFee,
        },
        '[startup-audit] Fee discrepancy detected — correcting'
      );

      const newEntryFee = realFees.entryFee;
      const newExitFee = realFees.exitFee;
      const newTotalFees = newEntryFee + newExitFee;
      const entryPrice = parseFloat(exec.entryPrice);
      const exitPrice = parseFloat(exec.exitPrice || '0');
      const quantity = parseFloat(exec.quantity);
      const leverage = exec.leverage || 1;
      const accumulatedFunding = parseFloat(exec.accumulatedFunding || '0');

      const grossPnl =
        exec.side === 'LONG'
          ? (exitPrice - entryPrice) * quantity
          : (entryPrice - exitPrice) * quantity;
      const newPnl = grossPnl - newTotalFees + accumulatedFunding;
      const marginValue = (entryPrice * quantity) / leverage;
      const newPnlPercent = marginValue > 0 ? (newPnl / marginValue) * 100 : 0;
      const oldPnl = parseFloat(exec.pnl || '0');
      const pnlDelta = newPnl - oldPnl;

      if (!dryRun) {
        await db
          .update(tradeExecutions)
          .set({
            entryFee: newEntryFee.toString(),
            exitFee: newExitFee.toString(),
            fees: newTotalFees.toString(),
            pnl: newPnl.toString(),
            pnlPercent: newPnlPercent.toString(),
            updatedAt: new Date(),
          })
          .where(eq(tradeExecutions.id, exec.id));

        if (Math.abs(pnlDelta) > FEES_DELTA_THRESHOLD) {
          const currentBalance = parseFloat(wallet.currentBalance || '0');
          const newBalance = currentBalance + pnlDelta;
          await db
            .update(wallets)
            .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
            .where(eq(wallets.id, wallet.id));
          wallet.currentBalance = newBalance.toString();
        }
      }

      summary.fixed++;
    }

    // === Check 5 — Wallet Balance Comparison (warn only) ===
    const dbBalance = parseFloat(wallet.currentBalance || '0');
    const exchangeAvailableBalance = parseFloat(accountInfo.availableBalance);
    const balanceDelta = Math.abs(dbBalance - exchangeAvailableBalance);

    if (balanceDelta > BALANCE_DELTA_THRESHOLD) {
      const warning = `Balance discrepancy: DB=${dbBalance.toFixed(4)} Binance=${exchangeAvailableBalance.toFixed(4)} delta=${balanceDelta.toFixed(4)}`;
      summary.warnings.push(warning);
      logger.warn(
        { walletId: wallet.id, dbBalance, exchangeAvailableBalance, balanceDelta },
        `[startup-audit] ${warning}`
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    summary.errors.push(msg);
    logger.error({ walletId: wallet.id, error: msg }, '[startup-audit] Wallet audit failed');
  }

  summary.durationMs = Date.now() - start;
  return summary;
}

export async function runStartupAudit(options?: {
  dryRun?: boolean;
  walletId?: string;
}): Promise<AuditSummary[]> {
  const dryRun = options?.dryRun ?? false;
  const filterWalletId = options?.walletId;

  logger.info({ dryRun, filterWalletId }, '[startup-audit] Starting startup audit');

  const allWallets = await db.select().from(wallets);
  const targetWallets = allWallets.filter(
    (w) =>
      !isPaperWallet(w) &&
      w.apiKeyEncrypted &&
      w.apiSecretEncrypted &&
      w.marketType === 'FUTURES' &&
      (!filterWalletId || w.id === filterWalletId)
  );

  if (targetWallets.length === 0) {
    logger.info('[startup-audit] No live FUTURES wallets to audit');
    return [];
  }

  const summaries: AuditSummary[] = [];
  let totalFixed = 0;
  let totalWarnings = 0;

  for (const wallet of targetWallets) {
    const summary = await auditWallet(wallet, dryRun);
    summaries.push(summary);
    totalFixed += summary.fixed;
    totalWarnings += summary.warnings.length;
  }

  logger.info(
    { totalFixed, totalWarnings, wallets: targetWallets.length, dryRun },
    `[startup-audit] ✅ Complete: ${totalFixed} fixed, ${totalWarnings} warnings across ${targetWallets.length} wallets`
  );

  return summaries;
}
