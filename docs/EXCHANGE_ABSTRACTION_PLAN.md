# Exchange Abstraction Layer - Preparacao para Multi-Exchange

## Status

| Fase | Descricao | Status |
|------|-----------|--------|
| 0 | Seletor de Currency | PENDENTE |
| 1 | Desacoplar tipos de trading e fees do Binance | CONCLUIDA |
| 2 | Criar interfaces exchange-agnosticas | CONCLUIDA |
| 3 | Implementacoes Binance (wrap do codigo existente) | CONCLUIDA |
| 4 | Adicionar campo `exchange` ao schema de wallets | CONCLUIDA |
| 5 | Conectar o registry e criar factory utilitaria | CONCLUIDA |
| 6 | Desacoplar business logic de logica exchange-especifica | CONCLUIDA |

**Ultima atualizacao:** 2026-02-04

## Objetivo

Criar uma camada de abstracoes exchange-agnosticas, mover todo o codigo Binance para atras dessas interfaces, e preparar a infraestrutura para suportar qualquer exchange/broker no futuro (crypto, acoes BR/US, futuros). **Nenhuma funcionalidade muda** — o Binance continua sendo o unico provider, mas agora atras de interfaces.

## Restricoes

- **ZERO quebra** — usuario esta operando em producao
- **ZERO magic numbers** — todos os valores numericos devem vir de constantes nomeadas em arquivos dedicados por exchange
- Logica exchange-especifica encapsulada nos adapters, nao vazando para business logic
- Exchanges podem ser mencionadas por nome onde faz sentido (config, factory, adapter files)
- Constantes e tipos especificos de cada exchange vivem em arquivos separados por exchange (ex: `binance-fees.ts`, `binance.ts`)
- **Fonte unica de verdade** — cada tipo/interface definido em UM lugar e importado nos demais. Tipos exchange-agnosticos vivem em `exchange/futures-client.ts` e `exchange/spot-client.ts`. O `binance-futures-client.ts` existente importa esses tipos ao inves de redefinir.
- Reaproveitar codigo existente (wrap, nao reescrever)
- Cada fase eh independente e segura para deploy

---

## Auditoria: Onde logica Binance vaza para business logic hoje

### Problemas encontrados

| Arquivo | Problema | Severidade |
|---------|----------|------------|
| `auto-trading.ts` | Chama `createBinanceFuturesClient()` diretamente, `executeBinanceOrder()` metodo com "Binance" no nome | ALTA |
| `order-executor.ts` | Import direto de `binance-futures-client`, `getOrderEntryFee()` acoplado | ALTA |
| `protection-orders.ts` | Mix de `createBinanceClient()` + `submitFuturesAlgoOrder()` com logica de SL/TP | ALTA |
| `position-monitor.ts` | Import de `createBinanceFuturesClient`, `getPositions`, `getAccountInfo` diretos | ALTA |
| `margin-manager.ts` | `createBinanceFuturesClient()` + `modifyIsolatedPositionMargin()` direto | ALTA |
| `fee-service.ts` | `new MainClient()` / `new USDMClient()` inline, `BINANCE_FEES` hardcoded | ALTA |
| `routers/trading.ts` | Import `MainClient, USDMClient` do SDK Binance | MEDIA |
| `routers/wallet.ts` | Cria `MainClient`/`USDMClient` para validar credenciais | MEDIA |
| `types/trading.ts` | `OrderType = BinanceOrderType`, `OrderSide = BinanceOrderSide` — tipos core sao alias de Binance | MEDIA |
| `types/futures.ts` | `FUTURES_DEFAULTS` usa `BINANCE_FEES` diretamente | BAIXA |
| `market-client-factory.ts` | Classes internas `SpotClient`/`FuturesClient` sao Binance-only mas interface eh generica — bom padrao, so precisa extender | BAIXA |

### O que esta BEM

- `MarketClient` interface em `market-client-factory.ts` — ja eh exchange-agnostica
- `BaseMarketProvider` em `packages/types/src/market.ts` — abstracoes de market data existem
- Tipos como `FuturesPosition`, `FuturesOrder`, `FuturesAccount` sao genericos (nao tem "Binance" nos campos)
- Kline type eh generico
- Calculo de PnL, position sizing, risk management, trailing stop, setup detection — tudo exchange-agnostico

---

## Pesquisa: B3 (Bolsa Brasileira) - Requisitos para integracao futura

### Caminhos de acesso a B3

