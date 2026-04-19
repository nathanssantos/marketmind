import 'dotenv/config';
import { sanitizeIndicatorParams } from '@marketmind/trading-core';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { userIndicators } from '../../src/db/schema';

const LEGACY_KEY_REMAP: Record<string, Record<string, string>> = {
  stoch: { kPeriod: 'period', kSmoothing: 'smoothK', dPeriod: 'smoothD' },
  stochRsi: { kSmooth: 'kPeriod', dSmooth: 'dPeriod' },
  ichimoku: { senkouBPeriod: 'senkouPeriod' },
  keltner: { emaPeriod: 'period' },
};

const remapKeys = (catalogType: string, params: Record<string, unknown>): Record<string, unknown> => {
  const remap = LEGACY_KEY_REMAP[catalogType];
  if (!remap) return params;
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    const canonical = remap[k] ?? k;
    if (next[canonical] === undefined) next[canonical] = v;
  }
  return next;
};

const main = async () => {
  console.log('Starting indicator params migration...\n');

  const rows = await db.select().from(userIndicators);
  console.log(`Found ${rows.length} userIndicators row(s).\n`);

  let migrated = 0;
  let unchanged = 0;

  for (const row of rows) {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(row.params);
    } catch {
      console.log(`  [SKIP] ${row.id} (${row.catalogType}): invalid JSON`);
      continue;
    }

    const remapped = remapKeys(row.catalogType, raw);
    const { params: sanitized, errors } = sanitizeIndicatorParams(row.catalogType, remapped);

    if (errors.length > 0) {
      const blocking = errors.filter((e) => !e.message.startsWith('Unknown param'));
      if (blocking.length > 0) {
        console.log(`  [WARN] ${row.id} (${row.catalogType}): ${blocking.map((e) => e.message).join('; ')}`);
      }
    }

    const before = JSON.stringify(raw);
    const after = JSON.stringify(sanitized);
    if (before === after) {
      unchanged += 1;
      continue;
    }

    await db
      .update(userIndicators)
      .set({ params: after, updatedAt: new Date() })
      .where(eq(userIndicators.id, row.id));

    migrated += 1;
    console.log(`  [MIGRATE] ${row.id} (${row.catalogType})\n    before: ${before}\n    after:  ${after}`);
  }

  console.log(`\nDone. migrated=${migrated} unchanged=${unchanged} total=${rows.length}`);
  process.exit(0);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
