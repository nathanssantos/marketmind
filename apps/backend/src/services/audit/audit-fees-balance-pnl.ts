import { and, eq, gte } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, wallets } from '../../db/schema';
import { binanceApiCache } from '../binance-api-cache';
import { getAllTradeFeesForPosition } from '../binance-futures-client';
import { recomputeExecutionAccumulatedFunding } from '../income-events/matcher';
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

    // Backfill any FUNDING_FEE income events that got linked to this
    // execution after it closed (or, for executions created before the
    // accumulation fix landed, that were linked but never summed into
    // the execution row). Cheap DB-only operation, no Binance call.
    await recomputeExecutionAccumulatedFunding(exec.id);

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

    // Re-read execution after the funding recomputation so the audit
    // sees up-to-date `accumulatedFunding` even when fees match.
    const [refreshed] = await db
      .select({ accumulatedFunding: tradeExecutions.accumulatedFunding })
      .from(tradeExecutions)
      .where(eq(tradeExecutions.id, exec.id))
      .limit(1);
    const accumulatedFunding = parseFloat(refreshed?.accumulatedFunding ?? exec.accumulatedFunding ?? '0');
    const fundingDelta = Math.abs(accumulatedFunding - parseFloat(exec.accumulatedFunding ?? '0'));

    if (
      entryFeeDelta <= FEES_DELTA_THRESHOLD &&
      exitFeeDelta <= FEES_DELTA_THRESHOLD &&
      fundingDelta <= FEES_DELTA_THRESHOLD
    ) continue;

    logger.info(
      {
        walletId: wallet.id,
        executionId: exec.id,
        symbol: exec.symbol,
        dbEntryFee,
        dbExitFee,
        realEntryFee: realFees.entryFee,
        realExitFee: realFees.exitFee,
        dbFunding: parseFloat(exec.accumulatedFunding ?? '0'),
        recomputedFunding: accumulatedFunding,
      },
      '[startup-audit] Fee or funding discrepancy detected — correcting'
    );

    const newEntryFee = realFees.entryFee;
    const newExitFee = realFees.exitFee;
    const newTotalFees = newEntryFee + newExitFee;
    const entryPrice = parseFloat(exec.entryPrice);
    const exitPrice = parseFloat(exec.exitPrice ?? '0');
    const quantity = parseFloat(exec.quantity);
    const leverage = exec.leverage ?? 1;

    // Binance's `realizedPnl` is the source of truth — sum of
    // `realizedPnl` across closing-side trades, handles weighted
    // average / partial closes / post-only fee adjustments. Trust
    // it whenever realFees was fetched (already guaranteed by the
    // `if (!realFees) continue` guard above).
    //
    // Earlier code fell back to a locally-computed grossPnl when
    // Binance reported `realizedPnl === 0` — but that's exactly the
    // case where local recomputation goes haywire: a SYNC_INCOMPLETE
    // exec has `exitPrice = null` (parsed as 0), so `(entry - 0) ×
    // qty` produces a phantom grossPnl in the tens of thousands
    // (incident 2026-05-09T17:43, BTCUSDT SHORT, +$8906 phantom).
    // realizedPnl === 0 should be honoured: the position genuinely
    // realized nothing yet (no exit fills). Net P&L is just the
    // entry fee paid.
    const grossPnl = realFees.realizedPnl;
    const newPnl = grossPnl - newTotalFees + accumulatedFunding;
    const marginValue = (entryPrice * quantity) / leverage;
    // No exit price → no realized return, so pnlPercent is 0 even
    // when newPnl is non-zero (it's just the fee cost). Surfacing a
    // ROE % off pure fees is misleading.
    const newPnlPercent = exitPrice > 0 && marginValue > 0
      ? (newPnl / marginValue) * 100
      : 0;
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

