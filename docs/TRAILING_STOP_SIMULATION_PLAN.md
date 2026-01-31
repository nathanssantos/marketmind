# Plano de Implementação: Simulação de Trailing Stop no Backtesting

**Status:** 🟢 Em Implementação
**Versão:** 1.7.0
**Última Atualização:** 2026-01-31
**Autor:** Claude Opus 4.5 + Nathan

---

## 🚀 RESUMO EXECUTIVO (Para Novos Chats)

### Estado Atual
- **Otimização de 3 anos rodando** em background (~82,944 combinações)
- **Script principal:** `apps/backend/src/cli/optimize-trailing-stop.ts`
- **Período:** 2023-01-01 a 2026-01-31 | **Ativo:** BTCUSDT | **Timeframe:** 2h
- **Capital:** $1,000 | **Posição:** 100% | **Alavancagem:** 5x

### O Que Já Existe (Pronto para Uso)
| Componente | Localização | Status |
|------------|-------------|--------|
| `MultiWatcherBacktestEngine` | `services/backtesting/` | ✅ Operacional |
| `WalkForwardOptimizer` | `services/backtesting/` | ✅ Pronto |
| `MonteCarloSimulator` | `services/backtesting/` | ✅ Pronto |
| `GranularPriceIndex` | `services/backtesting/trailing-stop-backtest.ts` | ✅ Pronto |
| CLI Runner | `cli/backtest-runner.ts` | ✅ Pronto |

### Scripts CLI Ativos
```
cli/
├── optimize-trailing-stop.ts     # PRINCIPAL - Trailing stop params
├── optimize-complete.ts          # Timeframes × Filtros
├── optimize-fibonacci-targets.ts # Níveis de TP
├── optimize-all-pairs.ts         # Sinergia de filtros
├── optimize-trend-ema.ts         # Período EMA
├── compare-timeframes.ts         # Comparação de timeframes
├── validate-trailing-backtest.ts # Validação rápida
├── shared-backtest-config.ts     # Config compartilhada
├── optimization-config.ts        # Config unificada
└── backtest-runner.ts            # CLI principal com subcomandos
```

### Próximos Passos Após Otimização
1. Analisar top 10 configurações
2. Rodar Walk-Forward validation
3. Rodar Monte Carlo (1000 iterações)
4. Aplicar melhor config como default do sistema
5. Atualizar configs no banco de dados

### Limpeza Realizada (v1.7.0)
**Scripts Removidos:**
- `optimize-master.ts`, `optimize-volume-filter.ts` (obsoletos)
- `debug-compare.ts`, `debug-short-filter.ts`, `debug-sol-shorts.ts`
- `compare-volume-*.ts`, `compare-trend-methods.ts`
- `run-fib-*.ts`, `run-fibonacci-*.ts`, `run-multi-timeframe-backtest.ts`

---

## 1. Objetivo

Implementar um sistema de simulação de trailing stop no backtesting que seja **fidedigno ao comportamento do auto-trading**, permitindo testar múltiplas combinações de parâmetros para descobrir a configuração ótima em termos de:

- **PnL (Profit & Loss)** - Maximizar retorno absoluto
- **Sharpe Ratio** - Otimizar retorno ajustado ao risco
- **Max Drawdown** - Minimizar perda máxima do pico ao vale

### Escopo do Projeto

| Aspecto | Especificação |
|---------|---------------|
| **Ativo** | BTCUSDT (Futures) |
| **Capital por Entrada** | 80% do equity |
| **Período de Teste** | 3 anos (Jan/2023 - Jan/2026) |
| **Timeframe Principal** | 2h (configurável) |
| **Timeframe Granular** | 5m (para simulação precisa do trailing) |
| **Mercado** | Futures com alavancagem configurável |

---

## 2. Arquitetura do Sistema

### 2.1 Componentes Principais

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TrailingStopBacktestEngine                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ GranularPrice │  │ TrailingStop  │  │  ParameterOptimizer   │   │
│  │   Simulator   │  │   Simulator   │  │                       │   │
│  │               │  │               │  │  - Grid Search        │   │
│  │  - 5m Klines  │  │  - Activation │  │  - Bayesian Opt       │   │
│  │  - Tick-level │  │  - Adjustment │  │  - Parallel Runs      │   │
│  │  - OHLC Walk  │  │  - Exit Logic │  │                       │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │    Filter     │  │  Fibonacci    │  │     Results           │   │
│  │  Orchestrator │  │   Resolver    │  │    Aggregator         │   │
│  │               │  │               │  │                       │   │
│  │  - 15 Filters │  │  - Entry Lvl  │  │  - PnL Tracking       │   │
│  │  - Confluence │  │  - Target Lvl │  │  - Sharpe Calc        │   │
│  │  - Scoring    │  │  - Dynamic    │  │  - DD Analysis        │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Dados

```
1. PREPARAÇÃO
   ├── Baixar klines 2h (timeframe principal) - 3 anos
   ├── Baixar klines 5m (granular) - 3 anos (~315K candles)
   └── Indexar por timestamp para lookup rápido

2. DETECÇÃO DE SETUPS
   ├── Executar SetupDetectionService no timeframe 2h
   ├── Filtrar setups por confiança e filtros habilitados
   └── Ordenar cronologicamente

3. SIMULAÇÃO DE TRADE
   Para cada setup:
   ├── Resolver entry price (Fibonacci ou fixed)
   ├── Resolver SL/TP iniciais
   ├── Aplicar filtros (15 disponíveis)
   └── Iniciar simulação granular

4. SIMULAÇÃO GRANULAR (5m)
   Para cada candle de 5 minutos após entrada:
   ├── Verificar hit de SL inicial
   ├── Verificar hit de TP inicial
   ├── Verificar ativação do trailing stop
   │   └── Se ativado:
   │       ├── Calcular novo SL (4 métodos)
   │       ├── Selecionar melhor candidato
   │       └── Atualizar SL se melhorou
   └── Continuar até exit ou fim do período

5. AGREGAÇÃO DE RESULTADOS
   ├── Calcular métricas por combinação de params
   ├── Gerar equity curve
   ├── Calcular Sharpe, Sortino, Max DD
   └── Rankear combinações
```

---

## 3. Parâmetros a Testar

### 3.1 Trailing Stop Configuration (Otimização Independente por Direção)

> **Importante:** O sistema otimiza parâmetros LONG e SHORT de forma independente.
> Cada direção pode ter valores iguais ou diferentes - o otimizador descobrirá
> a melhor combinação caso a caso.

#### Parâmetros por Direção
| Parâmetro | Tipo | Range | Step | Default LONG | Default SHORT |
|-----------|------|-------|------|--------------|---------------|
| `trailingActivationPercent{Dir}` | number | 50% - 150% | 10% | 100% | 88.6% |
| `trailingDistancePercent{Dir}` | number | 10% - 60% | 5% | 30% | 30% |
| `atrMultiplier{Dir}` | number | 1.0 - 4.0 | 0.5 | 2.0 | 2.0 |
| `breakevenProfitThreshold{Dir}` | number | 0.5% - 3% | 0.5% | 1% | 1% |

#### Configurações Globais
| Parâmetro | Tipo | Range | Step | Default |
|-----------|------|-------|------|---------|
| `trailingStopEnabled` | boolean | [true, false] | - | true |
| `useAdaptiveTrailing` | boolean | [true, false] | - | true |

