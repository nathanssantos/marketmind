# Plano de Melhoria: Arquitetura Backend

## 1. Estado Atual

### 1.1 Stack Tecnológico

| Componente | Versão | Propósito |
|------------|--------|-----------|
| Fastify | 5.6.2 | HTTP Server |
| tRPC | 11.7.2 | Type-safe RPC |
| Drizzle ORM | 0.44.7 | Database ORM |
| PostgreSQL | 17 | Database |
| TimescaleDB | 2.23.1 | Time-series extension |
| Argon2 | - | Password hashing |

### 1.2 Estrutura de Diretórios

```
apps/backend/src/
├── db/
│   ├── schema.ts           # Drizzle schema (9 tables)
│   └── migrations/         # SQL migrations
├── routers/
│   ├── health.ts           # Health check
│   ├── auth.ts             # Authentication
│   ├── wallet.ts           # Wallet management
│   ├── trading.ts          # Trading (SPOT)
│   ├── futures-trading.ts  # Trading (FUTURES)
│   ├── auto-trading.ts     # Auto-trading (100+ procedures!)
│   ├── analytics.ts        # Analytics & reports
│   └── fees.ts             # Fee management
├── services/
│   ├── auth/               # Auth services
│   ├── encryption/         # API key encryption
│   ├── database/           # DB queries (walletQueries)
│   ├── auto-trading/       # Auto-trading logic
│   └── risk/               # Risk management
├── trpc/
│   ├── context.ts          # tRPC context
│   └── router.ts           # Root router
└── utils/
    ├── profile-transformers.ts
    └── kline-mapper.ts
```

### 1.3 Database Schema

```sql
-- 9 tabelas principais
users                  -- Usuários
sessions              -- Sessões de autenticação
wallets               -- Carteiras (encrypted API keys)
orders                -- Histórico de ordens
positions             -- Posições abertas
klines                -- Dados de candles (TimescaleDB hypertable)
trading_profiles      -- Perfis de trading
auto_trading_configs  -- Configurações de auto-trading
fee_rebates           -- Rebates de taxas
```

### 1.4 Métricas Atuais

| Métrica | Valor |
|---------|-------|
| Routers | 8 |
| Procedures | ~200 |
| Tests | 885 (100% passing) |
| Coverage | 92.15% |
| Largest File | auto-trading-scheduler.ts (122KB) |

---

## 2. Análise de Arquitetura

### 2.1 Princípios de Design (Literatura)

**Referências:**
- "Clean Architecture" (Robert C. Martin, 2017)
- "Patterns of Enterprise Application Architecture" (Martin Fowler, 2002)
- "Domain-Driven Design" (Eric Evans, 2003)

**Princípios Aplicáveis:**

1. **Single Responsibility Principle (SRP)**
   - Cada módulo deve ter uma única razão para mudar
   - ❌ `auto-trading-scheduler.ts` viola SRP (122KB!)

2. **Dependency Inversion**
   - Depender de abstrações, não implementações
   - ✅ tRPC procedures dependem de services

3. **Separation of Concerns**
   - Routers → Services → Repositories
   - 🟡 Parcialmente implementado

### 2.2 tRPC Best Practices

**Referências:**
- tRPC Documentation (trpc.io)
- "Building Type-Safe APIs with tRPC" (Theo Browne)

**Patterns:**

1. **Router Organization:**
```typescript
// ✅ Bom: Routers pequenos e focados
const walletRouter = router({
  list: protectedProcedure.query(...),
  create: protectedProcedure.mutation(...),
  update: protectedProcedure.mutation(...),
});

// ❌ Ruim: Router com 100+ procedures
const autoTradingRouter = router({
  // 100+ procedures...
});
```

2. **Nested Routers:**
```typescript
// ✅ Organização hierárquica
const tradingRouter = router({
  spot: spotRouter,
  futures: futuresRouter,
  history: historyRouter,
});
```

### 2.3 Service Layer Pattern

**Referências:**
- "Service Layer" (Fowler, PEAA)
- "Application Services vs Domain Services" (DDD)

**Pattern:**
```
Router (API) → Service (Business Logic) → Repository (Data Access)
```

---

## 3. Problemas Identificados

### 3.1 auto-trading-scheduler.ts (122KB!)

**Problema:** Arquivo massivo com 3000+ linhas.

**Issues:**
- Impossível de manter
- Difícil de testar
- Acoplamento excessivo
- Memory issues em IDEs

