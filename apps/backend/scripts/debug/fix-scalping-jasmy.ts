import { db } from '../../src/db';
import { scalpingConfig } from '../../src/db/schema';
import { eq } from 'drizzle-orm';

const main = async () => {
  const configs = await db.query.scalpingConfig.findMany();

  console.log(`Found ${configs.length} scalping config(s)\n`);

  for (const config of configs) {
    const symbols: string[] = JSON.parse(config.symbols);
    console.log(`Wallet: ${config.walletId}`);
    console.log(`  Enabled: ${config.isEnabled}`);
    console.log(`  Symbols: ${JSON.stringify(symbols)}`);

    if (symbols.includes('JASMYUSDT')) {
      const filtered = symbols.filter((s) => s !== 'JASMYUSDT');
      console.log(`  → Removing JASMYUSDT. New symbols: ${JSON.stringify(filtered)}`);

      await db.update(scalpingConfig)
        .set({
          symbols: JSON.stringify(filtered),
          updatedAt: new Date(),
        })
        .where(eq(scalpingConfig.id, config.id));

      console.log('  → Done');
    } else {
      console.log('  → No JASMYUSDT found, skipping');
    }
    console.log();
  }

  process.exit(0);
};

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