**Exemplo de Otimização:**
- O sistema pode descobrir que LONG performa melhor com activation=100%, distance=25%
- Enquanto SHORT performa melhor com activation=88.6%, distance=40%
- Ou pode descobrir que ambos performam melhor com os mesmos valores

**Total de combinações trailing:** ~5,000+ (LONG × SHORT otimizados independentemente)

### 3.2 Fibonacci Entry/Target Levels

| Parâmetro | Tipo | Valores |
|-----------|------|---------|
| `minFibEntryLevel` | number | [0.382, 0.5, 0.618, 0.786] |
| `maxFibEntryProgress` | number | [60%, 70%, 75%, 80%] |
| `fibTargetLevelLong` | string | ['auto', '1.272', '1.382', '1.5', '1.618', '2', '2.618'] |
| `fibTargetLevelShort` | string | ['auto', '1.272', '1.382', '1.5', '1.618', '2', '2.618'] |
| `useDynamicFibTarget` | boolean | [true, false] |

**Total de combinações Fibonacci:** ~400+

### 3.3 Filter Combinations

| Filtro | Habilitado por Default | Prioridade de Teste |
|--------|------------------------|---------------------|
| `useTrendFilter` | true | Alta |
| `useDirectionFilter` | true | Alta |
| `useStochasticFilter` | false | Média |
| `useMomentumTimingFilter` | false | Média |
| `useAdxFilter` | true | Alta |
| `useMtfFilter` | true | Alta |
| `useVolumeFilter` | true | Alta |
| `useMarketRegimeFilter` | true | Alta |
| `useChoppinessFilter` | false | Média |
| `useBollingerSqueezeFilter` | false | Baixa |
| `useVwapFilter` | false | Baixa |
| `useSupertrendFilter` | false | Média |
| `useConfluenceScoring` | true | Alta |
| `confluenceMinScore` | 60 | [50, 60, 70, 80] |

**Total de combinações filtros:** ~500+ (subset estratégico)

### 3.4 Position Sizing

| Parâmetro | Valor Fixo |
|-----------|------------|
| `initialCapital` | $1,000 |
| `capitalPerTrade` | 100% |
| `leverage` | 5x (configurável para testes) |
| `maxConcurrentPositions` | 1 |

### 3.5 Modo de Validação (Obrigatório Antes do Backtest Completo)

> **IMPORTANTE:** Sempre rodar validação antes do backtest completo de 3 anos.

#### Configuração de Validação
| Aspecto | Validação | Produção |
|---------|-----------|----------|
| **Período** | 1 mês (Jan/2025) | 3 anos |
| **Combinações** | 5-10 fixas | 5,000+ |
| **Verbose** | true (debug) | false |
| **Output** | Console + arquivo | Apenas arquivo |

#### Checklist de Validação
- [ ] Download de dados funciona (2h + 5m)
- [ ] GranularPriceIndex indexa corretamente
- [ ] Trailing stop ativa no momento correto
- [ ] Trailing stop ajusta SL conforme esperado
- [ ] Exit por trailing stop é detectado
- [ ] Exit por TP é detectado
- [ ] Exit por SL inicial é detectado
- [ ] Métricas calculadas corretamente
- [ ] Sem memory leaks (monitorar heap)
- [ ] Output não causa overflow

#### CLI de Validação
```bash
# Rodar validação rápida (1 mês, 5 combinações)
pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts \
  --symbol BTCUSDT \
  --timeframe 2h \
  --start 2025-01-01 \
  --end 2025-01-31 \
  --validate \
  --verbose
```

### 3.6 Controle de Output e Logging

> **CRÍTICO:** Evitar logs excessivos que causam travamentos e overflow de buffer.

#### Níveis de Log
| Nível | Quando Usar | Exemplo |
|-------|-------------|---------|
| `silent` | Produção (apenas erros críticos) | - |
| `summary` | Produção (progresso a cada N%) | "Progress: 50% (2500/5000)" |
| `verbose` | Validação/Debug | Cada trade, cada SL update |

#### Regras de Output
```typescript
interface OutputConfig {
  // Controle de verbosidade
  logLevel: 'silent' | 'summary' | 'verbose';

  // Progress reporting
  progressIntervalPercent: number;  // Report a cada N% (default: 5%)
  progressIntervalSeconds: number;  // Ou a cada N segundos (default: 30)

  // Arquivo de output
  outputFile: string;               // Resultados salvos em arquivo
  appendMode: boolean;              // Append vs overwrite

  // Limites de segurança
  maxConsoleLines: number;          // Máximo de linhas no console (default: 1000)
  flushIntervalMs: number;          // Flush buffer a cada N ms (default: 5000)
}
```

#### Estrutura de Output
```typescript
interface BacktestOutput {
  // Metadata
  runId: string;
  startedAt: Date;
  completedAt: Date;
  config: OptimizationConfig;

  // Resumo (sempre logado)
  summary: {
    totalCombinations: number;
    completedCombinations: number;
    failedCombinations: number;
    elapsedTimeMs: number;
    estimatedRemainingMs: number;
  };

  // Resultados (salvos em arquivo, não no console)
  results: OptimizationResult[];

  // Erros (logados individualmente)
  errors: Array<{
    combination: number;
    error: string;
    stack?: string;
  }>;
}
```

#### Exemplo de Progress Output (Modo Summary)
```
[2026-01-31 10:00:00] Starting optimization: 5000 combinations
[2026-01-31 10:00:30] Progress:   5% (  250/5000) | ETA: 9m 30s | Best PnL: +45.2%
[2026-01-31 10:01:00] Progress:  10% (  500/5000) | ETA: 9m 00s | Best PnL: +52.1%
[2026-01-31 10:01:30] Progress:  15% (  750/5000) | ETA: 8m 30s | Best PnL: +52.1%
...
[2026-01-31 10:10:00] Completed: 5000/5000 | Total time: 10m 00s
[2026-01-31 10:10:00] Results saved to: results/trailing-opt-2026-01-31.json
[2026-01-31 10:10:00] Top 3 by composite score:
  1. PnL: +156.3% | Sharpe: 2.41 | DD: 12.3% | Score: 0.847
  2. PnL: +142.8% | Sharpe: 2.55 | DD: 14.1% | Score: 0.832
  3. PnL: +168.2% | Sharpe: 2.12 | DD: 18.7% | Score: 0.819
```

#### Prevenção de Problemas
```typescript
class SafeLogger {
  private lineCount = 0;
  private buffer: string[] = [];

  log(message: string): void {
    if (this.config.logLevel === 'silent') return;

    // Limite de linhas no console
    if (this.lineCount >= this.config.maxConsoleLines) {
      console.log('... [output truncated, see file for full results]');
      return;
    }

    // Buffer com flush periódico
    this.buffer.push(message);
    if (this.buffer.length >= 100 || this.shouldFlush()) {
      this.flush();
    }

    this.lineCount++;
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    console.log(this.buffer.join('\n'));
    this.buffer = [];
  }
}
```

---

## 4. Implementação Detalhada

### 4.1 Fase 1: Infraestrutura de Dados (Semana 1)

#### 4.1.1 Kline Downloader Service

**Arquivo:** `apps/backend/src/services/backtesting/KlineDownloaderService.ts`

