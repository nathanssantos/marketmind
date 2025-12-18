# Plano: Implementação de Trading de Futuros USD-M

## Resumo

Adicionar suporte completo a trading de **Futuros Perpétuos USD-M** da Binance no MarketMind, incluindo:
- Seletor de símbolos com toggle Spot/Futures
- Cliente Binance Futures (`USDMClient`) com suporte a testnet
- Backtesting com leverage, funding rates e liquidação
- Frontend para configuração de leverage e margin

## Escopo

- **Tipo de contrato**: USD-M Perpétuos apenas (não COIN-M)
- **Position Mode**: One-way (uma posição por símbolo)
- **Testnet**: Essencial para testes seguros
- **Backtesting**: Completo com todas features existentes + futures

---

## Fase 1: Types e Shared Packages

### 1.1 Criar tipos de futuros
**Arquivo**: `packages/types/src/futures.ts`

```typescript
export type MarketType = 'SPOT' | 'FUTURES';
export type MarginType = 'ISOLATED' | 'CROSSED';

export interface FuturesSymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: 'PERPETUAL';
  pricePrecision: number;
  quantityPrecision: number;
  maxLeverage: number;
  maintMarginPercent: string;
}

export interface FuturesPosition {
  symbol: string;
  positionSide: 'LONG' | 'SHORT';
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnl: string;
  liquidationPrice: string;
  leverage: number;
  marginType: MarginType;
}
```

### 1.2 Atualizar BacktestConfig
**Arquivo**: `packages/types/src/backtesting.ts`

Adicionar campos:
- `marketType?: 'SPOT' | 'FUTURES'`
- `leverage?: number` (1-125)
- `marginType?: 'ISOLATED' | 'CROSSED'`
- `simulateFundingRates?: boolean`
- `simulateLiquidation?: boolean`

---

## Fase 2: Binance Futures Client

### 2.1 Criar cliente de futuros
**Arquivo**: `apps/backend/src/services/binance-futures-client.ts`

```typescript
import { USDMClient } from 'binance';

export function createBinanceFuturesClient(wallet: Wallet): USDMClient {
  return new USDMClient({
    api_key: decryptApiKey(wallet.apiKeyEncrypted),
    api_secret: decryptApiKey(wallet.apiSecretEncrypted),
    testnet: wallet.walletType === 'testnet',
  });
}

// Métodos: setLeverage, setMarginType, getPositions, submitOrder
```

### 2.2 Estender BinanceFuturesDataService
**Arquivo**: `apps/backend/src/services/binance-futures-data.ts`

Adicionar métodos:
- `getExchangeInfo()` - buscar símbolos perpetuos de `/fapi/v1/exchangeInfo`
- `getHistoricalFundingRates(symbol, startTime, endTime)` - para backtesting

---

## Fase 3: Symbol Selector

### 3.1 Criar BinanceFuturesProvider
**Arquivo**: `apps/electron/src/renderer/services/market/providers/BinanceFuturesProvider.ts`

- Buscar símbolos de `/fapi/v1/exchangeInfo`
- Filtrar por `contractType: 'PERPETUAL'`
- Klines de `/fapi/v1/klines`

### 3.2 Modificar SymbolSelector
**Arquivo**: `apps/electron/src/renderer/components/SymbolSelector.tsx`

- Adicionar toggle Spot/Futures
- Exibir badge "PERP" para perpétuos
- Símbolos populares para futuros

---

## Fase 4: Backtesting Engine

### 4.1 Criar/Estender FuturesBacktestEngine
**Arquivo**: `apps/backend/src/services/backtesting/FuturesBacktestEngine.ts`

#### Cálculo de PnL com Leverage
```typescript
const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
const leveragedPnl = pnlPercent * leverage;
```

#### Simulação de Funding Rates
```typescript
// A cada 8h durante posição aberta
const fundingPayment = positionValue * fundingRate;
// LONG paga funding positivo, SHORT recebe
totalFunding += side === 'LONG' ? -fundingPayment : fundingPayment;
```

#### Simulação de Liquidação
```typescript
// Preço de liquidação (simplificado)
const liqPrice = side === 'LONG'
  ? entryPrice * (1 - 1/leverage + 0.004 + 0.015)  // MMR + LiqFee
  : entryPrice * (1 + 1/leverage - 0.004 - 0.015);

// Se mark price cruza liq price, fechar com taxa de liquidação (1.5%)
if (wouldLiquidate) {
  exitReason = 'LIQUIDATION';
  liquidationFee = positionValue * 0.015;
}
```

#### Taxas de Futuros
- Taker: 0.04% (vs 0.1% spot)
- Maker: 0.02%

---

## Fase 5: Database Schema

### 5.1 Adicionar colunas a tabelas existentes
**Arquivo**: `apps/backend/src/db/schema.ts`

```typescript
// positions table
marketType: varchar('market_type', { length: 10 }).default('SPOT'),
leverage: integer().default(1),
marginType: varchar('margin_type', { length: 10 }),
liquidationPrice: numeric('liquidation_price', { precision: 20, scale: 8 }),
accumulatedFunding: numeric('accumulated_funding', { precision: 20, scale: 8 }),

// orders table
marketType: varchar('market_type', { length: 10 }).default('SPOT'),
reduceOnly: boolean('reduce_only').default(false),
```

