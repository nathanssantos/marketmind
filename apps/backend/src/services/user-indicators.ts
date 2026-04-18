import { DEFAULT_USER_INDICATOR_SEEDS } from '@marketmind/trading-core';
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
