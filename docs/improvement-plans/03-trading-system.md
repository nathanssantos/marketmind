# Plano de Melhoria: Sistema de Trading

## 1. Estado Atual

### 1.1 Arquitetura

```
Backend Trading System
├── routers/
│   ├── trading.ts          (20+ procedures, 1500+ lines)
│   ├── futures-trading.ts  (15+ procedures)
│   └── auto-trading.ts     (100+ procedures)
├── services/
│   ├── auto-trading.ts     (23KB)
│   ├── auto-trading-scheduler.ts (122KB!) ⚠️
│   ├── execution-manager.ts
│   ├── position-monitor.ts
│   └── protection-orders.ts
└── utils/
    └── pnl-calculator.ts   (não usado consistentemente)
```

### 1.2 Features Implementadas

- **Spot Trading**: Market, Limit, Stop-Loss, Take-Profit
- **Futures Trading**: Leverage, Margin types, Position modes
- **Auto-Trading**: 13+ setups, pyramiding, trailing stops
- **Risk Management**: Position sizing, daily loss limits, drawdown

### 1.3 Problemas Críticos Identificados

| Problema | Localização | Impacto |
|----------|-------------|---------|
| Arquivo de 122KB | `auto-trading-scheduler.ts` | Manutenção impossível |
| Código duplicado SPOT/FUTURES | `trading.ts` | 70+ linhas duplicadas |
| Parâmetros não usados | `auto-trading.ts` | Confusão, bugs potenciais |
| PnL calculator não usado | `trading.ts`, `futures-trading.ts` | Duplicação |

---

## 2. Análise Acadêmica

### 2.1 Arquitetura de Sistemas de Trading

**Referências:**
- "Algorithmic Trading and DMA" (Barry Johnson, 2010)
- "Building Winning Trading Systems" (Keith Fitschen)
- "Design Patterns for Trading Systems" (Ernie Chan)

**Padrões Recomendados:**

1. **Event-Driven Architecture**
   - Separação de concerns via eventos
   - Order → Fill → Position → P&L

2. **Command/Query Separation (CQRS)**
   - Queries: getOrders, getPositions
   - Commands: createOrder, closePosition

3. **Strategy Pattern**
   - Interface comum para todas estratégias
   - Fácil adição de novas estratégias

4. **State Machine para Orders**
   ```
   PENDING → SUBMITTED → FILLED → CLOSED
                      ↘ CANCELLED
                      ↘ REJECTED
   ```

### 2.2 Order Management Systems (OMS)

**Referências:**
- FIX Protocol Standards
- "High-Frequency Trading" (Irene Aldridge)

**Componentes de um OMS:**

1. **Order Router**: Encaminha ordens para exchange
2. **Order Book**: Mantém estado de ordens ativas
3. **Position Keeper**: Calcula posições em tempo real
4. **Risk Manager**: Valida ordens contra limites

### 2.3 Kelly Criterion e Position Sizing

**Referências:**
- "Fortune's Formula" (William Poundstone)
- "The Kelly Criterion in Blackjack, Sports Betting, and the Stock Market" (Ed Thorp)

**Fórmula Kelly:**
```
f* = (bp - q) / b

onde:
f* = fração do capital a arriscar
b = odds (lucro por unidade arriscada)
p = probabilidade de ganhar
q = probabilidade de perder (1 - p)
```

**Fractional Kelly (recomendado):**
- Full Kelly pode ser muito agressivo
- 25-50% Kelly é mais conservador
- Reduz drawdowns em troca de crescimento mais lento

---

## 3. Benchmarking de Mercado

### 3.1 MetaTrader 5 MQL5

**Arquitetura:**
- `CTrade` class para operações
- `CPositionInfo` para gestão de posições
- `CSymbolInfo` para dados de mercado

**O que podemos aprender:**
- Separação clara de responsabilidades
- Interface consistente para diferentes exchanges
- Gestão de estado robusta

### 3.2 Backtrader (Python)

**Arquitetura:**
- `Strategy` base class
- `Broker` para execução
- `Cerebro` orquestrador

**O que podemos aprender:**
- Padrão Strategy bem definido
- Backtesting e live trading com mesma interface
- Sistema de eventos pub/sub

### 3.3 CCXT (Exchange Abstraction)

**Arquitetura:**
- Interface unificada para 100+ exchanges
- Normalização de dados
- Error handling consistente

**O que podemos aprender:**
- Abstração de exchange
- Normalização de tipos de ordem
- Tratamento de erros padronizado

---

## 4. Problemas Identificados

### 4.1 Código Duplicado SPOT vs FUTURES

**trading.ts - createOrder:**
```typescript
// Linhas 102-148 (FUTURES)
if (input.marketType === 'FUTURES') {
  const client = createBinanceFuturesClient(wallet);
  // 46 linhas de lógica
}

// Linhas 150-193 (SPOT)
else {
  const client = createBinanceClient(wallet);
  // 44 linhas de lógica IDÊNTICA
}
```

**Duplicações similares em:**
- `cancelOrder` (20 linhas)
- `syncOrders` (30 linhas)
- `closePosition` (PnL calculation)

### 4.2 Parâmetros Não Utilizados

| Arquivo | Função | Parâmetro | Linha |
|---------|--------|-----------|-------|
| `auto-trading.ts` | `calculateKellyCriterion` | `_riskPercent` | 196 |
| `auto-trading.ts` | `getStrategyStatistics` | `_interval` | 247 |

### 4.3 Arquivo Massivo (122KB)

**auto-trading-scheduler.ts contém:**
- Scheduler loop
- Watcher management
- Position handling
- Order execution
- Signal processing
- Risk validation
- Config management
- Logging

**Deveria ser dividido em ~8 módulos.**

