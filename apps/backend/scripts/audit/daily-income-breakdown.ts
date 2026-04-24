import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '../../src/db';
import { incomeEvents, wallets } from '../../src/db/schema';

async function main() {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.marketType, 'FUTURES'));
  if (!wallet) { console.log('no wallet'); process.exit(0); }

  const since = new Date('2026-04-01T00:00:00.000Z');

  const rows = await db
    .select({
      day: sql<string>`TO_CHAR(${incomeEvents.incomeTime} AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`,
      incomeType: incomeEvents.incomeType,
      count: sql<string>`COUNT(*)`,
      total: sql<string>`COALESCE(SUM(${incomeEvents.amount}), 0)`,
    })
    .from(incomeEvents)
    .where(and(eq(incomeEvents.walletId, wallet.id), gte(incomeEvents.incomeTime, since)))
    .groupBy(sql`TO_CHAR(${incomeEvents.incomeTime} AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`, incomeEvents.incomeType)
    .orderBy(sql`1, 2`);

  const byDay = new Map<string, Record<string, { count: number; total: number }>>();
  for (const r of rows) {
    if (!byDay.has(r.day)) byDay.set(r.day, {});
    byDay.get(r.day)![r.incomeType] = { count: parseInt(r.count), total: parseFloat(r.total) };
  }

  console.log('\nDay        | REALIZED_PNL (n)       | COMMISSION (n)         | FUNDING_FEE (n)        | NET        | TOTAL_IF_NET_INCL_ALL');
  console.log('-----------|------------------------|------------------------|------------------------|------------|----------------------');
  const sortedDays = [...byDay.keys()].sort();
  for (const d of sortedDays) {
    const types = byDay.get(d)!;
    const r = types['REALIZED_PNL'];
    const c = types['COMMISSION'];
    const f = types['FUNDING_FEE'];
    const other = Object.entries(types).filter(([k]) => k !== 'REALIZED_PNL' && k !== 'COMMISSION' && k !== 'FUNDING_FEE');

    const netPnl = (r?.total ?? 0) + (c?.total ?? 0) + (f?.total ?? 0);
    const total = Object.values(types).reduce((s, v) => s + v.total, 0);

    const rs = `${(r?.total ?? 0).toFixed(2)} (${r?.count ?? 0})`;
    const cs = `${(c?.total ?? 0).toFixed(2)} (${c?.count ?? 0})`;
    const fs = `${(f?.total ?? 0).toFixed(2)} (${f?.count ?? 0})`;
    let extra = '';
    if (other.length > 0) extra = ' | extra: ' + other.map(([k, v]) => `${k}=${v.total.toFixed(2)}`).join(', ');
    console.log(`${d} | ${rs.padEnd(22)} | ${cs.padEnd(22)} | ${fs.padEnd(22)} | ${netPnl.toFixed(2).padStart(10)} | ${total.toFixed(2).padStart(10)}${extra}`);
  }

  console.log('\n--- interpretação ---');
  console.log('NET = REALIZED_PNL + COMMISSION + FUNDING_FEE (o que o calendário deveria mostrar)');
  console.log('TOTAL = soma de todos os tipos (inclui TRANSFER/COIN_SWAP se houver)');

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