| Via | Protocolo | Tipo | Adequado para MarketMind? |
|-----|-----------|------|---------------------------|
| **Interactive Brokers** | TWS API (REST/WebSocket) | B3 equities desde dez/2025, 160+ mercados | **ESCOLHIDO — IB = B3 + US + global** |
| Cedro Technologies | REST/JSON + WebSocket | Order routing via 20+ corretoras BR | Descartado (IB cobre B3) |
| MetaApi Cloud | REST + WebSocket (Node.js SDK) | Via MT5 brokers | Descartado |
| FIX/SBE direto | FIX 4.4 ou Binary SBE | DMA para B3 via PUMA | Descartado |

### Diferencas B3 vs Crypto que a abstracoes devem suportar

1. **Horario de mercado**: B3 opera 10:00-17:30 BRT (nao 24/7)
   - Interface precisa: `getMarketHours()`, `isMarketOpen()`
2. **Moeda**: BRL (nao USDT/USD)
   - Wallet schema ja tem campo `currency` — bom
3. **Tipos de ativos**: Acoes (PETR4), ETFs (BOVA11), FIIs, Futuros (WINFUT), Opcoes
   - Interface precisa: `AssetClass` type
4. **Formato de simbolos**: PETR4, VALE3, WINFUT (diferente de BTCUSDT)
   - Interface precisa: `normalizeSymbol()`, `getSymbolInfo()`
5. **Liquidacao**: T+2 para acoes (crypto eh instantaneo)
   - Nao afeta order execution, mas afeta calculo de saldo disponivel
6. **Tick sizes**: Regras diferentes de precisao
   - `getSymbolInfo()` ja retorna `tickSize`/`stepSize` — bom
7. **Tipos de ordem**: Fundamentalmente similares (LIMIT, MARKET, STOP)
   - Nao tem OCO na B3 diretamente, mas SL/TP separados funcionam
8. **Taxas**: Corretagem + emolumentos B3 + IRRF day trade (20%) vs taxa fixa crypto
   - Fee service precisa suportar estrutura de taxas por exchange

### Impacto nas interfaces

As interfaces da Fase 2 ja devem incluir:
- `AssetClass` type: `'CRYPTO_SPOT' | 'CRYPTO_FUTURES' | 'EQUITY' | 'ETF' | 'FUTURES' | 'OPTIONS'`
- `ExchangeCapabilities` interface: horario de mercado, tipos de ordem suportados, OCO disponivel, etc.
- `getMarketHours()` e `isMarketOpen()` no `ExchangeProvider`
- `normalizeSymbol()` no client (cada exchange tem formato diferente)

---

## Fase 0: Seletor de Currency [PENDENTE]

**Risco: BAIXO** — UI + schema change com default, independente da abstracoes de exchange

### Contexto atual
- `WalletCurrency = 'USD' | 'BRL' | 'EUR' | 'USDT' | 'BTC' | 'ETH'` — tipo ja existe
- DB schema: `currency: varchar({ length: 10 }).default('USDT')` — campo existe
- `CreateWalletDialog` aceita currency mas **nao mostra seletor** — silenciosamente usa USDT
- Display usa `Intl.NumberFormat(currency)` — ja funciona com qualquer moeda
- BRL conversion ja existe (`currencyStore`, `BrlValue`, `exchangeRateService`)
- `PerformancePanel` mostra fees com `$` hardcoded — bug

### Decisao de default: USD

**USD como default** porque:
- IB opera em USD como base currency para a maioria dos mercados
- USDT eh pegged ao USD — numericamente equivalente para crypto
- Para B3 via IB, a operacao sera em USD (IB converte BRL internamente)
- USD eh o denominador universal — faz sentido como base

### Mudancas

#### 1. Tipo: `packages/types/src/trading.ts`
Atualizar `WalletCurrency` — manter os mesmos valores mas reordenar:
```typescript
export type WalletCurrency = 'USD' | 'USDT' | 'BRL' | 'EUR' | 'BTC' | 'ETH';
```

#### 2. DB default: `apps/backend/src/db/schema.ts`
Mudar default de `'USDT'` para `'USD'`:
```typescript
currency: varchar({ length: 10 }).default('USD'),
```
**Nota:** Wallets existentes mantem 'USDT' — nao alterar dados existentes. Apenas novas wallets recebem 'USD'.

#### 3. Backend: `apps/backend/src/routers/wallet.ts`
Atualizar default no `createPaper` e `createLive`:
```typescript
currency: z.string().default('USD'),
```

#### 4. UI: `apps/electron/src/renderer/components/Trading/CreateWalletDialog.tsx`
Adicionar seletor de currency no form de criacao de wallet:
- Dropdown com opcoes: USD, USDT, BRL, EUR
- Default: USD
- Mostrar para paper e live wallets

#### 5. Display fix: `apps/electron/src/renderer/components/Trading/PerformancePanel.tsx`
Substituir `$` hardcoded por currency da wallet (ja disponivel no contexto).

