# Arquitetura: Sistema de Estratégias Dinâmicas

> Documento de design e decisões arquiteturais

## Resumo Executivo

Sistema que permite definir estratégias de trading em arquivos JSON, eliminando a necessidade de classes TypeScript hardcoded. Isso permite:
- Adicionar/remover estratégias sem alterar código
- Usuários podem copiar/colar estratégias da internet
- Backtesting funciona igual, mas com estratégias dinâmicas

---

## Decisão de Formato: JSON vs Pine Script

### Pesquisa Realizada

| Formato | Prós | Contras |
|---------|------|---------|
| **Pine Script** | Padrão da indústria (TradingView), maior comunidade | Requer parser/interpretador complexo, DSL proprietária |
| **PineTS** | TypeScript nativo, roda Pine-like | Ainda código, não declarativo |
| **JSON declarativo** | Sem parsing complexo, validação via schema, fácil UI | Menos expressivo que código |
| **YAML** | Mais legível que JSON | Mesmo problema de expressividade |

### Decisão: JSON Schema Próprio

Motivos:
1. **Sem dependências externas** - não precisamos de parser Pine Script
2. **Validação nativa** - JSON Schema permite validar estrutura
3. **Fácil integração UI** - formulários dinâmicos a partir do schema
4. **Extensível** - podemos adicionar operadores conforme necessário
5. **Compartilhável** - usuários podem trocar arquivos JSON facilmente

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    BacktestEngine                       │
│               (SEM ALTERAÇÕES)                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              SetupDetectionService                      │
│          (refatorado para suportar ambos)               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────┐ │
│  │ Legacy Detectors │    │    Dynamic Interpreters    │ │
│  │ (TypeScript)     │    │      (JSON-based)          │ │
│  │                  │    │                             │ │
│  │ Pattern123       │    │  StrategyInterpreter ×N    │ │
│  │ BearTrap         │    │         ▲                   │ │
│  │ MeanReversion    │    │         │                   │ │
│  └─────────────────┘    │   StrategyLoader            │ │
│                          │         ▲                   │ │
│                          │    strategies/*.json        │ │
│                          └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Componentes

### 1. StrategyLoader (`dynamic/StrategyLoader.ts`)

Responsável por:
- Carregar arquivos JSON do diretório
- Validar estrutura contra schema
- Suportar hot-reload (watch for changes)
- Método `loadFromString()` para copy/paste

```typescript
const loader = new StrategyLoader(['./strategies/builtin']);
const strategies = await loader.loadAll();
```

### 2. StrategyInterpreter (`dynamic/StrategyInterpreter.ts`)

Responsável por:
- Estender `BaseSetupDetector`
- Orquestrar IndicatorEngine, ConditionEvaluator, ExitCalculator
- Produzir `TradingSetup` compatível com BacktestEngine

### 3. IndicatorEngine (`dynamic/IndicatorEngine.ts`)

Responsável por:
- Mapear definições JSON para funções `@marketmind/indicators`
- Resolver referências de parâmetros (`$paramName`)
- Cache de indicadores calculados

Indicadores suportados:

| JSON type | Função | Output |
|-----------|--------|--------|
| `sma` | calculateSMA() | `number[]` |
| `ema` | calculateEMA() | `number[]` |
| `rsi` | calculateRSI() | `number[]` |
| `macd` | calculateMACD() | `{ macd, signal, histogram }` |
| `bollingerBands` | calculateBollingerBandsArray() | `{ upper, middle, lower }[]` |
| `atr` | calculateATR() | `number[]` |
| `stochastic` | calculateStochastic() | `{ k, d }[]` |
| `vwap` | calculateVWAP() | `number[]` |
| `pivotPoints` | findPivotPoints() | pivot array |

### 4. ConditionEvaluator (`dynamic/ConditionEvaluator.ts`)

Responsável por:
- Avaliar condições de entrada (AND/OR groups)
- Suportar operadores de comparação e crossover
- Resolver referências a indicadores e preços

Operadores:

| Operador | Descrição |
|----------|-----------|
| `>`, `<`, `>=`, `<=`, `==`, `!=` | Comparação numérica |
| `crossover` | Cruzou para cima |
| `crossunder` | Cruzou para baixo |

### 5. ExitCalculator (`dynamic/ExitCalculator.ts`)

Responsável por:
- Calcular stop loss e take profit
- Suportar múltiplos tipos de exit

Tipos de exit:

| Tipo | Descrição |
|------|-----------|
| `atr` | Múltiplo do ATR |
| `percent` | Percentual do preço |
| `fixed` | Valor absoluto |
| `indicator` | Valor de indicador |
| `riskReward` | Múltiplo do SL |

---

## Tipos (`packages/types/src/strategyDefinition.ts`)

```typescript
interface StrategyDefinition {
  id: string;                    // kebab-case
  name: string;
  version: string;               // semver
  description?: string;
  author?: string;
  tags?: string[];

  parameters: Record<string, StrategyParameter>;
  indicators: Record<string, IndicatorDefinition>;
  entry: EntryConditions;
  exit: ExitConfig;
  confidence?: ConfidenceConfig;
  filters?: StrategyFilters;
}

interface StrategyParameter {
  default: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

interface IndicatorDefinition {
  type: IndicatorType;
  params: Record<string, number | string>;
}

interface Condition {
  left: string;      // indicador, preço, ou $param
  op: ComparisonOperator;
  right: string | number;
}

interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Condition[];
}

interface ExitLevel {
  type: 'atr' | 'percent' | 'fixed' | 'indicator' | 'riskReward';
  multiplier?: number | string;
  value?: number | string;
  indicator?: string;
}
```

---

## Integração com SetupDetectionService

O `SetupDetectionService` foi modificado para suportar ambos:

```typescript
interface SetupDetectionConfig {
  // Configurações legacy (TypeScript detectors)
  pattern123: Pattern123Config;
  bearTrap: BearTrapConfig;
  meanReversion: MeanReversionConfig;

  // Novas configurações dinâmicas
  enableLegacyDetectors?: boolean;
  strategyDirectory?: string;
  dynamicStrategies?: StrategyDefinition[];
}
```

Novos métodos:

```typescript
// Carregar estratégias de diretório
await service.loadStrategiesFromDirectory('./strategies');

// Carregar estratégia específica
await service.loadStrategy('./my-strategy.json');

// Carregar de string (copy/paste)
service.loadStrategyFromJson(jsonString);

// Remover estratégia
service.unloadStrategy('strategy-id');
```

---

## Estrutura de Diretórios

```
apps/backend/
├── strategies/
│   ├── README.md              # Documentação de uso
│   ├── ARCHITECTURE.md        # Este arquivo
│   ├── builtin/
│   │   ├── ema-crossover.json
│   │   ├── mean-reversion-bb-rsi.json
│   │   ├── rsi-oversold-bounce.json
│   │   └── macd-divergence.json
│   ├── community/             # Estratégias baixadas
│   └── custom/                # Estratégias do usuário
│
├── src/services/setup-detection/
│   ├── SetupDetectionService.ts  # Modificado
│   ├── BaseSetupDetector.ts
│   ├── Pattern123Detector.ts     # Legacy
│   ├── BearTrapDetector.ts       # Legacy
│   ├── MeanReversionDetector.ts  # Legacy
│   └── dynamic/
│       ├── index.ts
│       ├── StrategyLoader.ts
│       ├── StrategyInterpreter.ts
│       ├── IndicatorEngine.ts
│       ├── ConditionEvaluator.ts
│       └── ExitCalculator.ts

packages/types/src/
├── strategyDefinition.ts      # Novos tipos
├── strategySchema.json        # JSON Schema
├── tradingSetup.ts            # Modificado (SetupType aceita string)
└── index.ts                   # Exporta novos tipos
```

---

## Fluxo de Execução

```
1. StrategyLoader.loadAll()
   └── Lê arquivos JSON
   └── Valida contra schema
   └── Retorna StrategyDefinition[]

2. SetupDetectionService.loadStrategiesFromDirectory()
   └── Chama StrategyLoader
   └── Cria StrategyInterpreter para cada estratégia
   └── Adiciona ao array de detectores

3. SetupDetectionService.detectSetups(klines)
   └── Para cada detector (legacy + dinâmico):
       └── detector.detect(klines, index)
   └── Retorna TradingSetup[]

4. StrategyInterpreter.detect(klines, index)
   └── IndicatorEngine.computeIndicators()
   └── ConditionEvaluator.evaluate() para entry.long e entry.short
   └── Se condição true:
       └── ExitCalculator.calculate() para SL/TP
       └── Calcula confiança
       └── Retorna TradingSetup
```

---

## Compatibilidade

### BacktestEngine
- **Sem alterações necessárias**
- Recebe `TradingSetup[]` como sempre
- Não sabe se veio de detector legacy ou dinâmico

### SetupType
- Modificado para aceitar `string` além dos tipos builtin
- `type SetupType = BuiltinSetupType | string`

### Electron App
- Detectores não-lucrativos mantidos localmente
- Tipos definidos localmente (não importados de @marketmind/types)

---

## Validação

O sistema valida automaticamente:

1. **Campos obrigatórios**: id, name, version, parameters, indicators, entry, exit
2. **Formato do ID**: kebab-case (letras minúsculas, números, hífens)
3. **Versão**: Aviso se não seguir semver
4. **Indicadores**: Tipo deve estar na lista de suportados
5. **Condições**: Operador deve ser AND ou OR, pelo menos uma condição
6. **Exit levels**: Tipo deve ser válido (atr, percent, fixed, indicator, riskReward)

Erros de validação são lançados como `StrategyValidationException`.

---

## Extensibilidade

### Adicionar novo indicador

1. Adicionar tipo em `IndicatorType` (strategyDefinition.ts)
2. Adicionar case no switch de `IndicatorEngine.computeIndicator()`
3. Adicionar na lista de tipos válidos em `StrategyLoader.validateIndicators()`

### Adicionar novo operador

1. Adicionar em `ComparisonOperator` (strategyDefinition.ts)
2. Implementar lógica em `ConditionEvaluator.evaluateCondition()`

### Adicionar novo tipo de exit

1. Adicionar em `ExitLevelType` (strategyDefinition.ts)
2. Implementar em `ExitCalculator.calculateLevel()`
3. Adicionar na lista de tipos válidos em `StrategyLoader.validateExitLevel()`

---

## Próximos Passos (Futuro)

1. **UI para criação de estratégias** - Formulário baseado no schema
2. **Marketplace de estratégias** - Compartilhamento entre usuários
3. **Versionamento de estratégias** - Git-like history
4. **Testes A/B** - Comparar variações de parâmetros
5. **Auto-otimização** - Ajustar parâmetros baseado em backtesting
