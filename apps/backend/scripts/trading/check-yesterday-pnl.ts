import { db } from '../../src/db';
import { tradeExecutions } from '../../src/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';

const start = new Date('2026-03-11T00:00:00Z');
const end = new Date('2026-03-12T00:00:00Z');

const trades = await db.select({
  id: tradeExecutions.id,
  symbol: tradeExecutions.symbol,
  pnl: tradeExecutions.pnl,
  fees: tradeExecutions.fees,
  exitPrice: tradeExecutions.exitPrice,
  accumulatedFunding: tradeExecutions.accumulatedFunding,
}).from(tradeExecutions)
  .where(
    and(
      eq(tradeExecutions.status, 'closed'),
      gte(tradeExecutions.closedAt, start),
      lt(tradeExecutions.closedAt, end)
    )
  );

let totalWithBad = 0;
let totalWithoutBad = 0;
let totalFees = 0;
let totalFunding = 0;
const badIds: string[] = [];

for (const t of trades) {
  const pnl = parseFloat(t.pnl || '0');
  const fees = parseFloat(t.fees || '0');
  const funding = parseFloat(t.accumulatedFunding || '0');
  totalWithBad += pnl;

  const hasNoExit = t.exitPrice === null || t.exitPrice === undefined;
  if (hasNoExit && Math.abs(pnl) > 100) {
    badIds.push(t.id);
    console.log(`BAD: ${t.id} ${t.symbol} pnl=${pnl.toFixed(4)} exitPrice=null`);
  } else {
    totalWithoutBad += pnl;
    totalFees += fees;
    totalFunding += funding;
  }
}

console.log('');
console.log(`Total with bad trades: PnL=${totalWithBad.toFixed(4)}`);
console.log(`Total WITHOUT bad trades: PnL=${totalWithoutBad.toFixed(4)}`);
console.log(`Fees (excluding bad)=${totalFees.toFixed(4)} Funding=${totalFunding.toFixed(4)}`);
console.log(`Net (PnL - Fees + Funding) = ${(totalWithoutBad - totalFees + totalFunding).toFixed(4)}`);
console.log(`Bad IDs: ${JSON.stringify(badIds)}`);

process.exit(0);
