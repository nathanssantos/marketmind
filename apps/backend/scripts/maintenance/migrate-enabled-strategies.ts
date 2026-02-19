import 'dotenv/config';
import { db } from '../../src/db';
import { autoTradingConfig, tradingProfiles } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_ENABLED_SETUPS } from '../../src/constants';

const newSetupTypesJson = JSON.stringify([...DEFAULT_ENABLED_SETUPS]);

const migrateEnabledStrategies = async () => {
  console.log('Starting enabled strategies migration...\n');
  console.log(`New setup types (${DEFAULT_ENABLED_SETUPS.length}):`);
  DEFAULT_ENABLED_SETUPS.forEach((s) => console.log(`  - ${s}`));
  console.log();

  const configs = await db.select().from(autoTradingConfig);
  console.log(`Found ${configs.length} auto trading config(s).`);

  for (const config of configs) {
    const oldValue = config.enabledSetupTypes;
    await db
      .update(autoTradingConfig)
      .set({ enabledSetupTypes: newSetupTypesJson, updatedAt: new Date() })
      .where(eq(autoTradingConfig.id, config.id));
    console.log(`  [autoTradingConfig] ${config.id}: ${oldValue} -> ${newSetupTypesJson}`);
  }

  const profiles = await db.select().from(tradingProfiles);
  console.log(`\nFound ${profiles.length} trading profile(s).`);

  for (const profile of profiles) {
    const oldValue = profile.enabledSetupTypes;
    await db
      .update(tradingProfiles)
      .set({ enabledSetupTypes: newSetupTypesJson, updatedAt: new Date() })
      .where(eq(tradingProfiles.id, profile.id));
    console.log(`  [tradingProfiles] ${profile.id} ("${profile.name}"): ${oldValue} -> ${newSetupTypesJson}`);
  }

  console.log(`\nMigration complete! Updated ${configs.length} config(s) and ${profiles.length} profile(s).`);
  process.exit(0);
};

migrateEnabledStrategies().catch((error) => {
  console.error('Error migrating enabled strategies:', error);
  process.exit(1);
});
