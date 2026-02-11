import 'dotenv/config';
import { USDMClient } from 'binance';
import { and, eq, isNotNull, or } from 'drizzle-orm';
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
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}

interface TradeAuditResult {
  executionId: string;
  symbol: string;
  side: string;
  status: 'MATCH' | 'DISCREPANCY' | 'NO_BINANCE_DATA' | 'ERROR';
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAllAccountTrades(
  client: USDMClient,
  symbol: string,
  startTime: number,
  endTime: number
): Promise<BinanceTrade[]> {
  const allTrades: BinanceTrade[] = [];
  let fromId: number | undefined;

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
      quoteQty: String(t.quoteQty),
      commission: String(t.commission),
      commissionAsset: t.commissionAsset,
      time: t.time,
      buyer: t.buyer,
      maker: t.maker,
    });
  }

  if (firstBatch.length === 1000) {
    fromId = firstBatch[firstBatch.length - 1]!.id + 1;
    while (true) {
      await sleep(200);
      const batch = await client.getAccountTrades({
        symbol,
        fromId,
        limit: 1000,
      });

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
          quoteQty: String(t.quoteQty),
          commission: String(t.commission),
          commissionAsset: t.commissionAsset,
          time: t.time,
          buyer: t.buyer,
          maker: t.maker,
        });
      }

      if (inRange.length < batch.length || batch.length < 1000) break;
      fromId = batch[batch.length - 1]!.id + 1;
    }
  }

  const uniqueTrades = new Map<number, BinanceTrade>();
  for (const t of allTrades) {
    uniqueTrades.set(t.id, t);
  }

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

    for (const item of income) {
      totalFunding += parseFloat(item.income);
    }

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

