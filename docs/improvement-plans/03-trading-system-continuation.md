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

### 🔄 Fase 3: Decomposição do Scheduler - EM PROGRESSO

Módulos criados em `apps/backend/src/services/auto-trading/`:
- `types.ts` - Interfaces (ActiveWatcher, CacheEntry, WalletRotationState, dependency interfaces) ✅
- `cache-manager.ts` - Classe CacheManager para BTC klines, HTF klines, funding rate, config ✅
- `utils.ts` - Funções utilitárias (log, yieldToEventLoop, getCandleCloseTime, etc.) ✅
- `index.ts` - Re-exportações ✅
- `btc-stream-manager.ts` - Gerenciamento de streams BTC para correlação (~90 linhas) ✅ **NOVO**
- `watcher-manager.ts` - Gerenciamento do ciclo de vida dos watchers (~350 linhas) ✅ **NOVO**
- `rotation-manager.ts` - Rotação dinâmica de símbolos (~500 linhas) ✅ **NOVO**

**O QUE FALTA NA FASE 3:**

O arquivo `auto-trading-scheduler.ts` ainda tem **3480 linhas** e precisa dos seguintes módulos:

```
Métodos identificados para extração:

✅ 1. **rotation-manager.ts** (~500 linhas) - CONCLUÍDO
   - rotationStates, isCheckingRotation
   - startDynamicRotation(), stopDynamicRotation()
   - applyRotation(), triggerManualRotation()
   - checkAnticipatedRotations(), checkAllRotationsOnce()
   - applyRotationWithQueue(), restoreRotationStates()
   - getRotationConfig(), getNextRotationTime(), isRotationActive()

✅ 2. **watcher-manager.ts** (~350 linhas) - CONCLUÍDO
   - activeWatchers Map
   - startWatcher(), stopWatcher(), stopAllWatchersForWallet()
   - getWatcherStatusFromDb(), restoreWatchersFromDb()
   - getDynamicWatcherCount(), getManualWatcherCount()

❌ 3. **signal-processor.ts** (~500 linhas) - PENDENTE
   - processWatcherCore() - linha 851
   - processWatcherWithBuffer() - linha 794
   - processWatcherQueue() - linha 720
   - queueWatcherProcessing() - linha 704

❌ 4. **order-executor.ts** (~800 linhas) - PENDENTE
   - executeSetup() - linha 1405
   - executeSetupInternal() - linha 1433 (inclui todas as validações de filtros)
   - executeSetupSafe() - linha 1144
   - calculateFibonacciTakeProfit() - linha 3071

✅ 5. **btc-stream-manager.ts** (~90 linhas) - CONCLUÍDO
   - ensureBtcKlineStream()
   - cleanupBtcKlineStreamIfNeeded()
   - btcStreamSubscribed Set

❌ 6. **scheduler.ts** (orquestrador principal, ~500 linhas) - PENDENTE
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
├── auto-trading/                 # Diretório de módulos
│   ├── types.ts                  # ✅ CONCLUÍDO - interfaces e dependency types
│   ├── cache-manager.ts          # ✅ CONCLUÍDO - gerenciamento de cache
│   ├── utils.ts                  # ✅ CONCLUÍDO - funções utilitárias
│   ├── index.ts                  # ✅ CONCLUÍDO - re-exportações
│   ├── btc-stream-manager.ts     # ✅ CONCLUÍDO - gerenciamento de streams BTC
│   ├── watcher-manager.ts        # ✅ CONCLUÍDO - ciclo de vida dos watchers
│   ├── rotation-manager.ts       # ✅ CONCLUÍDO - rotação dinâmica de símbolos
│   ├── signal-processor.ts       # ❌ CRIAR - processamento de sinais/watchers
│   ├── order-executor.ts         # ❌ CRIAR - execução de ordens (800+ linhas)
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

Os testes `SharedPortfolioManager.test.ts` e `configLoader.test.ts` passam corretamente:
- `EXPOSURE_MULTIPLIER` = 1.75
- `MIN_RISK_REWARD_RATIO` = 1.0

**Status atual dos testes:**
```bash
✅ src/__tests__/backtesting/SharedPortfolioManager.test.ts (27 tests)
✅ src/__tests__/backtesting/configLoader.test.ts (7 tests)
✅ TypeScript compila sem erros
```

## Critérios de Sucesso

- [ ] Nenhum arquivo > 500 linhas (PARCIAL - 3 módulos criados < 500 linhas)
- [x] Todos os testes de backtesting passando
- [x] TypeScript compila sem erros
- [x] Código mais organizado e manutenível
- [x] Imports limpos e sem referências circulares
- [ ] Substituir auto-trading-scheduler.ts pelo novo scheduler.ts

## Próximos Passos

Para continuar a decomposição, falta:

1. **signal-processor.ts** (~500 linhas)
   - Extrair processWatcherCore, processWatcherWithBuffer, processWatcherQueue
   - Esta é a lógica de processamento de sinais do watcher

2. **order-executor.ts** (~800 linhas) - MAIS COMPLEXO
   - Extrair executeSetup, executeSetupInternal, executeSetupSafe
   - Inclui toda a lógica de validação de filtros
   - Inclui createStopLossOrder, createTakeProfitOrder, OCO orders
   - Inclui calculateFibonacciTakeProfit

3. **scheduler.ts** (orquestrador)
   - Criar novo scheduler que usa todos os módulos
   - Manter interface pública compatível
   - Substituir auto-trading-scheduler.ts

## Comando para Continuar

```
Continue a decomposição do trading system. Os módulos btc-stream-manager.ts,
watcher-manager.ts e rotation-manager.ts já foram criados. Falta criar:
signal-processor.ts, order-executor.ts e scheduler.ts (orquestrador principal).

O order-executor.ts é o mais complexo pois contém toda a lógica de execução
de ordens (~800 linhas). Considere se vale a pena decompô-lo em sub-módulos:
- filter-validator.ts - validação de filtros (BTC correlation, funding, MTF, etc)
- position-executor.ts - criação de ordens entry/SL/TP
- paper-trading-executor.ts - lógica específica de paper trading
```

## Histórico de Alterações

- **2025-01-22**: Criados btc-stream-manager.ts, watcher-manager.ts, rotation-manager.ts
  - TypeScript compila sem erros
  - Testes de backtesting passam
  - Módulos usam injeção de dependência para evitar acoplamento circular
