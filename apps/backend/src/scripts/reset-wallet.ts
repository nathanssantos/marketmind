import 'dotenv/config';
import { db } from '../db';
import { orders, positions, setupDetections, strategyPerformance, tradeCooldowns, tradeExecutions, wallets } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';

const resetWallet = async () => {
  console.log('Starting wallet reset...\n');

  const allWallets = await db.select().from(wallets);

  if (allWallets.length === 0) {
    console.log('No wallets found.');
    process.exit(0);
  }

  console.log(`Found ${allWallets.length} wallet(s):\n`);

  for (const wallet of allWallets) {
    console.log(`  - ${wallet.name} (${wallet.id})`);
    console.log(`    Initial: ${wallet.initialBalance} ${wallet.currency}`);
    console.log(`    Current: ${wallet.currentBalance} ${wallet.currency}\n`);
  }

  const closedOrders = await db.select().from(orders).where(inArray(orders.status, ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED']));
  const closedPositions = await db.select().from(positions).where(eq(positions.status, 'closed'));
  const executions = await db.select().from(tradeExecutions);
  const setups = await db.select().from(setupDetections);
  const cooldowns = await db.select().from(tradeCooldowns);
  const performance = await db.select().from(strategyPerformance);

  console.log(`Closed orders to delete: ${closedOrders.length}`);
  console.log(`Closed positions to delete: ${closedPositions.length}`);
  console.log(`Trade executions to delete: ${executions.length}`);
  console.log(`Setup detections to delete: ${setups.length}`);
  console.log(`Trade cooldowns to delete: ${cooldowns.length}`);
  console.log(`Strategy performance records to delete: ${performance.length}\n`);

  console.log('Deleting closed orders...');
  await db.delete(orders).where(inArray(orders.status, ['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED']));
  console.log('Done.');

  console.log('Deleting closed positions...');
  await db.delete(positions).where(eq(positions.status, 'closed'));
  console.log('Done.');

  console.log('Deleting trade executions...');
  await db.delete(tradeExecutions);
  console.log('Done.');

  console.log('Deleting setup detections...');
  await db.delete(setupDetections);
  console.log('Done.');

  console.log('Deleting trade cooldowns...');
  await db.delete(tradeCooldowns);
  console.log('Done.');

  console.log('Deleting strategy performance records...');
  await db.delete(strategyPerformance);
  console.log('Done.');

  console.log('Resetting wallet balances to initial...');
  for (const wallet of allWallets) {
    await db
      .update(wallets)
      .set({ currentBalance: wallet.initialBalance })
      .where(eq(wallets.id, wallet.id));
    console.log(`  - ${wallet.name}: ${wallet.currentBalance} -> ${wallet.initialBalance} ${wallet.currency}`);
  }

  console.log('\nWallet reset complete!');
  process.exit(0);
};

resetWallet().catch((error) => {
  console.error('Error resetting wallet:', error);
  process.exit(1);
});
