import {
  DEFAULT_CHECKLIST_TEMPLATE,
  DEFAULT_USER_INDICATOR_SEEDS,
  type ChecklistCondition,
} from '@marketmind/trading-core';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { userIndicators } from '../db/schema';
import { generateEntityId } from '../utils/id';

export const seedDefaultUserIndicators = async (userId: string): Promise<void> => {
  const existing = await db
    .select({ id: userIndicators.id })
    .from(userIndicators)
    .where(eq(userIndicators.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  const now = new Date();
  const rows = DEFAULT_USER_INDICATOR_SEEDS.map((seed) => ({
    id: generateEntityId(),
    userId,
    catalogType: seed.catalogType,
    label: seed.label,
    params: JSON.stringify(seed.params),
    isCustom: false,
    createdAt: now,
    updatedAt: now,
  }));

  await db.insert(userIndicators).values(rows);
};

export const materializeDefaultChecklist = async (userId: string): Promise<ChecklistCondition[]> => {
  await seedDefaultUserIndicators(userId);

  const rows = await db
    .select({ id: userIndicators.id, label: userIndicators.label })
    .from(userIndicators)
    .where(eq(userIndicators.userId, userId));

  const byLabel = new Map(rows.map((r) => [r.label, r.id]));

  const conditions: ChecklistCondition[] = [];
  for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
    const userIndicatorId = byLabel.get(entry.seedLabel);
    if (!userIndicatorId) continue;
    conditions.push({
      id: generateEntityId(),
      userIndicatorId,
      timeframe: entry.timeframe,
      op: entry.op,
      threshold: entry.threshold,
      tier: entry.tier,
      side: entry.side,
      enabled: entry.enabled,
      order: entry.order,
    });
  }

  return conditions;
};