```typescript
interface KlineDownloadConfig {
  symbol: string;
  intervals: IntervalKey[];  // ['2h', '5m']
  startDate: Date;
  endDate: Date;
  marketType: 'FUTURES';
}

class KlineDownloaderService {
  // Baixa e armazena klines em batch
  async downloadAndStore(config: KlineDownloadConfig): Promise<void>;

  // Verifica gaps e preenche automaticamente
  async backfillGaps(symbol: string, interval: IntervalKey): Promise<void>;

  // Estima tempo de download
  estimateDownloadTime(config: KlineDownloadConfig): Duration;
}
```

**Estimativa de dados para 3 anos:**
- 2h: ~13,140 candles (~400KB)
- 5m: ~315,360 candles (~10MB comprimido)

#### 4.1.2 Granular Price Index

**Arquivo:** `apps/backend/src/services/backtesting/GranularPriceIndex.ts`

```typescript
interface GranularPriceIndex {
  // Índice otimizado para lookup por timestamp
  getKlinesInRange(startTs: number, endTs: number): Kline[];

  // Retorna preço mais próximo de um timestamp
  getPriceAtTimestamp(ts: number): { price: number; kline: Kline };

  // Itera por cada kline no range (generator)
  *iterateKlines(startTs: number, endTs: number): Generator<Kline>;
}
```

**Otimização:** Usar `Map<timestamp, Kline>` com lazy loading por chunks de 1 semana.

---

### 4.2 Fase 2: Trailing Stop Simulator (Semana 2)

#### 4.2.1 Core Simulator

**Arquivo:** `apps/backend/src/services/backtesting/TrailingStopSimulator.ts`

```typescript
interface TrailingStopSimulatorConfig {
  // Configuração global
  trailingStopEnabled: boolean;
  useAdaptiveTrailing: boolean;

  // Configuração LONG (otimizada independentemente)
  trailingActivationPercentLong: number;  // Fibonacci level para ativação
  trailingDistancePercentLong: number;    // Distância do trailing
  atrMultiplierLong: number;              // Multiplicador ATR
  breakevenProfitThresholdLong: number;   // Threshold de breakeven

  // Configuração SHORT (otimizada independentemente)
  trailingActivationPercentShort: number;
  trailingDistancePercentShort: number;
  atrMultiplierShort: number;
  breakevenProfitThresholdShort: number;

  // Configuração de fees
  makerFee: number;  // 0.02%
  takerFee: number;  // 0.04%
  useBnbDiscount: boolean;
}

interface TrailingSimulationState {
  isActivated: boolean;
  activatedAt: number | null;
  highestPrice: number;  // Para LONG
  lowestPrice: number;   // Para SHORT
  currentStopLoss: number;
  stopLossHistory: Array<{
    timestamp: number;
    price: number;
    reason: 'fees_covered' | 'swing_trail' | 'atr_trail' | 'progressive_trail';
  }>;
}

interface TrailingSimulationResult {
  exitPrice: number;
  exitTime: number;
  exitReason: 'TRAILING_STOP' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'END_OF_PERIOD';
  trailingState: TrailingSimulationState;
  pricePathSummary: {
    maxFavorableExcursion: number;  // MFE
    maxAdverseExcursion: number;    // MAE
    timeToActivation: number | null;
  };
}

class TrailingStopSimulator {
  constructor(
    private config: TrailingStopSimulatorConfig,
    private granularIndex: GranularPriceIndex
  ) {}

  // Simula trailing stop para um trade específico
  simulateTrade(trade: BacktestTradeSetup): TrailingSimulationResult {
    const state = this.initializeState(trade);

    // Iterar por cada kline de 5m após entrada
    for (const kline of this.granularIndex.iterateKlines(
      trade.entryTime,
      trade.maxExitTime
    )) {
      // Simular movimento de preço dentro do candle
      const exitResult = this.processKline(kline, trade, state);
      if (exitResult) return exitResult;
    }

    return this.createEndOfPeriodResult(state);
  }

  private processKline(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): TrailingSimulationResult | null {
    // Ordem de processamento dentro do candle 5m:
    // 1. Verificar SL hit (usa low para LONG, high para SHORT)
    // 2. Verificar ativação do trailing
    // 3. Se ativado, calcular novo SL
    // 4. Verificar TP hit
    // 5. Atualizar extremos (highest/lowest)

    const isLong = trade.side === 'LONG';

    // 1. Check stop loss hit
    const slHit = isLong
      ? kline.low <= state.currentStopLoss
      : kline.high >= state.currentStopLoss;

    if (slHit) {
      return this.createStopLossResult(kline, state);
    }

    // 2. Check trailing activation
    if (!state.isActivated) {
      const shouldActivate = this.checkActivation(kline, trade, state);
      if (shouldActivate) {
        state.isActivated = true;
        state.activatedAt = kline.closeTime;
      }
    }

    // 3. Update trailing stop if activated
    if (state.isActivated) {
      this.updateTrailingStop(kline, trade, state);
    }

    // 4. Check take profit hit
    const tpHit = isLong
      ? kline.high >= trade.takeProfit
      : kline.low <= trade.takeProfit;

    if (tpHit) {
      return this.createTakeProfitResult(kline, trade);
    }

    // 5. Update extremes
    if (isLong) {
      state.highestPrice = Math.max(state.highestPrice, kline.high);
    } else {
      state.lowestPrice = Math.min(state.lowestPrice, kline.low);
    }

    return null; // Continue simulation
  }

  private checkActivation(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): boolean {
    const isLong = trade.side === 'LONG';
    const activationLevel = isLong
      ? this.config.trailingActivationPercentLong
      : this.config.trailingActivationPercentShort;

    if (trade.fibonacciProjection) {
      // Fibonacci-based activation
      return this.hasReachedFibonacciLevel(
        kline.close,
        trade.fibonacciProjection,
        activationLevel / 100, // Convert % to decimal
        isLong
      );
    } else {
      // Percentage-based activation
      const profitPercent = isLong
        ? (kline.close - trade.entryPrice) / trade.entryPrice
        : (trade.entryPrice - kline.close) / trade.entryPrice;

      const tpDistance = Math.abs(trade.takeProfit - trade.entryPrice);
      const activationDistance = tpDistance * (activationLevel / 100);
      const currentDistance = Math.abs(kline.close - trade.entryPrice);

      return currentDistance >= activationDistance;
    }
  }

  private updateTrailingStop(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): void {
    // Calcular candidatos de trailing stop
    const candidates = this.calculateTrailingCandidates(kline, trade, state);

    // Selecionar o melhor (mais apertado para LONG, mais solto para SHORT)
    const best = this.selectBestCandidate(candidates, trade.side === 'LONG');

    // Só atualiza se melhorar
    const isImprovement = trade.side === 'LONG'
      ? best.price > state.currentStopLoss
      : best.price < state.currentStopLoss;

    if (isImprovement) {
      state.currentStopLoss = best.price;
      state.stopLossHistory.push({
        timestamp: kline.closeTime,
        price: best.price,
        reason: best.reason
      });
    }
  }

  private calculateTrailingCandidates(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): TrailingCandidate[] {
    const isLong = trade.side === 'LONG';
    const candidates: TrailingCandidate[] = [];

    // 1. Fees Covered Floor
    const roundTripFee = (this.config.takerFee * 2) *
      (this.config.useBnbDiscount ? 0.75 : 1);
    const feesCoveredPrice = isLong
      ? trade.entryPrice * (1 + roundTripFee)
      : trade.entryPrice * (1 - roundTripFee);
    candidates.push({ price: feesCoveredPrice, reason: 'fees_covered' });

    // 2. ATR Trail (usa multiplicador específico por direção)
    if (trade.atr) {
      const atrMultiplier = isLong
        ? this.config.atrMultiplierLong
        : this.config.atrMultiplierShort;
      const atrDistance = trade.atr * atrMultiplier;
      const extremePrice = isLong ? state.highestPrice : state.lowestPrice;
      const atrStop = isLong
        ? extremePrice - atrDistance
        : extremePrice + atrDistance;
      candidates.push({ price: atrStop, reason: 'atr_trail' });
    }

    // 3. Progressive Floor (usa distância específica por direção)
    const trailingDistance = isLong
      ? this.config.trailingDistancePercentLong
      : this.config.trailingDistancePercentShort;
    const extremePrice = isLong ? state.highestPrice : state.lowestPrice;
    const peakProfit = isLong
      ? (extremePrice - trade.entryPrice) / trade.entryPrice
      : (trade.entryPrice - extremePrice) / trade.entryPrice;
    const floorProfit = peakProfit * (1 - trailingDistance / 100);
    const progressiveFloor = isLong
      ? trade.entryPrice * (1 + floorProfit)
      : trade.entryPrice * (1 - floorProfit);
    candidates.push({ price: progressiveFloor, reason: 'progressive_trail' });

    // 4. Swing Trail (requer swing points pre-calculados)
    // TODO: Implementar swing point detection no granular timeframe

    return candidates;
  }
}
```

