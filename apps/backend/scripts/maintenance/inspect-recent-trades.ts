import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { wallets } from '../../src/db/schema';
import { createBinanceFuturesClient } from '../../src/services/binance-futures-client';
import { guardBinanceCall } from '../../src/services/binance-api-cache';

const WALLET_ID = process.argv[2] ?? 'kP_efbmZqtTyEJ4p2LLBx';
const SYMBOL = process.argv[3] ?? 'BTCUSDT';
const MINUTES_AGO = parseInt(process.argv[4] ?? '60', 10);

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
  buyer: boolean;
}

interface IncomeEntry {
  symbol?: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  tradeId?: number;
  info?: string;
}

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) { console.error('No wallet'); process.exit(1); }

  const client = createBinanceFuturesClient(wallet);
  const startTime = Date.now() - MINUTES_AGO * 60 * 1000;
  const endTime = Date.now();

  console.log(`=== Last ${MINUTES_AGO}min Binance trades for ${SYMBOL} ===`);
  const trades = (await guardBinanceCall(() =>
    client.getAccountTrades({ symbol: SYMBOL, startTime, endTime, limit: 1000 } as never),
  )) as UserTrade[];
  trades.sort((a, b) => a.time - b.time);

  let totalRealized = 0;
  let totalCommission = 0;
  for (const t of trades) {
    totalRealized += parseFloat(t.realizedPnl);
    totalCommission += parseFloat(t.commission);
    console.log(
      `${new Date(t.time).toISOString()} ${t.side} qty=${t.qty} px=${t.price} realPnl=${t.realizedPnl} fee=${t.commission} order=${t.orderId} positionSide=${t.positionSide}`,
    );
  }
  console.log(`\nTotal: ${trades.length} fills, gross PnL=${totalRealized.toFixed(4)}, commission=${totalCommission.toFixed(4)}`);

  console.log(`\n=== Income events ===`);
  const incomes = (await guardBinanceCall(() =>
    client.getIncomeHistory({ symbol: SYMBOL, startTime, endTime, limit: 1000 } as never),
  )) as IncomeEntry[];
  for (const inc of incomes) {
    console.log(
      `${new Date(inc.time).toISOString()} ${inc.incomeType} amount=${inc.income} ${inc.asset} info=${inc.info ?? '-'}`,
    );
  }

  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
