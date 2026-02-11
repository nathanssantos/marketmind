import 'dotenv/config';
import { USDMClient } from 'binance';
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../src/db/client';
import { tradeExecutions, wallets } from '../src/db/schema';
import { decryptApiKey } from '../src/services/encryption';
import { getWalletType } from '../src/services/binance-client';

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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

async function fetchAllAccountTrades(
  client: USDMClient,
  symbol: string,
  startTime: number,
  endTime: number
): Promise<BinanceTrade[]> {
  const allTrades: BinanceTrade[] = [];
  const paddedStart = startTime - 10_000;
  const paddedEnd = endTime + 10_000;

  const firstBatch = await client.getAccountTrades({
    symbol,
    startTime: paddedStart,
    endTime: paddedEnd,
    limit: 1000,
  });

  for (const t of firstBatch) {
    allTrades.push({
      symbol: t.symbol,
      id: t.id,
      orderId: t.orderId,
      side: t.side,
      price: String(t.price),
      qty: String(t.qty),
      realizedPnl: String(t.realizedPnl),
      commission: String(t.commission),
      time: t.time,
    });
  }

  if (firstBatch.length === 1000) {
    let fromId = firstBatch[firstBatch.length - 1]!.id + 1;
    while (true) {
      await sleep(200);
      const batch = await client.getAccountTrades({ symbol, fromId, limit: 1000 });
      if (batch.length === 0) break;
      const inRange = batch.filter(t => t.time <= paddedEnd);
      for (const t of inRange) {
        allTrades.push({
          symbol: t.symbol,
          id: t.id,
          orderId: t.orderId,
          side: t.side,
          price: String(t.price),
          qty: String(t.qty),
          realizedPnl: String(t.realizedPnl),
          commission: String(t.commission),
          time: t.time,
        });
      }
      if (inRange.length < batch.length || batch.length < 1000) break;
      fromId = batch[batch.length - 1]!.id + 1;
    }
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
  let currentStart = startTime;

  while (currentStart < endTime) {
    await sleep(200);
    const income = await client.getIncomeHistory({
      symbol,
      incomeType: 'FUNDING_FEE',
      startTime: currentStart,
      endTime,
      limit: 1000,
    } as Parameters<typeof client.getIncomeHistory>[0]);

    if (income.length === 0) break;
    for (const item of income) totalFunding += parseFloat(item.income);
    if (income.length < 1000) break;
    currentStart = income[income.length - 1]!.time + 1;
  }

  return totalFunding;
}

function classifyTrades(
  trades: BinanceTrade[],
  side: 'LONG' | 'SHORT',
  _entryOrderId: number | null,
  _exitOrderIds: number[] = []
): { entryTrades: BinanceTrade[]; exitTrades: BinanceTrade[] } {
  const entrySide = side === 'LONG' ? 'BUY' : 'SELL';
  const exitSide = side === 'LONG' ? 'SELL' : 'BUY';

  const entryTrades = trades.filter(t => t.side === entrySide);
  const exitTrades = trades.filter(t => t.side === exitSide);
  return { entryTrades, exitTrades };
}

function computeWeightedAvg(trades: BinanceTrade[]): { avgPrice: number; totalQty: number; totalFee: number } {
  let weightedPrice = 0;
  let totalQty = 0;
  let totalFee = 0;

  for (const t of trades) {
    const qty = parseFloat(t.qty);
    const price = parseFloat(t.price);
    const fee = parseFloat(t.commission);
    weightedPrice += price * qty;
    totalQty += qty;
    totalFee += fee;
  }

  return {
    avgPrice: totalQty > 0 ? weightedPrice / totalQty : 0,
    totalQty,
    totalFee,
  };
}

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

interface CorrectionResult {
  executionId: string;
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
      api_key: apiKey,
      api_secret: apiSecret,
      testnet: walletType === 'testnet',
      disableTimeSync: false,
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

      try {
        const openedAt = exec.openedAt?.getTime() || exec.createdAt.getTime();
        const closedAt = exec.closedAt?.getTime() || Date.now();

        await sleep(300);
        const trades = await fetchAllAccountTrades(client, exec.symbol, openedAt, closedAt);

        if (trades.length === 0) {
          if (VERBOSE) console.log(`  [${exec.id.slice(0, 12)}] ${exec.symbol} - No Binance trades found, skipping`);
          totalSkipped++;
          continue;
        }

        const exitOrderIds = [
          exec.exitOrderId,
          exec.stopLossOrderId,
          exec.takeProfitOrderId,
        ].filter((id): id is number => id !== null && id !== undefined && id > 0);
        const { entryTrades, exitTrades } = classifyTrades(trades, exec.side, exec.entryOrderId, exitOrderIds);
        const entry = computeWeightedAvg(entryTrades);
        const exit = computeWeightedAvg(exitTrades);

        let fundingFees = 0;
        try {
          await sleep(200);
          fundingFees = await fetchFundingFees(client, exec.symbol, openedAt, closedAt);
        } catch (_e) { /* funding fetch is best-effort */ }

        const dbEntryFee = parseFloat(exec.entryFee || '0');
        const dbExitFee = parseFloat(exec.exitFee || '0');
        const dbTotalFees = parseFloat(exec.fees || '0');
        const dbPnl = parseFloat(exec.pnl || '0');
        const dbAccFunding = parseFloat(exec.accumulatedFunding || '0');
        const dbEntryPrice = parseFloat(exec.entryPrice);
        const dbQuantity = parseFloat(exec.quantity);
        const leverage = exec.leverage || 1;

        const binanceEntryQty = entry.totalQty;
        const qtyRatio = binanceEntryQty > 0 ? dbQuantity / binanceEntryQty : 1;
        const isOverlappingPosition = qtyRatio < 0.8 || qtyRatio > 1.2;

        if (isOverlappingPosition) {
          if (VERBOSE) console.log(`  [${exec.id.slice(0, 12)}] ${exec.symbol} ${exec.side} - Overlapping position (qty ratio ${qtyRatio.toFixed(2)}), skipping`);
          totalSkipped++;
          continue;
        }

        const quantity = (binanceEntryQty > 0 && Math.abs(dbQuantity - binanceEntryQty) > 0.00001)
          ? binanceEntryQty : dbQuantity;
        const entryPrice = (entry.avgPrice > 0 && Math.abs(dbEntryPrice - entry.avgPrice) > dbEntryPrice * 0.001)
          ? entry.avgPrice : dbEntryPrice;

        const binanceEntryFee = entry.totalFee;
        const binanceExitFee = exit.totalFee;
        const binanceTotalFees = binanceEntryFee + binanceExitFee;

        const exitPrice = exit.avgPrice > 0 ? exit.avgPrice : parseFloat(exec.exitPrice || '0');

        let grossPnl = 0;
        if (exec.side === 'LONG') {
          grossPnl = (exitPrice - entryPrice) * quantity;
        } else {
          grossPnl = (entryPrice - exitPrice) * quantity;
        }

        const correctPnl = roundTo(grossPnl - binanceTotalFees + fundingFees, 8);
        const marginValue = (entryPrice * quantity) / leverage;
        const correctPnlPercent = marginValue > 0 ? roundTo((correctPnl / marginValue) * 100, 4) : 0;

        const FEE_THRESHOLD = 0.001;
        const PNL_THRESHOLD = 0.01;

        const changes: string[] = [];
        const oldValues: Record<string, string> = {};
        const newValues: Record<string, string> = {};

        if (quantity !== dbQuantity) {
          changes.push(`quantity: ${dbQuantity} → ${quantity}`);
          oldValues.quantity = dbQuantity.toString();
          newValues.quantity = quantity.toFixed(8);
        }

        if (entryPrice !== dbEntryPrice) {
          changes.push(`entryPrice: ${dbEntryPrice} → ${entryPrice}`);
          oldValues.entryPrice = dbEntryPrice.toString();
          newValues.entryPrice = entryPrice.toString();
        }

        if (Math.abs(dbEntryFee - binanceEntryFee) > FEE_THRESHOLD) {
          changes.push(`entryFee: ${dbEntryFee.toFixed(8)} → ${binanceEntryFee.toFixed(8)}`);
          oldValues.entryFee = dbEntryFee.toFixed(8);
          newValues.entryFee = binanceEntryFee.toString();
        }

        if (Math.abs(dbExitFee - binanceExitFee) > FEE_THRESHOLD) {
          changes.push(`exitFee: ${dbExitFee.toFixed(8)} → ${binanceExitFee.toFixed(8)}`);
          oldValues.exitFee = dbExitFee.toFixed(8);
          newValues.exitFee = binanceExitFee.toString();
        }

        if (Math.abs(dbTotalFees - binanceTotalFees) > FEE_THRESHOLD) {
          changes.push(`fees: ${dbTotalFees.toFixed(8)} → ${binanceTotalFees.toFixed(8)}`);
          oldValues.fees = dbTotalFees.toFixed(8);
          newValues.fees = binanceTotalFees.toString();
        }

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

        if (exit.avgPrice > 0) {
          const dbExitPrice = parseFloat(exec.exitPrice || '0');
          const priceDiff = Math.abs(dbExitPrice - exit.avgPrice);
          if (priceDiff > dbExitPrice * 0.005 && priceDiff > 0.01) {
            changes.push(`exitPrice: ${dbExitPrice} → ${exit.avgPrice}`);
            oldValues.exitPrice = dbExitPrice.toString();
            newValues.exitPrice = exit.avgPrice.toString();
          }
        }

        if (Math.abs(dbAccFunding - fundingFees) > 0.01) {
          changes.push(`accumulatedFunding: ${dbAccFunding.toFixed(4)} → ${fundingFees.toFixed(4)}`);
          oldValues.accumulatedFunding = dbAccFunding.toFixed(4);
          newValues.accumulatedFunding = fundingFees.toString();
        }

        if (changes.length === 0) {
          if (VERBOSE) console.log(`  [${exec.id.slice(0, 12)}] ${exec.symbol} ${exec.side} - OK`);
          totalSkipped++;
          continue;
        }

        corrections.push({
          executionId: exec.id,
          symbol: exec.symbol,
          side: exec.side,
          changes,
          oldValues,
          newValues,
        });

        console.log(`  [${exec.id.slice(0, 12)}] ${exec.symbol} ${exec.side} - ${changes.length} correction(s):`);
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
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`  [${exec.id.slice(0, 12)}] ${exec.symbol} - ERROR: ${msg}`);
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
        totalOldPnl += parseFloat(c.oldValues.pnl);
        totalNewPnl += parseFloat(c.newValues.pnl);
      }
    }

    if (totalOldFees > 0 || totalNewFees > 0) {
      console.log(`\n  Fee impact:  old=$${totalOldFees.toFixed(4)} → new=$${totalNewFees.toFixed(4)} (delta=$${(totalNewFees - totalOldFees).toFixed(4)})`);
    }
    if (totalOldPnl !== 0 || totalNewPnl !== 0) {
      console.log(`  PnL impact:  old=$${totalOldPnl.toFixed(4)} → new=$${totalNewPnl.toFixed(4)} (delta=$${(totalNewPnl - totalOldPnl).toFixed(4)})`);
    }
  }

  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
