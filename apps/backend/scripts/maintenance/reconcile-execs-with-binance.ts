import 'dotenv/config';
import { eq, and, gte, lte, asc } from 'drizzle-orm';
import { db } from '../../src/db';
import { wallets, tradeExecutions } from '../../src/db/schema';
import { createBinanceFuturesClient } from '../../src/services/binance-futures-client';
import { guardBinanceCall } from '../../src/services/binance-api-cache';

const WALLET_ID = process.argv[2] ?? 'kP_efbmZqtTyEJ4p2LLBx';
const APPLY = process.argv.includes('--apply');

interface UserTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: 'BUY' | 'SELL';
  price: string;
  qty: string;
  realizedPnl: string;
  commission: string;
  time: number;
  positionSide: string;
}

const FEE_TOL = 0.01; // dollars

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) { console.error('No wallet'); process.exit(1); }

  const client = createBinanceFuturesClient(wallet);
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const startTime = startOfDay.getTime();
  const endTime = Date.now();

  const symbol = 'BTCUSDT';
  const trades = (await guardBinanceCall(() =>
    client.getAccountTrades({ symbol, startTime: startTime - 24*60*60*1000, endTime, limit: 1000 } as never),
  )) as UserTrade[];
  trades.sort((a, b) => a.time - b.time);

  // Index trades by orderId for fast lookup
  const tradesByOrderId = new Map<string, UserTrade[]>();
  for (const t of trades) {
    const k = String(t.orderId);
    const arr = tradesByOrderId.get(k) ?? [];
    arr.push(t);
    tradesByOrderId.set(k, arr);
  }

  const dbClosed = await db.select().from(tradeExecutions).where(
    and(
      eq(tradeExecutions.walletId, WALLET_ID),
      eq(tradeExecutions.status, 'closed'),
      gte(tradeExecutions.closedAt, new Date(startTime)),
      lte(tradeExecutions.closedAt, new Date(endTime)),
    ),
  ).orderBy(asc(tradeExecutions.openedAt));

  console.log(`Reconciling ${dbClosed.length} closed execs for ${symbol}\n`);

  const fixes: Array<{
    id: string;
    oldPnl: string; newPnl: number;
    oldFees: string; newFees: number;
    oldExit: string; newExit: number;
    oldPnlPercent: string; newPnlPercent: number;
  }> = [];

  for (const exec of dbClosed) {
    if (exec.symbol !== symbol) continue;

    // Entry: trades for entry_order_id
    const entryTrades = exec.entryOrderId ? (tradesByOrderId.get(exec.entryOrderId) ?? []) : [];
    const entrySide = exec.side === 'LONG' ? 'BUY' : 'SELL';
    const validEntryTrades = entryTrades.filter((t) => t.side === entrySide);
    const entryFees = validEntryTrades.reduce((s, t) => s + parseFloat(t.commission), 0);

    // Exit: opposite-side trades AFTER the latest entry trade time, summing to exec.quantity
    const lastEntryTime = validEntryTrades.length > 0 ? Math.max(...validEntryTrades.map((t) => t.time)) : exec.openedAt!.getTime();
    const exitSide = exec.side === 'LONG' ? 'SELL' : 'BUY';
    const candidateExitTrades = trades.filter(
      (t) => t.side === exitSide && t.time > lastEntryTime && t.time <= (exec.closedAt!.getTime() + 60_000),
    );

    // Greedy: take fills until quantity matches
    const targetQty = parseFloat(exec.quantity);
    let qtyConsumed = 0;
    const exitTrades: UserTrade[] = [];
    for (const t of candidateExitTrades) {
      if (qtyConsumed >= targetQty - 0.0001) break;
      exitTrades.push(t);
      qtyConsumed += parseFloat(t.qty);
    }

    const grossPnl = exitTrades.reduce((s, t) => s + parseFloat(t.realizedPnl), 0);
    const exitFees = exitTrades.reduce((s, t) => s + parseFloat(t.commission), 0);
    const totalFees = entryFees + exitFees;
    const netPnl = grossPnl - totalFees;

    const exitNotional = exitTrades.reduce((s, t) => s + parseFloat(t.qty) * parseFloat(t.price), 0);
    const exitQty = exitTrades.reduce((s, t) => s + parseFloat(t.qty), 0);
    const exitPrice = exitQty > 0 ? exitNotional / exitQty : parseFloat(exec.exitPrice ?? '0');

    const oldPnlNum = parseFloat(exec.pnl ?? '0');
    const oldFeesNum = parseFloat(exec.fees ?? '0');
    const oldExitNum = parseFloat(exec.exitPrice ?? '0');

    const drift = netPnl - oldPnlNum;

    console.log(`${exec.id} ${exec.side} qty=${exec.quantity}`);
    console.log(`  entry order ${exec.entryOrderId} → ${validEntryTrades.length} fills, fees=${entryFees.toFixed(4)}`);
    console.log(`  exit fills: ${exitTrades.length} qty=${exitQty.toFixed(4)} px=${exitPrice.toFixed(2)} grossPnl=${grossPnl.toFixed(4)}`);
    console.log(`  DB had: pnl=${exec.pnl} fees=${exec.fees} exit=${exec.exitPrice}`);
    console.log(`  Bin says: pnl=${netPnl.toFixed(4)} fees=${totalFees.toFixed(4)} exit=${exitPrice.toFixed(2)}`);
    console.log(`  drift: ${drift.toFixed(4)}`);

    // Recompute pnl_percent on the corrected pnl. Without an exit
    // price (exitPrice <= 0), there's no realized return, so % is 0.
    // With an exit price, % = ROE = (netPnl / margin) * 100 where
    // margin = (entry × qty) / leverage.
    const leverage = exec.leverage ?? 1;
    const entryPriceNum = parseFloat(exec.entryPrice);
    const margin = (entryPriceNum * targetQty) / leverage;
    const newPnlPercent = exitPrice > 0 && margin > 0 ? (netPnl / margin) * 100 : 0;
    const oldPnlPercentNum = parseFloat(exec.pnlPercent ?? '0');

    if (
      Math.abs(drift) > FEE_TOL
      || Math.abs(totalFees - oldFeesNum) > FEE_TOL
      || Math.abs(exitPrice - oldExitNum) > 1
      || Math.abs(newPnlPercent - oldPnlPercentNum) > 0.5
    ) {
      console.log('  → needs fix');
      fixes.push({
        id: exec.id,
        oldPnl: exec.pnl ?? '0', newPnl: netPnl,
        oldFees: exec.fees ?? '0', newFees: totalFees,
        oldExit: exec.exitPrice ?? '0', newExit: exitPrice,
        oldPnlPercent: exec.pnlPercent ?? '0', newPnlPercent,
      });
    } else {
      console.log('  ✓ within tolerance');
    }
    console.log('');
  }

  const totalDrift = fixes.reduce((s, f) => s + (f.newPnl - parseFloat(f.oldPnl)), 0);
  console.log(`\n${fixes.length} execs need fixing. Total pnl drift: ${totalDrift.toFixed(4)}`);

  if (!APPLY) {
    console.log('(read-only mode — pass --apply to fix)');
    process.exit(0);
  }

  console.log('\n=== APPLYING FIXES ===');
  for (const f of fixes) {
    await db.update(tradeExecutions).set({
      pnl: f.newPnl.toString(),
      pnlPercent: f.newPnlPercent.toString(),
      fees: f.newFees.toString(),
      exitPrice: f.newExit.toString(),
      updatedAt: new Date(),
    }).where(eq(tradeExecutions.id, f.id));
    console.log(`  fixed ${f.id} (pnl=${f.newPnl.toFixed(2)} pct=${f.newPnlPercent.toFixed(2)}%)`);
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
