import { BUILTIN_PATTERNS, type PatternDefinition } from '@marketmind/trading-core';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { userPatterns } from '../db/schema';
import { generateEntityId } from '../utils/id';

/**
 * Idempotent seed: ensures every default pattern from BUILTIN_PATTERNS exists
 * for the user, marked is_custom=false. Existing user-customized patterns
 * (is_custom=true) are never touched. Existing built-ins keep the user's
 * tweaked params — we don't overwrite once seeded.
 *
 * Mirrors the seedDefaultUserIndicators pattern. Called from auth.ts on
 * register and via the userPatterns.reset mutation.
 */
export const seedDefaultUserPatterns = async (userId: string): Promise<void> => {
  const existing = await db
    .select({ id: userPatterns.id, patternId: userPatterns.patternId, isCustom: userPatterns.isCustom })
    .from(userPatterns)
    .where(eq(userPatterns.userId, userId));

  const existingByPatternId = new Set(existing.map((row) => row.patternId));
  const now = new Date();

  const missing = BUILTIN_PATTERNS.filter((p) => !existingByPatternId.has(p.id));
  if (missing.length === 0) return;

  const rows = missing.map((p: PatternDefinition) => ({
    id: generateEntityId(),
    userId,
    patternId: p.id,
    label: p.label,
    definition: JSON.stringify(p),
    isCustom: false,
    createdAt: now,
    updatedAt: now,
  }));

  await db.insert(userPatterns).values(rows);
};