**Proposta de Decomposição:**
```
services/auto-trading/
├── index.ts                    # Re-exports
├── scheduler.ts                # Core scheduling (~500 lines)
├── watcher-manager.ts          # Watcher lifecycle (~400 lines)
├── position-handler.ts         # Position management (~300 lines)
├── order-executor.ts           # Order execution (~300 lines)
├── signal-processor.ts         # Setup signal processing (~400 lines)
├── risk-validator.ts           # Risk checks (~200 lines)
├── config-manager.ts           # Config cache (~200 lines)
└── types.ts                    # Type definitions
```

### 3.2 Duplicação SPOT vs FUTURES

**Locais:**
- `trading.ts`: 44 linhas duplicadas em createOrder
- `trading.ts`: 20 linhas duplicadas em cancelOrder
- Lógica de PnL duplicada em 3 lugares

**Padrão Repetido:**
```typescript
// Em 15+ lugares:
if (input.marketType === 'FUTURES') {
  const client = createBinanceFuturesClient(wallet);
  // futures logic
} else {
  const client = createBinanceClient(wallet);
  // spot logic
}
```

**Solução:**
```typescript
// services/market-client-factory.ts
export const createMarketClient = (wallet: Wallet) => {
  return wallet.marketType === 'FUTURES'
    ? createBinanceFuturesClient(wallet)
    : createBinanceClient(wallet);
};

// Interface unificada
interface MarketClient {
  createOrder(params: OrderParams): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;
  getPositions(): Promise<Position[]>;
  // ...
}
```

### 3.3 Error Handling Inconsistente

**Padrão Atual:**
```typescript
} catch (error) {
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'Failed',
    cause: error,
  });
}
```

**Problema:**
- Sem logging estruturado
- Sem contexto (walletId, symbol, etc.)
- Sem error codes para debugging

**Proposta:**
```typescript
// utils/error-handler.ts
export const handleTRPCError = (
  error: unknown,
  context: Record<string, unknown>
): never => {
  logger.error('Operation failed', { ...context, error });

  if (error instanceof TRPCError) throw error;

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : 'Unknown error',
    cause: error,
  });
};

// Uso:
try {
  // ...
} catch (error) {
  handleTRPCError(error, { walletId: input.walletId, symbol: input.symbol });
}
```

### 3.4 Parâmetros Não Utilizados

| Arquivo | Função | Parâmetro | Status |
|---------|--------|-----------|--------|
| auto-trading.ts | calculateKellyCriterion | _riskPercent | ❌ Não usado |
| auto-trading.ts | getStrategyStatistics | _interval | ❌ Não usado |

### 3.5 pnl-calculator.ts Subutilizado

**Problema:** Utility existe mas PnL é calculado inline em 3+ lugares.

**Locais de duplicação:**
- trading.ts:697-702
- trading.ts:978-983
- futures-trading.ts:449-459

**Solução:** Consolidar todos para usar o utility.

---

## 4. Melhorias Propostas

### 4.1 Decomposição do Auto-Trading

```typescript
// services/auto-trading/scheduler.ts
export class AutoTradingScheduler {
  private configManager: ConfigManager;
  private signalProcessor: SignalProcessor;
  private orderExecutor: OrderExecutor;
  private riskValidator: RiskValidator;

  async processSymbol(symbol: string, config: AutoTradingConfig): Promise<void> {
    const signals = await this.signalProcessor.detectSetups(symbol, config);

    for (const signal of signals) {
      if (!this.riskValidator.validate(signal, config)) continue;

      await this.orderExecutor.execute(signal, config);
    }
  }
}

// services/auto-trading/signal-processor.ts
export class SignalProcessor {
  async detectSetups(symbol: string, config: AutoTradingConfig): Promise<Signal[]> {
    // Setup detection logic
  }
}

// services/auto-trading/order-executor.ts
export class OrderExecutor {
  async execute(signal: Signal, config: AutoTradingConfig): Promise<Order> {
    // Order execution logic
  }
}
```

### 4.2 Market Client Factory

```typescript
// services/trading/market-client-factory.ts
import { Binance } from 'binance-api-node';

export interface MarketClient {
  createOrder(params: CreateOrderParams): Promise<Order>;
  cancelOrder(params: CancelOrderParams): Promise<void>;
  getOpenOrders(symbol?: string): Promise<Order[]>;
  getPositions(): Promise<Position[]>;
  getBalance(): Promise<Balance>;
}

export class SpotClient implements MarketClient {
  private client: Binance;

  constructor(wallet: Wallet) {
    this.client = createBinanceClient(wallet);
  }

  async createOrder(params: CreateOrderParams): Promise<Order> {
    return this.client.order(params);
  }

  // ...
}

export class FuturesClient implements MarketClient {
  private client: BinanceFutures;

  constructor(wallet: Wallet) {
    this.client = createBinanceFuturesClient(wallet);
  }

  async createOrder(params: CreateOrderParams): Promise<Order> {
    return this.client.futuresOrder(params);
  }

  // ...
}

export const createMarketClient = (wallet: Wallet): MarketClient => {
  return wallet.marketType === 'FUTURES'
    ? new FuturesClient(wallet)
    : new SpotClient(wallet);
};
```

