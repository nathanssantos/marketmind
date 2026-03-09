import 'dotenv/config';
import { db } from '../../src/db/client';
import { tradeExecutions, symbolTrailingStopOverrides } from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const execs = await db.select().from(tradeExecutions).where(
    and(eq(tradeExecutions.symbol, 'KITEUSDT'), eq(tradeExecutions.status, 'open'))
  );
  console.log('EXECUTIONS:', JSON.stringify(execs.map(e => ({
    id: e.id,
    side: e.side,
    setupId: e.setupId,
    exitSource: e.exitSource,
    entryPrice: e.entryPrice,
    stopLoss: e.stopLoss,
    takeProfit: e.takeProfit,
    stopLossAlgoId: e.stopLossAlgoId,
    takeProfitAlgoId: e.takeProfitAlgoId,
    highestPriceSinceEntry: e.highestPriceSinceEntry,
    lowestPriceSinceEntry: e.lowestPriceSinceEntry,
  })), null, 2));

  const overrides = await db.select().from(symbolTrailingStopOverrides).where(
    eq(symbolTrailingStopOverrides.symbol, 'KITEUSDT')
  );
  console.log('OVERRIDES:', JSON.stringify(overrides, null, 2));
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
