# 🚀 Quick Start - Backtesting CLI

Guia de 5 minutos para começar a usar o sistema de backtesting.

## 1️⃣ Teste Sua Primeira Estratégia (30 segundos)

```bash
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-11-01 \
  --end 2024-12-01 \
  --capital 1000
```

**O que acontece:**
- ✅ Busca dados históricos da Binance (BTCUSDT, 1 hora, Nov 2024)
- ✅ Simula trades com Setup 9.1
- ✅ Calcula métricas (win rate, profit factor, Sharpe ratio, etc.)
- ✅ Mostra interpretação automática dos resultados
- ✅ Salva resultado em JSON

**Resultado esperado:**
```
╔═══════════════════════════════════════════════╗
║        BACKTEST VALIDATION - SETUP91          ║
╠═══════════════════════════════════════════════╣
║ Symbol: BTCUSDT                               ║
║ Interval: 1h                                  ║
║ Period: 2024-11-01 → 2024-12-01              ║
║ Capital: $1,000.00                            ║
╚═══════════════════════════════════════════════╝

BACKTEST RESULTS:
Total Trades: 34
Win Rate: 35.29%
Profit Factor: 1.43
Total PnL: +2.12%
Max Drawdown: -1.69%
Sharpe Ratio: 2.55

✓ RECOMMENDATION: Strategy needs optimization before live trading.

✔ Result saved to: results/validations/setup91_BTCUSDT_1h_*.json
```

---

## 2️⃣ Otimize os Parâmetros (2 minutos)

Encontre os melhores parâmetros automaticamente:

```bash
npm run backtest:optimize -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 1h \
  --start 2024-10-01 \
  --end 2024-12-01 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --param minConfidence=60,70,80 \
  --parallel 4
```

**O que acontece:**
- ✅ Testa **27 combinações** de parâmetros (3×3×3)
- ✅ Executa 4 backtests em paralelo
- ✅ Mostra os top 10 melhores resultados
- ✅ Recomenda a melhor configuração

**Resultado esperado:**
```
╔═══════════════════════════════════════════════╗
║         TOP 10 RESULTS (sorted by PnL)        ║
╠═══╦═════╦════╦════╦═══════╦══════╦══════╦═════╣
║ # ║ SL% ║TP% ║ MC ║Trades ║Win%  ║ PnL% ║  PF ║
╠═══╬═════╬════╬════╬═══════╬══════╬══════╬═════╣
║ 1 ║ 2.0 ║ 6  ║ 70 ║   47  ║ 61.7 ║28.75 ║2.58 ║
║ 2 ║ 1.5 ║ 6  ║ 70 ║   52  ║ 59.6 ║26.50 ║2.41 ║
║ 3 ║ 2.0 ║ 7  ║ 70 ║   41  ║ 63.4 ║25.80 ║2.72 ║
...

✓ BEST: SL=2%, TP=6%, MC=70 → PnL=+28.75%
✔ Results saved to: results/optimizations/setup91_BTCUSDT_*.json
```

---

## 3️⃣ Compare Múltiplos Resultados (10 segundos)

Compare BTC vs ETH:

```bash
# Teste ETH
npm run backtest:validate -- \
  --strategy setup91 \
  --symbol ETHUSDT \
  --interval 1h \
  --start 2024-11-01 \
  --end 2024-12-01 \
  --capital 1000

# Compare BTC vs ETH
npm run backtest:compare -- \
  results/validations/setup91_BTCUSDT_*.json \
  results/validations/setup91_ETHUSDT_*.json
```

**Resultado:**
```
┌─────────┬─────────┬──────┬────────┬──────┬─────┬──────┐
│Strategy │ Symbol  │ Int. │ Trades │Win % │ PF  │ PnL% │
├─────────┼─────────┼──────┼────────┼──────┼─────┼──────┤
│ setup91 │ BTCUSDT │  1h  │   34   │ 35.3 │ 1.43│ +2.12│
│ setup91 │ ETHUSDT │  1h  │   42   │ 23.8 │ 0.77│ -1.65│
└─────────┴─────────┴──────┴────────┴──────┴─────┴──────┘

BEST RESULTS:
✓ Highest PnL: setup91 (BTCUSDT 1h): +2.12%
✓ Highest Win Rate: setup91 (BTCUSDT 1h): 35.3%
```

---

## 4️⃣ Valide Robustez com Walk-Forward (3 minutos)

Evite overfitting validando em períodos out-of-sample:

```bash
npm run backtest:walkforward -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-06-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --param stopLossPercent=1.5,2,2.5 \
  --param takeProfitPercent=5,6,7 \
  --training-months 3 \
  --testing-months 1 \
  --step-months 1
```

**Resultado:**
```
╔═══════════════════════════════════════════════╗
║    WALK-FORWARD ANALYSIS - SETUP91            ║
╠═══════════════════════════════════════════════╣
║ Created 3 walk-forward windows                ║
╚═══════════════════════════════════════════════╝

AGGREGATED METRICS:
Total Trades: 89
Overall Win Rate: 58.4%
Overall Profit Factor: 2.12

Sharpe Ratio Analysis:
Avg In-Sample Sharpe: 1.85
Avg Out-of-Sample Sharpe: 1.62
Degradation: 12.4%

Robustness Assessment:
✓ Strategy is ROBUST
  Performance degradation is acceptable (<30%)

✔ Results saved to: results/walkforward/setup91_BTCUSDT_4h_wf_*.json
```

---

## 5️⃣ Análise Monte Carlo (1 minuto)

Avalie significância estatística dos resultados:

```bash
npm run backtest:montecarlo -- \
  --strategy setup91 \
  --symbol BTCUSDT \
  --interval 4h \
  --start 2024-10-01 \
  --end 2024-12-01 \
  --capital 1000 \
  --stop-loss 2 \
  --take-profit 6 \
  --simulations 1000
```

