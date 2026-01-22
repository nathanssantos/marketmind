# Plano de Melhoria: Gestão de Risco

## 1. Estado Atual

### 1.1 Componentes de Risco Implementados

| Componente | Descrição | Status |
|------------|-----------|--------|
| Position Sizing | Cálculo de tamanho de posição | ✅ Implementado |
| Kelly Criterion | Fração ótima de capital | ✅ Implementado |
| Stop Loss | Stop fixo e trailing | ✅ Implementado |
| Take Profit | Targets de saída | ✅ Implementado |
| Risk/Reward | Cálculo de R:R ratio | ✅ Implementado |
| Max Drawdown | Monitoramento de drawdown | ✅ Implementado |
| Margin Manager | Gestão de margem futures | ✅ Implementado |
| Liquidation Monitor | Alertas de liquidação | ✅ Implementado |

### 1.2 Arquitetura

```
apps/backend/src/services/
├── risk/
│   ├── position-sizing.ts    # Cálculo de tamanho
│   ├── kelly-calculator.ts   # Kelly Criterion
│   └── drawdown-monitor.ts   # Monitoramento de DD
├── auto-trading/
│   ├── margin-manager.ts     # Gestão de margem
│   └── liquidation-monitor.ts # Alertas de liquidação
└── trading/
    └── exit-calculator.ts    # Cálculo de stops/targets
```

### 1.3 Parâmetros Configuráveis

```typescript
interface RiskConfig {
  maxRiskPerTrade: number;     // % do capital por trade
  maxDailyDrawdown: number;    // % máximo de perda diária
  maxTotalDrawdown: number;    // % máximo de perda total
  kellyFraction: number;       // Fração do Kelly (0.25 = quarter Kelly)
  minRiskReward: number;       // R:R mínimo para entrar
  trailingStopPercent: number; // % para trailing stop
  marginCallThreshold: number; // % para alerta de margin call
}
```

---

## 2. Análise Acadêmica

### 2.1 Kelly Criterion

**Referências:**
- "A New Interpretation of Information Rate" (J.L. Kelly Jr., 1956)
- "The Kelly Capital Growth Investment Criterion" (MacLean, Thorp, Ziemba, 2011)
- "Fortune's Formula" (William Poundstone, 2005)

**Fórmula Original:**
```
f* = (bp - q) / b

onde:
f* = fração ótima do capital
b = odds (retorno por unidade apostada)
p = probabilidade de ganhar
q = probabilidade de perder (1 - p)
```

**Para Trading:**
```
f* = (W × R - L) / R

onde:
W = win rate (probabilidade de trade vencedor)
L = loss rate (1 - W)
R = average win / average loss (ratio)
```

**Kelly Fracionário:**
```
f = k × f*

onde k é tipicamente 0.25 a 0.5 (quarter a half Kelly)

Justificativa:
- Reduz volatilidade do portfolio
- Protege contra estimativas imprecisas de W e R
- Recomendado por Thorp e outros practitioners
```

**Implementação Atual:**
```typescript
const calculateKellyCriterion = (
  winRate: number,
  avgWin: number,
  avgLoss: number,
  kellyFraction: number = 0.25
): number => {
  const R = avgWin / avgLoss;
  const fullKelly = (winRate * R - (1 - winRate)) / R;
  return Math.max(0, fullKelly * kellyFraction);
};
```

### 2.2 Position Sizing

**Referências:**
- "Trade Your Way to Financial Freedom" (Van K. Tharp, 1998)
- "The Mathematics of Money Management" (Ralph Vince, 1992)
- "Risk Management" (Michel Crouhy, 2006)

**Métodos:**

1. **Fixed Fractional:**
```
Position Size = (Account × Risk%) / (Entry - Stop)

Exemplo:
Account = $10,000
Risk% = 2%
Entry = $100
Stop = $95
Position Size = ($10,000 × 0.02) / ($100 - $95) = 40 shares
```

2. **Fixed Ratio (Ryan Jones):**
```
Next Level = Current Level + (Delta × (N + 1))

onde N = número de níveis já alcançados
```