---

### 4.3 Fase 3: Parameter Optimizer (Semana 3)

#### 4.3.1 Grid Search Implementation

**Arquivo:** `apps/backend/src/services/backtesting/ParameterOptimizer.ts`

```typescript
interface OptimizationConfig {
  // Parâmetros de trailing stop (LONG e SHORT independentes)
  trailingParams: {
    // LONG
    activationPercentLong: number[];    // [50, 60, 70, 80, 90, 100, 110, 120]
    distancePercentLong: number[];      // [10, 20, 30, 40, 50, 60]
    atrMultiplierLong: number[];        // [1.0, 1.5, 2.0, 2.5, 3.0]
    // SHORT
    activationPercentShort: number[];   // [50, 60, 70, 80, 88.6, 100, 110, 120]
    distancePercentShort: number[];     // [10, 20, 30, 40, 50, 60]
    atrMultiplierShort: number[];       // [1.0, 1.5, 2.0, 2.5, 3.0]
    // Global
    useAdaptive: boolean[];             // [true, false]
  };

  // Parâmetros de Fibonacci
  fibParams: {
    entryLevels: number[];              // [0.382, 0.5, 0.618, 0.786]
    targetLevelsLong: string[];         // ['auto', '1.618', '2', '2.618']
    targetLevelsShort: string[];        // ['auto', '1.272', '1.618', '2']
  };

  // Filtros a testar
  filterCombinations: FilterCombination[];

  // Métricas objetivo
  objective: 'pnl' | 'sharpe' | 'calmar' | 'combined';
  objectiveWeights?: {
    pnl: number;
    sharpe: number;
    maxDrawdown: number;  // Penalidade
  };
}

interface OptimizationResult {
  params: Record<string, unknown>;
  metrics: {
    totalPnl: number;
    totalPnlPercent: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    calmarRatio: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgTradeDuration: number;
  };
  equityCurve: EquityPoint[];
  tradeLog: TradeLogEntry[];
}

class ParameterOptimizer {
  private results: OptimizationResult[] = [];

  constructor(
    private engine: TrailingStopBacktestEngine,
    private config: OptimizationConfig
  ) {}

  // Executa grid search paralelo
  async runGridSearch(concurrency: number = 4): Promise<OptimizationResult[]> {
    const combinations = this.generateCombinations();
    console.log(`Total combinations to test: ${combinations.length}`);

    // Divide em batches para processamento paralelo
    const batches = this.chunk(combinations, concurrency);

    for (const batch of batches) {
      const promises = batch.map(params => this.runSingleBacktest(params));
      const results = await Promise.all(promises);
      this.results.push(...results);

      // Progress logging
      console.log(`Progress: ${this.results.length}/${combinations.length}`);
    }

    return this.rankResults();
  }

  // Gera todas as combinações de parâmetros (LONG e SHORT independentes)
  private generateCombinations(): Record<string, unknown>[] {
    const { trailingParams, fibParams, filterCombinations } = this.config;
    const combinations: Record<string, unknown>[] = [];

    // Nested loops para LONG params
    for (const actLong of trailingParams.activationPercentLong) {
      for (const distLong of trailingParams.distancePercentLong) {
        for (const atrLong of trailingParams.atrMultiplierLong) {
          // Nested loops para SHORT params (independente de LONG)
          for (const actShort of trailingParams.activationPercentShort) {
            for (const distShort of trailingParams.distancePercentShort) {
              for (const atrShort of trailingParams.atrMultiplierShort) {
                // Params globais
                for (const adaptive of trailingParams.useAdaptive) {
                  // Fibonacci params
                  for (const entryLvl of fibParams.entryLevels) {
                    for (const tgtLong of fibParams.targetLevelsLong) {
                      for (const tgtShort of fibParams.targetLevelsShort) {
                        for (const filters of filterCombinations) {
                          combinations.push({
                            // LONG trailing config
                            trailingActivationPercentLong: actLong,
                            trailingDistancePercentLong: distLong,
                            atrMultiplierLong: atrLong,
                            // SHORT trailing config
                            trailingActivationPercentShort: actShort,
                            trailingDistancePercentShort: distShort,
                            atrMultiplierShort: atrShort,
                            // Global
                            useAdaptiveTrailing: adaptive,
                            // Fibonacci
                            minFibEntryLevel: entryLvl,
                            fibTargetLevelLong: tgtLong,
                            fibTargetLevelShort: tgtShort,
                            ...filters
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return combinations;
  }

  // Rankeia resultados por objetivo composto
  private rankResults(): OptimizationResult[] {
    const weights = this.config.objectiveWeights || {
      pnl: 0.3,
      sharpe: 0.4,
      maxDrawdown: 0.3
    };

    return this.results
      .map(r => ({
        ...r,
        compositeScore: this.calculateCompositeScore(r.metrics, weights)
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }

  private calculateCompositeScore(
    metrics: OptimizationResult['metrics'],
    weights: { pnl: number; sharpe: number; maxDrawdown: number }
  ): number {
    // Normalizar métricas para escala 0-1
    const normalizedPnl = Math.tanh(metrics.totalPnlPercent / 100);
    const normalizedSharpe = Math.tanh(metrics.sharpeRatio / 3);
    const normalizedDD = 1 - Math.min(metrics.maxDrawdownPercent / 50, 1);

    return (
      weights.pnl * normalizedPnl +
      weights.sharpe * normalizedSharpe +
      weights.maxDrawdown * normalizedDD
    );
  }
}
```

---

### 4.4 Fase 4: Results Aggregator (Semana 4)

#### 4.4.1 Métricas e Relatórios

**Arquivo:** `apps/backend/src/services/backtesting/ResultsAggregator.ts`

