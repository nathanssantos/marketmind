import 'dotenv/config';
import { db } from '../db';
import { setupDetections, tradeExecutions, wallets } from '../db/schema';
import { eq } from 'drizzle-orm';

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

  const executions = await db.select().from(tradeExecutions);
  const setups = await db.select().from(setupDetections);

  console.log(`Trade executions to delete: ${executions.length}`);
  console.log(`Setup detections to delete: ${setups.length}\n`);

  console.log('Deleting trade executions...');
  await db.delete(tradeExecutions);
  console.log('Done.');

  console.log('Deleting setup detections...');
  await db.delete(setupDetections);
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
