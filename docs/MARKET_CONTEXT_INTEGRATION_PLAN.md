# Market Context Integration for Auto-Trading

## Objetivo
Integrar o Market Context existente no fluxo de auto-trading para filtrar/ajustar trades baseado em condições de mercado.

## Dados Disponíveis (Já Implementados)

| Dado | Fonte | Status | Cache |
|------|-------|--------|-------|
| Fear & Greed Index | alternative.me | ✅ Live | Nenhum |
| BTC Dominance | CoinGecko/CMC | ✅ Live | 2 min |
| Funding Rate | Binance Futures | ✅ Live | 60 sec |
| Open Interest | Binance Futures | ✅ Live | 60 sec |
| News | - | ❌ Stub | - |
| Calendar Events | - | ❌ Stub | - |
| Volatility | - | ❌ Placeholder (0.5) | - |

## Ponto de Integração Recomendado

**Opção B: Paralelo com ML filtering** no `processWatcher` (linha ~386)

Vantagens:
- Executa após detecção básica mas antes de preparar execução
- Tem acesso a todos os indicadores e klines
- Pode combinar score de contexto com confiança ML
- Eficiente - não computa se setup falhou detecção básica

## Regras de Filtragem Propostas

### 1. Fear & Greed Index
```
fear < 20 (extreme fear):
  - Reduzir position size em 50%
  - Logar warning

fear > 80 (extreme greed):
  - Rejeitar LONG setups ou exigir confiança ML > 80%
  - Permitir SHORT normalmente
```

### 2. Funding Rate (para trades alavancados)
```
fundingRate > 0.05% (alto, pagando longs):
  - Penalizar LONG: -20% no score final

fundingRate < -0.05% (baixo, pagando shorts):
  - Penalizar SHORT: -20% no score final
```

### 3. BTC Dominance (para altcoins)
```
Se symbol != BTCUSDT:
  btcDominance aumentando > 1% nas últimas 24h:
    - Ser mais conservador com altcoins
    - Reduzir position size em 25%
```

## Arquitetura Proposta

### Novo Service: `MarketContextFilter`

```
apps/backend/src/services/market-context-filter.ts
```

Interface:
```typescript
interface MarketContextFilterResult {
  shouldTrade: boolean;
  positionSizeMultiplier: number;  // 0.0 - 1.0
  confidenceAdjustment: number;    // -50 to +50
  reason?: string;
  warnings: string[];
}

class MarketContextFilter {
  async validateSetup(
    setup: TradingSetup,
    symbol: string,
    interval: Interval
  ): Promise<MarketContextFilterResult>
}
```

### Integração no Scheduler

```typescript
// auto-trading-scheduler.ts, dentro do loop de ML filtering

const contextResult = await marketContextFilter.validateSetup(
  setup,
  watcher.symbol,
  watcher.interval
);

if (!contextResult.shouldTrade) {
  log('⛔ Setup rejected by market context', { reason: contextResult.reason });
  continue;
}

// Ajustar confiança
const adjustedConfidence = setup.confidence + contextResult.confidenceAdjustment;

// Passar multiplier para o cálculo de position size
setup.positionSizeMultiplier = contextResult.positionSizeMultiplier;
```

## Validação

### Como Validar a Integração

1. **Unit Tests**: Testar cada regra isoladamente
2. **Backtesting Comparison**:
   - Rodar backtest com e sem filtro
   - Comparar métricas: win rate, drawdown, profit factor
3. **Paper Trading Period**:
   - Deixar rodando em paper por 1-2 semanas
   - Analisar trades rejeitados vs executados
4. **Logging Extensivo**:
   - Logar todos os dados de contexto
   - Logar decisões e razões
   - Permitir análise posterior

### Métricas de Sucesso

- Redução no drawdown máximo
- Melhoria no profit factor
- Menos trades perdedores em condições extremas
- Trades rejeitados que teriam sido perdedores

## Arquivos a Modificar

### Backend
1. **Novo**: `apps/backend/src/services/market-context-filter.ts` - Service principal
2. **Novo**: `apps/backend/src/services/market-context-filter.test.ts` - Testes
3. **Modificar**: `apps/backend/src/db/schema.ts` - Nova tabela market_context_config
4. **Novo**: `apps/backend/src/routers/market-context.ts` - CRUD endpoints
5. **Modificar**: `apps/backend/src/trpc/router.ts` - Registrar novo router
6. **Modificar**: `apps/backend/src/services/auto-trading-scheduler.ts` - Integrar filtro

### Types
7. **Novo**: `packages/types/src/marketContextConfig.ts` - Types do config
8. **Modificar**: `packages/types/src/index.ts` - Export types

### Frontend
9. **Novo**: `apps/electron/src/renderer/components/Settings/MarketContextConfigTab.tsx` - UI config
10. **Novo**: `apps/electron/src/renderer/hooks/useMarketContextConfig.ts` - Hook tRPC
11. **Modificar**: Settings page para adicionar nova tab

## Fases de Implementação

