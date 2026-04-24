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
  const args = process.argv.slice(2);
  const prune = args.includes('--prune');
  const emailFilter = args.find((a) => !a.startsWith('--'));

  const baseQuery = db.select({ id: users.id, email: users.email }).from(users);
  const allUsers = emailFilter
    ? await baseQuery.where(eq(users.email, emailFilter))
    : await baseQuery;
  console.log(
    emailFilter
      ? `Filtering to email: ${emailFilter} — ${allUsers.length} match(es).`
      : `Found ${allUsers.length} user(s).`,
  );
  if (prune) console.log('Prune mode: legacy (non-template) conditions will be removed.');

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
    const existingByKey = new Map(
      existing.map((c) => [buildKey(c.userIndicatorId, c.timeframe, c.op, c.side), c]),
    );

    const templateKeys = new Set<string>();
    const templateOrder = new Map<string, number>();
    const additions: typeof existing = [];
    let updated = 0;
    let reordered = 0;

    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      const userIndicatorId = idByLabel.get(entry.seedLabel);
      if (!userIndicatorId) continue;
      const key = buildKey(userIndicatorId, entry.timeframe, entry.op, entry.side);
      templateKeys.add(key);
      templateOrder.set(key, entry.order);

      const current = existingByKey.get(key);
      if (!current) {
        additions.push({
          id: generateEntityId(),
          userIndicatorId,
          timeframe: entry.timeframe,
          op: entry.op,
          threshold: entry.threshold,
          tier: entry.tier,
          side: entry.side,
          weight: entry.weight,
          enabled: entry.enabled,
          order: entry.order,
        });
        continue;
      }

      const thresholdChanged = JSON.stringify(current.threshold ?? null) !== JSON.stringify(entry.threshold ?? null);
      if (current.tier !== entry.tier || current.weight !== entry.weight || thresholdChanged) {
        current.tier = entry.tier;
        current.weight = entry.weight;
        current.threshold = entry.threshold;
        updated++;
      }
      if (current.order !== entry.order) reordered++;
    }

    const kept = prune
      ? existing.filter((c) =>
          templateKeys.has(buildKey(c.userIndicatorId, c.timeframe, c.op, c.side)),
        )
      : existing;
    const pruned = existing.length - kept.length;

    if (additions.length === 0 && updated === 0 && pruned === 0 && reordered === 0) {
      console.log(`  [${user.email}] already aligned (${existing.length} conditions)`);
      continue;
    }

    // Reorder: template entries get their canonical template.order, non-template
    // entries (kept when --prune is off) go after, appended in their existing order.
    const templateMax = DEFAULT_CHECKLIST_TEMPLATE.length;
    const withOrder = [...kept, ...additions].map((c) => {
      const tplOrder = templateOrder.get(buildKey(c.userIndicatorId, c.timeframe, c.op, c.side));
      return { ...c, order: tplOrder ?? templateMax + c.order };
    });
    const merged = withOrder
      .sort((a, b) => a.order - b.order)
      .map((c, idx) => ({ ...c, order: idx }));
    await db
      .update(tradingProfiles)
      .set({
        checklistConditions: stringifyChecklistConditions(merged),
        updatedAt: new Date(),
      })
      .where(eq(tradingProfiles.id, defaultProfile.id));

    console.log(
      `  [${user.email}] profile "${defaultProfile.name}": +${additions.length} added, ${updated} tier/weight/threshold updated, ${reordered} reordered, ${pruned} pruned (total ${merged.length})`,
    );
  }

  console.log('Done.');
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