#### 6. Exchange rate: `apps/electron/src/renderer/services/exchangeRateService.ts`
Generalizar para suportar conversao USD↔BRL alem de USDT↔BRL:
- Renomear `fetchUsdtBrlRate` para `fetchExchangeRate(from, to)`
- Manter cache por par de moedas

#### 7. Translations
Adicionar labels para as opcoes de currency nos 4 arquivos de traducao (en, pt, es, fr).

### Verificacao
- `pnpm --filter @marketmind/backend type-check`
- `pnpm --filter @marketmind/electron type-check`
- `pnpm test`
- UI: criar paper wallet com currency USD, verificar display correto
- UI: criar paper wallet com currency BRL, verificar display correto

---

## Fase 1: Desacoplar tipos de trading e fees do Binance [CONCLUIDA]

**Risco: ZERO** — valores identicos, apenas muda a fonte da definicao

### Arquivo: `packages/types/src/trading.ts`

Atualmente os tipos sao aliases diretos:
```typescript
export type OrderType = BinanceOrderType;      // alias
export type OrderSide = BinanceOrderSide;      // alias
export type OrderStatus = BinanceOrderStatus | 'EXPIRED_IN_MATCH' | 'PENDING_NEW';
```

**Mudanca:** Definir os tipos inline, mantendo os mesmos valores:
```typescript
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'PENDING_CANCEL' | 'REJECTED' | 'EXPIRED' | 'EXPIRED_IN_MATCH' | 'PENDING_NEW';
export type TimeInForce = 'GTC' | 'IOC' | 'FOK';
export type ContingencyType = 'OCO' | 'OTO' | 'OTOCO';
export type ListStatusType = 'RESPONSE' | 'EXEC_STARTED' | 'ALL_DONE';
export type ListOrderStatus = 'EXECUTING' | 'ALL_DONE' | 'REJECT';
```

Remover os imports de `./binance` em trading.ts. O `Order`, `OrderList`, `Balance`, `Account` interfaces permanecem inalteradas.

O arquivo `packages/types/src/binance.ts` continua existindo — usado apenas pelo adapter Binance.

### Arquivo: `packages/types/src/fees.ts`

Separar conteudo exchange-agnostico do Binance-especifico:

**Manter em `fees.ts` (exchange-agnostico):**
- Interfaces: `FeeParams`, `TradingFees`, `FeeCalculation`, `TradeViability`, `MarketFees`, `FeeOrderType`
- Constantes: `TRADING_THRESHOLDS`
- Funcoes genericas: `calculateTotalFees()`, `getRoundTripFee()`, `getTradingThresholds()`
- Essas funcoes ja aceitam `vipLevel` e `feeRate` como parametros — so precisam de defaults exchange-agnosticos

**Mover para novo `packages/types/src/binance-fees.ts` (Binance-especifico):**
- `BINANCE_FEES`, `BINANCE_DEFAULT_FEES`
- `BINANCE_SPOT_VIP_LEVELS`, `BINANCE_FUTURES_VIP_LEVELS`, `BINANCE_VIP_LEVELS`
- `applyBnbDiscount()`, `getVIPLevelFromCommission()`, `getFeeRateForVipLevel()`
- `getDefaultFee()` — usa `BINANCE_FEES` hardcoded

**Atualizar `packages/types/src/futures.ts`:**
- `FUTURES_DEFAULTS.TAKER_FEE` e `MAKER_FEE` atualmente importam `BINANCE_FEES` de `fees.ts` — mudar import para `binance-fees.ts`
- NUNCA usar valores numericos inline — sempre referenciar constantes nomeadas (`BINANCE_FEES.FUTURES.VIP_0.taker`)

**Atualizar consumers:**
- `packages/trading-core/src/volatility/profile.ts` — importar de `binance-fees`
- `apps/backend/src/services/fee-service.ts` — importar de `binance-fees`
- `apps/backend/src/routers/fees.ts` — importar de `binance-fees`

### Verificacao
- `pnpm --filter @marketmind/types build`
- `pnpm --filter @marketmind/backend type-check`
- `pnpm --filter @marketmind/electron type-check`
- `pnpm test` — todos os testes passando

---

## Fase 2: Criar interfaces exchange-agnosticas [CONCLUIDA]

**Risco: ZERO** — arquivos novos, nada importa deles ainda

### Novo diretorio: `apps/backend/src/exchange/`

