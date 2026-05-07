import 'dotenv/config';
import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db';
import { wallets, tradeExecutions } from '../../src/db/schema';
import { createBinanceFuturesClient, getPositions } from '../../src/services/binance-futures-client';

const WALLET_ID = process.argv[2] ?? 'kP_efbmZqtTyEJ4p2LLBx';

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, WALLET_ID)).limit(1);
  if (!wallet) {
    console.error('No wallet found for id', WALLET_ID);
    process.exit(1);
  }

  console.log('=== DB OPEN/PENDING EXECS ===');
  const open = await db.select().from(tradeExecutions)
    .where(and(eq(tradeExecutions.walletId, WALLET_ID)));
  const filtered = open.filter((e) => e.status === 'open' || e.status === 'pending');
  for (const e of filtered) {
    console.log({
      id: e.id, symbol: e.symbol, side: e.side, status: e.status,
      entryPrice: e.entryPrice, quantity: e.quantity, leverage: e.leverage,
      stopLoss: e.stopLoss, takeProfit: e.takeProfit,
      stopLossAlgoId: e.stopLossAlgoId, takeProfitAlgoId: e.takeProfitAlgoId,
      openedAt: e.openedAt,
    });
  }
  if (filtered.length === 0) console.log('(none)');

  console.log('\n=== BINANCE POSITIONS ===');
  const client = createBinanceFuturesClient(wallet);
  const positions = await getPositions(client);
  const nonZero = positions.filter((p) => Math.abs(parseFloat(String(p.positionAmt))) > 0);
  for (const p of nonZero) {
    console.log({
      symbol: p.symbol, positionSide: p.positionSide, positionAmt: p.positionAmt,
      entryPrice: p.entryPrice, leverage: p.leverage, marginType: p.marginType,
      unrealizedProfit: p.unRealizedProfit, liquidationPrice: p.liquidationPrice,
    });
  }
  if (nonZero.length === 0) console.log('NONE — Binance has no open position');

  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
