# 🧪 Guia de Testes e Validação - MarketMind Strategies

## 📊 Comandos Rápidos

### Validar TODAS as estratégias (72 ativas)
```bash
npm run validate:all
```
**O que faz:**
- Testa todas as 72 estratégias ativas
- Período: 2024 completo (BTCUSDT 1d)
- Salva resultados individuais em JSON
- Gera ranking automático das top 10 estratégias

**Resultado esperado:** ~5-10 minutos
**Output:** `results/bulk-validation-YYYY-MM-DD/`

---

### Otimizar TODAS as estratégias
```bash
npm run optimize:all
```
**O que faz:**
- Executa grid search em todas as estratégias
- Encontra melhores parâmetros para cada uma
- Salva parâmetros otimizados

**Resultado esperado:** ~30-60 minutos (depende do grid)
**Output:** `results/optimizations/`

---

### Fazer TUDO (validar + otimizar)
```bash
npm run test:all
```
**O que faz:**
- Primeiro valida todas as estratégias
- Depois otimiza cada uma
- Gera relatórios completos

**Resultado esperado:** ~1-2 horas
**Output:** Resultados em `results/`

---

## 🎯 Testes Individuais

### Validar uma estratégia específica
```bash
npm run backtest:validate -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --optimized
```

### Otimizar parâmetros de uma estratégia
```bash
npm run backtest:optimize -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --param rsiEntry=5,10,15,20 \
  --param rsiExit=50,60,70,80 \
  --parallel 4 \
  --top 10 \
  --sort-by profitFactor
```

### Análise Walk-Forward
```bash
npm run backtest:walkforward -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2023-01-01 \
  --end 2024-12-01 \
  --train-period 180 \
  --test-period 30
```

### Simulação Monte Carlo
```bash
npm run backtest:montecarlo -- \
  -s connors-rsi2-original \
  --symbol BTCUSDT \
  -i 1d \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --simulations 1000
```

---

## 📁 Estrutura de Resultados

```
results/
├── bulk-validation-2024-12-09/
│   ├── connors-rsi2-original_BTCUSDT_1d_2024.json
│   ├── larry-williams-9-1_BTCUSDT_1d_2024.json
│   ├── ...
│   └── summary.txt                    # ← Top 10 ranking
├── optimizations/
│   ├── connors-rsi2-original_opt_*.json
│   └── ...
└── validations/
    └── ...
```

---

## 📈 Métricas Importantes

### O que observar nos resultados:

1. **Total Trades** - Mínimo 20-30 para ser significativo
2. **Win Rate** - Ideal 40-60%
3. **Profit Factor** - Mínimo 1.5, ideal >2.0
4. **Total PnL %** - Retorno total
5. **Max Drawdown %** - Risco máximo (ideal <20%)
6. **Sharpe Ratio** - Retorno ajustado ao risco (ideal >1.0)

### Flags de Atenção:
- ⚠️ **0 trades** = Condições muito restritivas
- ⚠️ **Win rate <30%** = Problema na estratégia
- ⚠️ **Profit Factor <1.0** = Perdendo dinheiro
- ⚠️ **Max DD >30%** = Risco muito alto

---

## 🔧 Troubleshooting

### "Failed to load strategy"
- Verificar se indicador existe no IndicatorEngine
- Conferir nomes dos indicadores (case-sensitive)
- Ver `STRATEGY_VALIDATION_FIXES.md`

### "0 trades detected"
- Parâmetros muito restritivos
- Período muito curto
- Tentar ajustar thresholds (RSI, confidence, etc.)

### Timeout errors
- Aumentar timeout no script (linha 40)
- Reduzir período de teste
- Usar interval maior (1d ao invés de 1h)

---

## ✅ Checklist Antes de Rodar

- [ ] Backend compilado (`npm run build`)
- [ ] Variáveis de ambiente configuradas (`.env`)
- [ ] Estratégias ativas (`status: "active"`)
- [ ] Espaço em disco suficiente (~500MB para todos os resultados)
- [ ] Internet estável (para buscar dados da Binance)

---

## 🚀 Workflow Recomendado

1. **Primeira vez:**
   ```bash
   npm run validate:all
   ```
   - Verificar quais estratégias funcionam
   - Analisar resultados iniciais
   - Identificar as top 10

2. **Otimização:**
   ```bash
   # Otimizar apenas as top 10 promissoras
   npm run backtest:optimize -- -s connors-rsi2-original ...
   ```

3. **Validação final:**
   ```bash
   # Re-validar com parâmetros otimizados
   npm run validate:all
   ```

4. **Análise robustez:**
   ```bash
   # Walk-forward e Monte Carlo nas melhores
   npm run backtest:walkforward -- -s top-strategy ...
   npm run backtest:montecarlo -- -s top-strategy ...
   ```

---

**Última atualização:** 9 de dezembro de 2025  
**Estratégias ativas:** 72  
**Status:** ✅ Pronto para produção
