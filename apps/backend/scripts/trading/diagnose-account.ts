import { db } from '../src/db';
import { wallets } from '../src/db/schema';
import { getWalletType } from '../src/services/binance-client';
import { createBinanceFuturesClient, getAccountInfo, getPositions } from '../src/services/binance-futures-client';
import { guardedCall } from '../utils/binance-script-guard';

async function diagnoseAccount() {
  console.log('🔍 MarketMind Account Diagnostics\n');
  console.log('='.repeat(60));

  const allWallets = await db.select().from(wallets);
  
  if (allWallets.length === 0) {
    console.log('❌ No wallets found in database');
    return;
  }

  console.log(`\n📁 Found ${allWallets.length} wallet(s)\n`);

  for (const wallet of allWallets) {
    console.log('='.repeat(60));
    console.log(`\n🔑 Wallet: ${wallet.name} (ID: ${wallet.id})`);
    console.log(`   Exchange: ${wallet.exchange}`);
    
    const walletType = getWalletType(wallet);
    console.log(`   Type: ${walletType}`);
    
    if (walletType === 'paper') {
      console.log('   ⚠️  Paper wallet - cannot execute real trades');
      continue;
    }

    try {
      const client = createBinanceFuturesClient(wallet);
      
      console.log('\n📊 Fetching account information...\n');
      const accountInfo = await guardedCall(() => getAccountInfo(client));

      console.log('✅ API Connection: SUCCESS\n');
      
      console.log('📋 Account Permissions:');
      console.log(`   Can Trade: ${accountInfo.canTrade ? '✅ YES' : '❌ NO'}`);
      console.log(`   Can Deposit: ${accountInfo.canDeposit ? '✅ YES' : '❌ NO'}`);
      console.log(`   Can Withdraw: ${accountInfo.canWithdraw ? '✅ YES' : '❌ NO'}`);
      console.log(`   Fee Tier: ${accountInfo.feeTier}`);

      console.log('\n💰 Balances:');
      console.log(`   Total Wallet Balance: ${accountInfo.totalWalletBalance} USDT`);
      console.log(`   Available Balance: ${accountInfo.availableBalance} USDT`);
      console.log(`   Total Margin Balance: ${accountInfo.totalMarginBalance} USDT`);
      console.log(`   Max Withdraw Amount: ${accountInfo.maxWithdrawAmount} USDT`);

      console.log('\n📈 Margin Info:');
      console.log(`   Total Initial Margin: ${accountInfo.totalInitialMargin}`);
      console.log(`   Total Maint Margin: ${accountInfo.totalMaintMargin}`);
      console.log(`   Total Cross Wallet Balance: ${accountInfo.totalCrossWalletBalance}`);
      console.log(`   Total Unrealized PnL: ${accountInfo.totalUnrealizedProfit}`);

      const usdtAsset = accountInfo.assets.find(a => a.asset === 'USDT');
      if (usdtAsset) {
        console.log('\n💵 USDT Asset Details:');
        console.log(`   Wallet Balance: ${usdtAsset.walletBalance}`);
        console.log(`   Available Balance: ${usdtAsset.availableBalance}`);
        console.log(`   Cross Wallet Balance: ${usdtAsset.crossWalletBalance}`);
        console.log(`   Margin Available: ${usdtAsset.marginAvailable ? '✅ YES' : '❌ NO'}`);
      }

      console.log('\n📊 Open Positions:');
      const positions = await guardedCall(() => getPositions(client));
      if (positions.length === 0) {
        console.log('   No open positions');
      } else {
        for (const pos of positions) {
          console.log(`   ${pos.symbol}: ${pos.positionAmt} @ ${pos.entryPrice} (PnL: ${pos.unrealizedPnl})`);
        }
      }

      console.log('\n🔧 Trading Requirements Check:');
      
      const availableBalance = parseFloat(accountInfo.availableBalance);
      const minTradeValue = 5;
      
      if (!accountInfo.canTrade) {
        console.log('   ❌ CRITICAL: Trading is DISABLED on this account');
        console.log('      → Check API key permissions in Binance');
        console.log('      → Ensure "Enable Futures" is checked');
      } else {
        console.log('   ✅ Trading is enabled');
      }

      if (availableBalance < minTradeValue) {
        console.log(`   ❌ CRITICAL: Insufficient balance (${availableBalance} USDT)`);
        console.log(`      → Minimum ~5 USDT required for most trades`);
        console.log('      → Transfer funds to USDⓈ-M Futures account');
      } else {
        console.log(`   ✅ Sufficient balance: ${availableBalance} USDT`);
      }

      console.log('\n🔐 API Key Check:');
      console.log('   ✅ API Key is valid and working');
      console.log(`   ✅ Connected to: ${walletType === 'testnet' ? 'TESTNET' : 'MAINNET'}`);

    } catch (error: unknown) {
      console.log('\n❌ API Connection: FAILED\n');
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   Error: ${errorMessage}`);
      
      if (errorMessage.includes('Invalid API-key')) {
        console.log('\n   🔧 Solution: Check your API key in Binance');
        console.log('      1. Go to Binance → API Management');
        console.log('      2. Verify the API key is correct');
        console.log('      3. Check IP restrictions');
      } else if (errorMessage.includes('Signature')) {
        console.log('\n   🔧 Solution: API Secret is incorrect');
        console.log('      1. Re-enter your API Secret');
        console.log('      2. Make sure no extra spaces');
      } else if (errorMessage.includes('IP')) {
        console.log('\n   🔧 Solution: IP not whitelisted');
        console.log('      1. Go to Binance → API Management');
        console.log('      2. Add your current IP to whitelist');
        console.log('      3. Or enable "Unrestricted" (less secure)');
      } else if (errorMessage.includes('timestamp')) {
        console.log('\n   🔧 Solution: Time sync issue');
        console.log('      1. Sync your system clock');
        console.log('      2. The request timestamp was too old');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Diagnostics complete\n');
}

diagnoseAccount()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