#### `apps/backend/src/exchange/types.ts`
```typescript
export type ExchangeId = 'BINANCE' | 'INTERACTIVE_BROKERS';

export type AssetClass = 'CRYPTO_SPOT' | 'CRYPTO_FUTURES' | 'EQUITY' | 'ETF' | 'FUTURES' | 'OPTIONS';

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
}

export interface MarketHours {
  timezone: string;
  is24h: boolean;
  sessions?: Array<{ open: string; close: string }>; // e.g. [{ open: '10:00', close: '17:30' }]
}

export interface ExchangeCapabilities {
  supportedAssetClasses: AssetClass[];
  supportedOrderTypes: string[];
  supportsOco: boolean;
  supportsAlgoOrders: boolean;
  supportsLeverage: boolean;
  supportsIsolatedMargin: boolean;
  supportsWebSocket: boolean;
  marketHours: MarketHours;
}

export interface ExchangeConfig {
  exchangeId: ExchangeId;
  credentials?: ExchangeCredentials;
}
```

#### `apps/backend/src/exchange/spot-client.ts`
Interface para operacoes spot, baseada no `MarketClient` existente:
```typescript
export interface IExchangeSpotClient {
  readonly exchangeId: ExchangeId;
  submitOrder(params: SpotOrderParams): Promise<SpotOrderResult>;
  cancelOrder(symbol: string, orderId: number): Promise<CancelOrderResult>;
  getOpenOrders(symbol?: string): Promise<SpotOrderResult[]>;
  getAllOrders(symbol: string, limit?: number): Promise<SpotOrderResult[]>;
  submitOcoOrder(params: OcoOrderParams): Promise<OcoOrderResult>;
  getAccountInfo(): Promise<SpotAccountInfo>;
  getTradeFees(symbol?: string): Promise<TradeFees>;
}
```
Tipos `SpotOrderParams`, `SpotOrderResult`, etc definidos neste arquivo.

#### `apps/backend/src/exchange/futures-client.ts`
Interface para operacoes futures, baseada nas 30+ funcoes de `binance-futures-client.ts`:
```typescript
export interface IExchangeFuturesClient {
  readonly exchangeId: ExchangeId;

  // Account & Position
  getAccountInfo(): Promise<FuturesAccount>;
  getPositions(): Promise<FuturesPosition[]>;
  getPosition(symbol: string): Promise<FuturesPosition | null>;

  // Configuration
  setLeverage(symbol: string, leverage: number): Promise<FuturesLeverage>;
  setMarginType(symbol: string, marginType: MarginType): Promise<void>;
  modifyIsolatedMargin(symbol: string, amount: number, type: 'ADD' | 'REDUCE', positionSide?: string): Promise<MarginModifyResult>;

  // Orders
  submitOrder(params: FuturesOrderParams): Promise<FuturesOrder>;
  cancelOrder(symbol: string, orderId: number): Promise<void>;
  cancelAllOrders(symbol: string): Promise<void>;
  getOpenOrders(symbol?: string): Promise<FuturesOrder[]>;
  closePosition(symbol: string, positionAmt: string, stepSize?: string): Promise<FuturesOrder>;

  // Algo/Conditional Orders
  submitAlgoOrder(params: FuturesAlgoOrderParams): Promise<FuturesAlgoOrder>;
  cancelAlgoOrder(algoId: number): Promise<void>;
  cancelAllAlgoOrders(symbol: string): Promise<void>;
  getOpenAlgoOrders(symbol?: string): Promise<FuturesAlgoOrder[]>;
  getAlgoOrder(algoId: number): Promise<FuturesAlgoOrder | null>;

  // Trade History & Fees
  getIncomeHistory(params?: IncomeHistoryParams): Promise<IncomeHistoryRecord[]>;
  getRecentTrades(symbol: string, limit?: number): Promise<AccountTradeRecord[]>;
  getLastClosingTrade(symbol: string, side: 'LONG' | 'SHORT', openedAt: number): Promise<ClosingTradeResult | null>;
  getAllTradeFeesForPosition(symbol: string, side: 'LONG' | 'SHORT', openedAt: number, closedAt?: number): Promise<AllTradeFeesResult | null>;
  getOrderEntryFee(symbol: string, orderId: number): Promise<OrderEntryFeeResult | null>;

  // Symbol Info
  getLeverageBrackets(symbol: string): Promise<LeverageBracket[]>;
  getCommissionRate(): Promise<CommissionRate>;
}
```
Reusar tipos existentes de `@marketmind/types` (`FuturesPosition`, `FuturesAccount`, `FuturesOrder`, `FuturesLeverage`, `MarginType`).
Tipos como `FuturesOrderParams`, `FuturesAlgoOrderParams`, `FuturesAlgoOrder`, `IncomeHistoryRecord`, `AccountTradeRecord`, `AllTradeFeesResult`, `OrderEntryFeeResult` que hoje existem em `binance-futures-client.ts` devem ser movidos para `exchange/futures-client.ts` (fonte unica de verdade) e `binance-futures-client.ts` importa de la.

