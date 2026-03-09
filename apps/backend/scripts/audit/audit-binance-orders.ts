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
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}

type AuditStatus = 'MATCH' | 'DISCREPANCY' | 'NO_BINANCE_DATA' | 'SKIP' | 'ERROR';

interface ClassifiedTrades {
  entryTrades: BinanceTrade[];
  exitTrades: BinanceTrade[];
  canVerifyEntry: boolean;
  canVerifyExit: boolean;
}

interface TradeAuditResult {
  executionId: string;
  symbol: string;
  side: string;
  status: AuditStatus;
  skipReason?: string;
  discrepancies: string[];
  dbData: {
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    entryFee: number;
    exitFee: number;
    totalFees: number;
    pnl: number;
    pnlPercent: number;
    exitReason: string | null;
    exitSource: string | null;
    accumulatedFunding: number;
  };
  binanceData: {
    entryPrice: number;
    exitPrice: number;
    entryQty: number;
    exitQty: number;
    entryFee: number;
    exitFee: number;
    totalFees: number;
    realizedPnl: number;
    fundingFees: number;
    entryTrades: number;
    exitTrades: number;
  } | null;
}

const PRICE_TOLERANCE = 0.005;
const FEE_TOLERANCE = 0.01;
const PNL_TOLERANCE = 0.05;
const QTY_TOLERANCE = 0.00001;
const DUST_QTY_VALUE_THRESHOLD = 1.0;
const OVERLAP_RATIO_THRESHOLD = 1.5;
const EXIT_RELIABILITY_THRESHOLD = 0.5;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000 - 60_000;

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
        price: String(t.price), qty: String(t.qty), realizedPnl: String(t.realizedPnl),
        quoteQty: String(t.quoteQty), commission: String(t.commission),
        commissionAsset: t.commissionAsset, time: t.time, buyer: t.buyer, maker: t.maker,
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
            price: String(t.price), qty: String(t.qty), realizedPnl: String(t.realizedPnl),
            quoteQty: String(t.quoteQty), commission: String(t.commission),
            commissionAsset: t.commissionAsset, time: t.time, buyer: t.buyer, maker: t.maker,
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
  const avgPrice = totalQty > 0 ? Math.round((weightedPrice / totalQty) * 1e8) / 1e8 : 0;
  return { avgPrice, totalQty, totalFee };
}

function percentDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  return denom === 0 ? 0 : Math.abs(a - b) / denom;
}

