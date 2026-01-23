# Plano 1: Unificação de Código do Auto Trading

**Status:** ✅ Concluído
**Prioridade:** 3 (Manutenibilidade)
**Risco:** Médio
**Arquivos criados:** 12
**Testes novos:** 78

---

## Objetivo

Identificar e unificar código duplicado ou similar relacionado ao auto trading entre frontend, backend e packages.

---

## Análise Atual

### Código BEM Organizado (sem duplicação significativa)

| Componente | Localização | Status |
|------------|-------------|--------|
| Swing Points | `packages/indicators/src/swingPoints.ts` | ✅ Único |
| ATR | `packages/indicators/src/atr.ts` | ✅ Único |
| PnL Calculator | `apps/backend/src/utils/pnl-calculator.ts` | ✅ Único |
| Fee Service | `apps/backend/src/services/fee-service.ts` | ✅ Único |

### Pontos de Atenção (possível duplicação)

| Área | Backend | Package | Ação |
|------|---------|---------|------|
| Position Sizing | `services/auto-trading.ts:82-140` (Kelly + volatility) | `packages/risk/src/positionSizing.ts` (simple) | Avaliar merge |
| Volatility Profile | `services/volatility-profile.ts` | - | Mover para package |
| Risk/Reward Calc | `setup-detection/dynamic/ExitCalculator.ts:135-165` | - | Extrair para package |
| Exposure Calc | `services/risk-manager.ts:175-216` | `packages/risk/src/exposure.ts` | Unificar |

---

## Arquivos Críticos

```
apps/backend/src/
├── services/
│   ├── auto-trading.ts              # 697 linhas - Kelly criterion, position sizing
│   ├── volatility-profile.ts        # Perfis de volatilidade ATR-based
│   └── risk-manager.ts              # Exposure, drawdown, daily PnL
├── setup-detection/dynamic/
│   └── ExitCalculator.ts            # 527 linhas - R:R, stop loss, take profit
└── constants/
    └── auto-trading.ts              # Constantes de configuração

packages/
├── risk/src/
│   ├── exposure.ts                  # Cálculos de exposição
│   ├── capitalLimits.ts             # Limites de capital
│   └── positionSizing.ts            # Position sizing simples
└── indicators/src/
    ├── swingPoints.ts               # Detecção de swings
    └── atr.ts                       # Average True Range
```

---

## Ações Planejadas

### 1. Criar `packages/trading-core/`

Novo package para centralizar lógica de trading compartilhada.

```
packages/trading-core/
├── src/
│   ├── index.ts                     # Barrel exports
│   ├── positionSizing/
│   │   ├── index.ts
│   │   ├── simple.ts                # Sizing básico
│   │   ├── kelly.ts                 # Kelly criterion
│   │   └── volatilityAdjusted.ts    # Ajuste por volatilidade
│   ├── volatility/
│   │   ├── index.ts
│   │   └── profile.ts               # Volatility profiles
│   ├── riskReward/
│   │   ├── index.ts
│   │   └── calculator.ts            # R:R calculations
│   └── constants/
│       └── index.ts                 # Trading constants
├── package.json
└── tsconfig.json
```

### 2. Mover Volatility Profile

**De:** `apps/backend/src/services/volatility-profile.ts`
**Para:** `packages/trading-core/src/volatility/profile.ts`

```typescript
export interface VolatilityProfile {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';
  atrMultiplier: number;
  breakevenThreshold: number;
}

export const getVolatilityProfile = (atrPercent: number): VolatilityProfile => {
  if (atrPercent < 1) return { level: 'LOW', atrMultiplier: 2.0, breakevenThreshold: 0.01 };
  if (atrPercent < 2) return { level: 'MEDIUM', atrMultiplier: 2.5, breakevenThreshold: 0.015 };
  if (atrPercent < 3) return { level: 'HIGH', atrMultiplier: 3.0, breakevenThreshold: 0.02 };
  if (atrPercent < 4) return { level: 'VERY_HIGH', atrMultiplier: 3.5, breakevenThreshold: 0.025 };
  return { level: 'EXTREME', atrMultiplier: 5.0, breakevenThreshold: 0.03 };
};
```

### 3. Unificar Position Sizing

Combinar Kelly criterion do backend com funções simples do package.

```typescript
export interface PositionSizeConfig {
  method: 'fixed' | 'percentage' | 'kelly' | 'volatilityAdjusted';
  maxPositionValue: number;
  entryPrice: number;
  stopLoss?: number;
  leverage?: number;
  historicalStats?: { winRate: number; avgRR: number; tradeCount: number };
  volatility?: { atrPercent: number };
}

export const calculatePositionSize = (config: PositionSizeConfig): PositionSizeResult => {
  switch (config.method) {
    case 'fixed':
      return calculateFixedSize(config);
    case 'percentage':
      return calculatePercentageSize(config);
    case 'kelly':
      return calculateKellySize(config);
    case 'volatilityAdjusted':
      return calculateVolatilityAdjustedSize(config);
  }
};
```

### 4. Consolidar Constantes

**De:** `apps/backend/src/constants/auto-trading.ts`
**Para:** `packages/trading-core/src/constants/index.ts`

```typescript
export const TRADING_CONSTANTS = {
  KELLY: {
    DEFAULT_WIN_RATE: 0.50,
    DEFAULT_AVG_RR: 1.5,
    FRACTIONAL_KELLY: 0.25,
    MIN_TRADES_FOR_STATS: 20,
    MAX_KELLY_FRACTION: 0.10,
  },
  VOLATILITY: {
    HIGH_REDUCTION_FACTOR: 0.7,
    ATR_HIGH_THRESHOLD: 3.0,
  },
  TIMING: {
    CANDLE_CLOSE_SAFETY_BUFFER_MS: 2000,
    CHECK_INTERVAL_MS: 5000,
  },
  LIQUIDATION: {
    WARNING_THRESHOLD: 0.50,
    DANGER_THRESHOLD: 0.25,
    CRITICAL_THRESHOLD: 0.10,
  },
} as const;
```

### 5. Criar Barrel Exports

```typescript
// packages/trading-core/src/index.ts
export * from './positionSizing';
export * from './volatility';
export * from './riskReward';
export * from './constants';
```

---

## Migração

### Backend

```typescript
// ANTES
import { calculatePositionSize } from './auto-trading';
import { getVolatilityProfile } from './volatility-profile';

// DEPOIS
import { calculatePositionSize, getVolatilityProfile } from '@marketmind/trading-core';
```

### Frontend (se aplicável)

```typescript
// Usar mesmas funções para cálculos client-side
import { calculateRiskReward, TRADING_CONSTANTS } from '@marketmind/trading-core';
```

---

## Verificação

- [x] `pnpm test` passa em todos os packages (2440 tests passing)
- [x] Backend usa funções do `@marketmind/trading-core`
- [ ] Frontend (se aplicável) usa mesmas funções
- [x] Type-safety garantida entre apps
- [x] Nenhuma duplicação de lógica restante
- [x] Performance mantida (sem overhead de import)

---

## Dependências

- Nenhuma dependência de outros planos
- Pode ser feito independentemente

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Breaking changes em imports | Média | Médio | Manter exports antigos temporariamente |
| Diferenças sutis em cálculos | Baixa | Alto | Testes de comparação antes/depois |
| Circular dependencies | Baixa | Médio | Estrutura de módulos bem definida |
