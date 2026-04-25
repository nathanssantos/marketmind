import type { PositionSide } from '@marketmind/types';
import { eq } from 'drizzle-orm';
import { calculateTotalFees } from '@marketmind/types';
import { db } from '../../db';
import { tradeExecutions, wallets } from '../../db/schema';
import { getBinanceFuturesDataService } from '../binance-futures-data';
import { logger } from '../logger';
import type { AuditContext } from './audit-types';
import { generateExecutionId, findProtectionOrders } from './audit-types';

export async function auditPositions(ctx: AuditContext): Promise<void> {
  const { wallet, dryRun, summary, dbOpenExecutions, exchangePositionsBySymbol, openAlgoOrders, linkedAlgoIds } = ctx;

  for (const dbExec of dbOpenExecutions) {
    const exchangePos = exchangePositionsBySymbol.get(dbExec.symbol);

    if (!exchangePos) {
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
      exchangePositionsBySymbol.delete(dbExec.symbol);
    }
  }

  for (const [symbol, position] of exchangePositionsBySymbol) {
    const positionAmt = parseFloat(String(position.positionAmt));
    const entryPrice = parseFloat(String(position.entryPrice));
    const side: PositionSide = positionAmt > 0 ? 'LONG' : 'SHORT';
    const executionId = generateExecutionId();

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
}
