import 'dotenv/config';
import { USDMClient } from 'binance';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../src/db/client';
import { tradeExecutions, wallets } from '../../src/db/schema';
import { decryptApiKey } from '../../src/services/encryption';
import { getWalletType } from '../../src/services/binance-client';

interface BinanceTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: string;
  price: string;
  qty: string;
  realizedPnl: string;
  commission: string;
  time: number;
}

interface ClassifiedTrades {
  entryTrades: BinanceTrade[];
  exitTrades: BinanceTrade[];
  canVerifyEntry: boolean;
  canVerifyExit: boolean;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000 - 60_000;
const OVERLAP_RATIO_THRESHOLD = 1.5;
const EXIT_RELIABILITY_THRESHOLD = 0.5;

async function fetchAllAccountTrades(
  client: USDMClient,
  symbol: string,
  startTime: number,
  endTime: number
): Promise<BinanceTrade[]> {
  const allTrades: BinanceTrade[] = [];
  const paddedStart = startTime - 10_000;
  const paddedEnd = endTime + 10_000;

  let windowStart = paddedStart;
  while (windowStart < paddedEnd) {
    const windowEnd = Math.min(windowStart + SEVEN_DAYS_MS, paddedEnd);

    const firstBatch = await client.getAccountTrades({
      symbol, startTime: windowStart, endTime: windowEnd, limit: 1000,
    });

    for (const t of firstBatch) {
      allTrades.push({
        symbol: t.symbol, id: t.id, orderId: t.orderId, side: t.side,
        price: String(t.price), qty: String(t.qty),
        realizedPnl: String(t.realizedPnl), commission: String(t.commission), time: t.time,
      });
    }

    if (firstBatch.length === 1000) {
      let fromId = firstBatch[firstBatch.length - 1]!.id + 1;
      while (true) {
        await sleep(200);
        const batch = await client.getAccountTrades({ symbol, fromId, limit: 1000 });
        if (batch.length === 0) break;
        const inRange = batch.filter(t => t.time <= windowEnd);
        for (const t of inRange) {
          allTrades.push({
            symbol: t.symbol, id: t.id, orderId: t.orderId, side: t.side,
            price: String(t.price), qty: String(t.qty),
            realizedPnl: String(t.realizedPnl), commission: String(t.commission), time: t.time,
          });
        }
        if (inRange.length < batch.length || batch.length < 1000) break;
        fromId = batch[batch.length - 1]!.id + 1;
      }
    }

    windowStart = windowEnd + 1;
    if (windowStart < paddedEnd) await sleep(200);
  }

  const uniqueTrades = new Map<number, BinanceTrade>();
  for (const t of allTrades) uniqueTrades.set(t.id, t);
  return Array.from(uniqueTrades.values()).sort((a, b) => a.time - b.time);
}

async function fetchFundingFees(
  client: USDMClient,
  symbol: string,
  startTime: number,
  endTime: number
): Promise<number> {
  let totalFunding = 0;
  let windowStart = startTime;

  while (windowStart < endTime) {
    const windowEnd = Math.min(windowStart + SEVEN_DAYS_MS, endTime);
    let currentStart = windowStart;

    while (currentStart < windowEnd) {
      await sleep(200);
      const income = await client.getIncomeHistory({
        symbol, incomeType: 'FUNDING_FEE', startTime: currentStart, endTime: windowEnd, limit: 1000,
      } as Parameters<typeof client.getIncomeHistory>[0]);

      if (income.length === 0) break;
      for (const item of income) totalFunding += parseFloat(item.income);
      if (income.length < 1000) break;
      currentStart = income[income.length - 1]!.time + 1;
    }

    windowStart = windowEnd + 1;
  }

  return totalFunding;
}

const sumQty = (trades: BinanceTrade[]) => trades.reduce((s, t) => s + parseFloat(t.qty), 0);

function classifyTrades(
  trades: BinanceTrade[],
  side: 'LONG' | 'SHORT',
  entryOrderId: number | null,
  exitOrderIds: number[],
  dbQuantity: number
): ClassifiedTrades {
  const validEntryId = entryOrderId && entryOrderId > 0 ? entryOrderId : null;
  const validExitIds = exitOrderIds.filter(id => id > 0);

  const entrySide = side === 'LONG' ? 'BUY' : 'SELL';
  const exitSide = side === 'LONG' ? 'SELL' : 'BUY';
  const entryBySide = trades.filter(t => t.side === entrySide);
  const exitBySide = trades.filter(t => t.side === exitSide);

  const entryByOrderId = validEntryId ? trades.filter(t => t.orderId === validEntryId) : [];
  const exitByOrderId = validExitIds.length > 0 ? trades.filter(t => validExitIds.includes(t.orderId)) : [];

  const entryQtyById = sumQty(entryByOrderId);
  const entryQtyBySide = sumQty(entryBySide);
  const exitQtyById = sumQty(exitByOrderId);

  const hasHiddenOverlap = entryByOrderId.length > 0
    ? entryQtyBySide > 0 && (entryQtyBySide / entryQtyById) > OVERLAP_RATIO_THRESHOLD
    : dbQuantity > 0 && entryQtyBySide > 0 && (entryQtyBySide / dbQuantity) > OVERLAP_RATIO_THRESHOLD;

  const exitIsReliable = exitByOrderId.length > 0 && dbQuantity > 0 && exitQtyById > dbQuantity * EXIT_RELIABILITY_THRESHOLD;

  if (entryByOrderId.length > 0) {
    if (exitIsReliable) {
      return { entryTrades: entryByOrderId, exitTrades: exitByOrderId, canVerifyEntry: true, canVerifyExit: true };
    }
    if (!hasHiddenOverlap) {
      return { entryTrades: entryByOrderId, exitTrades: exitBySide, canVerifyEntry: true, canVerifyExit: true };
    }
    return { entryTrades: entryByOrderId, exitTrades: [], canVerifyEntry: true, canVerifyExit: false };
  }

  if (hasHiddenOverlap) {
    if (exitIsReliable) {
      return { entryTrades: [], exitTrades: exitByOrderId, canVerifyEntry: false, canVerifyExit: true };
    }
    return { entryTrades: [], exitTrades: [], canVerifyEntry: false, canVerifyExit: false };
  }

  return { entryTrades: entryBySide, exitTrades: exitBySide, canVerifyEntry: true, canVerifyExit: true };
}

function computeWeightedAvg(trades: BinanceTrade[]): { avgPrice: number; totalQty: number; totalFee: number } {
  let weightedPrice = 0;
  let totalQty = 0;
  let totalFee = 0;
  for (const t of trades) {
    const qty = parseFloat(t.qty);
    weightedPrice += parseFloat(t.price) * qty;
    totalQty += qty;
    totalFee += parseFloat(t.commission);
  }
  return { avgPrice: totalQty > 0 ? roundTo(weightedPrice / totalQty, 8) : 0, totalQty, totalFee };
}

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

function isOrphanedExit(exec: { exitReason: string | null; exitSource: string | null }): boolean {
  return exec.exitReason === 'ORPHANED_POSITION' || exec.exitSource === 'SYNC';
}

interface CorrectionResult {
  executionId: string;
  walletId: string;
  symbol: string;
  side: string;
  changes: string[];
  oldValues: Record<string, string>;
  newValues: Record<string, string>;
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  TRADE FEE CORRECTION SCRIPT');
  console.log(DRY_RUN ? '  MODE: DRY RUN (no DB changes)' : '  MODE: LIVE (will update DB)');
  console.log('='.repeat(80));
  console.log(`  Time: ${new Date().toISOString()}\n`);