```typescript
interface AggregatedResults {
  // Top performers
  topByPnl: OptimizationResult[];
  topBySharpe: OptimizationResult[];
  topByCalmar: OptimizationResult[];
  topByComposite: OptimizationResult[];

  // Análise de sensibilidade
  sensitivityAnalysis: {
    parameter: string;
    impact: number;  // Correlação com performance
    optimalRange: { min: number; max: number };
  }[];

  // Estatísticas gerais
  summary: {
    totalCombinationsTested: number;
    profitableCombinations: number;
    avgPnl: number;
    avgSharpe: number;
    avgMaxDrawdown: number;
    bestPnl: number;
    bestSharpe: number;
    lowestDrawdown: number;
  };

  // Análise de correlação
  correlationMatrix: Record<string, Record<string, number>>;
}

class ResultsAggregator {
  aggregate(results: OptimizationResult[]): AggregatedResults;

  // Exporta para análise externa
  exportToCSV(results: OptimizationResult[], path: string): void;
  exportToJSON(results: AggregatedResults, path: string): void;

  // Gera relatório visual (HTML)
  generateReport(results: AggregatedResults): string;

  // Análise de robustez (Monte Carlo)
  runRobustnessAnalysis(
    topParams: Record<string, unknown>,
    iterations: number
  ): RobustnessResult;
}
```

---

## 5. CLI Scripts

### 5.1 Download de Dados

**Arquivo:** `apps/backend/src/cli/download-granular-data.ts`

```bash
# Uso
pnpm tsx apps/backend/src/cli/download-granular-data.ts \
  --symbol BTCUSDT \
  --intervals 2h,5m \
  --start 2023-01-01 \
  --end 2026-01-31 \
  --market FUTURES
```

### 5.2 Otimização de Trailing Stop

**Arquivo:** `apps/backend/src/cli/optimize-trailing-stop.ts`

```bash
# Uso básico
pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts \
  --symbol BTCUSDT \
  --timeframe 2h \
  --start 2023-01-01 \
  --end 2026-01-31 \
  --capital 10000 \
  --capitalPerTrade 0.8 \
  --leverage 5 \
  --concurrency 4

# Com filtros específicos
pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts \
  --symbol BTCUSDT \
  --filters "trend,direction,adx,mtf,volume" \
  --fibTargets "1.618,2,2.618" \
  --trailingActivation "80,90,100,110" \
  --trailingDistance "20,30,40,50"
```

### 5.3 Análise de Resultados

**Arquivo:** `apps/backend/src/cli/analyze-trailing-results.ts`

```bash
# Gerar relatório
pnpm tsx apps/backend/src/cli/analyze-trailing-results.ts \
  --input results/trailing-optimization-2026-01-31.json \
  --output reports/trailing-analysis.html \
  --top 20
```

---

## 6. Estrutura de Arquivos

```
apps/backend/src/
├── services/
│   └── backtesting/
│       ├── TrailingStopBacktestEngine.ts    # Engine principal
│       ├── TrailingStopSimulator.ts         # Simulador granular
│       ├── GranularPriceIndex.ts            # Índice de preços 5m
│       ├── KlineDownloaderService.ts        # Download de dados
│       ├── ParameterOptimizer.ts            # Grid search
│       ├── ResultsAggregator.ts             # Agregação de resultados
│       └── types/
│           └── trailing-backtest.ts         # Tipos específicos
├── cli/
│   ├── download-granular-data.ts
│   ├── optimize-trailing-stop.ts
│   └── analyze-trailing-results.ts
└── __tests__/
    └── backtesting/
        ├── trailing-stop-simulator.test.ts
        └── parameter-optimizer.test.ts
```

---

## 7. Cronograma de Implementação

### Semana 1: Infraestrutura de Dados
- [x] Implementar `GranularPriceIndex`
- [x] Implementar `SafeLogger` (controle de output)
- [x] Implementar `TrailingStopSimulator`
- [x] Criar tipos reutilizando @marketmind/types
- [x] Criar CLI de validação
- [ ] Implementar `KlineDownloaderService` (usando prefetchKlines existente)
- [ ] Baixar 1 mês de dados (validação) + 3 anos (produção)
- [ ] Criar testes unitários

### Semana 2: Trailing Stop Simulator
- [ ] Implementar `TrailingStopSimulator`
- [ ] Portar lógica de `trailing-stop-core.ts`
- [ ] Implementar os 4 métodos de trailing (direction-aware)
- [ ] Integrar com `GranularPriceIndex`
- [ ] Criar testes de simulação
- [ ] **VALIDAÇÃO:** Rodar 1 mês com 5 combinações

### Semana 3: Parameter Optimizer + Validação
- [ ] Implementar `ParameterOptimizer`
- [ ] Criar gerador de combinações (LONG/SHORT independentes)
- [ ] Implementar execução paralela
- [ ] Criar sistema de ranking
- [ ] Implementar CLI de otimização
- [ ] **VALIDAÇÃO COMPLETA:**
  - [ ] Testar com 1 mês, 50 combinações
  - [ ] Verificar memory usage
  - [ ] Verificar output não trava
  - [ ] Comparar resultados com backtest manual

### Semana 4: Backtest Completo + Analysis
- [ ] ✅ Validação aprovada → Rodar backtest 3 anos
- [ ] Implementar `ResultsAggregator`
- [ ] Criar exportadores (CSV, JSON)
- [ ] Implementar análise de sensibilidade
- [ ] Criar gerador de relatório HTML
- [ ] Documentar resultados

---

## 8. Combinações Prioritárias de Teste

### 8.1 Trailing Stop (Alta Prioridade)

> Cada combinação testa LONG e SHORT com parâmetros independentes

| ID | Act. Long | Act. Short | Dist. Long | Dist. Short | ATR Long | ATR Short | Adaptive |
|----|-----------|------------|------------|-------------|----------|-----------|----------|
| T1 | 100% | 88.6% | 30% | 30% | 2.0 | 2.0 | true |
| T2 | 100% | 88.6% | 25% | 35% | 2.0 | 2.5 | true |
| T3 | 80% | 80% | 30% | 30% | 2.0 | 2.0 | true |
| T4 | 120% | 100% | 40% | 45% | 2.5 | 3.0 | true |
| T5 | 100% | 100% | 20% | 20% | 1.5 | 1.5 | false |
| T6 | 90% | 88.6% | 35% | 40% | 2.0 | 2.5 | true |
| T7 | 100% | 70% | 30% | 50% | 2.0 | 3.0 | true |

### 8.2 Fibonacci Targets (Alta Prioridade)

| ID | Entry Level | Target Long | Target Short |
|----|-------------|-------------|--------------|
| F1 | 0.618 | auto | auto |
| F2 | 0.618 | 1.618 | 1.272 |
| F3 | 0.5 | 2.0 | 1.618 |
| F4 | 0.618 | 2.618 | 2.0 |
| F5 | 0.786 | 1.618 | 1.618 |

### 8.3 Filter Combinations (Alta Prioridade)

| ID | Filters Enabled | Confluence Min |
|----|-----------------|----------------|
| FL1 | trend, direction, adx, mtf | 60 |
| FL2 | trend, direction, adx, mtf, volume | 65 |
| FL3 | trend, direction, adx, mtf, volume, regime | 70 |
| FL4 | trend, direction, adx, stochastic, momentum | 60 |
| FL5 | all enabled | 75 |

