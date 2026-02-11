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

  const openedAt = exec.openedAt ? exec.openedAt.getTime() : exec.createdAt.getTime();

  console.log('Fetching all FARTCOINUSDT trades since position opened...');
  const trades = await client.getAccountTrades({
    symbol: 'FARTCOINUSDT',
    startTime: openedAt - 1000,
    limit: 100,
  });

  console.log(`Found ${trades.length} trades`);

  let totalEntryQty = 0;
  let totalExitQty = 0;
  let totalEntryValue = 0;
  let totalExitValue = 0;
  let totalFees = 0;
  let totalRealizedPnl = 0;
  let lastExitPrice = 0;

  for (const trade of trades) {
    const qty = parseFloat(String(trade.qty));
    const price = parseFloat(String(trade.price));
    const commission = parseFloat(String(trade.commission));
    const realizedPnl = parseFloat(String(trade.realizedPnl));
    const isBuyer = trade.buyer;

    console.log(`  ${isBuyer ? 'BUY' : 'SELL'} ${qty} @ ${price}, fee=${commission}, pnl=${realizedPnl}`);

    if (isBuyer) {
      totalExitQty += qty;
      totalExitValue += qty * price;
      lastExitPrice = price;
    } else {
      totalEntryQty += qty;
      totalEntryValue += qty * price;
    }

    totalFees += commission;
    totalRealizedPnl += realizedPnl;
  }

  const avgEntryPrice = totalEntryQty > 0 ? totalEntryValue / totalEntryQty : parseFloat(exec.entryPrice);
  const avgExitPrice = totalExitQty > 0 ? totalExitValue / totalExitQty : lastExitPrice;

  console.log('\n--- POSITION SUMMARY ---');
  console.log(`Entry: ${totalEntryQty} @ avg ${avgEntryPrice.toFixed(6)}`);
  console.log(`Exit: ${totalExitQty} @ avg ${avgExitPrice.toFixed(6)}`);
  console.log(`Total Fees: ${totalFees.toFixed(6)} USDT`);
  console.log(`Total Realized PnL (Binance): ${totalRealizedPnl.toFixed(6)} USDT`);
  console.log(`Net PnL: ${(totalRealizedPnl - totalFees).toFixed(6)} USDT`);

  const originalQty = 1350.6;
  const entryPrice = parseFloat(exec.entryPrice);
  const grossPnl = (entryPrice - avgExitPrice) * Math.min(totalExitQty, originalQty);
  const netPnl = grossPnl - totalFees;
  const pnlPercent = ((entryPrice - avgExitPrice) / entryPrice) * 100;

  console.log(`\nCalculated PnL: gross=${grossPnl.toFixed(4)}, net=${netPnl.toFixed(4)}, pct=${pnlPercent.toFixed(2)}%`);

  console.log('\nUpdating DB...');
  await db.update(tradeExecutions).set({
    quantity: originalQty.toString(),
    exitPrice: avgExitPrice.toFixed(8),
    pnl: netPnl.toFixed(8),
    pnlPercent: pnlPercent.toFixed(4),
    fees: totalFees.toFixed(8),
    entryFee: '0',
    exitFee: totalFees.toFixed(8),
  }).where(eq(tradeExecutions.id, exec.id));

  console.log('DB updated with correct values from Binance trade history.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
