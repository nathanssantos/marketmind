# Plano de Melhoria: Sistema de Detecção de Setups

## 1. Estado Atual

### 1.1 Setups Implementados

**Total: 13+ setups de trading**

| Setup | Tipo | Descrição |
|-------|------|-----------|
| 123 Reversal | Pattern | Padrão de 3 barras de reversão |
| Bear Trap | Pattern | Armadilha de baixa |
| Mean Reversion | Momentum | Retorno à média |
| Stochastic Double Touch | Oscillator | Toque duplo no estocástico |
| EMA9 Pullback (9.1) | Trend | Pullback para EMA9 |
| EMA9 Double Pullback (9.2) | Trend | Pullback duplo conservador |
| EMA9 Continuation (9.3) | Trend | Continuação após falha temporária |
| EMA9 Setup 9.4 | Trend | Variação adicional |
| Larry Williams 9.1-9.4 | Suite | Suite completa Larry Williams |

### 1.2 Arquitetura de Detecção

```
services/setup-detection/
├── SetupDetectionService.ts    # Orquestrador
├── BaseSetupDetector.ts        # Classe base
└── dynamic/
    ├── ConditionEvaluator.ts   # Avaliação de condições
    ├── EntryCalculator.ts      # Cálculo de entrada
    ├── ExitCalculator.ts       # Cálculo de saída
    ├── IndicatorEngine.ts      # Motor de indicadores
    ├── StrategyInterpreter.ts  # Interpretador de regras
    └── StrategyLoader.ts       # Carregador de JSON
```

### 1.3 Métricas de Testes

- 44 testes para setups 9.2, 9.3, 9.4
- 14 testes para Setup 9.2 (EMA9 Pullback)
- 14 testes para Setup 9.3 (Double Pullback)
- 16 testes para Setup 9.4 (Continuation)

---

## 2. Análise Acadêmica

### 2.1 Larry Williams Trading Setups

**Referências:**
- "Long-Term Secrets to Short-Term Trading" (Larry Williams, 1999)
- "Trade Stocks and Commodities with the Insiders" (Larry Williams, 2005)

**Setup 9.x (EMA-Based):**

1. **Setup 9.1 (Single Pullback)**
   - Tendência definida por EMA9
   - Preço cruza EMA9 temporariamente
   - Retorna na direção da tendência
   - Entry: close acima/abaixo do candle anterior

2. **Setup 9.2 (Double Pullback)**
   - Mais conservador que 9.1
   - Requer 2 closes consecutivos do mesmo lado
   - Maior confirmação de reversão

3. **Setup 9.3 (Continuation)**
   - Após falha temporária da EMA9
   - Preço "teste" a EMA e rejeita
   - Continuação na direção original

**Validação Estatística:**
- Williams reportou win rate de 65-70%
- Risk/Reward típico de 1:2 a 1:3
- Funciona melhor em mercados com trend

### 2.2 Pattern Recognition em Trading

**Referências:**
- "Technical Analysis of the Financial Markets" (John Murphy, 1999)
- "Encyclopedia of Chart Patterns" (Thomas Bulkowski, 2021)

**123 Reversal Pattern:**
```
Bullish 123:
1. Novo low (ponto 1)
2. Bounce up (ponto 2)
3. Higher low (ponto 3)
4. Break acima do ponto 2 = entry

Estatísticas (Bulkowski):
- Success rate: 67%
- Average rise: 23%
```

**Mean Reversion:**
```
Princípio: Preços tendem a retornar à média
- Bollinger Bands: entry em 2σ
- RSI: oversold/overbought
- Z-Score: distância da média

Referência: "Quantitative Trading" (Ernie Chan)
```

### 2.3 Stochastic Oscillator

**Referências:**
- George Lane (criador, 1950s)
- "The Ultimate Guide to the Stochastic Oscillator" (TradingView)

**Fórmula:**
```
%K = (Close - Low14) / (High14 - Low14) × 100
%D = SMA(%K, 3)

Zonas:
- Oversold: < 20
- Overbought: > 80
```

**Double Touch Strategy:**
1. Primeiro toque em zona extrema
2. Preço move, mas estocástico fica na zona
3. Segundo toque = confirmação
4. Entry na divergência

---

## 3. Benchmarking de Mercado

### 3.1 TradingView Estratégias

- Pine Script para estratégias customizadas
- Backtesting integrado
- Alertas automáticos

**O que podemos aprender:**
- Linguagem declarativa para estratégias
- Validação em múltiplos timeframes
- Métricas de performance padronizadas

### 3.2 QuantConnect

- Estratégias em Python/C#
- Backtesting rigoroso
- Walk-forward optimization

**O que podemos aprender:**
- Validação estatística robusta
- Out-of-sample testing
- Risk metrics padronizados

### 3.3 Sistemas Profissionais

**Métricas standard:**
- Sharpe Ratio > 1.0
- Sortino Ratio > 1.5
- Max Drawdown < 20%
- Win Rate > 50% (com R:R favorável)

---

## 4. Problemas Identificados

### 4.1 Validação Estatística

- Falta backtesting rigoroso de cada setup
- Métricas de performance não padronizadas
- Sem validação out-of-sample