---

## 9. Métricas de Sucesso

### 9.1 Objetivos Mínimos

| Métrica | Target Mínimo | Target Ideal |
|---------|---------------|--------------|
| PnL Total (3 anos) | > 100% | > 300% |
| Sharpe Ratio | > 1.5 | > 2.5 |
| Max Drawdown | < 30% | < 15% |
| Win Rate | > 45% | > 55% |
| Profit Factor | > 1.5 | > 2.0 |
| Calmar Ratio | > 1.0 | > 2.0 |

### 9.2 Fórmula de Score Composto

```
CompositeScore = (
  0.30 × normalize(PnL%) +
  0.35 × normalize(Sharpe) +
  0.25 × (1 - normalize(MaxDD%)) +
  0.10 × normalize(WinRate)
)
```

---

## 10. Considerações de Performance

### 10.1 Otimizações de Memória

- Usar streams para processar klines 5m (não carregar 315K candles na RAM)
- Implementar chunked processing (processar 1 semana por vez)
- Liberar memória entre combinações de teste

### 10.2 Otimizações de Tempo

- Paralelizar com worker threads (até 8 cores)
- Cache de indicadores calculados
- Early exit em combinações claramente ruins

### 10.3 Estimativa de Tempo

| Combinações | Concurrency | Tempo Estimado |
|-------------|-------------|----------------|
| 1,000 | 4 | ~2 horas |
| 10,000 | 4 | ~20 horas |
| 50,000 | 8 | ~50 horas |

---

## 11. Consolidação de Scripts de Otimização

### 11.1 Sistema Principal

O sistema de otimização foi consolidado em scripts focados:

| Script | Status | Propósito |
|--------|--------|-----------|
| `optimize-trailing-stop.ts` | **PRINCIPAL** | Trailing stop params (LONG/SHORT) |
| `optimize-complete.ts` | MANTER | Timeframes × Filtros |
| `optimize-fibonacci-targets.ts` | MANTER | Níveis de TP Fibonacci |
| `optimize-all-pairs.ts` | MANTER | Descoberta de sinergias |
| `optimize-trend-ema.ts` | MANTER | Período EMA |

### 11.2 Scripts Removidos

| Script | Status | Motivo |
|--------|--------|--------|
| `optimize-filter-combinations.ts` | ✅ Removido | Duplicava optimize-master.ts |
| `optimize-master.ts` | ✅ Removido | Coberto por optimize-complete.ts |
| `optimize-volume-filter.ts` | ✅ Removido | Volume já testado em complete.ts |

### 11.3 Estrutura Recomendada

```
cli/
├── optimize-trailing-stop.ts     # Trailing stop (CORE)
├── optimize-complete.ts          # Timeframes × Filtros
├── optimize-fibonacci-targets.ts # TP levels
├── optimize-all-pairs.ts         # Filter synergies
├── optimize-trend-ema.ts         # EMA period
├── validate-trailing-backtest.ts # Validação
└── README-OPTIMIZATION.md        # Documentação
```

### 11.4 Config Unificada

Arquivo: `apps/backend/src/cli/optimization-config.ts`

```typescript
export const OPTIMIZATION_DEFAULTS = {
  symbol: 'BTCUSDT',
  marketType: 'FUTURES',
  initialCapital: 1000,
  capitalPerTrade: 1.0,
  leverage: 5,
  mainInterval: '2h',
  granularInterval: '5m',
  startDate: '2023-01-01',
  endDate: '2026-01-31',
};

export const TRAILING_STOP_PARAM_RANGES = {
  quick: { ... },   // 27 combinações
  medium: { ... },  // ~82,944 combinações
  full: { ... },    // ~25M combinações
};

export const SCORE_WEIGHTS = {
  pnl: 0.4,
  sharpe: 0.4,
  maxDrawdown: 0.2,
};
```

### 11.5 Performance Atual

| Métrica | 6 Meses | 3 Anos |
|---------|---------|--------|
| Klines 5m | 51,876 | 324,324 |
| Trades | 178 | 735 |
| Combinações | 82,944 | 82,944 |
| Tempo | ~20 min | ~80 min |
| Memória | ~500MB | ~2GB |

### 11.6 Otimizações de Performance (TODO)

- [ ] **Paralelização:** Worker threads para processar combinações
- [ ] **Cache:** Memoizar cálculos de indicadores
- [ ] **Early Exit:** Pular combinações claramente ruins
- [ ] **Streaming:** Processar klines em chunks
- [ ] **GPU:** Considerar CUDA/WebGPU para cálculos massivos

---

## 12. Aplicação dos Resultados Ótimos

### 11.1 Objetivo Final

Ao final da otimização, a melhor configuração encontrada será aplicada como **default do sistema**:

1. **Trailing Stop Config** - Parâmetros ótimos para LONG e SHORT
2. **Fibonacci Target Levels** - Níveis ótimos por direção
3. **Filter Combinations** - Filtros habilitados/desabilitados
4. **Timeframe** - Intervalo principal otimizado
5. **Confluence Score** - Threshold mínimo

### 11.2 Arquivos a Atualizar

| Arquivo | Descrição |
|---------|-----------|
| `packages/types/src/trading-defaults.ts` | Constantes globais |
| `packages/types/src/filters.ts` | Configuração de filtros |
| `apps/backend/src/cli/shared-backtest-config.ts` | Config de backtest |
| `apps/backend/src/constants.ts` | Constantes do backend |

### 11.3 Atualização de Configs no Banco

```sql
-- Atualizar trading profiles com configs otimizadas
UPDATE trading_profiles SET
  trailing_stop_enabled = true,
  trailing_activation_percent_long = :optimalActivationLong,
  trailing_activation_percent_short = :optimalActivationShort,
  trailing_distance_percent_long = :optimalDistanceLong,
  trailing_distance_percent_short = :optimalDistanceShort,
  atr_multiplier_long = :optimalAtrLong,
  atr_multiplier_short = :optimalAtrShort,
  fibonacci_target_level_long = :optimalFibLong,
  fibonacci_target_level_short = :optimalFibShort
WHERE use_default_config = true;

-- Atualizar auto_trading_configs
UPDATE auto_trading_configs SET
  trailing_config = :optimalTrailingConfigJson,
  filter_config = :optimalFilterConfigJson
WHERE is_template = true;
```

### 11.4 CLI de Aplicação

```bash
# Aplicar melhor config como defaults
pnpm tsx apps/backend/src/cli/apply-optimal-config.ts \
  --results-file results/optimization-2026-01-31.json \
  --update-code \
  --update-database \
  --dry-run  # Mostra o que seria atualizado

# Execução real
pnpm tsx apps/backend/src/cli/apply-optimal-config.ts \
  --results-file results/optimization-2026-01-31.json \
  --update-code \
  --update-database
```

### 11.5 Validação Pós-Aplicação

- [ ] Rodar backtest com novos defaults
- [ ] Comparar métricas com otimização
- [ ] Verificar que DB foi atualizado
- [ ] Testar auto-trading em paper mode
- [ ] Documentar mudanças no CHANGELOG.md

---

## 13. Melhores Práticas de Backtesting (Pesquisa 2026)

### 13.1 Walk-Forward Optimization (WFO)