3. **Optimal f (Ralph Vince):**
```
Optimal f = max(f) onde HPR = ((1 + f × (Trade / Largest Loss))^N)
```

4. **Percent Volatility:**
```
Position Size = (Account × Risk%) / (N × ATR)

onde N é multiplicador de ATR (tipicamente 2-3)
```

### 2.3 Drawdown Management

**Referências:**
- "Active Portfolio Management" (Grinold & Kahn, 1999)
- "Quantitative Trading" (Ernest Chan, 2008)

**Fórmulas:**

```
Drawdown = (Peak - Current) / Peak × 100

Max Drawdown = max(Drawdown) over period

Recovery Factor = Net Profit / Max Drawdown
```

**Regras de Gestão:**
- Max Drawdown > 20%: Reduzir exposição
- Max Drawdown > 30%: Pausar trading
- Max Drawdown > 50%: Rever estratégia completamente

**Calmar Ratio:**
```
Calmar Ratio = CAGR / Max Drawdown

Interpretação:
> 3.0: Excelente
> 1.0: Bom
< 0.5: Ruim
```

### 2.4 Value at Risk (VaR)

**Referências:**
- "Value at Risk" (Philippe Jorion, 2006)
- J.P. Morgan RiskMetrics (1994)

**Métodos:**

1. **Historical VaR:**
```
VaR(95%) = 5º percentil dos retornos históricos
```

2. **Parametric VaR:**
```
VaR = μ - (z × σ)

onde:
μ = retorno médio
σ = desvio padrão
z = 1.65 (95%) ou 2.33 (99%)
```

3. **Conditional VaR (CVaR/Expected Shortfall):**
```
CVaR = E[Loss | Loss > VaR]

Média das perdas que excedem o VaR
```

### 2.5 Risk-Adjusted Returns

**Referências:**
- "Portfolio Selection" (Markowitz, 1952)
- William Sharpe (1966)
- Frank Sortino (1994)

**Métricas:**

```
Sharpe Ratio = (Rp - Rf) / σp

Sortino Ratio = (Rp - Rf) / σd
onde σd = downside deviation (apenas retornos negativos)

Treynor Ratio = (Rp - Rf) / β

Information Ratio = (Rp - Rb) / σ(Rp - Rb)
onde Rb = benchmark return

Omega Ratio = ∫[Rf,∞) (1 - F(r)) dr / ∫[-∞,Rf) F(r) dr
```

**System Quality Number (SQN):**
```
SQN = √N × (Average R / Std Dev of R)

Interpretação:
< 1.6: Difícil de operar com lucro
1.7-2.0: Médio
2.0-2.5: Bom
2.5-3.0: Excelente
3.0-5.0: Soberbo
> 5.0: Santo Graal
```

### 2.6 Futures Risk (Específico)

**Referências:**
- "Options, Futures, and Other Derivatives" (John Hull, 2018)
- CME Group Risk Management Guidelines

**Margin Requirements:**
```
Initial Margin = Position Size × Initial Margin Rate
Maintenance Margin = Position Size × Maintenance Rate

Margin Call quando: Equity < Maintenance Margin
Liquidation quando: Equity ≈ 0 (ou threshold da exchange)
```

**Liquidation Price:**
```
Long: Liquidation = Entry × (1 - 1/Leverage + Maintenance Rate)
Short: Liquidation = Entry × (1 + 1/Leverage - Maintenance Rate)
```

---

## 3. Benchmarking de Mercado

### 3.1 Profissionais de Gestão de Risco

**Citadel:**
- Risk límits por estratégia
- Real-time monitoring
- Correlation-based limits

**Two Sigma:**
- VaR limits diários
- Stress testing
- Factor-based risk decomposition

### 3.2 Plataformas de Trading

**Interactive Brokers:**
- Real-time margin monitoring
- Portfolio margin
- Risk Navigator tool

**Binance:**
- Auto-deleverage system
- Insurance fund
- Margin ratio alerts

### 3.3 Métricas Standard da Indústria

