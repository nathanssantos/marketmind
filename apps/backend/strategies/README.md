# Sistema de Estratégias Dinâmicas

Este sistema permite definir estratégias de trading em arquivos JSON declarativos, eliminando a necessidade de classes TypeScript hardcoded.

## Estrutura de Diretórios

```
strategies/
├── builtin/           # Estratégias incluídas no sistema
│   ├── ema-crossover.json
│   ├── mean-reversion-bb-rsi.json
│   ├── rsi-oversold-bounce.json
│   └── macd-divergence.json
├── community/         # Estratégias baixadas/compartilhadas
└── custom/            # Estratégias criadas pelo usuário
```

## Formato de Definição

### Estrutura Básica

```json
{
  "id": "minha-estrategia",
  "name": "Nome da Estratégia",
  "version": "1.0.0",
  "description": "Descrição do que a estratégia faz",
  "author": "Seu Nome",
  "tags": ["trend-following", "momentum"],

  "parameters": { ... },
  "indicators": { ... },
  "entry": { ... },
  "exit": { ... },
  "confidence": { ... },
  "filters": { ... }
}
```

### Campos Obrigatórios

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | Identificador único (kebab-case) |
| `name` | string | Nome legível |
| `version` | string | Versão semântica (ex: 1.0.0) |
| `parameters` | object | Parâmetros configuráveis |
| `indicators` | object | Indicadores técnicos usados |
| `entry` | object | Condições de entrada |
| `exit` | object | Configuração de stop loss e take profit |

### Campos Opcionais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `description` | string | Descrição detalhada |
| `author` | string | Autor da estratégia |
| `tags` | string[] | Tags para categorização |
| `confidence` | object | Cálculo de confiança |
| `filters` | object | Filtros mínimos |

---

## Parâmetros

Defina parâmetros que podem ser otimizados ou ajustados pelo usuário:

```json
"parameters": {
  "emaPeriod": {
    "default": 20,
    "min": 5,
    "max": 50,
    "step": 1,
    "description": "Período da EMA"
  },
  "atrMultiplier": {
    "default": 2.0,
    "min": 1.0,
    "max": 4.0,
    "step": 0.5,
    "description": "Multiplicador do ATR para stop"
  }
}
```

Use `$nomeParametro` para referenciar valores em outras seções:

```json
"indicators": {
  "ema": {
    "type": "ema",
    "params": { "period": "$emaPeriod" }
  }
}
```

---

## Indicadores

### Tipos Suportados

| Tipo | Descrição | Parâmetros |
|------|-----------|------------|
| `sma` | Média Móvel Simples | `period` |
| `ema` | Média Móvel Exponencial | `period` |
| `rsi` | Índice de Força Relativa | `period` |
| `macd` | MACD | `fastPeriod`, `slowPeriod`, `signalPeriod` |
| `bollingerBands` | Bandas de Bollinger | `period`, `stdDev` |
| `atr` | Average True Range | `period` |
| `stochastic` | Estocástico | `kPeriod`, `dPeriod` |
| `vwap` | Volume Weighted Average Price | - |
| `pivotPoints` | Pontos de Pivô | `lookback` |

### Exemplo

```json
"indicators": {
  "emaFast": {
    "type": "ema",
    "params": { "period": 9 }
  },
  "emaSlow": {
    "type": "ema",
    "params": { "period": 21 }
  },
  "bb": {
    "type": "bollingerBands",
    "params": { "period": 20, "stdDev": 2 }
  },
  "rsi": {
    "type": "rsi",
    "params": { "period": "$rsiPeriod" }
  }
}
```

### Acessando Valores

- Indicador simples: `"rsi"`, `"emaFast"`
- Indicador composto: `"bb.upper"`, `"bb.middle"`, `"bb.lower"`
- MACD: `"macd.macd"`, `"macd.signal"`, `"macd.histogram"`
- Preço: `"close"`, `"open"`, `"high"`, `"low"`
- Volume: `"volume"`, `"volume.sma20"`

---

## Condições de Entrada

### Estrutura

```json
"entry": {
  "long": {
    "operator": "AND",
    "conditions": [
      { "left": "...", "op": "...", "right": "..." }
    ]
  },
  "short": {
    "operator": "AND",
    "conditions": [
      { "left": "...", "op": "...", "right": "..." }
    ]
  }
}
```