**Por quê:** Previne overfitting ao testar parâmetros em dados que não foram usados na otimização.

**Implementação:**
```
│ 3 Anos de Dados │
├─────────────────┼─────────────────┼─────────────────┤
│   In-Sample 1   │  Out-Sample 1   │                 │
│   (Otimiza)     │  (Valida)       │                 │
├─────────────────┼─────────────────┼─────────────────┤
│                 │   In-Sample 2   │  Out-Sample 2   │
│                 │   (Otimiza)     │  (Valida)       │
└─────────────────┴─────────────────┴─────────────────┘

Janela: 6 meses in-sample → 2 meses out-of-sample → Rola
```

**Benefícios:**
- Testa robustez em diferentes condições de mercado
- Detecta quando estratégia para de funcionar
- Simula cenário real de re-otimização periódica

**TODO:**
- [ ] Implementar `WalkForwardOptimizer` com janelas configuráveis
- [ ] Adicionar flag `--walk-forward` ao CLI
- [ ] Gerar relatório de consistência entre janelas

### 13.2 Monte Carlo Simulation

**Por quê:** Testa se os resultados são estatisticamente significativos ou apenas sorte.

**Técnicas:**
1. **Trade Shuffling** - Embaralha ordem dos trades e recalcula métricas
2. **Bootstrap Sampling** - Amostra trades com reposição
3. **Noise Injection** - Adiciona variação aleatória aos preços de entrada/saída

**Implementação:**
```typescript
interface MonteCarloConfig {
  iterations: number;      // 1000-10000
  method: 'shuffle' | 'bootstrap' | 'noise';
  noisePercent?: number;   // 0.1% - 0.5%
  confidenceLevel: number; // 0.95 (95%)
}

interface MonteCarloResult {
  original: BacktestMetrics;
  percentiles: {
    p5: BacktestMetrics;   // Worst case (5%)
    p50: BacktestMetrics;  // Median
    p95: BacktestMetrics;  // Best case (95%)
  };
  significanceTest: {
    profitable: number;    // % das simulações lucrativas
    exceedsBaseline: number; // % > buy-and-hold
  };
}
```

**TODO:**
- [ ] Implementar `MonteCarloSimulator`
- [ ] Adicionar ao relatório final com intervalos de confiança
- [ ] Rejeitar configs onde p5 é negativo

### 13.3 Bayesian Optimization (Otimização Eficiente)

**Por quê:** Grid search é exponencial. Bayesian encontra ótimo com menos iterações.

**Comparação:**
| Método | 10 Params | Eficiência |
|--------|-----------|------------|
| Grid Search | 10^10 combinações | Baixa |
| Random Search | ~60% do ótimo com 1% das amostras | Média |
| Bayesian Opt | ~95% do ótimo com 0.1% das amostras | Alta |

**Quando usar:**
- Grid Search: < 10K combinações (atual)
- Bayesian: > 100K combinações (full mode)

**TODO:**
- [ ] Pesquisar libs: `hyperopt`, `optuna` (Python) ou equivalente TS
- [ ] Implementar modo `--optimization=bayesian` para full search
- [ ] Comparar resultados Bayesian vs Grid em subset

### 13.4 Market Regime Detection

**Por quê:** Diferentes regimes (bull/bear/ranging) requerem diferentes configs.

**Regimes:**
| Regime | Características | Config Ideal |
|--------|-----------------|--------------|
| Bull Trend | ADX > 25, Price > EMA200 | Trailing largo, TP extensão 2.0+ |
| Bear Trend | ADX > 25, Price < EMA200 | Trailing apertado, TP conservador |
| Ranging/Chop | ADX < 20, Choppiness > 60 | Filtrar (não operar) ou scalp |
| High Volatility | ATR > 2× média | Stops maiores, position menor |

**Implementação:**
```typescript
type MarketRegime = 'BULL_TREND' | 'BEAR_TREND' | 'RANGING' | 'HIGH_VOLATILITY';

interface RegimeAwareConfig {
  [regime: MarketRegime]: TrailingStopConfig;
}

// Otimização por regime
const optimalConfigs = {
  BULL_TREND: { activationLong: 120, distanceLong: 40, ... },
  BEAR_TREND: { activationShort: 80, distanceShort: 30, ... },
  RANGING: null, // Skip trades
};
```

**TODO:**
- [ ] Implementar `MarketRegimeDetector`
- [ ] Otimizar configs separadamente por regime
- [ ] Adicionar flag `--regime-aware` ao optimizer

### 13.5 Custos Realistas de Transação

**Por quê:** Ignorar custos leva a estratégias que não funcionam em produção.

**Custos a considerar:**
| Custo | Valor Típico | Impact |
|-------|--------------|--------|
| Trading Fee (maker) | 0.02% | Baixo |
| Trading Fee (taker) | 0.04% | Médio |
| Slippage | 0.05% - 0.20% | Alto |
| Funding Rate | ±0.01%/8h | Médio (shorts) |
| Spread | 0.01% - 0.05% | Baixo |

**Implementação atual:** ✅ Fees incluídos
**TODO:**
- [ ] Adicionar slippage configurável (0.1% default)
- [ ] Simular funding rates para posições overnight
- [ ] Considerar spread em entradas/saídas

### 13.6 Métricas Adicionais Recomendadas

| Métrica | Fórmula | Target |
|---------|---------|--------|
| Sortino Ratio | Return / Downside Dev | > 2.0 |
| Calmar Ratio | CAGR / Max DD | > 1.0 |
| Ulcer Index | Sqrt(Mean(DD²)) | < 10 |
| Recovery Factor | Total Return / Max DD | > 3.0 |
| Expectancy | (WR × AvgWin) - ((1-WR) × AvgLoss) | > 0.3R |

**TODO:**
- [ ] Adicionar Sortino, Calmar, Ulcer Index ao relatório
- [ ] Incluir Expectancy por trade

---

## 14. Arquitetura de Backtesting (Existente)

### 14.1 Estrutura Atual

O sistema de backtesting já está implementado em `apps/backend/src/services/backtesting/`:

```
apps/backend/src/services/backtesting/
├── index.ts                     # Exports públicos
├── BacktestEngine.ts            # Engine base
├── MultiWatcherBacktestEngine.ts # Engine principal (multi-watcher)
├── FuturesBacktestEngine.ts     # Especializado para futures
├── WalkForwardOptimizer.ts      # ✅ Implementado
├── MonteCarloSimulator.ts       # ✅ Implementado
├── BacktestOptimizer.ts         # Grid search
├── FullSystemOptimizer.ts       # Otimização completa
├── ParameterGenerator.ts        # Gerador de combinações
├── ParameterSensitivityAnalyzer.ts # Análise de sensibilidade
├── PermutationTest.ts           # Teste estatístico
├── IndicatorCache.ts            # Cache de indicadores
├── ResultManager.ts             # Gerenciamento de resultados
├── FilterManager.ts             # Gerenciamento de filtros
├── ExitManager.ts               # Lógica de saída
├── TradeExecutor.ts             # Execução de trades
├── PositionSizer.ts             # Dimensionamento de posição
├── SharedPortfolioManager.ts    # Portfolio compartilhado
└── configLoader.ts              # Carregamento de configs
```

### 14.2 Componentes de Validação (Prontos para Uso)

