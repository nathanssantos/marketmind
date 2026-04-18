import {
  DEFAULT_CHECKLIST_TEMPLATE,
  DEFAULT_USER_INDICATOR_SEEDS,
  type ChecklistCondition,
} from '@marketmind/trading-core';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { userIndicators } from '../db/schema';
import { generateEntityId } from '../utils/id';

export const seedDefaultUserIndicators = async (userId: string): Promise<void> => {
  const existing = await db
    .select({
      id: userIndicators.id,
      catalogType: userIndicators.catalogType,
      label: userIndicators.label,
      params: userIndicators.params,
      isCustom: userIndicators.isCustom,
    })
    .from(userIndicators)
    .where(eq(userIndicators.userId, userId));

  const existingByKey = new Map(existing.map((row) => [`${row.catalogType}::${row.label}`, row]));
  const now = new Date();

  const missing = DEFAULT_USER_INDICATOR_SEEDS.filter(
    (seed) => !existingByKey.has(`${seed.catalogType}::${seed.label}`),
  );
  if (missing.length > 0) {
    const rows = missing.map((seed) => ({
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
  }

  for (const seed of DEFAULT_USER_INDICATOR_SEEDS) {
    const row = existingByKey.get(`${seed.catalogType}::${seed.label}`);
    if (!row || row.isCustom) continue;
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(row.params) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
    let drift = false;
    for (const [key, value] of Object.entries(seed.params)) {
      if (parsed[key] !== value) {
        drift = true;
        break;
      }
    }
    if (!drift) continue;
    await db
      .update(userIndicators)
      .set({ params: JSON.stringify({ ...parsed, ...seed.params }), updatedAt: now })
      .where(and(eq(userIndicators.id, row.id), eq(userIndicators.isCustom, false)));
  }
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
