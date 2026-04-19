import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { DEFAULT_CHECKLIST_TEMPLATE } from '@marketmind/trading-core';
import { db } from '../../src/db';
import { tradingProfiles, userIndicators, users } from '../../src/db/schema';
import { generateEntityId } from '../../src/utils/id';
import {
  parseChecklistConditions,
  stringifyChecklistConditions,
} from '../../src/utils/profile-transformers';
import { seedDefaultUserIndicators } from '../../src/services/user-indicators';

const buildKey = (userIndicatorId: string, timeframe: string, op: string, side: string): string =>
  `${userIndicatorId}::${timeframe}::${op}::${side}`;

const main = async (): Promise<void> => {
  const allUsers = await db.select({ id: users.id, email: users.email }).from(users);
  console.log(`Found ${allUsers.length} user(s).`);

  for (const user of allUsers) {
    await seedDefaultUserIndicators(user.id);

    const indicatorRows = await db
      .select({ id: userIndicators.id, label: userIndicators.label })
      .from(userIndicators)
      .where(eq(userIndicators.userId, user.id));
    const idByLabel = new Map(indicatorRows.map((r) => [r.label, r.id]));

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
    if (!defaultProfile) {
      console.log(`  [${user.email}] no profile — skipping`);
      continue;
    }

    const existing = parseChecklistConditions(defaultProfile.checklistConditions ?? '[]');
    const existingKeys = new Set(
      existing.map((c) => buildKey(c.userIndicatorId, c.timeframe, c.op, c.side)),
    );

    const additions: typeof existing = [];
    let nextOrder = existing.reduce((m, c) => Math.max(m, c.order), -1) + 1;

    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      const userIndicatorId = idByLabel.get(entry.seedLabel);
      if (!userIndicatorId) continue;
      const key = buildKey(userIndicatorId, entry.timeframe, entry.op, entry.side);
      if (existingKeys.has(key)) continue;
      additions.push({
        id: generateEntityId(),
        userIndicatorId,
        timeframe: entry.timeframe,
        op: entry.op,
        threshold: entry.threshold,
        tier: entry.tier,
        side: entry.side,
        enabled: entry.enabled,
        order: nextOrder++,
      });
    }

    if (additions.length === 0) {
      console.log(`  [${user.email}] already aligned (${existing.length} conditions)`);
      continue;
    }

    const merged = [...existing, ...additions];
    await db
      .update(tradingProfiles)
      .set({
        checklistConditions: stringifyChecklistConditions(merged),
        updatedAt: new Date(),
      })
      .where(eq(tradingProfiles.id, defaultProfile.id));

    console.log(
      `  [${user.email}] added ${additions.length} condition(s) to "${defaultProfile.name}" (now ${merged.length})`,
    );
  }

  console.log('Done.');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