### Operadores de Comparação

| Operador | Descrição |
|----------|-----------|
| `>` | Maior que |
| `<` | Menor que |
| `>=` | Maior ou igual |
| `<=` | Menor ou igual |
| `==` | Igual |
| `!=` | Diferente |
| `crossover` | Cruzou para cima |
| `crossunder` | Cruzou para baixo |

### Operadores Lógicos

- `"operator": "AND"` - Todas as condições devem ser verdadeiras
- `"operator": "OR"` - Pelo menos uma condição deve ser verdadeira

### Exemplos

```json
// EMA Crossover
{
  "left": "emaFast",
  "op": "crossover",
  "right": "emaSlow"
}

// RSI Oversold
{
  "left": "rsi",
  "op": "<=",
  "right": 30
}

// Preço abaixo da Bollinger inferior
{
  "left": "close",
  "op": "<=",
  "right": "bb.lower"
}

// Usando parâmetro
{
  "left": "rsi",
  "op": "<=",
  "right": "$rsiOversold"
}
```

---

## Configuração de Saída (Exit)

### Tipos de Stop Loss / Take Profit

| Tipo | Descrição | Campos |
|------|-----------|--------|
| `atr` | Baseado em ATR | `multiplier`, `indicator` |
| `percent` | Percentual do preço | `value` |
| `fixed` | Valor absoluto | `value` |
| `indicator` | Valor de indicador | `value` |
| `riskReward` | Múltiplo do risco | `multiplier` |

### Exemplos

```json
"exit": {
  // Stop Loss baseado em ATR
  "stopLoss": {
    "type": "atr",
    "multiplier": 2,
    "indicator": "atr"
  },

  // Take Profit como 2x o risco
  "takeProfit": {
    "type": "riskReward",
    "multiplier": 2
  }
}
```

```json
"exit": {
  // Stop Loss percentual
  "stopLoss": {
    "type": "percent",
    "value": 2
  },

  // Take Profit no meio da Bollinger
  "takeProfit": {
    "type": "indicator",
    "value": "bb.middle"
  }
}
```

---

## Cálculo de Confiança

Define como a confiança do setup é calculada:

```json
"confidence": {
  "base": 60,
  "bonuses": [
    {
      "condition": { "left": "rsi", "op": "<", "right": 25 },
      "bonus": 15,
      "description": "RSI extremamente oversold"
    },
    {
      "condition": { "left": "volume", "op": ">", "right": "volume.sma20" },
      "bonus": 10,
      "description": "Volume acima da média"
    }
  ],
  "max": 95
}
```

---

## Filtros

Define critérios mínimos para aceitar um setup:

```json
"filters": {
  "minConfidence": 65,
  "minRiskReward": 1.5
}
```

---

## Exemplos Completos

### EMA Crossover

```json
{
  "id": "ema-crossover",
  "name": "EMA Crossover",
  "version": "1.0.0",
  "description": "Long quando EMA rápida cruza acima da EMA lenta",
  "tags": ["trend-following", "ema", "crossover"],

  "parameters": {
    "fastPeriod": { "default": 9, "min": 5, "max": 21, "step": 1 },
    "slowPeriod": { "default": 21, "min": 15, "max": 50, "step": 1 },
    "atrMultiplier": { "default": 1.5, "min": 1, "max": 3, "step": 0.25 }
  },

  "indicators": {
    "emaFast": { "type": "ema", "params": { "period": "$fastPeriod" } },
    "emaSlow": { "type": "ema", "params": { "period": "$slowPeriod" } },
    "atr": { "type": "atr", "params": { "period": 14 } }
  },

  "entry": {
    "long": {
      "operator": "AND",
      "conditions": [
        { "left": "emaFast", "op": "crossover", "right": "emaSlow" }
      ]
    },
    "short": {
      "operator": "AND",
      "conditions": [
        { "left": "emaFast", "op": "crossunder", "right": "emaSlow" }
      ]
    }
  },

  "exit": {
    "stopLoss": { "type": "atr", "multiplier": "$atrMultiplier", "indicator": "atr" },
    "takeProfit": { "type": "riskReward", "multiplier": 2 }
  },

  "filters": {
    "minConfidence": 60,
    "minRiskReward": 1.5
  }
}
```