**O que acontece:**
- ✅ Executa backtest inicial
- ✅ Embaralha ordem dos trades 1000 vezes
- ✅ Calcula distribuição estatística dos resultados
- ✅ Fornece intervalos de confiança (95%)
- ✅ Estima probabilidades de diferentes cenários

**Resultado esperado:**
```
╔═══════════════════════════════════════════════╗
║    MONTE CARLO SIMULATION - SETUP91           ║
╠═══════════════════════════════════════════════╣
║ Simulations: 1,000                            ║
║ Confidence Level: 95%                         ║
╚═══════════════════════════════════════════════╝

ORIGINAL BACKTEST RESULTS:
Final Equity: $1,287.45 (+28.75%)
Total Trades: 47
Win Rate: 61.70%
Profit Factor: 2.58
Sharpe Ratio: 1.82

MONTE CARLO STATISTICS:
Mean Final Equity: $1,285.22
Median Final Equity: $1,284.50
Std Dev: $18.45

95% CONFIDENCE INTERVALS:
Final Equity: [$1,250.12, $1,320.88]
Total Return: [+25.01%, +32.09%]
Max Drawdown: [-3.2%, -11.8%]
Sharpe Ratio: [1.65, 1.98]

PROBABILITIES:
Profitable: 92.5%
Drawdown > 10%: 15.3%
Drawdown > 20%: 2.1%
Return > 20%: 78.4%

SCENARIOS:
Worst Case: $1,215.33 (+21.53%)
Median Case: $1,284.50 (+28.45%)
Best Case: $1,358.92 (+35.89%)

ASSESSMENT:
✓ Statistically significant results
✓ High probability of profit (92.5%)
✓ Low probability of large drawdowns
✓ Even worst case is profitable

✔ Results saved to: results/montecarlo/setup91_BTCUSDT_4h_mc_*.json
```

---

## 6️⃣ Exporte para CSV (5 segundos)

Analise em Excel/Google Sheets:

```bash
npm run backtest:export -- \
  results/validations/setup91_BTCUSDT_*.json \
  --verbose
```

**Resultado:**
```
CSV gerado com:
- 34 trades individuais (entrada, saída, PnL)
- Métricas finais (win rate, profit factor, etc.)
- Salvo em: results/comparisons/*.csv

Preview:
Trade,Type,Entry Date,Entry Price,Exit Price,PnL ($),PnL (%)
1,SHORT,2024-11-03,68018.00,69378.36,-2.00,-2.20
2,SHORT,2024-11-04,68662.39,70035.64,-2.00,-2.20
3,LONG,2024-11-04,67920.01,71995.21,5.97,5.80
...
```

---

## 🎯 Próximos Passos

### Opção A: Testar Outras Estratégias

```bash
# Setup 9.2 (pullback/retest)
npm run backtest:validate -- --strategy setup92 --symbol BTCUSDT --interval 4h ...

# Breakout Retest
npm run backtest:validate -- --strategy breakoutRetest --symbol BTCUSDT --interval 1h ...

# Bull Trap (reversão SHORT)
npm run backtest:validate -- --strategy bullTrap --symbol BTCUSDT --interval 1h ...
```

**Estratégias disponíveis:**
- `setup91`, `setup92`, `setup93`, `setup94`
- `pattern123`, `bullTrap`, `bearTrap`
- `breakoutRetest`, `pinbar`, `insidebar`
- `orderBlockFVG`, `vwapEma`, `divergence`, `liquiditySweep`

### Opção B: Testar Outros Símbolos

```bash
# Ethereum
--symbol ETHUSDT

# Solana
--symbol SOLUSDT

# Binance Coin
--symbol BNBUSDT

# Outros
--symbol ADAUSDT  # Cardano
--symbol DOGEUSDT # Dogecoin
--symbol XRPUSDT  # Ripple
```

### Opção C: Testar Outros Timeframes

```bash
# Scalping (15 minutos)
--interval 15m

# Day trading (1 hora)
--interval 1h

# Swing trading (4 horas ou 1 dia)
--interval 4h
--interval 1d
```

---

## 🛠️ Comandos Úteis

### Ver ajuda completa
```bash
npm run backtest -- --help
npm run backtest:validate -- --help
npm run backtest:optimize -- --help
```

### Listar resultados salvos
```bash
ls -lh results/validations/
ls -lh results/optimizations/
ls -lh results/walkforward/
ls -lh results/montecarlo/
ls -lh results/comparisons/
```

### Ver resultado específico
```bash
cat results/validations/setup91_BTCUSDT_*.json | jq '.metrics'
```

---

## 📖 Documentação Completa

Para detalhes completos, veja:
- **[CLI.md](./CLI.md)** - Documentação completa com todos os parâmetros e exemplos

---

## 💡 Dicas Rápidas

1. **Comece com períodos curtos** (1 mês) para testes rápidos
2. **Use --verbose** para ver trades individuais
3. **Optimize em paralelo** com `--parallel 4` para velocidade
4. **Filtre resultados** com `--min-win-rate 50 --min-profit-factor 1.5`
5. **Compare sempre** BTC, ETH e SOL para ver qual funciona melhor

---

## ⚠️ Avisos

- ❌ Resultados passados ≠ resultados futuros
- ❌ Sempre teste em paper trading primeiro
- ❌ Comissões reais: 0.1% (spot) ou 0.02-0.04% (maker/taker)
- ❌ Slippage não incluído nos backtests

---

**Pronto! Em 5 minutos você já está fazendo backtests profissionais! 🚀📈**

Para mais exemplos, veja [CLI.md](./CLI.md)
