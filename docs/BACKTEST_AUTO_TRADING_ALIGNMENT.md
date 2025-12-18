# Alinhamento Backtesting com Auto-Trading

## Objetivo
Garantir que o sistema de backtesting use exatamente as mesmas condições que o auto-trading, permitindo resultados mais realistas e comparáveis.

---

## Diferenças Identificadas

| Funcionalidade | Auto-Trading | Backtest | Pode Alinhar? |
|----------------|-------------|----------|---------------|
| ML Filter | Sim (blend 50/50) | Sim (blend 70/30) | SIM - corrigir fórmula |
| Market Context Filter | Sim (Fear/Greed, Funding, BTC Dom, OI) | Não | SIM - dados históricos disponíveis |
| Cooldown System | Sim (por strategy-symbol-interval) | Não | SIM - simular |
| Pyramiding | Sim | Não | PULAR - complexo demais |
| Position Sizing Dinâmico | Sim (fatores performance/volatilidade) | Parcial | PARCIAL - adicionar fator volatilidade |
| Daily Loss Limit | Sim | Não | SIM - adicionar check |
| Fee Viability Check | Sim | Parcial (minProfitPercent) | SIM - alinhar fórmula |
| Risk Validation | Completo (risk-manager) | Básico (max positions/exposure) | PARCIAL |

---

## Fontes de Dados Históricos Disponíveis

### 1. Fear & Greed Index
- **API**: `https://api.alternative.me/fng/?limit=0`
- **Dados**: Todos os dados históricos desde 2018
- **Formato**: JSON com `value`, `value_classification`, `timestamp`
- **Rate Limit**: 60 requests/minuto

### 2. Binance Funding Rate
- **Endpoint**: `GET /fapi/v1/fundingRate`
- **Parâmetros**: `symbol`, `startTime`, `endTime`, `limit`
- **Dados**: Histórico de funding rates por símbolo
- **Rate Limit**: 500/5min/IP

### 3. BTC Dominance
- **Opção 1**: Calcular via market cap histórico
- **Opção 2**: Usar valores em cache
- **Limitação**: Dados históricos limitados

### 4. Open Interest
- **Endpoint**: `GET /fapi/v1/openInterest`
- **Limitação**: Dados históricos muito limitados

---

## Plano de Implementação

### Fase 1: Serviço de Contexto de Mercado Histórico

**Arquivo**: `apps/backend/src/services/historical-market-context.ts` (NOVO)

```typescript
export class HistoricalMarketContextService {
  private fearGreedCache: Map<string, number> = new Map();
  private fundingRateCache: Map<string, Map<string, number>> = new Map();

  async fetchHistoricalFearGreed(startDate: Date, endDate: Date): Promise<void>;
  async fetchHistoricalFundingRates(symbol: string, startDate: Date, endDate: Date): Promise<void>;
  getMarketContextAtTimestamp(timestamp: number, symbol: string): MarketContextData;
}
```

**Tarefas**:
1. Criar classe `HistoricalMarketContextService`
2. Implementar `fetchHistoricalFearGreed()` - buscar da API Alternative.me
3. Implementar `fetchHistoricalFundingRates(symbol, startDate, endDate)` - buscar da Binance
4. Criar cache em memória para performance do backtest
5. Adicionar método `getMarketContextAtTimestamp(timestamp, symbol)`

---

### Fase 2: Adicionar Market Context Filter ao BacktestEngine

**Arquivos**:
- `apps/backend/src/services/backtesting/BacktestEngine.ts`
- `packages/types/src/backtesting.ts`

**Novas opções de config**:
```typescript
interface BacktestConfig {
  // ... existing fields
  useMarketContextFilter?: boolean;
  marketContextConfig?: {
    fearGreed: {
      enabled: boolean;
      thresholdLow: number;   // default: 20
      thresholdHigh: number;  // default: 80
      action: 'block' | 'reduce_size' | 'warn_only';
    };
    fundingRate: {
      enabled: boolean;
      threshold: number;      // default: 0.05%
      action: 'block' | 'penalize' | 'warn_only';
    };
  };
}
```

**Tarefas**:
1. Adicionar opção `useMarketContextFilter?: boolean` na config
2. Adicionar `marketContextConfig?: MarketContextConfig` na config
3. Importar serviço de contexto histórico
4. Antes de cada trade, aplicar mesma lógica de filtro do `market-context-filter.ts`:
   - Filtro de extreme fear/greed
   - Filtro de funding rate por direção
5. Logar trades pulados com motivo

---

### Fase 3: Adicionar Simulação de Cooldown

**Arquivo**: `apps/backend/src/services/backtesting/BacktestEngine.ts`

**Novas opções**:
```typescript
interface BacktestConfig {
  // ... existing fields
  useCooldown?: boolean;
  cooldownMinutes?: number;  // default: 15
}
```

