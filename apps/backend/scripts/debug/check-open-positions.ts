import { db } from '../../src/db';
import { tradeExecutions } from '../../src/db/schema';
import { inArray } from 'drizzle-orm';

const main = async () => {
  const open = await db.query.tradeExecutions.findMany({
    where: inArray(tradeExecutions.status, ['open', 'pending']),
  });

  console.log(`Found ${open.length} open/pending executions:\n`);

  for (const exec of open) {
    console.log(`ID: ${exec.id}`);
    console.log(`  Symbol: ${exec.symbol}`);
    console.log(`  Side: ${exec.side}`);
    console.log(`  Status: ${exec.status}`);
    console.log(`  SetupType: ${exec.setupType}`);
    console.log(`  EntryPrice: ${exec.entryPrice}`);
    console.log(`  Quantity: ${exec.quantity}`);
    console.log(`  StopLoss: ${exec.stopLoss}`);
    console.log(`  TakeProfit: ${exec.takeProfit}`);
    console.log(`  Leverage: ${exec.leverage}`);
    console.log(`  MarketType: ${exec.marketType}`);
    console.log(`  EntryOrderType: ${exec.entryOrderType}`);
    console.log(`  StopLossAlgoId: ${exec.stopLossAlgoId}`);
    console.log(`  TakeProfitAlgoId: ${exec.takeProfitAlgoId}`);
    console.log(`  OpenedAt: ${exec.openedAt}`);
    console.log(`  WalletId: ${exec.walletId}`);
    console.log();
  }

  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
