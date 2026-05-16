import {
  DEFAULT_CONFLUENCE_TEMPLATE,
  DEFAULT_USER_INDICATOR_SEEDS,
  type ConfluenceCondition,
} from '@marketmind/trading-core';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { tradingProfiles, userIndicators } from '../db/schema';
import type { NewTradingProfileRow } from '../db/schema';
import { DEFAULT_ENABLED_SETUPS } from '../constants';
import { generateEntityId } from '../utils/id';
import {
  parseIndicatorParams,
  stringifyConfluenceConditions,
  stringifyEnabledSetupTypes,
  stringifyIndicatorParams,
} from '../utils/profile-transformers';

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
      params: stringifyIndicatorParams(seed.params),
      isCustom: false,
      createdAt: now,
      updatedAt: now,
    }));
    await db.insert(userIndicators).values(rows);
  }

  for (const seed of DEFAULT_USER_INDICATOR_SEEDS) {
    const row = existingByKey.get(`${seed.catalogType}::${seed.label}`);
    if (!row || row.isCustom) continue;
    const parsed = parseIndicatorParams(row.params);
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
      .set({ params: stringifyIndicatorParams({ ...parsed, ...seed.params }), updatedAt: now })
      .where(and(eq(userIndicators.id, row.id), eq(userIndicators.isCustom, false)));
  }
};

export const materializeDefaultConfluence = async (userId: string): Promise<ConfluenceCondition[]> => {
  await seedDefaultUserIndicators(userId);

  const rows = await db
    .select({ id: userIndicators.id, label: userIndicators.label })
    .from(userIndicators)
    .where(eq(userIndicators.userId, userId));

  const byLabel = new Map(rows.map((r) => [r.label, r.id]));

  const conditions: ConfluenceCondition[] = [];
  for (const entry of DEFAULT_CONFLUENCE_TEMPLATE) {
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
      weight: entry.weight,
      enabled: entry.enabled,
      order: entry.order,
    });
  }

  return conditions;
};

/**
 * Backfill the default confluence template into every profile the user
 * already has. Existing entries are PRESERVED (with whatever
 * customizations the user made — weight, enabled, threshold, tier);
 * only entries missing from a given profile's confluence are appended.
 *
 * The match key is `userIndicatorId + timeframe + op + side` — the
 * tuple that uniquely identifies a row in the confluence UI. Adding
 * new timeframes to `DEFAULT_CONFLUENCE_TEMPLATE` (e.g. the v1.22.8
 * 1w / 1M extension for RSI 2 + Stoch 14) makes those rows appear
 * on the next call without resetting the rest of the user's confluence.
 *
 * Called from `tradingProfilesRouter.list` so the reconciliation runs
 * each time the user opens the trading config — idempotent, cheap
 * (one SELECT + at most one UPDATE per profile), and lets template
 * extensions land automatically for existing users.
 */
export const reconcileUserProfilesConfluence = async (userId: string): Promise<void> => {
  const profiles = await db
    .select({ id: tradingProfiles.id, confluenceConditions: tradingProfiles.confluenceConditions })
    .from(tradingProfiles)
    .where(eq(tradingProfiles.userId, userId));
  if (profiles.length === 0) return;

  // Materialize once per user — the userIndicator rows are shared across
  // all that user's profiles. Lazy-seeds the user-indicator rows for
  // any indicator added to DEFAULT_USER_INDICATOR_SEEDS too.
  const defaultConfluence = await materializeDefaultConfluence(userId);
  if (defaultConfluence.length === 0) return;

  const now = new Date();
  for (const profile of profiles) {
    let existing: ConfluenceCondition[];
    try {
      existing = JSON.parse(profile.confluenceConditions) as ConfluenceCondition[];
    } catch {
      existing = [];
    }
    const key = (c: { userIndicatorId: string; timeframe: string; op: string; side: string }): string =>
      `${c.userIndicatorId}::${c.timeframe}::${c.op}::${c.side}`;
    const seen = new Set(existing.map(key));
    const missing = defaultConfluence.filter((d) => !seen.has(key(d)));
    if (missing.length === 0) continue;
    // Re-number `order` so the appended entries continue the sequence.
    const maxOrder = existing.reduce((m, c) => Math.max(m, c.order ?? 0), -1);
    const appended = missing.map((m, i) => ({ ...m, order: maxOrder + 1 + i }));
    const next = [...existing, ...appended];
    await db
      .update(tradingProfiles)
      .set({ confluenceConditions: stringifyConfluenceConditions(next), updatedAt: now })
      .where(eq(tradingProfiles.id, profile.id));
  }
};

export const seedDefaultTradingProfile = async (userId: string): Promise<void> => {
  const existing = await db
    .select({ id: tradingProfiles.id })
    .from(tradingProfiles)
    .where(eq(tradingProfiles.userId, userId))
    .limit(1);

  if (existing.length > 0) return;

  const confluence = await materializeDefaultConfluence(userId);

  const values: NewTradingProfileRow = {
    id: generateEntityId(),
    userId,
    name: 'Default Profile',
    description: 'Auto-generated default profile with standard confluence',
    enabledSetupTypes: stringifyEnabledSetupTypes([...DEFAULT_ENABLED_SETUPS]),
    isDefault: true,
    confluenceConditions: stringifyConfluenceConditions(confluence),
  };

  await db.insert(tradingProfiles).values(values);
};