### Mean Reversion (Bollinger + RSI)

```json
{
  "id": "mean-reversion-bb-rsi",
  "name": "Mean Reversion (Bollinger + RSI)",
  "version": "1.0.0",
  "description": "Long quando preço toca banda inferior + RSI oversold",
  "tags": ["mean-reversion", "bollinger-bands", "rsi"],

  "parameters": {
    "bbPeriod": { "default": 20, "min": 10, "max": 50, "step": 5 },
    "bbStdDev": { "default": 2, "min": 1.5, "max": 3, "step": 0.5 },
    "rsiPeriod": { "default": 14, "min": 7, "max": 21, "step": 1 },
    "rsiOversold": { "default": 30, "min": 20, "max": 40, "step": 5 },
    "rsiOverbought": { "default": 70, "min": 60, "max": 80, "step": 5 }
  },

  "indicators": {
    "bb": { "type": "bollingerBands", "params": { "period": "$bbPeriod", "stdDev": "$bbStdDev" } },
    "rsi": { "type": "rsi", "params": { "period": "$rsiPeriod" } },
    "atr": { "type": "atr", "params": { "period": 14 } }
  },

  "entry": {
    "long": {
      "operator": "AND",
      "conditions": [
        { "left": "close", "op": "<=", "right": "bb.lower" },
        { "left": "rsi", "op": "<=", "right": "$rsiOversold" }
      ]
    },
    "short": {
      "operator": "AND",
      "conditions": [
        { "left": "close", "op": ">=", "right": "bb.upper" },
        { "left": "rsi", "op": ">=", "right": "$rsiOverbought" }
      ]
    }
  },

  "exit": {
    "stopLoss": { "type": "atr", "multiplier": 2, "indicator": "atr" },
    "takeProfit": { "type": "indicator", "value": "bb.middle" }
  },

  "confidence": {
    "base": 60,
    "bonuses": [
      { "condition": { "left": "rsi", "op": "<", "right": 25 }, "bonus": 10 },
      { "condition": { "left": "volume", "op": ">", "right": "volume.sma20" }, "bonus": 10 }
    ],
    "max": 95
  },

  "filters": {
    "minConfidence": 65,
    "minRiskReward": 1.5
  }
}
```

---

## Uso Programático

### Carregando Estratégias

```typescript
import { StrategyLoader } from './services/setup-detection/dynamic';

const loader = new StrategyLoader([
  './strategies/builtin',
  './strategies/custom'
]);

// Carregar todas
const strategies = await loader.loadAll();

// Carregar uma específica
const strategy = await loader.loadStrategy('./strategies/custom/minha-estrategia.json');

// Carregar de string (copy/paste)
const strategyJson = '{ "id": "...", ... }';
const strategy = loader.loadFromString(strategyJson);
```

### Usando com SetupDetectionService

```typescript
import { SetupDetectionService } from './services/setup-detection';

const service = new SetupDetectionService({
  enableLegacyDetectors: true,
  strategyDirectory: './strategies/builtin',
  dynamicStrategies: []
});

// Carregar estratégias do diretório
await service.loadStrategiesFromDirectory('./strategies/custom');

// Carregar uma estratégia específica
await service.loadStrategy('./strategies/minha-estrategia.json');

// Descarregar uma estratégia
service.unloadStrategy('minha-estrategia');
```

### Hot Reload

```typescript
loader.watchForChanges((strategies) => {
  console.log('Estratégias recarregadas:', strategies.map(s => s.id));
});

// Para parar de observar
loader.stopWatching();
```

---

## Validação

O sistema valida automaticamente:

- Campos obrigatórios presentes
- Formato do ID (kebab-case)
- Tipos de indicadores válidos
- Estrutura de condições
- Tipos de exit levels

Erros de validação impedem o carregamento e são reportados com detalhes.

---

## Dicas

1. **Comece simples** - Inicie com poucas condições e adicione complexidade gradualmente
2. **Use parâmetros** - Facilita otimização e ajustes
3. **Teste com backtesting** - Valide a estratégia antes de usar em produção
4. **Documente** - Use `description` em parâmetros e condições de confiança
5. **Versionamento** - Atualize a versão ao fazer mudanças significativas
