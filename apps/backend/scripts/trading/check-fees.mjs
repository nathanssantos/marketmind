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
    console.log('Nenhuma execução BTC encontrada');
    process.exit(0);
}

const exec = lastBTC[0];
console.log('📊 Última execução BTC fechada:');
console.log('ID:', exec.id);
console.log('Símbolo:', exec.symbol);
console.log('Lado:', exec.side);
console.log('Entrada:', exec.entryPrice);
console.log('Saída:', exec.exitPrice);
console.log('Quantidade:', exec.quantity);
console.log('PnL:', exec.pnl);
console.log('PnL %:', exec.pnlPercent);
console.log('Razão:', exec.exitReason);
console.log('Fechado em:', exec.closedAt);

const entryPrice = parseFloat(exec.entryPrice);
const exitPrice = parseFloat(exec.exitPrice || '0');
const qty = parseFloat(exec.quantity);

console.log('\n💰 Cálculo esperado:');
const grossPnl = exec.side === 'LONG'
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;
console.log('PnL bruto (sem taxas):', grossPnl.toFixed(4));

const entryValue = entryPrice * qty;
const exitValue = exitPrice * qty;
const entryFee = entryValue * 0.001;
const exitFee = exitValue * 0.001;
const totalFees = entryFee + exitFee;
const netPnl = grossPnl - totalFees;

console.log('Valor entrada:', entryValue.toFixed(2));
console.log('Taxa entrada (0.1%):', entryFee.toFixed(4));
console.log('Valor saída:', exitValue.toFixed(2));
console.log('Taxa saída (0.1%):', exitFee.toFixed(4));
console.log('Total taxas:', totalFees.toFixed(4));
console.log('PnL líquido (com taxas):', netPnl.toFixed(4));
console.log('\n⚠️ PnL registrado no banco:', exec.pnl);
console.log('❌ Diferença (taxas não descontadas):', (parseFloat(exec.pnl || '0') - netPnl).toFixed(4));

process.exit(0);