| Métrica | Valor Esperado | MarketMind |
|---------|----------------|------------|
| Max Drawdown | < 20% | ✅ Monitorado |
| Sharpe Ratio | > 1.0 | 🟡 Calculado |
| Sortino Ratio | > 1.5 | ⏳ Pendente |
| Risk per Trade | 1-2% | ✅ Configurável |
| Calmar Ratio | > 1.0 | ⏳ Pendente |
| SQN | > 2.0 | ⏳ Pendente |

---

## 4. Problemas Identificados

### 4.1 Parâmetro Não Utilizado

```typescript
// auto-trading.ts linha 196
const calculateKellyCriterion = (
  winRate: number,
  avgWin: number,
  avgLoss: number,
  _riskPercent: number  // ← NÃO USADO!
): number => {
  // ...
}
```

**Ação:** Remover `_riskPercent` ou implementar sua função.

### 4.2 Métricas Faltando

1. **CVaR/Expected Shortfall** - Não implementado
2. **Sortino Ratio** - Não calculado
3. **SQN** - Não calculado
4. **Calmar Ratio** - Não calculado

### 4.3 Validação de Kelly

1. **Não valida estimativas** - Usa W e R sem questionar
2. **Sem historical validation** - Não verifica se estimativas são precisas
3. **Sem regime detection** - Ignora mudanças de mercado

### 4.4 Position Sizing Limitado

1. **Apenas Fixed Fractional** - Sem outras opções
2. **Sem ajuste por volatilidade** - ATR não usado
3. **Sem correlation adjustment** - Posições correlacionadas tratadas independentemente

---

## 5. Melhorias Propostas

### 5.1 Risk Metrics Service

```typescript
// services/risk/metrics.ts
interface RiskMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  sqn: number;
  var95: number;
  cvar95: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
}

export const calculateRiskMetrics = (trades: Trade[]): RiskMetrics => {
  const returns = calculateReturns(trades);
  const downside = returns.filter(r => r < 0);

  return {
    sharpeRatio: calculateSharpe(returns),
    sortinoRatio: calculateSortino(returns, downside),
    calmarRatio: calculateCalmar(returns),
    maxDrawdown: calculateMaxDrawdown(returns),
    sqn: calculateSQN(trades),
    var95: calculateVaR(returns, 0.95),
    cvar95: calculateCVaR(returns, 0.95),
    winRate: calculateWinRate(trades),
    profitFactor: calculateProfitFactor(trades),
    expectancy: calculateExpectancy(trades),
  };
};
```

### 5.2 Position Sizing Avançado

```typescript
// services/risk/position-sizing.ts
type SizingMethod = 'fixedFractional' | 'percentVolatility' | 'kellyFractional' | 'optimalF';

interface PositionSizeInput {
  method: SizingMethod;
  accountSize: number;
  riskPercent: number;
  entryPrice: number;
  stopPrice: number;
  atr?: number;
  atrMultiplier?: number;
  winRate?: number;
  avgWin?: number;
  avgLoss?: number;
}

export const calculatePositionSize = (input: PositionSizeInput): number => {
  switch (input.method) {
    case 'fixedFractional':
      return fixedFractionalSize(input);
    case 'percentVolatility':
      return percentVolatilitySize(input);
    case 'kellyFractional':
      return kellyFractionalSize(input);
    case 'optimalF':
      return optimalFSize(input);
  }
};

const percentVolatilitySize = (input: PositionSizeInput): number => {
  if (!input.atr || !input.atrMultiplier) {
    throw new Error('ATR required for percent volatility sizing');
  }
  const riskAmount = input.accountSize * input.riskPercent;
  const stopDistance = input.atr * input.atrMultiplier;
  return riskAmount / stopDistance;
};
```

### 5.3 Correlation-Aware Risk

