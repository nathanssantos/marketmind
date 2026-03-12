import { db } from '../../src/db';
import { tradeExecutions } from '../../src/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const ghosts = await db.select({
  id: tradeExecutions.id,
  symbol: tradeExecutions.symbol,
  side: tradeExecutions.side,
  qty: tradeExecutions.quantity,
  entry: tradeExecutions.entryPrice,
  exit: tradeExecutions.exitPrice,
  pnl: tradeExecutions.pnl,
  fees: tradeExecutions.fees,
  exitFee: tradeExecutions.exitFee,
  status: tradeExecutions.status,
  closedAt: tradeExecutions.closedAt,
}).from(tradeExecutions)
  .where(
    and(
      eq(tradeExecutions.status, 'closed'),
      isNull(tradeExecutions.exitPrice)
    )
  );

if (ghosts.length === 0) {
  console.log('No ghost trades found (closed with no exit price)');
} else {
  console.log(`Found ${ghosts.length} ghost trade(s):\n`);
  let totalBadPnl = 0;
  for (const t of ghosts) {
    const pnl = parseFloat(t.pnl || '0');
    totalBadPnl += pnl;
    console.log(`${t.id} ${t.symbol} ${t.side} qty=${t.qty} entry=${t.entry} exit=null pnl=${pnl.toFixed(4)} exitFee=${t.exitFee} closed=${t.closedAt?.toISOString()}`);
  }
  console.log(`\nTotal ghost PnL impact: ${totalBadPnl.toFixed(4)}`);
}

process.exit(0);
