import { and, eq, gte } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, wallets } from '../../db/schema';
import { binanceApiCache } from '../binance-api-cache';
import { getAllTradeFeesForPosition } from '../binance-futures-client';
import { logger } from '../logger';
import type { AuditContext } from './audit-types';
import {
  FEES_DELTA_THRESHOLD,
  BALANCE_DELTA_THRESHOLD,
  FEES_AUDIT_CAP,
  FEES_AUDIT_DAYS,
  FEES_RATE_LIMIT_MS,
  sleep,
} from './audit-types';

export async function auditFees(ctx: AuditContext): Promise<void> {
  const { wallet, dryRun, summary, client, feesCap, feesDays } = ctx;

  const cap = feesCap ?? FEES_AUDIT_CAP;
  const days = feesDays ?? FEES_AUDIT_DAYS;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const recentClosed = await db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, wallet.id),
        eq(tradeExecutions.status, 'closed'),
        eq(tradeExecutions.marketType, 'FUTURES'),
        gte(tradeExecutions.closedAt, cutoff)
      )
    );

  const feesAuditCandidates = recentClosed.slice(0, cap);
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

    const dbEntryFee = parseFloat(exec.entryFee ?? '0');
    const dbExitFee = parseFloat(exec.exitFee ?? '0');
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
    const exitPrice = parseFloat(exec.exitPrice ?? '0');
    const quantity = parseFloat(exec.quantity);
    const leverage = exec.leverage ?? 1;
    const accumulatedFunding = parseFloat(exec.accumulatedFunding ?? '0');

    const grossPnl =
      exec.side === 'LONG'
        ? (exitPrice - entryPrice) * quantity
        : (entryPrice - exitPrice) * quantity;
    const newPnl = grossPnl - newTotalFees + accumulatedFunding;
    const marginValue = (entryPrice * quantity) / leverage;
    const newPnlPercent = marginValue > 0 ? (newPnl / marginValue) * 100 : 0;
    const oldPnl = parseFloat(exec.pnl ?? '0');
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
        const currentBalance = parseFloat(wallet.currentBalance ?? '0');
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
}

export async function auditBalance(ctx: AuditContext): Promise<void> {
  const { wallet, dryRun, summary, dbOpenExecutions, accountInfo } = ctx;

  const dbBalance = parseFloat(wallet.currentBalance ?? '0');
  const exchangeTotalWalletBalance = parseFloat(accountInfo.totalWalletBalance);
  const exchangeAvailableBalance = parseFloat(accountInfo.availableBalance);
  const hasOpenPositions = dbOpenExecutions.length > 0;
  const exchangeBalance = hasOpenPositions ? exchangeTotalWalletBalance : exchangeAvailableBalance;
  const balanceDelta = Math.abs(dbBalance - exchangeBalance);

  if (balanceDelta > BALANCE_DELTA_THRESHOLD) {
    logger.info(
      { walletId: wallet.id, dbBalance, exchangeBalance, exchangeTotalWalletBalance, exchangeAvailableBalance, balanceDelta, hasOpenPositions },
      '[startup-audit] Balance discrepancy detected — syncing to exchange value'
    );

    if (!dryRun) {
      await db
        .update(wallets)
        .set({
          currentBalance: exchangeBalance.toString(),
          totalWalletBalance: exchangeTotalWalletBalance.toString(),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
      wallet.currentBalance = exchangeBalance.toString();
    }

    summary.fixed++;
    logger.info(
      { walletId: wallet.id, oldBalance: dbBalance.toFixed(4), newBalance: exchangeBalance.toFixed(4), delta: balanceDelta.toFixed(4), dryRun },
      '[startup-audit] Balance synced'
    );
  }
}