```typescript
// services/risk/correlation.ts
interface CorrelationRisk {
  positions: Position[];
  correlationMatrix: number[][];
  totalRisk: number;
  diversificationBenefit: number;
}

export const calculateCorrelatedRisk = (positions: Position[]): CorrelationRisk => {
  const returns = positions.map(p => getHistoricalReturns(p.symbol));
  const correlationMatrix = calculateCorrelationMatrix(returns);

  const weights = positions.map(p => p.value / totalValue);
  const individualRisks = positions.map(p => p.volatility);

  const portfolioVariance = calculatePortfolioVariance(
    weights,
    individualRisks,
    correlationMatrix
  );

  const sumOfIndividualRisks = weights.reduce(
    (sum, w, i) => sum + w * individualRisks[i],
    0
  );

  return {
    positions,
    correlationMatrix,
    totalRisk: Math.sqrt(portfolioVariance),
    diversificationBenefit: sumOfIndividualRisks - Math.sqrt(portfolioVariance),
  };
};
```

### 5.4 Real-time Risk Dashboard

```typescript
// components/RiskDashboard.tsx
interface RiskDashboardProps {
  walletId: string;
}

export const RiskDashboard = ({ walletId }: RiskDashboardProps) => {
  const { data: metrics } = useRiskMetrics(walletId);
  const { data: positions } = usePositions(walletId);
  const { data: alerts } = useRiskAlerts(walletId);

  return (
    <Grid columns={4}>
      <MetricCard
        label="Max Drawdown"
        value={metrics.maxDrawdown}
        threshold={20}
        format="percent"
      />
      <MetricCard
        label="Sharpe Ratio"
        value={metrics.sharpeRatio}
        threshold={1.0}
      />
      <MetricCard
        label="VaR (95%)"
        value={metrics.var95}
        format="currency"
      />
      <MetricCard
        label="Open Risk"
        value={calculateOpenRisk(positions)}
        threshold={10}
        format="percent"
      />
    </Grid>
  );
};
```

---

## 6. Plano de Implementação

### Fase 1: Correções (3 dias)

| Task | Prioridade |
|------|------------|
| Remover `_riskPercent` não usado | P1 |
| Corrigir cálculo de Kelly | P1 |
| Validar fórmulas contra literatura | P1 |

### Fase 2: Novas Métricas (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar Sortino Ratio | P1 |
| Implementar CVaR | P1 |
| Implementar SQN | P2 |
| Implementar Calmar Ratio | P2 |
| Criar RiskMetricsService | P1 |

### Fase 3: Position Sizing Avançado (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar Percent Volatility sizing | P2 |
| Implementar Optimal f | P3 |
| Adicionar correlation-aware risk | P2 |
| UI para seleção de método | P2 |

### Fase 4: Dashboard de Risco (1 semana)

| Task | Prioridade |
|------|------------|
| Criar componentes de métricas | P2 |
| Dashboard em tempo real | P2 |
| Alertas configuráveis | P2 |
| Relatórios de risco | P3 |

---

## 7. Critérios de Validação

### 7.1 Fórmulas

- [ ] Kelly Criterion validado contra papers
- [ ] VaR/CVaR validado contra exemplos conhecidos
- [ ] Sharpe/Sortino calculados corretamente
- [ ] Position sizing com testes unitários

### 7.2 Métricas

- [ ] Todas as métricas da tabela 3.3 implementadas
- [ ] Métricas calculadas em tempo real
- [ ] Dashboard funcional

### 7.3 Performance

- [ ] Cálculos < 100ms para 1000 trades
- [ ] Atualizações em tempo real sem lag
- [ ] Cache de correlations

### 7.4 Testes

- [ ] Cobertura > 95%
- [ ] Testes com dados reais
- [ ] Testes de edge cases

---

## 8. Arquivos a Modificar

### Backend

1. `apps/backend/src/services/auto-trading.ts` - Remover `_riskPercent`
2. `apps/backend/src/services/risk/` - Criar novo diretório
3. `apps/backend/src/routers/analytics.ts` - Adicionar endpoints de métricas

### Frontend

1. `apps/electron/src/renderer/components/RiskDashboard/` - Criar
2. `apps/electron/src/renderer/hooks/useRiskMetrics.ts` - Criar
3. `apps/electron/src/renderer/components/Trading/` - Integrar métricas

### Packages

1. `packages/indicators/src/risk/` - Funções de risco reutilizáveis