### 5.2 Criar migration
```bash
pnpm --filter @marketmind/backend db:generate
pnpm --filter @marketmind/backend db:migrate
```

---

## Fase 6: Trading Router

### 6.1 Criar futures-trading router
**Arquivo**: `apps/backend/src/routers/futures-trading.ts`

Procedures:
- `setLeverage({ walletId, symbol, leverage })`
- `setMarginType({ walletId, symbol, marginType })`
- `createFuturesOrder({ walletId, symbol, side, type, quantity, ... })`
- `getPositions({ walletId })`
- `closeFuturesPosition({ walletId, symbol })`

### 6.2 Registrar no appRouter
**Arquivo**: `apps/backend/src/trpc/router.ts`

```typescript
futuresTrading: futuresTradingRouter,
```

---

## Fase 7: Frontend Components

### 7.1 LeverageSelector
**Arquivo**: `apps/electron/src/renderer/components/LeverageSelector.tsx`

- Slider 1-125x
- Presets: 1, 2, 3, 5, 10, 20, 50, 75, 100, 125x
- Warning visual para leverage > 20x

### 7.2 MarginTypeToggle
**Arquivo**: `apps/electron/src/renderer/components/MarginTypeToggle.tsx`

- Toggle ISOLATED / CROSSED
- Default: ISOLATED (recomendado)

### 7.3 FuturesPositionInfo
- Entry price, mark price, PnL
- Liquidation price com distância %
- Cor de alerta baseada em proximidade

### 7.4 Atualizar TradingSidebar
- Market type toggle (Spot/Futures)
- Leverage selector quando Futures
- Exibir liquidation price em posições

---

## Fase 8: Testes

### 8.1 Unit Tests
- Cálculo de preço de liquidação
- Cálculo de funding payment
- PnL com leverage

### 8.2 Integration Tests
- Conexão com testnet
- Colocação e cancelamento de ordens
- Gerenciamento de posições

### 8.3 Backtest Validation
- Comparar resultados com/sem leverage
- Verificar impacto de funding rates
- Testar cenários de liquidação

---

## Arquivos Críticos

| Arquivo | Ação |
|---------|------|
| `packages/types/src/futures.ts` | CRIAR |
| `packages/types/src/backtesting.ts` | MODIFICAR |
| `apps/backend/src/services/binance-futures-client.ts` | CRIAR |
| `apps/backend/src/services/binance-futures-data.ts` | MODIFICAR |
| `apps/backend/src/services/backtesting/FuturesBacktestEngine.ts` | CRIAR |
| `apps/backend/src/db/schema.ts` | MODIFICAR |
| `apps/backend/src/routers/futures-trading.ts` | CRIAR |
| `apps/electron/src/renderer/services/market/providers/BinanceFuturesProvider.ts` | CRIAR |
| `apps/electron/src/renderer/components/SymbolSelector.tsx` | MODIFICAR |
| `apps/electron/src/renderer/components/LeverageSelector.tsx` | CRIAR |

---

## Ordem de Implementação

1. **Types** - Criar tipos de futuros e atualizar BacktestConfig
2. **Backend Services** - Futures client + extend data service
3. **Database** - Schema updates + migration
4. **Trading Router** - Futures trading procedures
5. **Backtesting** - FuturesBacktestEngine com leverage/funding/liquidation
6. **Frontend Provider** - BinanceFuturesProvider
7. **Frontend Components** - SymbolSelector, LeverageSelector, etc.
8. **Tests** - Unit + integration + backtest validation

---

## Notas Importantes

- **SDK já suporta futuros**: `binance` v3.1.5 tem `USDMClient`
- **Dados de futuros já existem**: `BinanceFuturesDataService` busca funding rates, OI, liquidations
- **Testnet URL**: `testnet.binancefuture.com` (demo-fapi)
- **One-way mode**: Não precisa de `positionSide` nas ordens
- **Fees menores**: Futuros tem 0.04% taker vs 0.1% spot

---

## API Binance Futures (Referência)

### Endpoints Principais
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/fapi/v1/exchangeInfo` | GET | Lista de símbolos perpetuos |
| `/fapi/v1/klines` | GET | Candlesticks (mesmo formato spot) |
| `/fapi/v1/fundingRate` | GET | Histórico de funding rates |
| `/fapi/v1/order` | POST | Criar ordem |
| `/fapi/v1/leverage` | POST | Configurar leverage (1-125x) |
| `/fapi/v1/marginType` | POST | ISOLATED ou CROSSED |
| `/fapi/v1/positionRisk` | GET | Posições abertas |

### URLs
- **Produção**: `https://fapi.binance.com`
- **Testnet**: `https://testnet.binancefuture.com`

### Taxas
| Tipo | Maker | Taker |
|------|-------|-------|
| Spot | 0.10% | 0.10% |
| Futures | 0.02% | 0.04% |
