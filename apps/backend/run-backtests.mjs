#!/usr/bin/env node
import { execSync } from 'child_process';

const strategies = [
    'order-block-fvg',
    'liquidity-sweep',
    'divergence-rsi-macd',
    'larry-williams-9-1',
    'larry-williams-9-2',
    'larry-williams-9-3',
    'larry-williams-9-4',
    'connors-rsi2-original',
    'cumulative-rsi-r3',
    'double-seven',
    'mean-reversion-bb-rsi',
    'rsi2-mean-reversion',
    'ibs-mean-reversion',
    'donchian-breakout',
    'momentum-breakout-2025',
    'trend-pullback-2025',
];

console.log('Strategy                       | Trades | Win Rate | PnL %    | PF    | Max DD %');
console.log('--------------------------------------------------------------------------------');

for (const strategy of strategies) {
    try {
        const result = execSync(
            `npm run backtest:validate -- --strategy ${strategy} --symbol BTCUSDT --interval 1h --start 2024-01-01 --end 2024-12-31 2>&1`,
            { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        );

        const trades = result.match(/│ Total Trades\s+│\s+(\d+)/)?.[1] || '0';
        const winrate = result.match(/│ Win Rate\s+│\s+([+-]?\d+\.?\d*%)/)?.[1] || '0%';
        const pnl = result.match(/│ Total PnL %\s+│\s+([+-]?\d+\.?\d*%)/)?.[1] || '0%';
        const pf = result.match(/│ Profit Factor\s+│\s+(\d+\.?\d*)/)?.[1] || '0';
        const dd = result.match(/│ Max Drawdown %\s+│\s+([+-]?\d+\.?\d*%)/)?.[1] || '0%';

        console.log(
            `${strategy.padEnd(30)} | ${trades.padStart(6)} | ${winrate.padStart(8)} | ${pnl.padStart(8)} | ${pf.padStart(5)} | ${dd.padStart(8)}`
        );
    } catch (error) {
        console.log(`${strategy.padEnd(30)} | ERROR: ${error.message.split('\n')[0]}`);
    }
}
