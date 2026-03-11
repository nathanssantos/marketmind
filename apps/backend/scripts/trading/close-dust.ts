import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { tradeExecutions, wallets } from '../src/db/schema';
import { createBinanceFuturesClient } from '../src/services/binance-futures-client';
import { guardedCall } from '../utils/binance-script-guard';

async function main() {
  const exec = await db.query.tradeExecutions.findFirst({
    where: eq(tradeExecutions.id, 'exec-1770788717637-m3kixnd'),
  });
  if (exec === undefined || exec === null) {
    console.log('Execution not found');
    return;
  }

  console.log(`Closing ${exec.symbol} ${exec.side} dust qty=${exec.quantity} at market...`);

  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, exec.walletId)).limit(1);
  if (wallet === undefined || wallet === null) {
    console.log('Wallet not found');
    return;
  }

  const client = createBinanceFuturesClient(wallet);
  const qty = parseFloat(exec.quantity);

  const orderSide = exec.side === 'LONG' ? 'SELL' : 'BUY';
  console.log(`Placing ${orderSide} MARKET order for ${qty} ${exec.symbol} (reduceOnly)...`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = await guardedCall(() => client.submitNewOrder({
    symbol: exec.symbol,
    side: orderSide,
    type: 'MARKET',
    quantity: qty,
    reduceOnly: 'true',
  } as any));

  console.log('Order result:', JSON.stringify(order, null, 2));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exitPrice = parseFloat(String((order as any).avgPrice || '0'));
  const entryPrice = parseFloat(exec.entryPrice);
  const isLong = exec.side === 'LONG';
  const grossPnl = isLong ? (exitPrice - entryPrice) * qty : (entryPrice - exitPrice) * qty;
  const fees = entryPrice * qty * 0.001;
  const pnl = grossPnl - fees;
  const pnlPercent = isLong
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : ((entryPrice - exitPrice) / entryPrice) * 100;

  await db.update(tradeExecutions).set({
    status: 'closed',
    exitPrice: exitPrice.toString(),
    pnl: pnl.toFixed(8),
    pnlPercent: pnlPercent.toFixed(4),
    fees: fees.toFixed(8),
    exitReason: 'MANUAL_CLOSE',
    exitSource: 'sync-script',
    closedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(tradeExecutions.id, exec.id));

  console.log(`${exec.symbol} dust closed. Exit: ${exitPrice}, PnL: ${pnl.toFixed(4)} USDT`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