function percentDiff(a: number, b: number): number {
  if (a === 0 && b === 0) return 0;
  const denom = Math.max(Math.abs(a), Math.abs(b));
  if (denom === 0) return 0;
  return Math.abs(a - b) / denom;
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

    for (const exec of closedExecutions) {
      totalAudited++;
      const execId = exec.id;
      const symbol = exec.symbol;
      const side = exec.side;

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
        executionId: execId,
        symbol,
        side,
        status: 'MATCH',
        discrepancies: [],
        dbData: {
          entryPrice: dbEntryPrice,
          exitPrice: dbExitPrice,
          quantity: dbQuantity,
          entryFee: dbEntryFee,
          exitFee: dbExitFee,
          totalFees: dbTotalFees,
          pnl: dbPnl,
          pnlPercent: dbPnlPercent,
          exitReason: exec.exitReason,
          exitSource: exec.exitSource,
          accumulatedFunding: dbAccFunding,
        },
        binanceData: null,
      };

      try {
        const openedAt = exec.openedAt?.getTime() || exec.createdAt.getTime();
        const closedAt = exec.closedAt?.getTime() || Date.now();

        await sleep(300);

        const trades = await fetchAllAccountTrades(client, symbol, openedAt, closedAt);

        if (trades.length === 0) {
          result.status = 'NO_BINANCE_DATA';
          result.discrepancies.push('No trades found on Binance for this time range');
          totalNoData++;
          allResults.push(result);
          continue;
        }

        const exitOrderIds = [
          exec.exitOrderId,
          exec.stopLossOrderId,
          exec.takeProfitOrderId,
        ].filter((id): id is number => id !== null && id !== undefined && id > 0);
        const { entryTrades, exitTrades } = classifyTrades(trades, side, exec.entryOrderId, exitOrderIds);

        const entry = computeWeightedAvg(entryTrades);
        const exit = computeWeightedAvg(exitTrades);

        let totalRealizedPnl = 0;
        for (const t of exitTrades) {
          totalRealizedPnl += parseFloat(t.realizedPnl);
        }

        let fundingFees = 0;
        try {
          await sleep(200);
          fundingFees = await fetchFundingFees(client, symbol, openedAt, closedAt);
        } catch (_e) {
          result.discrepancies.push('Failed to fetch funding fees from Binance');
        }

        result.binanceData = {
          entryPrice: entry.avgPrice,
          exitPrice: exit.avgPrice,
          entryQty: entry.totalQty,
          exitQty: exit.totalQty,
          entryFee: entry.totalFee,
          exitFee: exit.totalFee,
          totalFees: entry.totalFee + exit.totalFee,
          realizedPnl: totalRealizedPnl,
          fundingFees,
          entryTrades: entryTrades.length,
          exitTrades: exitTrades.length,
        };

        const bn = result.binanceData;

        if (entry.avgPrice > 0 && percentDiff(dbEntryPrice, entry.avgPrice) > PRICE_TOLERANCE) {
          result.discrepancies.push(
            `ENTRY PRICE: db=${dbEntryPrice.toFixed(8)} vs binance=${entry.avgPrice.toFixed(8)} (${(percentDiff(dbEntryPrice, entry.avgPrice) * 100).toFixed(3)}%)`
          );
        }

        if (exit.avgPrice > 0 && percentDiff(dbExitPrice, exit.avgPrice) > PRICE_TOLERANCE) {
          result.discrepancies.push(
            `EXIT PRICE: db=${dbExitPrice.toFixed(8)} vs binance=${exit.avgPrice.toFixed(8)} (${(percentDiff(dbExitPrice, exit.avgPrice) * 100).toFixed(3)}%)`
          );
        }

        if (entry.totalQty > 0 && Math.abs(dbQuantity - entry.totalQty) > QTY_TOLERANCE) {
          result.discrepancies.push(
            `ENTRY QTY: db=${dbQuantity} vs binance=${entry.totalQty}`
          );
        }

        if (exit.totalQty > 0 && Math.abs(dbQuantity - exit.totalQty) > QTY_TOLERANCE) {
          result.discrepancies.push(
            `EXIT QTY: db=${dbQuantity} vs binance_exit=${exit.totalQty}`
          );
        }

        if (dbEntryFee > 0 && entry.totalFee > 0 && Math.abs(dbEntryFee - entry.totalFee) > FEE_TOLERANCE) {
          result.discrepancies.push(
            `ENTRY FEE: db=${dbEntryFee.toFixed(8)} vs binance=${entry.totalFee.toFixed(8)} (diff=$${Math.abs(dbEntryFee - entry.totalFee).toFixed(8)})`
          );
        }

        if (dbExitFee > 0 && exit.totalFee > 0 && Math.abs(dbExitFee - exit.totalFee) > FEE_TOLERANCE) {
          result.discrepancies.push(
            `EXIT FEE: db=${dbExitFee.toFixed(8)} vs binance=${exit.totalFee.toFixed(8)} (diff=$${Math.abs(dbExitFee - exit.totalFee).toFixed(8)})`
          );
        }

        if (dbTotalFees > 0 && bn.totalFees > 0 && Math.abs(dbTotalFees - bn.totalFees) > FEE_TOLERANCE) {
          result.discrepancies.push(
            `TOTAL FEES: db=${dbTotalFees.toFixed(8)} vs binance=${bn.totalFees.toFixed(8)} (diff=$${Math.abs(dbTotalFees - bn.totalFees).toFixed(8)})`
          );
        }

        if (bn.realizedPnl !== 0) {
          const binancePnlWithFunding = bn.realizedPnl + fundingFees;
          const binanceNetPnl = binancePnlWithFunding - bn.totalFees;

          if (Math.abs(dbPnl - binanceNetPnl) > PNL_TOLERANCE && percentDiff(dbPnl, binanceNetPnl) > 0.02) {
            result.discrepancies.push(
              `PNL: db=${dbPnl.toFixed(4)} vs binance_net=${binanceNetPnl.toFixed(4)} (binance_realized=${bn.realizedPnl.toFixed(4)}, funding=${fundingFees.toFixed(4)}, fees=${bn.totalFees.toFixed(4)})`
            );
          }
        }

        if (dbEntryFee === 0 && entry.totalFee > 0.001) {
          result.discrepancies.push(
            `MISSING ENTRY FEE: db has 0 but Binance shows $${entry.totalFee.toFixed(8)}`
          );
        }

        if (dbExitFee === 0 && exit.totalFee > 0.001) {
          result.discrepancies.push(
            `MISSING EXIT FEE: db has 0 but Binance shows $${exit.totalFee.toFixed(8)}`
          );
        }

        if (entryTrades.length === 0 && exitTrades.length > 0) {
          result.discrepancies.push(
            `NO ENTRY TRADES FOUND: ${exitTrades.length} exit trade(s) but 0 entry trades on Binance`
          );
        }

        if (exitTrades.length === 0 && entryTrades.length > 0) {
          result.discrepancies.push(
            `NO EXIT TRADES FOUND: ${entryTrades.length} entry trade(s) but 0 exit trades on Binance`
          );
        }

        if (result.discrepancies.length > 0) {
          result.status = 'DISCREPANCY';
          totalDiscrepancies++;
        } else {
          totalMatches++;
        }
      } catch (error) {
        result.status = 'ERROR';
        const msg = error instanceof Error ? error.message : String(error);
        result.discrepancies.push(`Error fetching from Binance: ${msg}`);
        totalErrors++;
      }

      allResults.push(result);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('  AUDIT RESULTS');
  console.log('='.repeat(80));

  const discrepancies = allResults.filter(r => r.status === 'DISCREPANCY');
  const noDataResults = allResults.filter(r => r.status === 'NO_BINANCE_DATA');
  const errorResults = allResults.filter(r => r.status === 'ERROR');

  if (discrepancies.length > 0) {
    console.log(`\n  DISCREPANCIES FOUND: ${discrepancies.length}`);
    console.log('  ' + '-'.repeat(76));

    for (const r of discrepancies) {
      const openedAt = r.dbData.exitReason;
      console.log(`\n  [${r.executionId.slice(0, 12)}] ${r.symbol} ${r.side} | exit: ${r.dbData.exitReason} | source: ${r.dbData.exitSource}`);
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

      for (const d of r.discrepancies) {
        console.log(`    >> ${d}`);
      }
    }
  }

  if (noDataResults.length > 0) {
    console.log(`\n\n  NO BINANCE DATA: ${noDataResults.length}`);
    console.log('  ' + '-'.repeat(76));
    for (const r of noDataResults) {
      console.log(`  [${r.executionId.slice(0, 12)}] ${r.symbol} ${r.side} - ${r.discrepancies[0]}`);
    }
  }

  if (errorResults.length > 0) {
    console.log(`\n\n  ERRORS: ${errorResults.length}`);
    console.log('  ' + '-'.repeat(76));
    for (const r of errorResults) {
      console.log(`  [${r.executionId.slice(0, 12)}] ${r.symbol} ${r.side} - ${r.discrepancies[0]}`);
    }
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('  SUMMARY');
  console.log('='.repeat(80));
  console.log(`  Total audited:      ${totalAudited}`);
  console.log(`  Matches:            ${totalMatches}`);
  console.log(`  Discrepancies:      ${totalDiscrepancies}`);
  console.log(`  No Binance data:    ${totalNoData}`);
  console.log(`  Errors:             ${totalErrors}`);

  if (discrepancies.length > 0) {
    console.log('\n  DISCREPANCY BREAKDOWN:');

    const feeIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('FEE')));
    const priceIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('PRICE')));
    const pnlIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('PNL')));
    const qtyIssues = discrepancies.filter(r => r.discrepancies.some(d => d.includes('QTY')));
    const missingFees = discrepancies.filter(r => r.discrepancies.some(d => d.includes('MISSING')));
    const noTrades = discrepancies.filter(r => r.discrepancies.some(d => d.includes('NO ') && d.includes('TRADES')));

    if (feeIssues.length > 0) console.log(`    Fee mismatches:     ${feeIssues.length}`);
    if (priceIssues.length > 0) console.log(`    Price mismatches:   ${priceIssues.length}`);
    if (pnlIssues.length > 0) console.log(`    PnL mismatches:     ${pnlIssues.length}`);
    if (qtyIssues.length > 0) console.log(`    Qty mismatches:     ${qtyIssues.length}`);
    if (missingFees.length > 0) console.log(`    Missing fees in DB: ${missingFees.length}`);
    if (noTrades.length > 0) console.log(`    Missing trades:     ${noTrades.length}`);

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
    console.log('\n  All trades match Binance records.');
  }

  console.log('\n' + '='.repeat(80) + '\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