| Componente | Status | Descrição |
|------------|--------|-----------|
| `WalkForwardOptimizer` | ✅ Pronto | Previne overfitting com janelas IS/OS |
| `MonteCarloSimulator` | ✅ Pronto | Validação estatística (shuffle trades) |
| `ParameterSensitivityAnalyzer` | ✅ Pronto | Análise de impacto de parâmetros |
| `PermutationTest` | ✅ Pronto | Teste de significância estatística |

### 14.3 Integração com CLI (TODO)

**Próximo passo:** Integrar os componentes de validação com o CLI de otimização:

```bash
# Após otimização grid search
pnpm tsx apps/backend/src/cli/validate-optimization.ts \
  --results results/optimization-2026-01-31.json \
  --walk-forward \
  --monte-carlo 1000 \
  --sensitivity
```

**TODO:**
- [ ] Criar CLI `validate-optimization.ts`
- [ ] Integrar WalkForwardOptimizer com resultados da otimização
- [ ] Gerar relatório de robustez (markdown ou HTML)

---

## 15. Atualizações do Plano

### v1.7.0 (2026-01-31)
- **Limpeza massiva de código obsoleto:**
  - Removido 7 scripts de debug/compare: `debug-*.ts`, `compare-volume-*.ts`, `compare-trend-methods.ts`
  - Removido 5 scripts de fibonacci duplicados: `run-fib-*.ts`, `run-fibonacci-*.ts`
  - Removido `run-multi-timeframe-backtest.ts` (coberto por compare-timeframes.ts)
  - Total: 14 arquivos obsoletos removidos
- **Resumo executivo adicionado** no início do documento para novos chats
- **Documentação da estrutura de CLI** atualizada com scripts ativos

### v1.6.0 (2026-01-31)
- **Pesquisa de melhores práticas adicionada (Seção 13):**
  - Walk-Forward Optimization para prevenir overfitting
  - Monte Carlo Simulation para validação estatística
  - Bayesian Optimization para searches eficientes (>100K combos)
  - Market Regime Detection para configs adaptativas
  - Custos realistas (slippage, funding rates)
  - Métricas adicionais (Sortino, Calmar, Ulcer Index)
- **Auditoria de código existente (Seção 14):**
  - Descoberto que WalkForwardOptimizer já existe e está pronto
  - Descoberto que MonteCarloSimulator já existe e está pronto
  - ParameterSensitivityAnalyzer e PermutationTest também disponíveis
  - NÃO criar pacote separado - código já organizado no backend
- **Limpeza de código:**
  - Removido `optimize-master.ts` (obsoleto)
  - Removido `optimize-volume-filter.ts` (obsoleto)
- **TODOs priorizados:**
  - Integrar WalkForward e MonteCarlo com CLI (alta prioridade)
  - Criar CLI de validação de resultados (alta prioridade)
  - Bayesian Optimization (baixa prioridade - só se precisar full mode)

### v1.5.0 (2026-01-31)
- **Sistema de otimização principal definido:** `optimize-trailing-stop.ts`
  - Este é o único sistema de otimização oficial do projeto
  - Scripts obsoletos serão removidos para evitar confusão
- **README.md criado** para documentar o sistema
- **Performance otimizada:**
  - 82,944 combinações em ~80 minutos (3 anos de dados)
  - 735 trades reais (vs 178 anterior)
  - 324K 5m klines processados
- **Configs unificadas:**
  - Parâmetros em arquivo centralizado
  - Modos: quick, medium, full
  - Fácil extensão para novos parâmetros
- **Próximos passos de performance:**
  - Paralelização com worker threads
  - Cache de indicadores
  - Early exit para combinações ruins

### v1.4.0 (2026-01-31)
- **Capital atualizado:**
  - `initialCapital`: $10,000 → **$1,000**
  - `capitalPerTrade`: 80% → **100%**
- **CLI de otimização criada:** `optimize-trailing-stop.ts`
  - Suporte a quick-test (25 combinações) e full (5000+ combinações)
  - Download automático de klines para date range especificado
  - Cálculo de Sharpe ratio e Max Drawdown
  - Score composto para ranking
- **Seção 11 adicionada:** Aplicação dos Resultados Ótimos
  - Procedimento para atualizar defaults do sistema
  - Queries SQL para atualizar banco de dados
  - CLI para aplicação automática
- **Validação aprovada:** Quick test passou com 25 combinações

### v1.3.0 (2026-01-31)
- **Implementação inicial concluída:**
  - `GranularPriceIndex` - índice eficiente para lookup de klines 5m
  - `SafeLogger` - controle de output com níveis e limites
  - `TrailingStopSimulator` - reutiliza `trailing-stop-core.ts`
  - `validate-trailing-backtest.ts` - CLI de validação
- Tipos reutilizam `@marketmind/types` (BacktestMetrics, etc.)
- Branch criada: `feature/trailing-stop-backtest-simulation`

### v1.2.0 (2026-01-31)
- Adicionado **Modo de Validação** obrigatório antes do backtest completo
- Adicionado **Controle de Output** (SafeLogger) para evitar overflow
- Definidos níveis de log: silent, summary, verbose
- Checklist de validação com critérios de aprovação
- Progress reporting com ETA e best results
- Limite de linhas no console para evitar travamentos

### v1.1.0 (2026-01-31)
- Alterado timeframe principal de 4h para **2h**
- Alterado timeframe granular de 1m para **5m** (mais eficiente, menos ruído)
- Adicionada **otimização independente por direção** (LONG/SHORT)
- Parâmetros separados: activation, distance, ATR multiplier por direção
- Atualizada estimativa de dados: ~315K candles (vs 1.5M anterior)

### v1.0.0 (2026-01-31)
- Criação do plano inicial
- Definição de arquitetura
- Listagem de parâmetros a testar
- Cronograma de 4 semanas

---

## Próximos Passos Imediatos

### Fase Atual: Otimização 3 Anos (Em Execução)
- [x] Sistema de otimização principal criado (`optimize-trailing-stop.ts`)
- [x] Download automático de klines implementado
- [x] Validação aprovada (quick test passou)
- [🔄] Otimização 3 anos rodando (82,944 combinações)

### Próxima Fase: Validação de Robustez
1. **Após otimização completar:**
   - [ ] Analisar top 10 configurações
   - [ ] Verificar se há overfitting (configs muito específicas)
   - [ ] Comparar LONG vs SHORT performance

2. **Implementar Walk-Forward Optimization:**
   - [ ] Dividir dados em janelas (6 meses in-sample, 2 meses out-of-sample)
   - [ ] Re-otimizar em cada janela
   - [ ] Verificar consistência das configs ótimas

3. **Implementar Monte Carlo Validation:**
   - [ ] Rodar 1000 simulações com trade shuffling
   - [ ] Calcular intervalos de confiança (95%)
   - [ ] Rejeitar configs onde P5 é negativo

### Fase Final: Aplicação dos Resultados
4. **Aplicar configuração ótima:**
   - [ ] Atualizar defaults no código
   - [ ] Atualizar configs no banco de dados
   - [ ] Testar em paper trading

5. **Arquitetura (Médio Prazo):**
   - [ ] Criar pacote `@marketmind/backtesting`
   - [ ] Migrar engine e otimizadores
   - [ ] Desacoplar de dependências do backend

---

**Assinatura:**
Claude Opus 4.5 + Nathan Santos
MarketMind Project - 2026
