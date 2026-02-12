import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db';
import { tradeExecutions, wallets } from '../src/db/schema';
import { createBinanceFuturesClient } from '../src/services/binance-futures-client';

async function main() {
  const exec = await db.query.tradeExecutions.findFirst({
    where: eq(tradeExecutions.id, 'exec-1770788717637-m3kixnd'),
  });
  if (exec === undefined || exec === null) {
    console.log('Not found');
    return;
  }

  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, exec.walletId)).limit(1);
  if (wallet === undefined || wallet === null) {
    console.log('Wallet not found');
    return;
  }

  const client = createBinanceFuturesClient(wallet);

  const order = await client.getOrder({ symbol: 'FARTCOINUSDT', orderId: 10443659669 });
  console.log('Order status:', JSON.stringify(order, null, 2));

  const positions = await client.getPositions({ symbol: 'FARTCOINUSDT' });
  console.log('Positions:', JSON.stringify(positions, null, 2));

  if (order.status === 'FILLED') {
    const exitPrice = parseFloat(String(order.avgPrice));
    const entryPrice = parseFloat(exec.entryPrice);
    const qty = parseFloat(String(order.executedQty));
    const grossPnl = (entryPrice - exitPrice) * qty;
    const fees = entryPrice * qty * 0.001;
    const pnl = grossPnl - fees;
    const pnlPercent = ((entryPrice - exitPrice) / entryPrice) * 100;

    console.log(`Exit: ${exitPrice}, Qty: ${qty}, PnL: ${pnl.toFixed(4)}`);

    await db.update(tradeExecutions).set({
      exitPrice: exitPrice.toString(),
      pnl: pnl.toFixed(8),
      pnlPercent: pnlPercent.toFixed(4),
      fees: fees.toFixed(8),
    }).where(eq(tradeExecutions.id, exec.id));
    console.log('DB updated with correct values');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