### Fase 1: Implementação Básica
- Criar MarketContextFilter service
- Integrar no scheduler (log only mode primeiro)
- Adicionar testes unitários

### Fase 2: Validação
- Rodar em modo "shadow" (loga mas não bloqueia)
- Coletar dados por 1 semana
- Analisar resultados

### Fase 3: Ativação
- Ativar bloqueio real
- Monitorar por mais 1 semana
- Ajustar thresholds conforme necessário

## Configuração Granular (Toggle Individual)

### Schema: Nova tabela `market_context_config`

```typescript
// apps/backend/src/db/schema.ts
export const marketContextConfig = pgTable('market_context_config', {
  id: text('id').primaryKey(),
  walletId: text('wallet_id').notNull().references(() => wallets.id),
  userId: text('user_id').notNull(),

  // Master switch
  enabled: boolean('enabled').default(true),
  shadowMode: boolean('shadow_mode').default(true), // Log only, don't block

  // Fear & Greed Filter
  fearGreedEnabled: boolean('fear_greed_enabled').default(true),
  fearGreedThresholdLow: integer('fear_greed_threshold_low').default(20),
  fearGreedThresholdHigh: integer('fear_greed_threshold_high').default(80),
  fearGreedAction: text('fear_greed_action').default('reduce_size'), // 'reduce_size' | 'block' | 'warn_only'
  fearGreedSizeReduction: integer('fear_greed_size_reduction').default(50), // %

  // Funding Rate Filter
  fundingRateEnabled: boolean('funding_rate_enabled').default(true),
  fundingRateThreshold: text('funding_rate_threshold').default('0.05'), // %
  fundingRateAction: text('funding_rate_action').default('penalize'), // 'penalize' | 'block' | 'warn_only'
  fundingRatePenalty: integer('funding_rate_penalty').default(20), // % confidence reduction

  // BTC Dominance Filter (for altcoins)
  btcDominanceEnabled: boolean('btc_dominance_enabled').default(false),
  btcDominanceChangeThreshold: text('btc_dominance_change_threshold').default('1.0'), // %
  btcDominanceAction: text('btc_dominance_action').default('reduce_size'),
  btcDominanceSizeReduction: integer('btc_dominance_size_reduction').default(25), // %

  // Open Interest Filter
  openInterestEnabled: boolean('open_interest_enabled').default(false),
  openInterestChangeThreshold: text('oi_change_threshold').default('10'), // %
  openInterestAction: text('oi_action').default('warn_only'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### Interface TypeScript

```typescript
// packages/types/src/marketContextConfig.ts
export type MarketContextAction = 'reduce_size' | 'block' | 'penalize' | 'warn_only';

export interface MarketContextConfig {
  enabled: boolean;
  shadowMode: boolean;

  fearGreed: {
    enabled: boolean;
    thresholdLow: number;
    thresholdHigh: number;
    action: MarketContextAction;
    sizeReduction: number;
  };

  fundingRate: {
    enabled: boolean;
    threshold: number;
    action: MarketContextAction;
    penalty: number;
  };

  btcDominance: {
    enabled: boolean;
    changeThreshold: number;
    action: MarketContextAction;
    sizeReduction: number;
  };

  openInterest: {
    enabled: boolean;
    changeThreshold: number;
    action: MarketContextAction;
  };
}
```

### UI de Configuração (Frontend)

Adicionar nova aba ou seção em Settings:

```
┌─────────────────────────────────────────────────────────┐
│ Market Context Filters                    [Master: ON] │
│                                          [Shadow Mode] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ☑ Fear & Greed Index                                   │
│   └─ Low threshold: [20]  High threshold: [80]         │
│   └─ Action: [Reduce Size ▼]  Reduction: [50%]         │
│                                                         │
│ ☑ Funding Rate                                         │
│   └─ Threshold: [0.05%]                                │
│   └─ Action: [Penalize ▼]  Penalty: [20%]              │
│                                                         │
│ ☐ BTC Dominance (Altcoins)                             │
│   └─ Change threshold: [1.0%]                          │
│   └─ Action: [Reduce Size ▼]  Reduction: [25%]         │
│                                                         │
│ ☐ Open Interest                                        │
│   └─ Change threshold: [10%]                           │
│   └─ Action: [Warn Only ▼]                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Ações Disponíveis

| Ação | Comportamento |
|------|---------------|
| `warn_only` | Loga warning, não afeta trade |
| `reduce_size` | Reduz position size pelo % configurado |
| `penalize` | Reduz confiança do setup pelo % configurado |
| `block` | Bloqueia o trade completamente |

### Shadow Mode

Quando `shadowMode: true`:
- Todas as regras são avaliadas
- Todas as decisões são logadas
- Nenhum trade é bloqueado ou modificado
- Permite validar regras antes de ativar

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| API externa falha | Usar defaults e não bloquear |
| Filtro muito agressivo | Começar em log-only mode |
| Perder bons trades | Analisar trades rejeitados |
| Latência adicional | Cache agressivo (já existe) |