#### `apps/backend/src/exchange/price-stream.ts`
```typescript
export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface IExchangePriceStream {
  readonly exchangeId: ExchangeId;
  start(): void;
  stop(): void;
  subscribe(symbol: string, marketType: MarketType): void;
  unsubscribe(symbol: string): void;
  isSubscribed(symbol: string): boolean;
  onPriceUpdate(handler: (update: PriceUpdate) => void): void;
}
```

#### `apps/backend/src/exchange/kline-stream.ts`
```typescript
export interface KlineUpdate {
  symbol: string;
  interval: string;
  marketType: MarketType;
  kline: Kline;
  isClosed: boolean;
}

export interface IExchangeKlineStream {
  readonly exchangeId: ExchangeId;
  start(): void;
  stop(): void;
  subscribe(symbol: string, interval: string): void;
  unsubscribe(symbol: string, interval: string): void;
  getSubscriptionCount(): number;
  onKlineUpdate(handler: (update: KlineUpdate) => void): void;
}
```

#### `apps/backend/src/exchange/user-stream.ts`
```typescript
export interface OrderFillEvent {
  walletId: string;
  symbol: string;
  orderId: number;
  side: 'BUY' | 'SELL';
  status: string;
  price: number;
  quantity: number;
  commission: number;
  commissionAsset: string;
  realizedPnl?: number;
  executionType: string;
}

export interface AccountUpdateEvent {
  walletId: string;
  balances: Array<{ asset: string; balance: string }>;
  positions: Array<{ symbol: string; positionAmt: string; entryPrice: string; unrealizedPnl: string }>;
}

export interface IExchangeUserStream {
  readonly exchangeId: ExchangeId;
  subscribeWallet(wallet: Wallet): Promise<void>;
  unsubscribeWallet(walletId: string): void;
  resubscribeWallet(wallet: Wallet): Promise<void>;
  isSubscribed(walletId: string): boolean;
  onOrderFill(handler: (event: OrderFillEvent) => void): void;
  onAccountUpdate(handler: (event: AccountUpdateEvent) => void): void;
}
```

#### `apps/backend/src/exchange/exchange-registry.ts`
```typescript
export interface ExchangeProvider {
  readonly exchangeId: ExchangeId;
  readonly capabilities: ExchangeCapabilities;

  createSpotClient(credentials: ExchangeCredentials): IExchangeSpotClient;
  createFuturesClient(credentials: ExchangeCredentials): IExchangeFuturesClient;
  createPriceStream(): IExchangePriceStream;
  createSpotKlineStream(): IExchangeKlineStream;
  createFuturesKlineStream(): IExchangeKlineStream;
  createSpotUserStream(): IExchangeUserStream;
  createFuturesUserStream(): IExchangeUserStream;

  normalizeSymbol(symbol: string): string;
  isMarketOpen(): boolean;
  getMarketHours(): MarketHours;
}

class ExchangeRegistry {
  private providers = new Map<ExchangeId, ExchangeProvider>();

  register(provider: ExchangeProvider): void;
  get(exchangeId: ExchangeId): ExchangeProvider;
  has(exchangeId: ExchangeId): boolean;
  getAll(): ExchangeProvider[];
}

export const exchangeRegistry = new ExchangeRegistry();
```

#### `apps/backend/src/exchange/index.ts`
Barrel export de todas as interfaces e o registry.

### Verificacao
- `pnpm --filter @marketmind/backend type-check`
- Nenhum arquivo existente importa deste diretorio — zero impacto

---

## Fase 3: Implementacoes Binance (wrap do codigo existente) [CONCLUIDA]

**Risco: ZERO** — arquivos novos que delegam para funcoes existentes

### Novo diretorio: `apps/backend/src/exchange/binance/`

#### `apps/backend/src/exchange/binance/futures-client.ts`
```typescript
export class BinanceFuturesClient implements IExchangeFuturesClient {
  readonly exchangeId: ExchangeId = 'BINANCE';
  private client: USDMClient;

  constructor(credentials: ExchangeCredentials) {
    this.client = new USDMClient({
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      testnet: credentials.testnet,
      disableTimeSync: false,
    });
  }

  async getPositions(): Promise<FuturesPosition[]> {
    return existingGetPositions(this.client); // delega para funcao existente
  }

  async setLeverage(symbol: string, leverage: number): Promise<FuturesLeverage> {
    return existingSetLeverage(this.client, symbol, leverage);
  }

  // ... cada metodo delega para a funcao existente em binance-futures-client.ts
}
```