### 4.3 Nested Router Organization

```typescript
// routers/trading/index.ts
export const tradingRouter = router({
  spot: spotRouter,
  futures: futuresRouter,
  orders: ordersRouter,
  positions: positionsRouter,
});

// routers/trading/spot.ts
export const spotRouter = router({
  createOrder: protectedProcedure.input(createOrderSchema).mutation(...),
  cancelOrder: protectedProcedure.input(cancelOrderSchema).mutation(...),
});

// routers/trading/futures.ts
export const futuresRouter = router({
  createOrder: protectedProcedure.input(createOrderSchema).mutation(...),
  cancelOrder: protectedProcedure.input(cancelOrderSchema).mutation(...),
  adjustLeverage: protectedProcedure.input(leverageSchema).mutation(...),
});
```

### 4.4 Repository Pattern

```typescript
// repositories/order-repository.ts
export class OrderRepository {
  constructor(private db: Database) {}

  async findByWallet(walletId: string): Promise<Order[]> {
    return this.db.query.orders.findMany({
      where: eq(orders.walletId, walletId),
      orderBy: [desc(orders.createdAt)],
    });
  }

  async create(order: NewOrder): Promise<Order> {
    const [created] = await this.db.insert(orders).values(order).returning();
    return created;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const [updated] = await this.db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }
}
```

### 4.5 Structured Logging

```typescript
// utils/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Uso em routers:
logger.info({ walletId, symbol, side }, 'Creating order');
logger.error({ walletId, error }, 'Failed to create order');
```

---

## 5. Plano de Implementação

### Fase 1: Refatoração Crítica (1 semana)

| Task | Prioridade |
|------|------------|
| Remover parâmetros não utilizados | P1 |
| Consolidar cálculo de PnL | P1 |
| Criar MarketClientFactory | P1 |
| Error handling padronizado | P1 |

### Fase 2: Decomposição (2 semanas)

| Task | Prioridade |
|------|------------|
| Decompor auto-trading-scheduler.ts | P1 |
| Separar services/auto-trading/ | P1 |
| Criar repositories | P2 |
| Testes para novos módulos | P1 |

### Fase 3: Reorganização de Routers (1 semana)

| Task | Prioridade |
|------|------------|
| Nested routers para trading | P2 |
| Separar auto-trading router | P2 |
| Documentar API | P3 |

### Fase 4: Observabilidade (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar logging estruturado | P2 |
| Adicionar métricas | P3 |
| Error tracking | P3 |

---

## 6. Critérios de Validação

### 6.1 Arquitetura

- [ ] Nenhum arquivo > 500 linhas
- [ ] Routers delegam para services
- [ ] Services testáveis isoladamente
- [ ] Zero duplicação de código

### 6.2 Qualidade

- [ ] Coverage > 90%
- [ ] Zero parâmetros não utilizados
- [ ] Error handling consistente
- [ ] Logging estruturado em todas operações

### 6.3 Performance

- [ ] Response time < 100ms para queries simples
- [ ] Batch operations para múltiplas inserções
- [ ] Connection pooling otimizado

### 6.4 Manutenibilidade

- [ ] Documentação de API
- [ ] README por service
- [ ] Testes de integração

---

## 7. Arquivos a Modificar

### Criar

1. `services/trading/market-client-factory.ts`
2. `services/auto-trading/scheduler.ts`
3. `services/auto-trading/signal-processor.ts`
4. `services/auto-trading/order-executor.ts`
5. `services/auto-trading/risk-validator.ts`
6. `repositories/order-repository.ts`
7. `repositories/position-repository.ts`
8. `utils/error-handler.ts`
9. `utils/logger.ts`

### Modificar

1. `services/auto-trading-scheduler.ts` → Decomposition
2. `routers/trading.ts` → Usar MarketClientFactory
3. `routers/futures-trading.ts` → Unificar com trading
4. `services/auto-trading.ts` → Remover params não usados

### Remover

1. Código duplicado entre SPOT/FUTURES
2. Cálculos de PnL inline (usar utility)
3. Parâmetros não utilizados
