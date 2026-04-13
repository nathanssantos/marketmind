import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { pairMaintenanceLog } from '../../db/schema';
import type { ActivePair } from './types';

export const shouldCheckGaps = async (pair: ActivePair, cooldownMs: number): Promise<boolean> => {
  const log = await db.query.pairMaintenanceLog.findFirst({
    where: and(
      eq(pairMaintenanceLog.symbol, pair.symbol),
      eq(pairMaintenanceLog.interval, pair.interval),
      eq(pairMaintenanceLog.marketType, pair.marketType)
    ),
  });

  if (!log?.lastGapCheck) return true;

  const elapsed = Date.now() - log.lastGapCheck.getTime();
  return elapsed >= cooldownMs;
};

export const shouldCheckCorruption = async (pair: ActivePair, cooldownMs: number): Promise<boolean> => {
  const log = await db.query.pairMaintenanceLog.findFirst({
    where: and(
      eq(pairMaintenanceLog.symbol, pair.symbol),
      eq(pairMaintenanceLog.interval, pair.interval),
      eq(pairMaintenanceLog.marketType, pair.marketType)
    ),
  });

  if (!log?.lastCorruptionCheck) return true;

  const elapsed = Date.now() - log.lastCorruptionCheck.getTime();
  return elapsed >= cooldownMs;
};

export const updateMaintenanceLog = async (
  pair: ActivePair,
  updates: { gapsFound?: number; corruptedFixed?: number; checkType: 'gap' | 'corruption' }
): Promise<void> => {
  const now = new Date();
  const setClause: Record<string, unknown> = { updatedAt: now };

  if (updates.checkType === 'gap') {
    setClause['lastGapCheck'] = now;
    if (updates.gapsFound !== undefined) {
      setClause['gapsFound'] = updates.gapsFound;
    }
  } else {
    setClause['lastCorruptionCheck'] = now;
    if (updates.corruptedFixed !== undefined) {
      setClause['corruptedFixed'] = updates.corruptedFixed;
    }
  }

  await db
    .insert(pairMaintenanceLog)
    .values({
      symbol: pair.symbol,
      interval: pair.interval,
      marketType: pair.marketType,
      lastGapCheck: updates.checkType === 'gap' ? now : undefined,
      lastCorruptionCheck: updates.checkType === 'corruption' ? now : undefined,
      gapsFound: updates.gapsFound ?? 0,
      corruptedFixed: updates.corruptedFixed ?? 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pairMaintenanceLog.symbol, pairMaintenanceLog.interval, pairMaintenanceLog.marketType],
      set: setClause,
    });
};
