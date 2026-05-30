import { desc, eq } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { tradeExecutions } from './src/db/schema.js';

const lastBTC = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.symbol, 'BTCUSDT'))
    .orderBy(desc(tradeExecutions.closedAt))
    .limit(1);

if (lastBTC.length === 0) {
    console.log('No BTC execution found');
    process.exit(0);
}

const exec = lastBTC[0];
console.log('📊 Last closed BTC execution:');
console.log('ID:', exec.id);
console.log('Symbol:', exec.symbol);
console.log('Side:', exec.side);
console.log('Entry:', exec.entryPrice);
console.log('Exit:', exec.exitPrice);
console.log('Quantity:', exec.quantity);
console.log('PnL:', exec.pnl);
console.log('PnL %:', exec.pnlPercent);
console.log('Reason:', exec.exitReason);
console.log('Closed at:', exec.closedAt);

const entryPrice = parseFloat(exec.entryPrice);
const exitPrice = parseFloat(exec.exitPrice || '0');
const qty = parseFloat(exec.quantity);

console.log('\n💰 Expected calculation:');
const grossPnl = exec.side === 'LONG'
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;
console.log('Gross PnL (before fees):', grossPnl.toFixed(4));

const entryValue = entryPrice * qty;
const exitValue = exitPrice * qty;
const entryFee = entryValue * 0.001;
const exitFee = exitValue * 0.001;
const totalFees = entryFee + exitFee;
const netPnl = grossPnl - totalFees;

console.log('Entry value:', entryValue.toFixed(2));
console.log('Entry fee (0.1%):', entryFee.toFixed(4));
console.log('Exit value:', exitValue.toFixed(2));
console.log('Exit fee (0.1%):', exitFee.toFixed(4));
console.log('Total fees:', totalFees.toFixed(4));
console.log('Net PnL (after fees):', netPnl.toFixed(4));
console.log('\n⚠️ PnL recorded in DB:', exec.pnl);
console.log('❌ Difference (fees not deducted):', (parseFloat(exec.pnl || '0') - netPnl).toFixed(4));

process.exit(0);
