# Prompt para Continuar Decomposição do Trading System

## Contexto

O plano `03-trading-system.md` está parcialmente concluído:

### ✅ Fase 1: Quick Fixes - CONCLUÍDO
- Removido `_riskPercent` de `calculateKellyCriterion` em `auto-trading.ts`
- Removido `_interval` de `getStrategyStatistics` em `auto-trading.ts`
- `pnl-calculator.ts` extendido com suporte a leverage
- `trading.ts` e `futures-trading.ts` refatorados para usar `calculatePnl()`

### ✅ Fase 2: Unificação SPOT/FUTURES - CONCLUÍDO
- Criado `market-client-factory.ts` com interface `MarketClient`
- Implementado `SpotClient` e `FuturesClient`
- Refatorados `createOrder`, `cancelOrder`, `syncOrders` para usar MarketClient

### 🔄 Fase 3: Decomposição do Scheduler - PARCIALMENTE INICIADO

Módulos criados em `apps/backend/src/services/auto-trading/`:
- `types.ts` - Interfaces (ActiveWatcher, CacheEntry, WalletRotationState)
- `cache-manager.ts` - Classe CacheManager para BTC klines, HTF klines, funding rate, config
- `utils.ts` - Funções utilitárias (log, yieldToEventLoop, getCandleCloseTime, etc.)
- `index.ts` - Re-exportações

**O QUE FALTA NA FASE 3:**

O arquivo `auto-trading-scheduler.ts` tem **3480 linhas** e precisa ser decomposto em módulos menores. A estrutura já foi analisada:

```
Métodos identificados para extração:

1. **rotation-manager.ts** (~600 linhas)
   - rotationStates, isCheckingRotation
   - startDynamicRotation() - linha 3110
   - stopDynamicRotation() - linha 3178
   - applyRotation() - linha 3224
   - triggerManualRotation() - linha 3341
   - checkAnticipatedRotations() - linha 436
   - checkAllRotationsOnce() - linha 517
   - applyRotationWithQueue() - linha 611
   - restoreRotationStates() - linha 2985
   - getRotationConfig(), getNextRotationTime(), etc.

2. **watcher-manager.ts** (~400 linhas)
   - activeWatchers Map
   - startWatcher() - linha 1186
   - stopWatcher() - linha 1338
   - stopAllWatchersForWallet() - linha 1375
   - getWatcherStatusFromDb() - linha 2851
   - restoreWatchersFromDb() - linha 2886
   - isWatcherRecentlyRotated() - linha 838

3. **signal-processor.ts** (~500 linhas)
   - processWatcherCore() - linha 851
   - processWatcherWithBuffer() - linha 794
   - processWatcherQueue() - linha 720
   - queueWatcherProcessing() - linha 704

4. **order-executor.ts** (~800 linhas)
   - executeSetup() - linha 1405
   - executeSetupInternal() - linha 1433 (inclui todas as validações de filtros)
   - executeSetupSafe() - linha 1144
   - calculateFibonacciTakeProfit() - linha 3071

5. **btc-stream-manager.ts** (~100 linhas)
   - ensureBtcKlineStream() - linha 301
   - cleanupBtcKlineStreamIfNeeded() - linha 346
   - btcStreamSubscribed Set

6. **scheduler.ts** (orquestrador principal, ~500 linhas)
   - Importa todos os módulos acima
   - Mantém a lógica de coordenação
   - Constructor e inicialização
   - startAnticipationTimer(), stopAnticipationTimer()
   - incrementBarsForOpenTrades()
   - emitLogsToWebSocket()
```

## Tarefa

Decomponha completamente o `auto-trading-scheduler.ts` seguindo a estrutura acima:

1. **Mova cada grupo de métodos** para seu respectivo módulo
2. **Mantenha a mesma funcionalidade** - não altere a lógica, apenas reorganize
3. **Use injeção de dependência** onde necessário para evitar referências circulares
4. **Atualize os imports** no scheduler principal
5. **Execute os testes** para garantir que nada quebrou

## Arquivos Relevantes

