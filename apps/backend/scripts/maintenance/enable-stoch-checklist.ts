import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { tradingProfiles, userIndicators, users } from '../../src/db/schema';
import {
  parseChecklistConditions,
  stringifyChecklistConditions,
} from '../../src/utils/profile-transformers';

const main = async (): Promise<void> => {
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  for (const user of allUsers) {
    const indicatorRows = await db
      .select({ id: userIndicators.id, label: userIndicators.label })
      .from(userIndicators)
      .where(eq(userIndicators.userId, user.id));
    const stochId = indicatorRows.find((r) => r.label === 'Stoch 14')?.id;
    if (!stochId) {
      console.log(`  [${user.email}] no Stoch 14 indicator — skipping`);
      continue;
    }

    const profiles = await db
      .select({
        id: tradingProfiles.id,
        name: tradingProfiles.name,
        isDefault: tradingProfiles.isDefault,
        checklistConditions: tradingProfiles.checklistConditions,
      })
      .from(tradingProfiles)
      .where(eq(tradingProfiles.userId, user.id));

    const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0];
    if (!defaultProfile) continue;

    const existing = parseChecklistConditions(defaultProfile.checklistConditions ?? '[]');
    let toggled = 0;
    const updated = existing.map((c) => {
      if (c.userIndicatorId === stochId && !c.enabled) {
        toggled += 1;
        return { ...c, enabled: true };
      }
      return c;
    });

    if (toggled === 0) {
      console.log(`  [${user.email}] Stoch 14 already enabled or absent`);
      continue;
    }

    await db
      .update(tradingProfiles)
      .set({
        checklistConditions: stringifyChecklistConditions(updated),
        updatedAt: new Date(),
      })
      .where(eq(tradingProfiles.id, defaultProfile.id));

    console.log(`  [${user.email}] enabled ${toggled} Stoch 14 condition(s)`);
  }

  console.log('Done.');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