function isOrphanedExit(exec: { exitReason: string | null; exitSource: string | null }): boolean {
  return exec.exitReason === 'ORPHANED_POSITION' || exec.exitSource === 'SYNC';
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  BINANCE FULL ORDER AUDIT');
  console.log('  Compares ALL closed DB trade executions with Binance trade history');
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

  console.log(`Found ${liveWallets.length} live/testnet FUTURES wallet(s)\n`);

  const allResults: TradeAuditResult[] = [];
  let totalAudited = 0;
  let totalMatches = 0;
  let totalDiscrepancies = 0;
  let totalSkipped = 0;
  let totalNoData = 0;
  let totalErrors = 0;

  for (const wallet of liveWallets) {
    const walletType = getWalletType(wallet);
    console.log('-'.repeat(80));
    console.log(`WALLET: ${wallet.name} (${wallet.id}) [${walletType}]`);
    console.log('-'.repeat(80));

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

    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      );

    console.log(`  Closed executions to audit: ${closedExecutions.length}`);
    console.log(`  Currently open positions: ${openExecutions.length}\n`);

    const nonOrphaned = closedExecutions.filter(e => !isOrphanedExit(e));
    const orphaned = closedExecutions.filter(e => isOrphanedExit(e));
    for (const exec of orphaned) {
      totalAudited++;
      totalSkipped++;
      allResults.push({
        executionId: exec.id, symbol: exec.symbol, side: exec.side,
        status: 'SKIP', skipReason: 'orphaned', discrepancies: [],
        dbData: {
          entryPrice: parseFloat(exec.entryPrice), exitPrice: parseFloat(exec.exitPrice || '0'),
          quantity: parseFloat(exec.quantity), entryFee: parseFloat(exec.entryFee || '0'),
          exitFee: parseFloat(exec.exitFee || '0'), totalFees: parseFloat(exec.fees || '0'),
          pnl: parseFloat(exec.pnl || '0'), pnlPercent: parseFloat(exec.pnlPercent || '0'),
          exitReason: exec.exitReason, exitSource: exec.exitSource,
          accumulatedFunding: parseFloat(exec.accumulatedFunding || '0'),
        },
        binanceData: null,
      });
    }

    const symbolGroups = new Map<string, typeof nonOrphaned>();
    for (const exec of nonOrphaned) {
      const group = symbolGroups.get(exec.symbol) ?? [];
      group.push(exec);
      symbolGroups.set(exec.symbol, group);
    }

    console.log(`  Symbols to fetch: ${symbolGroups.size} (${nonOrphaned.length} executions, ${orphaned.length} orphaned skipped)\n`);

    const tradesCache = new Map<string, BinanceTrade[]>();
    const fundingCache = new Map<string, number>();

    let symbolIdx = 0;
    for (const [symbol, execsForSymbol] of symbolGroups) {
      symbolIdx++;
      const minOpenedAt = Math.min(...execsForSymbol.map(e => e.openedAt?.getTime() || e.createdAt.getTime()));
      const maxClosedAt = Math.max(...execsForSymbol.map(e => e.closedAt?.getTime() || Date.now()));

      console.log(`  [${symbolIdx}/${symbolGroups.size}] ${symbol} (${execsForSymbol.length} executions, range: ${Math.round((maxClosedAt - minOpenedAt) / 86400000)}d)`);

      try {
        await sleep(1500);
        const trades = await fetchAllAccountTrades(client, symbol, minOpenedAt, maxClosedAt);
        tradesCache.set(symbol, trades);

        await sleep(1500);
        const funding = await fetchFundingFees(client, symbol, minOpenedAt, maxClosedAt);
        fundingCache.set(symbol, funding);

        console.log(`    fetched ${trades.length} trades, funding=$${funding.toFixed(4)}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : JSON.stringify(error);
        console.log(`    ERROR: ${msg}`);
        if (msg.includes('banned') || msg.includes('Too many') || msg.includes('TOO_MANY') || msg.includes('-1003')) {
          const retryMatch = msg.match(/"retry-after":"(\d+)"/);
          const waitSec = retryMatch ? Math.min(parseInt(retryMatch[1], 10) + 5, 600) : 120;
          console.log(`    Rate limited! Waiting ${waitSec}s...`);
          await sleep(waitSec * 1000);
        }
        for (const exec of execsForSymbol) {
          totalAudited++;
          totalErrors++;
          allResults.push({
            executionId: exec.id, symbol: exec.symbol, side: exec.side,
            status: 'ERROR', discrepancies: [`Error fetching from Binance: ${msg}`],
            dbData: {
              entryPrice: parseFloat(exec.entryPrice), exitPrice: parseFloat(exec.exitPrice || '0'),
              quantity: parseFloat(exec.quantity), entryFee: parseFloat(exec.entryFee || '0'),
              exitFee: parseFloat(exec.exitFee || '0'), totalFees: parseFloat(exec.fees || '0'),
              pnl: parseFloat(exec.pnl || '0'), pnlPercent: parseFloat(exec.pnlPercent || '0'),
              exitReason: exec.exitReason, exitSource: exec.exitSource,
              accumulatedFunding: parseFloat(exec.accumulatedFunding || '0'),
            },
            binanceData: null,
          });
        }
        continue;
      }

      for (const exec of execsForSymbol) {
        totalAudited++;
        const dbEntryPrice = parseFloat(exec.entryPrice);
        const dbExitPrice = parseFloat(exec.exitPrice || '0');
        const dbQuantity = parseFloat(exec.quantity);
        const dbEntryFee = parseFloat(exec.entryFee || '0');
        const dbExitFee = parseFloat(exec.exitFee || '0');
        const dbTotalFees = parseFloat(exec.fees || '0');
        const dbPnl = parseFloat(exec.pnl || '0');
        const dbPnlPercent = parseFloat(exec.pnlPercent || '0');
        const dbAccFunding = parseFloat(exec.accumulatedFunding || '0');

        const result: TradeAuditResult = {
          executionId: exec.id, symbol: exec.symbol, side: exec.side,
          status: 'MATCH', discrepancies: [],
          dbData: {
            entryPrice: dbEntryPrice, exitPrice: dbExitPrice, quantity: dbQuantity,
            entryFee: dbEntryFee, exitFee: dbExitFee, totalFees: dbTotalFees,
            pnl: dbPnl, pnlPercent: dbPnlPercent, exitReason: exec.exitReason,
            exitSource: exec.exitSource, accumulatedFunding: dbAccFunding,
          },
          binanceData: null,
        };

        const openedAt = exec.openedAt?.getTime() || exec.createdAt.getTime();
        const closedAt = exec.closedAt?.getTime() || Date.now();
        const allSymbolTrades = tradesCache.get(exec.symbol) ?? [];
        const trades = allSymbolTrades.filter(t => t.time >= openedAt - 10_000 && t.time <= closedAt + 10_000);

        if (trades.length === 0) {
          result.status = 'NO_BINANCE_DATA';
          result.discrepancies.push('No trades found on Binance for this time range');
          totalNoData++;
          allResults.push(result);
          continue;
        }

        const exitOrderIds = [
          exec.exitOrderId, exec.stopLossOrderId, exec.takeProfitOrderId,
        ].filter((id): id is number => id !== null && id !== undefined && id > 0);

        const classified = classifyTrades(trades, exec.side, exec.entryOrderId, exitOrderIds, dbQuantity);
        const { entryTrades, exitTrades, canVerifyEntry, canVerifyExit } = classified;

        if (!canVerifyEntry && !canVerifyExit) {
          result.status = 'SKIP';
          result.skipReason = 'overlapping (unverifiable)';
          totalSkipped++;
          allResults.push(result);
          continue;
        }

        const entry = computeWeightedAvg(entryTrades);
        const exit = computeWeightedAvg(exitTrades);

        let totalRealizedPnl = 0;
        for (const t of exitTrades) totalRealizedPnl += parseFloat(t.realizedPnl);

        const allFunding = fundingCache.get(exec.symbol) ?? 0;
        const symbolExecs = execsForSymbol.length;
        const fundingFees = symbolExecs === 1 ? allFunding : 0;

        result.binanceData = {
          entryPrice: entry.avgPrice, exitPrice: exit.avgPrice,
          entryQty: entry.totalQty, exitQty: exit.totalQty,
          entryFee: entry.totalFee, exitFee: exit.totalFee,
          totalFees: entry.totalFee + exit.totalFee,
          realizedPnl: totalRealizedPnl, fundingFees,
          entryTrades: entryTrades.length, exitTrades: exitTrades.length,
        };

        const bn = result.binanceData;

        if (canVerifyEntry) {
          if (entry.avgPrice > 0 && percentDiff(dbEntryPrice, entry.avgPrice) > PRICE_TOLERANCE) {
            result.discrepancies.push(`ENTRY PRICE: db=${dbEntryPrice.toFixed(8)} vs binance=${entry.avgPrice.toFixed(8)}`);
          }
          if (entry.totalQty > 0 && Math.abs(dbQuantity - entry.totalQty) > QTY_TOLERANCE) {
            result.discrepancies.push(`ENTRY QTY: db=${dbQuantity} vs binance=${entry.totalQty}`);
          }
          if (dbEntryFee > 0 && entry.totalFee > 0 && Math.abs(dbEntryFee - entry.totalFee) > FEE_TOLERANCE) {
            result.discrepancies.push(`ENTRY FEE: db=${dbEntryFee.toFixed(8)} vs binance=${entry.totalFee.toFixed(8)}`);
          }
          if (dbEntryFee === 0 && entry.totalFee > 0.001) {
            result.discrepancies.push(`MISSING ENTRY FEE: db has 0 but Binance shows $${entry.totalFee.toFixed(8)}`);
          }
        }

        if (canVerifyExit) {
          if (exit.avgPrice > 0 && percentDiff(dbExitPrice, exit.avgPrice) > PRICE_TOLERANCE) {
            result.discrepancies.push(`EXIT PRICE: db=${dbExitPrice.toFixed(8)} vs binance=${exit.avgPrice.toFixed(8)}`);
          }
          if (exit.totalQty > 0 && Math.abs(dbQuantity - exit.totalQty) > QTY_TOLERANCE) {
            const qtyDiffValue = Math.abs(dbQuantity - exit.totalQty) * dbEntryPrice;
            if (qtyDiffValue > DUST_QTY_VALUE_THRESHOLD) {
              result.discrepancies.push(`EXIT QTY: db=${dbQuantity} vs binance_exit=${exit.totalQty} ($${qtyDiffValue.toFixed(2)})`);
            }
          }
          if (dbExitFee > 0 && exit.totalFee > 0 && Math.abs(dbExitFee - exit.totalFee) > FEE_TOLERANCE) {
            result.discrepancies.push(`EXIT FEE: db=${dbExitFee.toFixed(8)} vs binance=${exit.totalFee.toFixed(8)}`);
          }
          if (dbExitFee === 0 && exit.totalFee > 0.001) {
            result.discrepancies.push(`MISSING EXIT FEE: db has 0 but Binance shows $${exit.totalFee.toFixed(8)}`);
          }
        }

        if (canVerifyEntry && canVerifyExit) {
          if (dbTotalFees > 0 && bn.totalFees > 0 && Math.abs(dbTotalFees - bn.totalFees) > FEE_TOLERANCE) {
            result.discrepancies.push(`TOTAL FEES: db=${dbTotalFees.toFixed(8)} vs binance=${bn.totalFees.toFixed(8)}`);
          }
          if (bn.realizedPnl !== 0) {
            const binanceNetPnl = bn.realizedPnl + fundingFees - bn.totalFees;
            if (Math.abs(dbPnl - binanceNetPnl) > PNL_TOLERANCE && percentDiff(dbPnl, binanceNetPnl) > 0.02) {
              result.discrepancies.push(
                `PNL: db=${dbPnl.toFixed(4)} vs binance_net=${binanceNetPnl.toFixed(4)} (realized=${bn.realizedPnl.toFixed(4)}, funding=${fundingFees.toFixed(4)}, fees=${bn.totalFees.toFixed(4)})`
              );
            }
          }
        }

        if (result.discrepancies.length > 0) {
          result.status = 'DISCREPANCY';
          totalDiscrepancies++;
        } else {
          totalMatches++;
        }

        allResults.push(result);
      }
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('  AUDIT RESULTS');
  console.log('='.repeat(80));

  const discrepancies = allResults.filter(r => r.status === 'DISCREPANCY');
  const skippedResults = allResults.filter(r => r.status === 'SKIP');
  const noDataResults = allResults.filter(r => r.status === 'NO_BINANCE_DATA');
  const errorResults = allResults.filter(r => r.status === 'ERROR');

  if (discrepancies.length > 0) {
    console.log(`\n  DISCREPANCIES FOUND: ${discrepancies.length}`);
    console.log('  ' + '-'.repeat(76));

    for (const r of discrepancies) {
      console.log(`\n  [${r.executionId}] ${r.symbol} ${r.side} | exit: ${r.dbData.exitReason} | source: ${r.dbData.exitSource}`);
      console.log(`    DB:      entry=${r.dbData.entryPrice} exit=${r.dbData.exitPrice} qty=${r.dbData.quantity}`);
      console.log(`             entryFee=${r.dbData.entryFee.toFixed(8)} exitFee=${r.dbData.exitFee.toFixed(8)} totalFees=${r.dbData.totalFees.toFixed(8)}`);
      console.log(`             pnl=${r.dbData.pnl.toFixed(4)} (${r.dbData.pnlPercent.toFixed(2)}%) funding=${r.dbData.accumulatedFunding.toFixed(4)}`);

      if (r.binanceData) {
        const bn = r.binanceData;
        console.log(`    Binance: entry=${bn.entryPrice.toFixed(8)} exit=${bn.exitPrice.toFixed(8)} entryQty=${bn.entryQty} exitQty=${bn.exitQty}`);
        console.log(`             entryFee=${bn.entryFee.toFixed(8)} exitFee=${bn.exitFee.toFixed(8)} totalFees=${bn.totalFees.toFixed(8)}`);
        console.log(`             realizedPnl=${bn.realizedPnl.toFixed(4)} funding=${bn.fundingFees.toFixed(4)}`);
        console.log(`             trades: ${bn.entryTrades} entry + ${bn.exitTrades} exit`);
      }

      for (const d of r.discrepancies) console.log(`    >> ${d}`);
    }
  }

  if (skippedResults.length > 0) {
    console.log(`\n\n  SKIPPED (not fully verifiable): ${skippedResults.length}`);
    console.log('  ' + '-'.repeat(76));
    for (const r of skippedResults) {
      console.log(`  [${r.executionId}] ${r.symbol} ${r.side} - ${r.skipReason}`);
    }
  }

  if (noDataResults.length > 0) {
    console.log(`\n\n  NO BINANCE DATA: ${noDataResults.length}`);
    console.log('  ' + '-'.repeat(76));
    for (const r of noDataResults) {
      console.log(`  [${r.executionId}] ${r.symbol} ${r.side} - ${r.discrepancies[0]}`);
    }
  }

  if (errorResults.length > 0) {
    console.log(`\n\n  ERRORS: ${errorResults.length}`);
    console.log('  ' + '-'.repeat(76));
    for (const r of errorResults) {
      console.log(`  [${r.executionId}] ${r.symbol} ${r.side} - ${r.discrepancies[0]}`);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total audited:      ${totalAudited}`);
  console.log(`  Matches:            ${totalMatches}`);
  console.log(`  Discrepancies:      ${totalDiscrepancies}`);
  console.log(`  Skipped:            ${totalSkipped}`);
  console.log(`  No Binance data:    ${totalNoData}`);
  console.log(`  Errors:             ${totalErrors}`);

  if (discrepancies.length > 0) {
    console.log('\n  DISCREPANCY BREAKDOWN:');
    const feeIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('FEE')));
    const priceIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('PRICE')));
    const pnlIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('PNL')));
    const qtyIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('QTY')));

    if (feeIssues.length > 0) console.log(`    Fee mismatches:     ${feeIssues.length}`);
    if (priceIssues.length > 0) console.log(`    Price mismatches:   ${priceIssues.length}`);
    if (pnlIssues.length > 0) console.log(`    PnL mismatches:     ${pnlIssues.length}`);
    if (qtyIssues.length > 0) console.log(`    Qty mismatches:     ${qtyIssues.length}`);

    let totalFeeDiff = 0;
    let totalPnlDiff = 0;
    for (const r of discrepancies) {
      if (r.binanceData) {
        totalFeeDiff += Math.abs(r.dbData.totalFees - r.binanceData.totalFees);
        const binanceNetPnl = r.binanceData.realizedPnl + r.binanceData.fundingFees - r.binanceData.totalFees;
        totalPnlDiff += Math.abs(r.dbData.pnl - binanceNetPnl);
      }
    }
    console.log(`\n    Total fee delta:    $${totalFeeDiff.toFixed(4)}`);
    console.log(`    Total PnL delta:    $${totalPnlDiff.toFixed(4)}`);
  }

  if (totalDiscrepancies === 0 && totalErrors === 0 && totalNoData === 0) {
    console.log('\n  All verifiable trades match Binance records.');
  }

  console.log('\n' + '='.repeat(80) + '\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
