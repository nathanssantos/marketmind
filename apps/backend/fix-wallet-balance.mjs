import { eq } from 'drizzle-orm';
import { db } from './src/db/index.js';
import { tradeExecutions, wallets } from './src/db/schema.js';

const paperWallet = await db.select().from(wallets).where(eq(wallets.walletType, 'paper')).limit(1);
if (paperWallet.length === 0) {
    console.log('No paper wallet found');
    process.exit(1);
}

const wallet = paperWallet[0];
console.log('📊 Carteira:', {
    id: wallet.id,
    name: wallet.name,
    currentBalance: wallet.currentBalance,
    initialBalance: wallet.initialBalance,
});

const allExecutions = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.walletId, wallet.id));

console.log('\n📈 Total de execuções:', allExecutions.length);

const openExecs = allExecutions.filter(e => e.status === 'open');
const closedExecs = allExecutions.filter(e => e.status === 'closed');

console.log('  🟢 Abertas:', openExecs.length);
console.log('  🔴 Fechadas:', closedExecs.length);

let totalPnl = 0;
console.log('\n💰 PnL por execução fechada:');
closedExecs.forEach(exec => {
    const pnl = parseFloat(exec.pnl || '0');
    totalPnl += pnl;
    const emoji = pnl >= 0 ? '✅' : '❌';
    console.log(`  ${emoji} ${exec.symbol} (${exec.side}): $${pnl.toFixed(2)}`);
});

const initialBalance = parseFloat(wallet.initialBalance || '0');
const expectedBalance = initialBalance + totalPnl;
const currentBalance = parseFloat(wallet.currentBalance || '0');

console.log('\n💵 Resumo:');
console.log(`  Saldo inicial: $${initialBalance.toFixed(2)}`);
console.log(`  PnL total: $${totalPnl.toFixed(2)}`);
console.log(`  Saldo esperado: $${expectedBalance.toFixed(2)}`);
console.log(`  Saldo atual: $${currentBalance.toFixed(2)}`);
console.log(`  Diferença: $${(expectedBalance - currentBalance).toFixed(2)}`);

if (Math.abs(expectedBalance - currentBalance) > 0.01) {
    console.log('\n⚠️  Saldo incorreto! Atualizando...');

    await db
        .update(wallets)
        .set({
            currentBalance: expectedBalance.toString(),
            totalPnl: totalPnl.toString(),
            updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));

    console.log(`✅ Saldo atualizado para $${expectedBalance.toFixed(2)}`);
} else {
    console.log('\n✅ Saldo correto!');
}

process.exit(0);