### 4.2 Configurabilidade

- Parâmetros hardcoded em alguns setups
- Falta de presets por timeframe/ativo
- Sem ajuste automático de parâmetros

### 4.3 Documentação

- Falta documentação da lógica de cada setup
- Sem referência aos papers originais
- Difícil entender regras de cada setup

### 4.4 Testes

- Cobertura boa (44 testes)
- Falta testes de edge cases
- Sem testes de performance

---

## 5. Melhorias Propostas

### 5.1 Validação Estatística de Setups

```typescript
// services/setup-validation/
interface SetupValidation {
  setup: string;
  symbol: string;
  timeframe: string;
  period: { start: Date; end: Date };

  // Métricas
  totalTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  avgHoldingPeriod: number;

  // Validação
  sampleSize: boolean; // > 30 trades
  statisticalSignificance: boolean; // p < 0.05
}
```

### 5.2 Configuração por Contexto

```typescript
// configs/setup-presets.ts
const SETUP_PRESETS = {
  '9.1_crypto_1h': {
    emaPeriod: 9,
    lookbackBars: 5,
    minRiskReward: 2,
    stopBuffer: 0.5,
  },
  '9.1_stocks_daily': {
    emaPeriod: 9,
    lookbackBars: 3,
    minRiskReward: 1.5,
    stopBuffer: 0.3,
  },
};
```

### 5.3 Documentação de Setups

```markdown
# Setup 9.1 - EMA9 Single Pullback

## Origem
Larry Williams, "Long-Term Secrets to Short-Term Trading" (1999)

## Regras
1. Trend definido: Close > EMA9 (bullish) ou Close < EMA9 (bearish)
2. Pullback: Close cruza EMA9 temporariamente
3. Recovery: Close retorna ao lado original da EMA9
4. Entry: Break do high/low do candle de recovery

## Parâmetros
- EMA Period: 9 (default)
- Lookback: 5 barras (default)
- Min R:R: 2:1

## Validação Estatística
- Período: 2020-2024
- Ativos: BTC, ETH, Top 20 Crypto
- Win Rate: 58%
- Avg R:R: 2.3
- Sharpe: 1.2
```

### 5.4 Métricas Padronizadas

```typescript
// Adicionar a cada setup
interface SetupMetrics {
  // Performance
  winRate: number;
  avgPnl: number;
  avgRiskReward: number;
  profitFactor: number;

  // Risk
  maxConsecutiveLosses: number;
  maxDrawdown: number;
  avgDrawdown: number;

  // Timing
  avgBarsInTrade: number;
  avgTimeToProfit: number;

  // Quality
  expectancy: number; // (winRate × avgWin) - (lossRate × avgLoss)
  sqn: number; // System Quality Number
}
```

---

## 6. Plano de Implementação

### Fase 1: Documentação (1 semana)

| Task | Prioridade |
|------|------------|
| Documentar Setup 9.1 com referências | P1 |
| Documentar Setup 9.2 com referências | P1 |
| Documentar Setup 9.3 com referências | P1 |
| Documentar Setup 9.4 com referências | P1 |
| Documentar 123 Reversal | P2 |
| Documentar Mean Reversion | P2 |
| Documentar Stochastic Double Touch | P2 |

### Fase 2: Validação Estatística (2 semanas)

| Task | Prioridade |
|------|------------|
| Criar SetupValidator service | P1 |
| Rodar backtests para cada setup | P1 |
| Calcular métricas padronizadas | P1 |
| Validação estatística (p-value) | P2 |
| Relatório por setup | P2 |

### Fase 3: Configurabilidade (1 semana)

| Task | Prioridade |
|------|------------|
| Criar sistema de presets | P2 |
| Presets por timeframe | P2 |
| Presets por tipo de ativo | P3 |
| UI para customização | P3 |

### Fase 4: Melhorias de Detecção (2 semanas)

| Task | Prioridade |
|------|------------|
| Otimizar performance de detecção | P2 |
| Adicionar filtros de confluência | P2 |
| Multi-timeframe confirmation | P3 |
| Scoring system para setups | P3 |

---

## 7. Critérios de Validação

### 7.1 Estatísticos

- [ ] Cada setup com > 30 trades no backtest
- [ ] P-value < 0.05 para win rate
- [ ] Profit factor > 1.2
- [ ] Sharpe ratio > 0.5

### 7.2 Documentação

- [ ] Cada setup com README completo
- [ ] Referências a papers/livros
- [ ] Regras claramente definidas
- [ ] Parâmetros documentados

### 7.3 Testes

- [ ] Cobertura > 90% para detectors
- [ ] Testes de edge cases
- [ ] Testes de performance
- [ ] Testes de integração

---

## 8. Arquivos a Criar/Modificar

### Criar

1. `docs/setups/` - Documentação de cada setup
2. `services/setup-validation/` - Validação estatística
3. `configs/setup-presets.ts` - Presets por contexto

### Modificar

1. `services/setup-detection/SetupDetectionService.ts` - Adicionar métricas
2. `services/setup-detection/dynamic/` - Melhorar performance
3. Cada detector individual para suportar presets