  const allWallets = await db.select().from(wallets);
  const liveWallets = allWallets.filter(w => {
    const wType = getWalletType(w);
    return wType !== 'paper' && w.apiKeyEncrypted && w.apiSecretEncrypted && w.marketType === 'FUTURES';
  });

  if (liveWallets.length === 0) {
    console.log('No live/testnet FUTURES wallets found.');
    process.exit(0);
  }

  const corrections: CorrectionResult[] = [];
  let totalProcessed = 0;
  let totalCorrected = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const wallet of liveWallets) {
    const walletType = getWalletType(wallet);
    console.log(`\nWALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);

    const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
    const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);
    const client = new USDMClient({
      api_key: apiKey, api_secret: apiSecret, testnet: walletType === 'testnet', disableTimeSync: false,
    });

    const closedExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.status, 'closed'),
          eq(tradeExecutions.marketType, 'FUTURES'),
          isNotNull(tradeExecutions.exitPrice)
        )
      );

    console.log(`  Closed executions: ${closedExecutions.length}`);

    for (const exec of closedExecutions) {
      totalProcessed++;

      if (isOrphanedExit(exec)) {
        if (VERBOSE) console.log(`  [${exec.id}] ${exec.symbol} - Orphaned, skipping`);
        totalSkipped++;
        continue;
      }

      try {
        const openedAt = exec.openedAt?.getTime() || exec.createdAt.getTime();
        const closedAt = exec.closedAt?.getTime() || Date.now();

        await sleep(300);
        const trades = await fetchAllAccountTrades(client, exec.symbol, openedAt, closedAt);

        if (trades.length === 0) {
          if (VERBOSE) console.log(`  [${exec.id}] ${exec.symbol} - No Binance trades, skipping`);
          totalSkipped++;
          continue;
        }

        const exitOrderIds = [
          exec.exitOrderId, exec.stopLossOrderId, exec.takeProfitOrderId,
        ].filter((id): id is number => id !== null && id !== undefined && id > 0);

        const dbQuantity = parseFloat(exec.quantity);
        const classified = classifyTrades(trades, exec.side, exec.entryOrderId, exitOrderIds, dbQuantity);
        const { entryTrades, exitTrades, canVerifyEntry, canVerifyExit } = classified;

        if (!canVerifyEntry && !canVerifyExit) {
          if (VERBOSE) console.log(`  [${exec.id}] ${exec.symbol} ${exec.side} - Overlapping, unverifiable, skipping`);
          totalSkipped++;
          continue;
        }

        const entry = computeWeightedAvg(entryTrades);
        const exit = computeWeightedAvg(exitTrades);

        let fundingFees = 0;
        try {
          await sleep(200);
          fundingFees = await fetchFundingFees(client, exec.symbol, openedAt, closedAt);
        } catch (_e) { /* best-effort */ }

        const dbEntryFee = parseFloat(exec.entryFee || '0');
        const dbExitFee = parseFloat(exec.exitFee || '0');
        const dbTotalFees = parseFloat(exec.fees || '0');
        const dbPnl = parseFloat(exec.pnl || '0');
        const dbAccFunding = parseFloat(exec.accumulatedFunding || '0');
        const dbEntryPrice = parseFloat(exec.entryPrice);
        const dbExitPrice = parseFloat(exec.exitPrice || '0');
        const leverage = exec.leverage || 1;

        const FEE_THRESHOLD = 0.001;
        const PNL_THRESHOLD = 0.01;

        const changes: string[] = [];
        const oldValues: Record<string, string> = {};
        const newValues: Record<string, string> = {};

        let quantity = dbQuantity;
        let entryPrice = dbEntryPrice;
        let exitPrice = dbExitPrice;

        if (canVerifyEntry) {
          if (entry.totalQty > 0 && Math.abs(dbQuantity - entry.totalQty) > 0.00001) {
            quantity = entry.totalQty;
            changes.push(`quantity: ${dbQuantity} → ${quantity}`);
            oldValues.quantity = dbQuantity.toString();
            newValues.quantity = quantity.toFixed(8);
          }

          if (entry.avgPrice > 0) {
            const priceDiff = Math.abs(dbEntryPrice - entry.avgPrice);
            const pnlImpact = priceDiff * quantity;
            if (pnlImpact > PNL_THRESHOLD) {
              entryPrice = entry.avgPrice;
              changes.push(`entryPrice: ${dbEntryPrice} → ${entryPrice}`);
              oldValues.entryPrice = dbEntryPrice.toString();
              newValues.entryPrice = entryPrice.toString();
            }
          }

          if (Math.abs(dbEntryFee - entry.totalFee) > FEE_THRESHOLD) {
            changes.push(`entryFee: ${dbEntryFee.toFixed(8)} → ${entry.totalFee.toFixed(8)}`);
            oldValues.entryFee = dbEntryFee.toFixed(8);
            newValues.entryFee = entry.totalFee.toString();
          }
        }

        if (canVerifyExit) {
          if (exit.avgPrice > 0) {
            const priceDiff = Math.abs(dbExitPrice - exit.avgPrice);
            const pnlImpact = priceDiff * quantity;
            if (pnlImpact > PNL_THRESHOLD) {
              exitPrice = exit.avgPrice;
              changes.push(`exitPrice: ${dbExitPrice} → ${exitPrice}`);
              oldValues.exitPrice = dbExitPrice.toString();
              newValues.exitPrice = exitPrice.toString();
            }
          }

          if (Math.abs(dbExitFee - exit.totalFee) > FEE_THRESHOLD) {
            changes.push(`exitFee: ${dbExitFee.toFixed(8)} → ${exit.totalFee.toFixed(8)}`);
            oldValues.exitFee = dbExitFee.toFixed(8);
            newValues.exitFee = exit.totalFee.toString();
          }
        }

        const binanceEntryFee = canVerifyEntry ? entry.totalFee : dbEntryFee;
        const binanceExitFee = canVerifyExit ? exit.totalFee : dbExitFee;
        const binanceTotalFees = binanceEntryFee + binanceExitFee;

        if (canVerifyEntry && canVerifyExit && Math.abs(dbTotalFees - binanceTotalFees) > FEE_THRESHOLD) {
          changes.push(`fees: ${dbTotalFees.toFixed(8)} → ${binanceTotalFees.toFixed(8)}`);
          oldValues.fees = dbTotalFees.toFixed(8);
          newValues.fees = binanceTotalFees.toString();
        }

        if (canVerifyEntry && canVerifyExit) {
          const grossPnl = exec.side === 'LONG'
            ? (exitPrice - entryPrice) * quantity
            : (entryPrice - exitPrice) * quantity;

          const correctPnl = roundTo(grossPnl - binanceTotalFees + fundingFees, 8);
          const marginValue = (entryPrice * quantity) / leverage;
          const correctPnlPercent = marginValue > 0 ? roundTo((correctPnl / marginValue) * 100, 4) : 0;

          if (Math.abs(dbPnl - correctPnl) > PNL_THRESHOLD) {
            changes.push(`pnl: ${dbPnl.toFixed(4)} → ${correctPnl.toFixed(4)}`);
            oldValues.pnl = dbPnl.toFixed(4);
            newValues.pnl = correctPnl.toString();
          }

          const dbPnlPercent = parseFloat(exec.pnlPercent || '0');
          if (Math.abs(dbPnlPercent - correctPnlPercent) > 0.01) {
            changes.push(`pnlPercent: ${dbPnlPercent.toFixed(4)} → ${correctPnlPercent.toFixed(4)}`);
            oldValues.pnlPercent = dbPnlPercent.toFixed(4);
            newValues.pnlPercent = correctPnlPercent.toString();
          }
        }

        if (Math.abs(dbAccFunding - fundingFees) > 0.01) {
          changes.push(`accumulatedFunding: ${dbAccFunding.toFixed(4)} → ${fundingFees.toFixed(4)}`);
          oldValues.accumulatedFunding = dbAccFunding.toFixed(4);
          newValues.accumulatedFunding = fundingFees.toString();
        }

        if (changes.length === 0) {
          if (VERBOSE) console.log(`  [${exec.id}] ${exec.symbol} ${exec.side} - OK`);
          totalSkipped++;
          continue;
        }

        corrections.push({
          executionId: exec.id, walletId: wallet.id, symbol: exec.symbol,
          side: exec.side, changes, oldValues, newValues,
        });

        console.log(`  [${exec.id}] ${exec.symbol} ${exec.side} - ${changes.length} correction(s):`);
        for (const c of changes) console.log(`    ${c}`);

        if (!DRY_RUN) {
          const updateSet: Record<string, string | Date> = { updatedAt: new Date() };
          if (newValues.quantity !== undefined) updateSet.quantity = newValues.quantity;
          if (newValues.entryPrice !== undefined) updateSet.entryPrice = newValues.entryPrice;
          if (newValues.entryFee !== undefined) updateSet.entryFee = newValues.entryFee;
          if (newValues.exitFee !== undefined) updateSet.exitFee = newValues.exitFee;
          if (newValues.fees !== undefined) updateSet.fees = newValues.fees;
          if (newValues.pnl !== undefined) updateSet.pnl = newValues.pnl;
          if (newValues.pnlPercent !== undefined) updateSet.pnlPercent = newValues.pnlPercent;
          if (newValues.exitPrice !== undefined) updateSet.exitPrice = newValues.exitPrice;
          if (newValues.accumulatedFunding !== undefined) updateSet.accumulatedFunding = newValues.accumulatedFunding;

          await db
            .update(tradeExecutions)
            .set(updateSet)
            .where(eq(tradeExecutions.id, exec.id));

          totalCorrected++;
        } else {
          totalCorrected++;
        }
      } catch (error) {
        const errObj = error as Record<string, unknown>;
        const msg = error instanceof Error ? error.message : errObj?.message || JSON.stringify(error);
        console.log(`  [${exec.id}] ${exec.symbol} - ERROR: ${msg}`);
        totalErrors++;
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('  CORRECTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total processed:   ${totalProcessed}`);
  console.log(`  Corrected:         ${totalCorrected}${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`  Already correct:   ${totalSkipped}`);
  console.log(`  Errors:            ${totalErrors}`);

  const walletPnlDeltas = new Map<string, number>();

  if (corrections.length > 0) {
    let totalOldFees = 0;
    let totalNewFees = 0;
    let totalOldPnl = 0;
    let totalNewPnl = 0;

    for (const c of corrections) {
      if (c.oldValues.fees && c.newValues.fees) {
        totalOldFees += parseFloat(c.oldValues.fees);
        totalNewFees += parseFloat(c.newValues.fees);
      }
      if (c.oldValues.pnl && c.newValues.pnl) {
        const pnlDelta = parseFloat(c.newValues.pnl) - parseFloat(c.oldValues.pnl);
        totalOldPnl += parseFloat(c.oldValues.pnl);
        totalNewPnl += parseFloat(c.newValues.pnl);
        const current = walletPnlDeltas.get(c.walletId) || 0;
        walletPnlDeltas.set(c.walletId, current + pnlDelta);
      }
    }

    if (totalOldFees > 0 || totalNewFees > 0) {
      console.log(`\n  Fee impact:  old=$${totalOldFees.toFixed(4)} → new=$${totalNewFees.toFixed(4)} (delta=$${(totalNewFees - totalOldFees).toFixed(4)})`);
    }
    if (totalOldPnl !== 0 || totalNewPnl !== 0) {
      console.log(`  PnL impact:  old=$${totalOldPnl.toFixed(4)} → new=$${totalNewPnl.toFixed(4)} (delta=$${(totalNewPnl - totalOldPnl).toFixed(4)})`);
    }
  }

  for (const [walletId, pnlDelta] of walletPnlDeltas) {
    if (Math.abs(pnlDelta) < 0.001) continue;

    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);
    if (!wallet) continue;

    const currentBalance = parseFloat(wallet.currentBalance || '0');
    const newBalance = roundTo(currentBalance + pnlDelta, 8);

    console.log(`\n  WALLET BALANCE ADJUSTMENT (${wallet.name}):`);
    console.log(`    current:  $${currentBalance.toFixed(8)}`);
    console.log(`    pnlDelta: $${pnlDelta.toFixed(8)}`);
    console.log(`    new:      $${newBalance.toFixed(8)}`);

    if (!DRY_RUN) {
      await db
        .update(wallets)
        .set({ currentBalance: newBalance.toString(), updatedAt: new Date() })
        .where(eq(wallets.id, walletId));
      console.log(`    ✓ Updated`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
