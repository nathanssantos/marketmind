import 'dotenv/config';
import { db } from '../src/db';
import { tradeExecutions } from '../src/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { getIntervalMs } from '../src/services/dynamic-symbol-rotation';

const fixTriggerKlineOpenTime = async () => {
  console.log('🔧 Fixing triggerKlineOpenTime for existing trades...\n');

  const tradesWithoutTriggerTime = await db
    .select()
    .from(tradeExecutions)
    .where(isNull(tradeExecutions.triggerKlineOpenTime));

  console.log(`Found ${tradesWithoutTriggerTime.length} trades without triggerKlineOpenTime\n`);

  if (tradesWithoutTriggerTime.length === 0) {
    console.log('✅ No trades to fix!');
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const trade of tradesWithoutTriggerTime) {
    const { id, openedAt, entryInterval } = trade;

    if (!openedAt || !entryInterval) {
      console.log(`⚠️ Skipping trade ${id}: missing openedAt or entryInterval`);
      skipped++;
      continue;
    }

    const intervalMs = getIntervalMs(entryInterval);
    if (!intervalMs) {
      console.log(`⚠️ Skipping trade ${id}: unknown interval ${entryInterval}`);
      skipped++;
      continue;
    }

    const openedAtMs = openedAt.getTime();
    const triggerKlineOpenTime = Math.floor(openedAtMs / intervalMs) * intervalMs;

    console.log(`📝 Trade ${id}:`);
    console.log(`   openedAt: ${openedAt.toISOString()} (${openedAtMs})`);
    console.log(`   interval: ${entryInterval} (${intervalMs}ms)`);
    console.log(`   triggerKlineOpenTime: ${new Date(triggerKlineOpenTime).toISOString()} (${triggerKlineOpenTime})`);

    await db
      .update(tradeExecutions)
      .set({ triggerKlineOpenTime })
      .where(eq(tradeExecutions.id, id));

    updated++;
  }

  console.log(`\n✅ Done! Updated: ${updated}, Skipped: ${skipped}`);
};

fixTriggerKlineOpenTime()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