**Principio:** Cada metodo faz `return existingFunction(this.client, ...args)`. Zero logica nova.

#### `apps/backend/src/exchange/binance/spot-client.ts`
Wraps `MainClient` operations. Delega para funcoes existentes onde possivel, ou cria thin wrappers onde as funcoes sao inline no `SpotClient` de `market-client-factory.ts`.

#### `apps/backend/src/exchange/binance/price-stream.ts`
Wraps `BinancePriceStreamService` existente implementando `IExchangePriceStream`.

#### `apps/backend/src/exchange/binance/kline-stream.ts`
Wraps `BinanceKlineStreamService` e `BinanceFuturesKlineStreamService`.

#### `apps/backend/src/exchange/binance/user-stream.ts`
Wraps `BinanceUserStreamService` e `BinanceFuturesUserStreamService`.

#### `apps/backend/src/exchange/binance/provider.ts`
```typescript
export class BinanceExchangeProvider implements ExchangeProvider {
  readonly exchangeId: ExchangeId = 'BINANCE';
  readonly capabilities: ExchangeCapabilities = {
    supportedAssetClasses: ['CRYPTO_SPOT', 'CRYPTO_FUTURES'],
    supportedOrderTypes: ['LIMIT', 'MARKET', 'STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT'],
    supportsOco: true,
    supportsAlgoOrders: true,
    supportsLeverage: true,
    supportsIsolatedMargin: true,
    supportsWebSocket: true,
    marketHours: { timezone: 'UTC', is24h: true },
  };

  createFuturesClient(creds: ExchangeCredentials): IExchangeFuturesClient {
    return new BinanceFuturesClient(creds);
  }
  normalizeSymbol(symbol: string): string { return symbol.toUpperCase(); }
  isMarketOpen(): boolean { return true; } // crypto 24/7
  getMarketHours(): MarketHours { return this.capabilities.marketHours; }
  // ... etc
}
```

#### `apps/backend/src/exchange/binance/index.ts`
Barrel export + registration:
```typescript
export const binanceProvider = new BinanceExchangeProvider();
```

### Verificacao
- `pnpm --filter @marketmind/backend type-check`
- Nenhum arquivo existente importa deste diretorio — zero impacto
- Escrever testes unitarios para os adapters (verificar que delegam corretamente)

---

## Fase 4: Adicionar campo `exchange` ao schema de wallets [CONCLUIDA]

**Risco: BAIXO** — coluna nova com default, nao afeta queries existentes

### Arquivo: `apps/backend/src/db/schema.ts`

Adicionar ao `wallets`:
```typescript
exchange: varchar({ length: 20 }).$type<ExchangeId>().default('BINANCE'),
```

### Migration

Gerar migration com `pnpm --filter @marketmind/backend db:generate` que vai:
1. `ALTER TABLE wallets ADD COLUMN exchange VARCHAR(20) DEFAULT 'BINANCE'`
2. `UPDATE wallets SET exchange = 'BINANCE' WHERE exchange IS NULL`

### Verificacao
- `pnpm --filter @marketmind/backend db:generate`
- `pnpm --filter @marketmind/backend db:migrate`
- `pnpm --filter @marketmind/backend type-check`
- `pnpm --filter @marketmind/backend test` — todos os testes passando
- Wallet type inferido agora inclui `exchange` — verificar que nao quebra nenhum router

---

## Fase 5: Conectar o registry e criar factory utilitaria [CONCLUIDA]

**Risco: BAIXO** — adiciona funcoes utilitarias, comeca a usar em pontos controlados

### Arquivo: `apps/backend/src/exchange/factory.ts`

```typescript
import { exchangeRegistry } from './exchange-registry';
import { binanceProvider } from './binance';
import type { Wallet } from '../db/schema';
import { decryptApiKey } from '../services/encryption';
import { getWalletType } from '../services/binance-client';

// Registrar Binance na inicializacao
exchangeRegistry.register(binanceProvider);

export function getExchangeCredentials(wallet: Wallet): ExchangeCredentials {
  const walletType = getWalletType(wallet);
  if (walletType === 'paper') throw new Error('Paper wallets cannot execute real exchange orders');
  return {
    apiKey: decryptApiKey(wallet.apiKeyEncrypted),
    apiSecret: decryptApiKey(wallet.apiSecretEncrypted),
    testnet: walletType === 'testnet',
  };
}

export function getFuturesClient(wallet: Wallet): IExchangeFuturesClient {
  const exchangeId = wallet.exchange ?? 'BINANCE';
  const provider = exchangeRegistry.get(exchangeId);
  return provider.createFuturesClient(getExchangeCredentials(wallet));
}

export function getSpotClient(wallet: Wallet): IExchangeSpotClient {
  const exchangeId = wallet.exchange ?? 'BINANCE';
  const provider = exchangeRegistry.get(exchangeId);
  return provider.createSpotClient(getExchangeCredentials(wallet));
}
```

