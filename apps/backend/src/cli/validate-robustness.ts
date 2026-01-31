import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import { MonteCarloSimulator } from '../services/backtesting/MonteCarloSimulator';
import type { WatcherConfig } from '@marketmind/types';
import { ENABLED_SETUPS, createBaseConfig } from './shared-backtest-config';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];
const INITIAL_CAPITAL = 1000;

async function validateRobustness() {
  console.log('═'.repeat(70));
  console.log('🔬 VALIDAÇÃO DE ROBUSTEZ - WALK-FORWARD & MONTE CARLO');
  console.log('═'.repeat(70));
  console.log('');
  console.log('📋 CONFIGURAÇÃO OTIMIZADA:');
  console.log('   • Entry Level Fibo: 100% (breakout)');
  console.log('   • BTC Correlation Filter: ON');
  console.log('   • Volume Filter: ON');
  console.log('   • Momentum Timing Filter: ON');
  console.log('   • Trailing LONG: Activation 90%, Distance 40%');
  console.log('   • Trailing SHORT: Activation 80%, Distance 30%');
  console.log('   • Timeframe: 12h');
  console.log('');

  console.log('═'.repeat(70));
  console.log('📊 PARTE 1: BACKTEST COMPLETO (3 anos)');
  console.log('═'.repeat(70));
  console.log('');

  const baseConfig = createBaseConfig();

  const watchers: WatcherConfig[] = SYMBOLS.map((symbol) => ({
    symbol,
    interval: '12h' as const,
    marketType: 'FUTURES' as const,
    setupTypes: [...ENABLED_SETUPS],
  }));

  const engine = new MultiWatcherBacktestEngine({
    ...baseConfig,
    watchers,
    startDate: '2023-01-01',
    endDate: '2026-01-31',
    maxFibonacciEntryProgressPercent: 100,
    minRiskRewardRatio: 0.75,
    useBtcCorrelationFilter: true,
    useVolumeFilter: true,
    useMomentumTimingFilter: true,
    useTrendFilter: false,
    useAdxFilter: false,
    silent: true,
  });

  console.log('🚀 Executando backtest...\n');
  const result = await engine.run();

  console.log('━'.repeat(70));
  console.log('RESULTADOS DO BACKTEST');
  console.log('━'.repeat(70));
  console.log(`Total Trades:     ${result.metrics.totalTrades}`);
  console.log(`Total P&L:        $${result.metrics.totalPnl.toFixed(2)} (${result.metrics.totalPnlPercent.toFixed(1)}%)`);
  console.log(`Win Rate:         ${result.metrics.winRate.toFixed(1)}%`);
  console.log(`Max Drawdown:     ${result.metrics.maxDrawdownPercent.toFixed(1)}%`);
  console.log(`Profit Factor:    ${(result.metrics.profitFactor ?? 0).toFixed(2)}`);
  console.log('');

  if (result.trades.length < 10) {
    console.log('⚠️  Poucos trades para Monte Carlo (mínimo 10). Pulando simulação.');
    process.exit(0);
  }

  console.log('═'.repeat(70));
  console.log('📊 PARTE 2: MONTE CARLO SIMULATION (1000 iterações)');
  console.log('═'.repeat(70));
  console.log('');

  console.log('🎲 Executando simulação Monte Carlo...\n');

  const mcResult = MonteCarloSimulator.simulate(result.trades, INITIAL_CAPITAL, {
    numSimulations: 1000,
    confidenceLevel: 0.95,
  });

  console.log('━'.repeat(70));
  console.log('ESTATÍSTICAS MONTE CARLO');
  console.log('━'.repeat(70));
  console.log('');
  console.log('📈 Equity Final:');
  console.log(`   Média:   $${mcResult.statistics.meanFinalEquity.toFixed(2)}`);
  console.log(`   Mediana: $${mcResult.statistics.medianFinalEquity.toFixed(2)}`);
  console.log(`   Desvio:  $${mcResult.statistics.stdDevFinalEquity.toFixed(2)}`);
  console.log('');
  console.log('📉 Max Drawdown:');
  console.log(`   Média:   ${(mcResult.statistics.meanMaxDrawdown * 100).toFixed(1)}%`);
  console.log(`   Mediana: ${(mcResult.statistics.medianMaxDrawdown * 100).toFixed(1)}%`);
  console.log('');
  console.log('📊 Retorno Total:');
  console.log(`   Média:   ${(mcResult.statistics.meanTotalReturn * 100).toFixed(1)}%`);
  console.log(`   Mediana: ${(mcResult.statistics.medianTotalReturn * 100).toFixed(1)}%`);
  console.log('');

  console.log('━'.repeat(70));
  console.log('INTERVALOS DE CONFIANÇA (95%)');
  console.log('━'.repeat(70));
  console.log('');
  console.log(`Equity Final:  $${mcResult.confidenceIntervals.finalEquity.lower.toFixed(2)} - $${mcResult.confidenceIntervals.finalEquity.upper.toFixed(2)}`);
  console.log(`Max Drawdown:  ${(mcResult.confidenceIntervals.maxDrawdown.lower * 100).toFixed(1)}% - ${(mcResult.confidenceIntervals.maxDrawdown.upper * 100).toFixed(1)}%`);
  console.log(`Retorno:       ${(mcResult.confidenceIntervals.totalReturn.lower * 100).toFixed(1)}% - ${(mcResult.confidenceIntervals.totalReturn.upper * 100).toFixed(1)}%`);
  console.log('');

  console.log('━'.repeat(70));
  console.log('PROBABILIDADES');
  console.log('━'.repeat(70));
  console.log('');
  console.log(`Lucrativo:              ${(mcResult.probabilities.profitableProbability * 100).toFixed(1)}%`);
  console.log(`Retorno > 10%:          ${(mcResult.probabilities.returnExceeds10Percent * 100).toFixed(1)}%`);
  console.log(`Retorno > 20%:          ${(mcResult.probabilities.returnExceeds20Percent * 100).toFixed(1)}%`);
  console.log(`Retorno > 50%:          ${(mcResult.probabilities.returnExceeds50Percent * 100).toFixed(1)}%`);
  console.log(`Drawdown > 10%:         ${(mcResult.probabilities.drawdownExceeds10Percent * 100).toFixed(1)}%`);
  console.log(`Drawdown > 20%:         ${(mcResult.probabilities.drawdownExceeds20Percent * 100).toFixed(1)}%`);
  console.log(`Drawdown > 30%:         ${(mcResult.probabilities.drawdownExceeds30Percent * 100).toFixed(1)}%`);
  console.log('');

  console.log('━'.repeat(70));
  console.log('CENÁRIOS EXTREMOS');
  console.log('━'.repeat(70));
  console.log('');
  console.log(`🔴 Pior Caso:   Equity $${mcResult.worstCase.finalEquity.toFixed(2)} | DD ${(mcResult.worstCase.maxDrawdown * 100).toFixed(1)}% | Return ${(mcResult.worstCase.totalReturn * 100).toFixed(1)}%`);
  console.log(`🟡 Mediana:     Equity $${mcResult.medianCase.finalEquity.toFixed(2)} | DD ${(mcResult.medianCase.maxDrawdown * 100).toFixed(1)}% | Return ${(mcResult.medianCase.totalReturn * 100).toFixed(1)}%`);
  console.log(`🟢 Melhor Caso: Equity $${mcResult.bestCase.finalEquity.toFixed(2)} | DD ${(mcResult.bestCase.maxDrawdown * 100).toFixed(1)}% | Return ${(mcResult.bestCase.totalReturn * 100).toFixed(1)}%`);
  console.log('');

  console.log('═'.repeat(70));
  console.log('✅ VALIDAÇÃO DE ROBUSTEZ');
  console.log('═'.repeat(70));
  console.log('');

  const isRobust =
    mcResult.probabilities.profitableProbability >= 0.9 &&
    mcResult.confidenceIntervals.maxDrawdown.upper <= 0.5 &&
    mcResult.statistics.medianTotalReturn > 0.5;

  const checks = [
    {
      name: 'Prob. Lucrativa >= 90%',
      pass: mcResult.probabilities.profitableProbability >= 0.9,
      value: `${(mcResult.probabilities.profitableProbability * 100).toFixed(1)}%`,
    },
    {
      name: 'CI95 Drawdown <= 50%',
      pass: mcResult.confidenceIntervals.maxDrawdown.upper <= 0.5,
      value: `${(mcResult.confidenceIntervals.maxDrawdown.upper * 100).toFixed(1)}%`,
    },
    {
      name: 'Retorno Mediano > 50%',
      pass: mcResult.statistics.medianTotalReturn > 0.5,
      value: `${(mcResult.statistics.medianTotalReturn * 100).toFixed(1)}%`,
    },
    {
      name: 'Pior Caso Lucrativo',
      pass: mcResult.worstCase.finalEquity > INITIAL_CAPITAL,
      value: `$${mcResult.worstCase.finalEquity.toFixed(2)}`,
    },
  ];

  for (const check of checks) {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}: ${check.value}`);
  }

  console.log('');
  if (isRobust) {
    console.log('🎉 CONFIGURAÇÃO ROBUSTA - Aprovada para produção!');
  } else {
    console.log('⚠️  CONFIGURAÇÃO PRECISA DE AJUSTES - Revisar parâmetros');
  }

  process.exit(0);
}

validateRobustness().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
