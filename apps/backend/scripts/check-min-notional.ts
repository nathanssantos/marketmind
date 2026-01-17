import { USDMClient } from 'binance';

const client = new USDMClient({});

async function check() {
  const info = await client.getExchangeInfo();
  
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'PEPEUSDT', 'XRPUSDT', 'ADAUSDT'];
  
  console.log('=== MIN_NOTIONAL por Símbolo (FUTURES) ===\n');
  
  for (const sym of symbols) {
    const symbolInfo = info.symbols.find(s => s.symbol === sym);
    if (symbolInfo) {
      const minNotional = symbolInfo.filters.find((f: { filterType: string }) => f.filterType === 'MIN_NOTIONAL') as { notional?: string } | undefined;
      console.log(`${sym}: minNotional = ${minNotional?.notional || 'N/A'} USDT`);
    }
  }
  
  const balance = 55;
  const leverage = 1;
  const exposureMultiplier = 1.5;
  const watcherCount = 12;
  
  const exposurePerWatcher = Math.min((100 * exposureMultiplier) / watcherCount, 100);
  const capitalPerWatcher = (balance * leverage * exposurePerWatcher) / 100;
  const minAllowed = capitalPerWatcher / 1.1;
  
  console.log('\n=== Cálculo de Capital ===');
  console.log(`Balance: ${balance} USDT`);
  console.log(`Leverage: ${leverage}x`);
  console.log(`Exposure Multiplier: ${exposureMultiplier}`);
  console.log(`Watchers: ${watcherCount}`);
  console.log(`Exposure per watcher: ${exposurePerWatcher.toFixed(2)}%`);
  console.log(`Capital per watcher: ${capitalPerWatcher.toFixed(2)} USDT`);
  console.log(`Símbolos com minNotional > ${minAllowed.toFixed(2)} USDT serão FILTRADOS`);
  
  console.log('\n=== Resultado ===');
  for (const sym of symbols) {
    const symbolInfo = info.symbols.find(s => s.symbol === sym);
    if (symbolInfo) {
      const minNotional = symbolInfo.filters.find((f: { filterType: string }) => f.filterType === 'MIN_NOTIONAL') as { notional?: string } | undefined;
      const notionalValue = parseFloat(minNotional?.notional || '0');
      const status = notionalValue * 1.1 > capitalPerWatcher ? '❌ FILTRADO' : '✅ PASSA';
      console.log(`${sym}: ${status} (minNotional ${notionalValue} vs capital ${capitalPerWatcher.toFixed(2)})`);
    }
  }
}

check().catch(console.error);
