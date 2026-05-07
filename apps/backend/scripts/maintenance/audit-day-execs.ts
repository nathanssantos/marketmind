import 'dotenv/config';
import { eq, and, gte, lte } from 'drizzle-orm';
import { db } from '../../src/db';
import { wallets, tradeExecutions } from '../../src/db/schema';
import { createBinanceFuturesClient } from '../../src/services/binance-futures-client';
import { guardBinanceCall } from '../../src/services/binance-api-cache';

const WALLET_ID = process.argv[2] ?? 'kP_efbmZqtTyEJ4p2LLBx';

interface UserTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: 'BUY' | 'SELL';
  price: string;
  qty: string;
  realizedPnl: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
  positionSide: string;
}

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) { console.error('No wallet'); process.exit(1); }

  const client = createBinanceFuturesClient(wallet);
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const startTime = startOfDay.getTime();
  const endTime = Date.now();

  // Per-symbol Binance trades (Binance requires symbol filter for userTrades)
  const symbolsToCheck = ['BTCUSDT'];

  for (const symbol of symbolsToCheck) {
    console.log(`\n=== Binance userTrades ${symbol} (today) ===`);
    const trades = (await guardBinanceCall(() =>
      client.getAccountTrades({ symbol, startTime, endTime, limit: 1000 } as never),
    )) as UserTrade[];

    let grossPnl = 0;
    let totalCommission = 0;
    for (const t of trades) {
      grossPnl += parseFloat(t.realizedPnl);
      totalCommission += parseFloat(t.commission);
      console.log(`  ${new Date(t.time).toISOString()} ${t.side} qty=${t.qty} px=${t.price} realPnl=${t.realizedPnl} fee=${t.commission} order=${t.orderId}`);
    }
    console.log(`  total trades: ${trades.length}  gross PnL: ${grossPnl.toFixed(4)}  commission: ${totalCommission.toFixed(4)}`);
  }

  console.log('\n=== DB closed execs today ===');
  const dbClosed = await db.select().from(tradeExecutions).where(
    and(
      eq(tradeExecutions.walletId, WALLET_ID),
      eq(tradeExecutions.status, 'closed'),
      gte(tradeExecutions.closedAt, new Date(startTime)),
      lte(tradeExecutions.closedAt, new Date(endTime)),
    ),
  );
  for (const e of dbClosed) {
    console.log({
      id: e.id, symbol: e.symbol, side: e.side, qty: e.quantity,
      entry: e.entryPrice, exit: e.exitPrice, pnl: e.pnl, fees: e.fees,
      entryFee: e.entryFee, exitFee: e.exitFee, partialClosePnl: e.partialClosePnl,
      entryOrderId: e.entryOrderId, exitOrderId: e.exitOrderId,
      openedAt: e.openedAt?.toISOString(), closedAt: e.closedAt?.toISOString(),
      exitSource: e.exitSource, exitReason: e.exitReason,
    });
  }

  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