### 4.4 PnL Calculator Não Usado

```typescript
// utils/pnl-calculator.ts existe mas:
// - trading.ts:697-702 calcula inline
// - trading.ts:978-983 calcula inline
// - futures-trading.ts:449-459 calcula inline
```

---

## 5. Melhorias Propostas

### 5.1 Criar Market Client Factory

```typescript
// services/market-client-factory.ts
interface MarketClient {
  createOrder(params: OrderParams): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  getOpenOrders(): Promise<Order[]>;
  getPositions(): Promise<Position[]>;
}

export const createMarketClient = (wallet: Wallet): MarketClient => {
  return wallet.marketType === 'FUTURES'
    ? new FuturesClient(wallet)
    : new SpotClient(wallet);
};
```

### 5.2 Unificar Trading Router

```typescript
// routers/trading.ts refatorado
createOrder: protectedProcedure
  .input(createOrderSchema)
  .mutation(async ({ ctx, input }) => {
    const wallet = await walletQueries.getByIdAndUser(input.walletId, ctx.user.id);
    const client = createMarketClient(wallet);

    // Lógica unificada
    const order = await client.createOrder({
      symbol: input.symbol,
      side: input.side,
      type: input.type,
      quantity: input.quantity,
      price: input.price,
    });

    // Persistir no DB
    return orderRepository.save(order);
  }),
```

### 5.3 Decompor auto-trading-scheduler.ts

```
services/auto-trading/
├── index.ts                    # Re-exports
├── scheduler.ts                # Loop principal (~500 lines)
│   └── tick(), start(), stop()
├── watcher-manager.ts          # Gestão de watchers (~400 lines)
│   └── start(), stop(), pause(), getStatus()
├── position-handler.ts         # Gestão de posições (~300 lines)
│   └── open(), close(), monitor()
├── order-executor.ts           # Execução de ordens (~300 lines)
│   └── execute(), cancel(), modify()
├── signal-processor.ts         # Processamento de sinais (~400 lines)
│   └── process(), validate(), rank()
├── risk-validator.ts           # Validações de risco (~200 lines)
│   └── validatePosition(), validateExposure()
├── config-manager.ts           # Cache de config (~200 lines)
│   └── get(), set(), invalidate()
└── types.ts                    # Definições de tipos
```

### 5.4 Usar PnL Calculator Consistentemente

```typescript
// Refatorar todos os lugares para usar:
import { calculatePnl } from '../utils/pnl-calculator';

const pnl = calculatePnl({
  side: position.side,
  entryPrice: position.entryPrice,
  exitPrice: currentPrice,
  quantity: position.quantity,
  leverage: position.leverage,
});
```

### 5.5 Remover Parâmetros Não Usados

```typescript
// Antes
private async calculateKellyCriterion(
  _riskPercent: number, // ⚠️ não usado
  ...
)

// Depois
private async calculateKellyCriterion(
  // removido parâmetro não usado
  ...
)
```

---

## 6. Plano de Implementação

### Fase 1: Quick Fixes (1 semana)

| Task | Prioridade |
|------|------------|
| Remover `_riskPercent` de calculateKellyCriterion | P1 |
| Remover `_interval` de getStrategyStatistics | P1 |
| Usar pnl-calculator em trading.ts | P1 |
| Usar pnl-calculator em futures-trading.ts | P1 |

### Fase 2: Unificação SPOT/FUTURES (2 semanas)

| Task | Prioridade |
|------|------------|
| Criar MarketClientFactory | P1 |
| Criar interface MarketClient | P1 |
| Implementar SpotClient | P1 |
| Implementar FuturesClient | P1 |
| Refatorar createOrder | P2 |
| Refatorar cancelOrder | P2 |
| Refatorar syncOrders | P2 |

### Fase 3: Decomposição do Scheduler (3 semanas)

| Módulo | Linhas | Prioridade |
|--------|--------|------------|
| types.ts | 100 | P1 |
| config-manager.ts | 200 | P1 |
| risk-validator.ts | 200 | P2 |
| order-executor.ts | 300 | P2 |
| position-handler.ts | 300 | P2 |
| signal-processor.ts | 400 | P3 |
| watcher-manager.ts | 400 | P3 |
| scheduler.ts | 500 | P3 |

### Fase 4: Testes (1 semana)

| Área | Cobertura Target |
|------|-----------------|
| MarketClient | 90% |
| Trading Router | 85% |
| Auto-Trading Modules | 80% |

---

## 7. Critérios de Validação

### 7.1 Código

- [ ] Nenhum arquivo > 500 linhas
- [ ] Zero parâmetros não utilizados
- [ ] Zero código duplicado entre SPOT/FUTURES
- [ ] 100% uso de pnl-calculator

### 7.2 Testes

- [ ] Todos os testes existentes passando
- [ ] Novos testes para MarketClient
- [ ] Integration tests para trading flow

### 7.3 Performance

- [ ] Latência de execução < 100ms
- [ ] Memory usage estável
- [ ] No memory leaks

### 7.4 Observability

- [ ] Logging estruturado em todas operações
- [ ] Error tracking com context
- [ ] Métricas de execução

---

## 8. Arquivos Críticos

### Modificar

1. `apps/backend/src/routers/trading.ts`
2. `apps/backend/src/routers/futures-trading.ts`
3. `apps/backend/src/services/auto-trading.ts`
4. `apps/backend/src/services/auto-trading-scheduler.ts`

### Criar

1. `apps/backend/src/services/market-client-factory.ts`
2. `apps/backend/src/services/auto-trading/` (diretório com 8 módulos)

### Remover/Deprecar

1. Código duplicado em trading.ts
2. Parâmetros não usados em auto-trading.ts
