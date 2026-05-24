import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets } from '../db/schema';
import {
  createBinanceFuturesClient,
  isPaperWallet,
  getPositions,
  getOpenOrders,
  getOpenAlgoOrders,
  getAccountInfo,
} from './binance-futures-client';
import { logger } from './logger';

export type { AuditSummary, AuditCheck } from './audit/audit-types';
export { ALL_AUDIT_CHECKS } from './audit/audit-types';
import type { AuditSummary, AuditCheck, AuditContext } from './audit/audit-types';
import { ALL_AUDIT_CHECKS } from './audit/audit-types';
import { auditPositions } from './audit/audit-positions';
import { auditPending } from './audit/audit-pending';
import { auditProtection } from './audit/audit-protection';
import { auditFees, auditBalance } from './audit/audit-fees-balance-pnl';

async function auditWallet(
  wallet: (typeof wallets.$inferSelect),
  dryRun: boolean,
  enabledChecks: Set<AuditCheck>,
  feesCap?: number,
  feesDays?: number,
  feesRateMs?: number,
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
    const openOrderIds = new Set<string>(openOrders.map((o) => o.orderId));
    const openAlgoOrderIds = new Set<string>(openAlgoOrders.map((o) => o.algoId));

    const linkedAlgoIds = new Set<string>();
    for (const exec of dbOpenExecutions) {
      if (exec.stopLossAlgoId) linkedAlgoIds.add(exec.stopLossAlgoId);
      if (exec.takeProfitAlgoId) linkedAlgoIds.add(exec.takeProfitAlgoId);
    }

    const ctx: AuditContext = {
      wallet,
      dryRun,
      summary,
      client,
      dbOpenExecutions,
      dbPendingExecutions,
      exchangePositionsBySymbol,
      openOrderIds,
      openAlgoOrderIds,
      openOrders,
      openAlgoOrders,
      linkedAlgoIds,
      accountInfo,
      feesCap,
      feesDays,
      feesRateMs,
    };

    if (enabledChecks.has('positions')) await auditPositions(ctx);
    if (enabledChecks.has('pending')) await auditPending(ctx);
    if (enabledChecks.has('protection')) await auditProtection(ctx);
    if (enabledChecks.has('fees')) await auditFees(ctx);
    if (enabledChecks.has('balance')) await auditBalance(ctx);

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
  checks?: AuditCheck[];
  feesCap?: number;
  feesDays?: number;
  feesRateMs?: number;
}): Promise<AuditSummary[]> {
  const dryRun = options?.dryRun ?? false;
  const filterWalletId = options?.walletId;
  const feesCap = options?.feesCap;
  const feesDays = options?.feesDays;
  const feesRateMs = options?.feesRateMs;

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

  const enabledChecks = new Set(options?.checks ?? ALL_AUDIT_CHECKS);

  for (const wallet of targetWallets) {
    const summary = await auditWallet(wallet, dryRun, enabledChecks, feesCap, feesDays, feesRateMs);
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

export interface PeriodicAuditSchedulerOptions {
  /** Interval between runs in ms. Required. */
  intervalMs: number;
  /** Audit scope — passed through to runStartupAudit. */
  feesCap?: number;
  feesDays?: number;
  feesRateMs?: number;
  /** Optional run override (for unit tests). Defaults to runStartupAudit. */
  runner?: (opts: Parameters<typeof runStartupAudit>[0]) => Promise<AuditSummary[]>;
}

export interface PeriodicAuditScheduler {
  stop: () => void;
}

/**
 * Periodically reconciles every live FUTURES wallet's DB state with the
 * exchange. Runs the same set of checks as the boot audit (positions,
 * pending, protection, fees, balance) — catches drift that accumulates
 * during long-running sessions (stale fee data, balance creep from any
 * future double-increment, missed user-stream events, etc.).
 *
 * Uses `setInterval` with `.unref()` so the timer doesn't block graceful
 * shutdown. Each run is wrapped so a single failure (network, Binance
 * outage) doesn't kill the loop.
 */
export function startPeriodicAuditScheduler(
  options: PeriodicAuditSchedulerOptions,
): PeriodicAuditScheduler {
  const { intervalMs, feesCap, feesDays, feesRateMs } = options;
  const runner = options.runner ?? runStartupAudit;

  logger.info(
    { intervalMs, feesCap, feesDays, feesRateMs },
    '[startup-audit] Periodic audit scheduler armed',
  );

  const tick = (): void => {
    void (async () => {
      try {
        const summaries = await runner({ feesCap, feesDays, feesRateMs });
        const totalFixed = summaries.reduce((acc, s) => acc + s.fixed, 0);
        logger.info(
          { wallets: summaries.length, totalFixed },
          '[startup-audit] Periodic audit complete',
        );
      } catch (err) {
        logger.error({ err }, '[startup-audit] Periodic audit failed — will retry on next tick');
      }
    })();
  };

  const handle = setInterval(tick, intervalMs);
  handle.unref();

  return {
    stop: () => clearInterval(handle),
  };
}