```
apps/backend/src/services/
├── auto-trading-scheduler.ts     # Arquivo principal (3480 linhas) - DECOMPOR
├── auto-trading/                 # Diretório já criado
│   ├── types.ts                  # ✅ Já existe
│   ├── cache-manager.ts          # ✅ Já existe
│   ├── utils.ts                  # ✅ Já existe
│   ├── index.ts                  # ✅ Já existe
│   ├── rotation-manager.ts       # ❌ CRIAR
│   ├── watcher-manager.ts        # ❌ CRIAR
│   ├── signal-processor.ts       # ❌ CRIAR
│   ├── order-executor.ts         # ❌ CRIAR
│   ├── btc-stream-manager.ts     # ❌ CRIAR
│   └── scheduler.ts              # ❌ CRIAR (substituirá auto-trading-scheduler.ts)
```

## Estratégia de Implementação

1. **Leia o arquivo completo** `auto-trading-scheduler.ts`
2. **Crie cada módulo** extraindo os métodos correspondentes
3. **Resolva dependências** usando:
   - Parâmetros de função para dados necessários
   - Callbacks para interações entre módulos
   - Injeção de dependências no constructor
4. **Atualize o scheduler principal** para usar os módulos
5. **Delete o arquivo antigo** após validar que tudo funciona

## Exemplo de Padrão para Módulos

```typescript
// rotation-manager.ts
import type { MarketType } from '@marketmind/types';
import type { RotationConfig, RotationResult } from '../dynamic-symbol-rotation';
import type { WalletRotationState, RotationPendingWatcher } from './types';

export interface RotationManagerDeps {
  startWatcher: (walletId: string, userId: string, symbol: string, interval: string, profileId?: string, isManual?: boolean, marketType?: MarketType) => Promise<void>;
  stopWatcher: (walletId: string, symbol: string, interval: string, marketType: MarketType) => Promise<void>;
  addToProcessingQueue: (watcherIds: string[]) => void;
}

export class RotationManager {
  private rotationStates: Map<string, WalletRotationState> = new Map();
  private isCheckingRotation: Set<string> = new Set();
  private rotationPendingWatchers = new Map<string, RotationPendingWatcher>();
  private recentlyRotatedWatchers = new Map<string, number>();
  private anticipationCheckIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private deps: RotationManagerDeps) {}

  async startDynamicRotation(/* params */): Promise<void> {
    // implementação movida do scheduler
  }

  async stopDynamicRotation(walletId: string, stopDynamicWatchers: boolean = true): Promise<void> {
    // implementação movida do scheduler
  }

  // ... outros métodos
}
```

## Testes

Após a decomposição, execute:

```bash
pnpm --filter @marketmind/backend test -- --run
```

Os testes `SharedPortfolioManager.test.ts` e `configLoader.test.ts` já foram corrigidos para usar valores de `TRADING_DEFAULTS` em vez de valores hardcoded:
- `EXPOSURE_MULTIPLIER` = 1.75
- `MIN_RISK_REWARD_RATIO` = 1.0

Todos os testes relacionados à decomposição devem passar.

## Critérios de Sucesso

- [ ] Nenhum arquivo > 500 linhas
- [ ] Todos os testes passando
- [ ] Mesma funcionalidade do sistema original
- [ ] Código mais organizado e manutenível
- [ ] Imports limpos e sem referências circulares

## Comando para Iniciar

```
Execute o plano de decomposição do trading system (03-trading-system.md),
focando na Fase 3 que está parcialmente iniciada. O arquivo auto-trading-scheduler.ts
tem 3480 linhas e precisa ser decomposto em módulos menores no diretório
apps/backend/src/services/auto-trading/. Já existem tipos, cache-manager e utils
criados. Falta criar: rotation-manager.ts, watcher-manager.ts, signal-processor.ts,
order-executor.ts, btc-stream-manager.ts e scheduler.ts (orquestrador principal).
Leia o arquivo completo, extraia os métodos para cada módulo, e atualize os imports.
Execute os testes no final.
```
