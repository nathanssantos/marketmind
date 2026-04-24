import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import { tradingProfiles, userIndicators, users } from '../../src/db/schema';
import { parseChecklistConditions } from '../../src/utils/profile-transformers';

const email = process.argv[2] ?? 'dev@marketmind.local';
const [user] = await db.select().from(users).where(eq(users.email, email));
if (!user) { console.log('user not found'); process.exit(1); }

const indicators = await db.select({ id: userIndicators.id, label: userIndicators.label }).from(userIndicators).where(eq(userIndicators.userId, user.id));
const labelById = new Map(indicators.map((r) => [r.id, r.label]));

const profiles = await db.select().from(tradingProfiles).where(eq(tradingProfiles.userId, user.id));
const def = profiles.find((p) => p.isDefault) ?? profiles[0];
if (!def) { console.log('no profile'); process.exit(1); }

const conds = parseChecklistConditions(def.checklistConditions ?? '[]');
console.log(`\nUser: ${email}  Profile: ${def.name}  Conditions: ${conds.length}\n`);
const rows = conds
  .map((c) => ({ label: labelById.get(c.userIndicatorId) ?? '?', tf: c.timeframe, op: c.op, side: c.side, weight: c.weight, tier: c.tier }))
  .sort((a, b) => {
    const tfOrder: Record<string, number> = { '15m': 1, '1h': 2, '4h': 3, '1d': 4, current: 0 };
    return (a.label.localeCompare(b.label)) || ((tfOrder[a.tf] ?? 99) - (tfOrder[b.tf] ?? 99)) || a.side.localeCompare(b.side);
  });

for (const r of rows) {
  console.log(`  ${r.label.padEnd(10)} ${r.tf.padEnd(5)} ${r.side.padEnd(6)} ${r.op.padEnd(12)} weight=${r.weight}  tier=${r.tier}`);
}
process.exit(0);