### Arquivo: `apps/backend/src/services/market-client-factory.ts`

Atualizar `createMarketClient` para usar o registry internamente, mantendo a mesma assinatura publica:
```typescript
export const createMarketClient = (wallet: Wallet, marketType: MarketType): MarketClient => {
  const exchangeId = wallet.exchange ?? 'BINANCE';
  const provider = exchangeRegistry.get(exchangeId);
  const creds = getExchangeCredentials(wallet);

  if (marketType === 'FUTURES') {
    const client = provider.createFuturesClient(creds);
    return new FuturesClientAdapter(client); // adapter para MarketClient interface
  }
  return new SpotClientAdapter(provider.createSpotClient(creds));
};
```

Os `SpotClientAdapter`/`FuturesClientAdapter` fazem bridge entre `MarketClient` (interface antiga) e `IExchangeSpotClient`/`IExchangeFuturesClient` (interface nova). Isso garante que os 2 consumers existentes (`routers/trading.ts`, `routers/trading/orders.ts`) continuam funcionando sem mudanca.

### Verificacao
- `pnpm --filter @marketmind/backend type-check`
- `pnpm --filter @marketmind/backend test`
- Testar manualmente: criar ordem via UI (paper wallet) → deve funcionar igual

---

## Fase 6: Desacoplar business logic de logica exchange-especifica [CONCLUIDA]

**Risco: MEDIO** — muda imports em arquivos criticos, mas comportamento identico

Principio: arquivos de business logic (auto-trading, position-monitor, protection-orders, etc.) NAO devem importar de `binance-client.ts`, `binance-futures-client.ts`, nem do SDK `'binance'`. Eles devem usar apenas as interfaces exchange-agnosticas.

Migrar gradualmente, um servico por vez. Cada servico eh um sub-commit separado.

### 6a. `auto-trading.ts`
- Renomear `executeBinanceOrder()` para `executeOrder()` (remover "Binance" do nome de metodo publico)
- Substituir `createBinanceFuturesClient(wallet)` + chamadas diretas por `getFuturesClient(wallet)` + metodos da interface
- A logica de position sizing, risk management, etc. permanece intacta — eh exchange-agnostica

### 6b. `auto-trading/order-executor.ts`
- Substituir `createBinanceFuturesClient()` + `getOrderEntryFee()` por `getFuturesClient(wallet).getOrderEntryFee()`
- Substituir chamadas de leverage/margin por metodos da interface
- A logica de validacao (filtros, risk/reward, cooldown, pyramiding) permanece — eh exchange-agnostica

### 6c. `protection-orders.ts`
- Substituir `createBinanceFuturesClient()` + `submitFuturesAlgoOrder()` por `getFuturesClient(wallet).submitAlgoOrder()`
- Substituir `createBinanceClient()` + `client.submitNewOrder()` por `getSpotClient(wallet).submitOrder()`
- Usar `exchangeRegistry.get(wallet.exchange).capabilities.supportsOco` para decidir se usa OCO ou ordens separadas
- A logica de "se SL falhar, fechar posicao" permanece — eh exchange-agnostica

### 6d. `position-monitor.ts`
- Substituir `createBinanceFuturesClient()` + funcoes diretas por `getFuturesClient(wallet)` + metodos da interface
- A logica de check de liquidacao, pending orders, etc. permanece — eh exchange-agnostica

### 6e. `margin-manager.ts`
- Substituir `createBinanceFuturesClient()` + `getPosition()` + `modifyIsolatedPositionMargin()` por metodos da interface
- Usar `capabilities.supportsIsolatedMargin` para checar se exchange suporta

### 6f. `fee-service.ts`
- Substituir `new MainClient()` / `new USDMClient()` diretos por `getSpotClient()` / `getFuturesClient()`
- Mover `BINANCE_FEES` defaults para `exchange/binance/` — nao deve estar em `packages/types`

### 6g. Routers (`trading.ts`, `wallet.ts`, `trading/orders.ts`, `trading/futures.ts`, `trading/positions.ts`, `trading/executions.ts`)
- Substituir imports diretos de `binance-client.ts` e `binance-futures-client.ts` por factory do registry
- Router de wallet: usar interface para validar credenciais (cada exchange valida de forma diferente)

### Nota sobre streams (price, kline, user)
Os stream services sao singletons globais com logica complexa de reconnect/state. A migracao deles para as interfaces deve ser feita com MUITO cuidado, idealmente em uma fase separada posterior. Na Fase 6, os streams continuam como estao — usando Binance diretamente. A interface de streams foi criada (Fase 2) para uso futuro.

