import { USDMClient } from 'binance';
import { guardedCall } from '../utils/binance-script-guard';

const client = new USDMClient({});

async function check() {
  const info = await guardedCall(() => client.getExchangeInfo());
  
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'PEPEUSDT', 'XRPUSDT', 'ADAUSDT'];
  
  console.log('=== MIN_NOTIONAL per Symbol (FUTURES) ===\n');
  
  for (const sym of symbols) {
    const symbolInfo = info.symbols.find(s => s.symbol === sym);
    if (symbolInfo) {
      const minNotional = symbolInfo.filters.find((f: { filterType: string }) => f.filterType === 'MIN_NOTIONAL') as { notional?: string } | undefined;
      console.log(`${sym}: minNotional = ${minNotional?.notional || 'N/A'} USDT`);
    }
  }
  
  const balance = 55;
  const leverage = 1;
  const positionSizePercent = 10;

  const capitalPerWatcher = (balance * leverage * positionSizePercent) / 100;
  const minAllowed = capitalPerWatcher / 1.1;

  console.log('\n=== Capital Calculation ===');
  console.log(`Balance: ${balance} USDT`);
  console.log(`Leverage: ${leverage}x`);
  console.log(`Position Size: ${positionSizePercent}%`);
  console.log(`Capital per watcher: ${capitalPerWatcher.toFixed(2)} USDT`);
  console.log(`Symbols with minNotional > ${minAllowed.toFixed(2)} USDT will be FILTERED`);
  
  console.log('\n=== Result ===');
  for (const sym of symbols) {
    const symbolInfo = info.symbols.find(s => s.symbol === sym);
    if (symbolInfo) {
      const minNotional = symbolInfo.filters.find((f: { filterType: string }) => f.filterType === 'MIN_NOTIONAL') as { notional?: string } | undefined;
      const notionalValue = parseFloat(minNotional?.notional || '0');
      const status = notionalValue * 1.1 > capitalPerWatcher ? '❌ FILTERED' : '✅ PASSES';
      console.log(`${sym}: ${status} (minNotional ${notionalValue} vs capital ${capitalPerWatcher.toFixed(2)})`);
    }
  }
}

check().catch(console.error);
