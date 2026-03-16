import { db } from '../../src/db';
import { scalpingConfig } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const main = async () => {
  const configs = await db.query.scalpingConfig.findMany();

  for (const config of configs) {
    if (config.isEnabled) {
      console.log(`Disabling scalping for wallet ${config.walletId}`);
      console.log(`  Symbols: ${config.symbols}`);

      await db.update(scalpingConfig)
        .set({ isEnabled: false, updatedAt: new Date() })
        .where(eq(scalpingConfig.id, config.id));

      console.log('  → Disabled');
    } else {
      console.log(`Wallet ${config.walletId} already disabled`);
    }
  }

  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