### Verificacao (apos CADA sub-fase)
- `pnpm --filter @marketmind/backend type-check`
- `pnpm --filter @marketmind/backend test`
- Testar com paper wallet: abrir posicao, verificar SL/TP, trailing stop

---

## Arquivos Afetados (Resumo)

### Novos
- `apps/backend/src/exchange/types.ts`
- `apps/backend/src/exchange/spot-client.ts`
- `apps/backend/src/exchange/futures-client.ts`
- `apps/backend/src/exchange/price-stream.ts`
- `apps/backend/src/exchange/kline-stream.ts`
- `apps/backend/src/exchange/user-stream.ts`
- `apps/backend/src/exchange/exchange-registry.ts`
- `apps/backend/src/exchange/factory.ts`
- `apps/backend/src/exchange/index.ts`
- `apps/backend/src/exchange/binance/futures-client.ts`
- `apps/backend/src/exchange/binance/spot-client.ts`
- `apps/backend/src/exchange/binance/price-stream.ts`
- `apps/backend/src/exchange/binance/kline-stream.ts`
- `apps/backend/src/exchange/binance/user-stream.ts`
- `apps/backend/src/exchange/binance/provider.ts`
- `apps/backend/src/exchange/binance/index.ts`

### Modificados
- `packages/types/src/trading.ts` — desacoplar de binance.ts
- `apps/backend/src/db/schema.ts` — campo `exchange`
- `apps/backend/src/services/market-client-factory.ts` — usar registry
- `apps/backend/src/services/auto-trading.ts` — usar interfaces
- `apps/backend/src/services/auto-trading/order-executor.ts` — usar interfaces
- `apps/backend/src/services/protection-orders.ts` — usar interfaces
- `apps/backend/src/services/position-monitor.ts` — usar interfaces
- `apps/backend/src/services/margin-manager.ts` — usar interfaces
- `apps/backend/src/services/fee-service.ts` — usar interfaces
- `apps/backend/src/routers/trading.ts` — usar interfaces
- `apps/backend/src/routers/wallet.ts` — usar interfaces
- `apps/backend/src/routers/trading/orders.ts` — usar interfaces
- `apps/backend/src/routers/trading/futures.ts` — usar interfaces
- `apps/backend/src/routers/trading/positions.ts` — usar interfaces
- `apps/backend/src/routers/trading/executions.ts` — usar interfaces

### NAO modificados (stream singletons permanecem como estao)
- `apps/backend/src/services/binance-price-stream.ts`
- `apps/backend/src/services/binance-kline-stream.ts`
- `apps/backend/src/services/binance-user-stream.ts`
- `apps/backend/src/services/binance-futures-user-stream.ts`

### NAO deletados (permanecem como implementacao Binance, consumidos apenas pelo adapter)
- `apps/backend/src/services/binance-client.ts` — funcoes de criacao de client, usadas pelo `exchange/binance/`
- `apps/backend/src/services/binance-futures-client.ts` — 30+ funcoes futures, delegadas pelo adapter
- `packages/types/src/binance.ts` — tipos Binance-especificos, usados apenas pelo adapter layer

### Constantes e tipos por exchange (separacao clara)
- `packages/types/src/binance-fees.ts` — todas as constantes Binance de fees (BINANCE_FEES, VIP levels, BNB discount, etc.)
- `packages/types/src/binance.ts` — tipos Binance-especificos (BinanceOrderSide, BinanceAccount, etc.)
- `packages/types/src/fees.ts` — interfaces e thresholds exchange-agnosticos (FeeParams, TradingFees, TRADING_THRESHOLDS)
- `packages/types/src/futures.ts` — importa de `binance-fees.ts` para FUTURES_DEFAULTS (referencia constantes nomeadas, nunca numeros soltos)
- Futuras exchanges terao seus proprios arquivos: `ib-fees.ts`, `ib.ts`, etc.

---

## Verificacao Final

1. `pnpm --filter @marketmind/types build` — tipos compilam
2. `pnpm --filter @marketmind/backend type-check` — sem erros TS
3. `pnpm --filter @marketmind/electron type-check` — sem erros TS
4. `pnpm --filter @marketmind/backend test` — todos testes passando
5. `pnpm --filter @marketmind/electron test` — todos testes passando
6. Teste manual com paper wallet:
   - Abrir posicao futures
   - Verificar SL/TP criados
   - Verificar trailing stop atualiza
   - Fechar posicao
   - Verificar P&L calculado
7. Verificar que `wallet.exchange` aparece como 'BINANCE' para todas as wallets existentes
