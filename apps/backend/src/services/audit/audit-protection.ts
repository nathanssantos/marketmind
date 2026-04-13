import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { autoTradingConfig, tradeExecutions } from '../../db/schema';
import { cancelFuturesAlgoOrder } from '../binance-futures-client';
import { logger } from '../logger';
import type { AuditContext } from './audit-types';
import { findProtectionOrders } from './audit-types';

export async function auditProtection(ctx: AuditContext): Promise<void> {
  const { wallet, dryRun, summary, client, dbOpenExecutions, openAlgoOrderIds, openOrderIds, openAlgoOrders, linkedAlgoIds } = ctx;

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
}
