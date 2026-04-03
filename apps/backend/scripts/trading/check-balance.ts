import { db } from '../../src/db/index.js';
import { wallets } from '../../src/db/schema/index.js';
import { createBinanceFuturesClient, getAccountInfo, getPositions } from '../../src/services/binance-futures-client.js';

async function main() {
  const allWallets = await db.select().from(wallets);
  console.log('Wallets found:', allWallets.map(w => `${w.name} (${w.exchange}, type: ${w.type})`).join(', '));
  const wallet = allWallets[0];
  if (!wallet) {
    console.log('No Binance wallet found');
    process.exit(1);
  }

  const client = createBinanceFuturesClient(wallet);
  const info = await getAccountInfo(client);

  console.log('=== ACCOUNT INFO ===');
  console.log('Total Wallet Balance:', info.totalWalletBalance, 'USDT');
  console.log('Available Balance:', info.availableBalance, 'USDT');
  console.log('Total Margin Balance:', info.totalMarginBalance, 'USDT');
  console.log('Max Withdraw Amount:', info.maxWithdrawAmount, 'USDT');
  console.log('Total Initial Margin:', info.totalInitialMargin);
  console.log('Total Maint Margin:', info.totalMaintMargin);
  console.log('Total Unrealized PnL:', info.totalUnrealizedProfit);
  console.log('Can Withdraw:', info.canWithdraw);

  const marginRatio = parseFloat(info.totalMaintMargin) / parseFloat(info.totalMarginBalance) * 100;
  console.log('Margin Ratio:', marginRatio.toFixed(2) + '%');

  const usdtAsset = info.assets.find(a => a.asset === 'USDT');
  if (usdtAsset) {
    console.log('\n=== USDT DETAILS ===');
    console.log('Wallet Balance:', usdtAsset.walletBalance);
    console.log('Available Balance:', usdtAsset.availableBalance);
    console.log('Cross Wallet Balance:', usdtAsset.crossWalletBalance);
    console.log('Max Withdraw:', usdtAsset.maxWithdrawAmount);
  }

  const positions = await getPositions(client);
  if (positions.length > 0) {
    console.log('\n=== OPEN POSITIONS ===');
    for (const p of positions) {
      console.log(`${p.symbol}: ${p.positionAmt} @ entry ${p.entryPrice} | PnL: ${p.unrealizedPnl} | Margin: ${p.initialMargin} | Leverage: ${p.leverage}x`);
    }
  } else {
    console.log('\nNo open positions');
  }

  console.log('\n=== TRANSFER ANALYSIS ===');
  const available = parseFloat(info.availableBalance);
  const maxWithdraw = parseFloat(info.maxWithdrawAmount);
  console.log('Max Transferable:', maxWithdraw.toFixed(2), 'USDT');
  if (maxWithdraw <= 0) {
    console.log('REASON: Cannot transfer - margin + unrealized loss consume entire balance');
    console.log('  Wallet:', info.totalWalletBalance);
    console.log('  - Initial Margin:', info.totalInitialMargin);
    console.log('  - Unrealized PnL:', info.totalUnrealizedProfit);
    console.log('  = Available:', available.toFixed(2));
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