**Tarefas**:
1. Adicionar `useCooldown?: boolean` e `cooldownMinutes?: number`
2. Rastrear último trade por strategy-symbol-interval
3. Pular trades dentro do período de cooldown
4. Adicionar contador de skips por cooldown

---

### Fase 4: Alinhar Fórmula de Confidence Blending

**Arquivo**: `apps/backend/src/services/backtesting/BacktestEngine.ts`

**Mudança** (linha ~312):
```typescript
// ANTES (70/30)
const blendedConfidence = (setup.confidence * 0.7) + (mlConfidence * 0.3);

// DEPOIS (50/50 - igual auto-trading)
const blendedConfidence = (setup.confidence + mlConfidence) / 2;
```

---

### Fase 5: Adicionar Daily Loss Limit Check

**Arquivos**:
- `apps/backend/src/services/backtesting/BacktestEngine.ts`
- `packages/types/src/backtesting.ts`

**Nova opção**:
```typescript
interface BacktestConfig {
  // ... existing fields
  dailyLossLimit?: number;  // percent of capital (e.g., 5 = 5%)
}
```

**Tarefas**:
1. Adicionar `dailyLossLimit?: number` na config
2. Rastrear PnL diário durante loop do backtest
3. Pular trades quando loss diário exceder limite
4. Resetar contador de PnL diário nas fronteiras de dia
5. Adicionar contador de skips por daily loss limit

---

### Fase 6: Adicionar Ajuste de Position Size por Volatilidade

**Arquivo**: `apps/backend/src/services/backtesting/BacktestEngine.ts`

**Lógica** (mesmo do auto-trading):
```typescript
const HIGH_VOLATILITY_THRESHOLD = 3.0;  // ATR% > 3%
const REDUCTION_FACTOR = 0.7;

const atrPercent = (atr / currentPrice) * 100;
if (atrPercent > HIGH_VOLATILITY_THRESHOLD) {
  positionSize *= REDUCTION_FACTOR;
}
```

**Tarefas**:
1. Calcular ATR no ponto de entrada
2. Se ATR% > 3%, aplicar multiplicador 0.7x no position size
3. Logar ajuste de volatilidade quando aplicado

---

### Fase 7: Atualizar CLI

**Arquivos**:
- `apps/backend/src/cli/commands/validate.ts`
- `apps/backend/src/cli/backtest-runner.ts`

**Novas opções CLI**:
```bash
--use-market-context-filter    # Habilitar filtro de contexto de mercado
--use-cooldown                 # Habilitar simulação de cooldown
--cooldown-minutes <n>         # Minutos de cooldown (default: 15)
--daily-loss-limit <percent>   # Limite de loss diário em %
```

---

### Fase 8: Rodar Backtests Abrangentes

**Símbolos**: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT
**Timeframes**: 15m, 30m, 1h, 4h, 1d, 1w
**Total**: 4 símbolos x 6 timeframes = 24 backtests

**Comando template**:
```bash
pnpm exec tsx src/cli/backtest-runner.ts validate \
  -s <strategy> \
  --symbol <SYMBOL> \
  -i <interval> \
  --start 2024-01-01 \
  --end 2024-12-01 \
  --optimized \
  --use-ml-filter \
  --use-market-context-filter \
  --use-cooldown
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `apps/backend/src/services/historical-market-context.ts` | CRIAR |
| `apps/backend/src/services/backtesting/BacktestEngine.ts` | MODIFICAR |
| `packages/types/src/backtesting.ts` | MODIFICAR |
| `apps/backend/src/cli/commands/validate.ts` | MODIFICAR |
| `apps/backend/src/cli/backtest-runner.ts` | MODIFICAR |

---

## Estratégia de Testes

1. Rodar backtest único com todas as features novas habilitadas
2. Comparar resultados com mesmo backtest sem as features
3. Verificar se market context filter está aplicando corretamente
4. Verificar se cooldown está sendo respeitado
5. Verificar se daily loss limit para trading apropriadamente

---

## Complexidade Estimada

| Fase | Complexidade | Tempo Estimado |
|------|--------------|----------------|
| Fase 1 | Média | 1-2h |
| Fase 2 | Média | 1-2h |
| Fase 3 | Baixa | 30min |
| Fase 4 | Baixa | 15min |
| Fase 5 | Baixa | 30min |
| Fase 6 | Baixa | 30min |
| Fase 7 | Baixa | 30min |
| Fase 8 | Baixa | 1h (execução) |

**Total**: ~5-7 horas de implementação

---

## Referências

- [Alternative.me Fear & Greed API](https://alternative.me/crypto/api/)
- [Binance Funding Rate API](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Get-Funding-Rate-History)
- Auto-trading scheduler: `apps/backend/src/services/auto-trading-scheduler.ts`
- Market context filter: `apps/backend/src/services/market-context-filter.ts`
