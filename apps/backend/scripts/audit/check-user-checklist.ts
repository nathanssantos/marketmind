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
  .map((c) => ({
    order: c.order,
    label: labelById.get(c.userIndicatorId) ?? '?',
    tf: c.timeframe,
    op: c.op,
    side: c.side,
    weight: c.weight,
    tier: c.tier,
    threshold: c.threshold,
  }))
  .sort((a, b) => a.order - b.order);

for (const r of rows) {
  const thr = r.threshold === undefined ? '—' : JSON.stringify(r.threshold);
  console.log(
    `  #${String(r.order).padStart(2)}  ${r.label.padEnd(10)} ${r.tf.padEnd(3)} ${r.side.padEnd(6)} ${r.op.padEnd(12)} weight=${String(r.weight).padEnd(4)} threshold=${thr}`,
  );
}
process.exit(0);
