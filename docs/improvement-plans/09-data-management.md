# Plano de Melhoria: Gestão de Dados

## 1. Estado Atual

### 1.1 Stack de Dados

| Componente | Versão | Propósito |
|------------|--------|-----------|
| PostgreSQL | 17 | Database relacional |
| TimescaleDB | 2.23.1 | Time-series extension |
| Drizzle ORM | 0.44.7 | Type-safe ORM |
| React Query | 5.x | Client-side caching |

### 1.2 Schema do Banco

```sql
-- Tabelas principais
users (id, email, password, createdAt, updatedAt)
sessions (id, userId, token, expiresAt, createdAt)
wallets (id, userId, name, exchange, apiKey, apiSecret, marketType, createdAt)
orders (id, walletId, symbol, side, type, status, price, quantity, ...)
positions (id, walletId, symbol, side, entryPrice, quantity, ...)
trading_profiles (id, userId, name, enabledSetupTypes, ...)
auto_trading_configs (id, walletId, profileId, ...)
fee_rebates (id, userId, symbol, rebatePercent, ...)

-- TimescaleDB hypertable
klines (symbol, interval, openTime, closeTime, open, high, low, close, volume, ...)
```

### 1.3 Hypertable Configuration

```sql
-- Klines como hypertable TimescaleDB
SELECT create_hypertable('klines', by_range('open_time'));

-- Chunks por semana
SELECT set_chunk_time_interval('klines', INTERVAL '7 days');

-- Compression policy (após 30 dias)
ALTER TABLE klines SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol, interval'
);

SELECT add_compression_policy('klines', INTERVAL '30 days');
```

### 1.4 Volumes Estimados

| Entidade | Volume Estimado | Crescimento |
|----------|-----------------|-------------|
| Users | 1,000 | Lento |
| Wallets | 5,000 | Lento |
| Orders | 1M+ | Alto |
| Klines | 100M+ | Muito alto |
| Positions | 50,000 | Médio |

---

## 2. Análise Acadêmica

### 2.1 Time-Series Databases

**Referências:**
- "Time Series Databases: New Ways to Store and Access Data" (Ted Dunning, 2014)
- TimescaleDB Documentation
- InfluxDB vs TimescaleDB Comparison (Timescale Blog)

**Por que TimescaleDB:**
1. **SQL completo** - Não precisa aprender nova linguagem
2. **Compression** - 90%+ reduction para time-series
3. **Continuous Aggregates** - Materialização automática
4. **Retention Policies** - Cleanup automático

### 2.2 Query Optimization

**Referências:**
- "High Performance MySQL" (Baron Schwartz)
- "Use The Index, Luke" (Markus Winand)
- PostgreSQL Documentation - Query Planning

**Técnicas:**

1. **Indexing Strategies:**
```sql
-- Composite index para queries frequentes
CREATE INDEX idx_klines_symbol_interval_time
ON klines (symbol, interval, open_time DESC);

-- Partial index para posições abertas
CREATE INDEX idx_positions_open
ON positions (wallet_id, symbol)
WHERE status = 'OPEN';
```

2. **Query Batching:**
```typescript
// ❌ N+1 queries
for (const wallet of wallets) {
  const orders = await getOrders(wallet.id);
}

// ✅ Batch query
const orders = await getOrdersByWalletIds(wallets.map(w => w.id));
```

3. **Materialized Views:**
```sql
-- Aggregados pré-calculados
CREATE MATERIALIZED VIEW daily_pnl AS
SELECT
  wallet_id,
  date_trunc('day', closed_at) AS date,
  SUM(pnl) AS total_pnl,
  COUNT(*) AS trades
FROM orders
WHERE status = 'FILLED'
GROUP BY wallet_id, date_trunc('day', closed_at);
```

### 2.3 Caching Strategies

**Referências:**
- "Designing Data-Intensive Applications" (Martin Kleppmann, 2017)
- "Caching at Scale" (Facebook Engineering)

**Patterns:**

1. **Cache-Aside:**
```typescript
const getData = async (key: string) => {
  let data = await cache.get(key);
  if (!data) {
    data = await db.query(key);
    await cache.set(key, data, TTL);
  }
  return data;
};
```

2. **Write-Through:**
```typescript
const updateData = async (key: string, value: any) => {
  await db.update(key, value);
  await cache.set(key, value);
};
```

3. **Stale-While-Revalidate:**
```typescript
// React Query pattern
const { data } = useQuery({
  queryKey: ['klines', symbol],
  queryFn: () => fetchKlines(symbol),
  staleTime: 5 * 60 * 1000, // 5 min stale
  cacheTime: 30 * 60 * 1000, // 30 min cache
});
```

### 2.4 Data Streaming

**Referências:**
- "Streaming Systems" (Akidau, Chernyak, Lax)
- WebSocket API (MDN)
- Binance WebSocket Streams Documentation

**Patterns:**

1. **Real-time Updates:**
```typescript
// WebSocket para dados em tempo real
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');

ws.onmessage = (event) => {
  const kline = parseKline(event.data);
  // Update local state
  // Invalidate React Query cache
};
```

2. **Backpressure Handling:**
```typescript
// Buffer e batch updates
const buffer: Kline[] = [];
const BATCH_SIZE = 100;

ws.onmessage = (event) => {
  buffer.push(parseKline(event.data));

  if (buffer.length >= BATCH_SIZE) {
    await insertBatch(buffer.splice(0, BATCH_SIZE));
  }
};
```

---

## 3. Benchmarking de Mercado

### 3.1 TradingView Data Infrastructure

- Proprietary time-series storage
- Aggressive caching (CDN + edge)
- Compression para historical data
- WebSocket para real-time

### 3.2 Binance Data Architecture

- Multiple data centers
- Real-time streaming via WebSocket
- REST API com rate limits
- Historical data via download

### 3.3 QuantConnect (LEAN)

- Tick-level data storage
- Factor files para adjustments
- Data normalization pipeline
- Caching por asset class

---

## 4. Problemas Identificados

### 4.1 Kline Fetching Inefficiency

**Problema:** Dados de klines são re-fetched frequentemente.

**Atual:**
```typescript
// Fetches from API every time
const klines = await fetchKlines(symbol, interval, limit);
```

**Proposta:**
```typescript
// Check local first, fetch only missing
const klines = await getKlinesWithCache(symbol, interval, start, end);
```

### 4.2 Falta de Continuous Aggregates

**Problema:** Agregações calculadas on-the-fly.

**Exemplo:**
```typescript
// Calcula PnL daily toda vez
const dailyPnL = await db.query(`
  SELECT date_trunc('day', closed_at), SUM(pnl)
  FROM orders
  WHERE wallet_id = $1
  GROUP BY 1
`);
```

**Proposta:** Usar TimescaleDB continuous aggregates.

### 4.3 Sem Retention Policy

**Problema:** Dados crescem indefinidamente.

**Proposta:**
```sql
-- Manter apenas últimos 2 anos de klines 1m
SELECT add_retention_policy('klines', INTERVAL '2 years');

-- Manter agregados por mais tempo
-- (usando continuous aggregates com different retention)
```

### 4.4 React Query Não Otimizado

**Problema:** Cache times não configurados apropriadamente.

**Exemplo:**
```typescript
// Sem staleTime, refetch em cada focus
const { data } = useQuery({
  queryKey: ['wallets'],
  queryFn: fetchWallets,
});
```

---

## 5. Melhorias Propostas

### 5.1 Continuous Aggregates

```sql
-- OHLCV por hora (agregado de 1m)
CREATE MATERIALIZED VIEW klines_1h
WITH (timescaledb.continuous) AS
SELECT
  symbol,
  time_bucket('1 hour', open_time) AS open_time,
  first(open, open_time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, open_time) AS close,
  sum(volume) AS volume
FROM klines
WHERE interval = '1m'
GROUP BY symbol, time_bucket('1 hour', open_time);

-- Refresh policy
SELECT add_continuous_aggregate_policy('klines_1h',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour'
);
```

### 5.2 Intelligent Kline Caching

```typescript
// services/kline-cache.ts
export class KlineCache {
  private cache: Map<string, Kline[]> = new Map();

  async get(
    symbol: string,
    interval: string,
    start: number,
    end: number
  ): Promise<Kline[]> {
    const key = `${symbol}:${interval}`;
    const cached = this.cache.get(key) || [];

    // Find gaps in cached data
    const gaps = findGaps(cached, start, end);

    if (gaps.length === 0) {
      return filterRange(cached, start, end);
    }

    // Fetch only missing data
    for (const gap of gaps) {
      const newKlines = await this.fetchFromDB(symbol, interval, gap.start, gap.end);
      this.merge(key, newKlines);
    }

    return filterRange(this.cache.get(key)!, start, end);
  }

  private async fetchFromDB(
    symbol: string,
    interval: string,
    start: number,
    end: number
  ): Promise<Kline[]> {
    return db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, interval),
        gte(klines.openTime, new Date(start)),
        lte(klines.openTime, new Date(end))
      ),
      orderBy: [asc(klines.openTime)],
    });
  }
}
```

### 5.3 React Query Configuration

```typescript
// services/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});

// Query-specific configs
export const QUERY_CONFIGS = {
  klines: {
    staleTime: 60 * 1000, // 1 minute (real-time)
    cacheTime: 5 * 60 * 1000,
  },
  wallets: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000,
  },
  tradingProfiles: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 60 * 60 * 1000, // 1 hour
  },
};
```

### 5.4 Data Retention Policies

```sql
-- Klines: 2 anos para 1m, indefinido para agregados
SELECT add_retention_policy('klines', INTERVAL '2 years');

-- Orders preenchidas: arquivar após 1 ano
-- (mover para tabela orders_archive)
CREATE TABLE orders_archive (LIKE orders INCLUDING ALL);

-- Job para arquivar
CREATE OR REPLACE FUNCTION archive_old_orders()
RETURNS void AS $$
BEGIN
  INSERT INTO orders_archive
  SELECT * FROM orders
  WHERE status = 'FILLED' AND created_at < NOW() - INTERVAL '1 year';

  DELETE FROM orders
  WHERE status = 'FILLED' AND created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;
```

### 5.5 Data Sync Pipeline

```typescript
// services/data-sync/kline-syncer.ts
export class KlineSyncer {
  private ws: WebSocket | null = null;
  private symbols: Set<string> = new Set();

  async subscribe(symbol: string, interval: string): Promise<void> {
    this.symbols.add(`${symbol.toLowerCase()}@kline_${interval}`);
    await this.reconnect();
  }

  async unsubscribe(symbol: string, interval: string): Promise<void> {
    this.symbols.delete(`${symbol.toLowerCase()}@kline_${interval}`);
    await this.reconnect();
  }

  private async reconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }

    const streams = Array.from(this.symbols).join('/');
    this.ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    this.ws.onmessage = this.handleMessage.bind(this);
    this.ws.onerror = this.handleError.bind(this);
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    const data = JSON.parse(event.data);
    const kline = this.parseKline(data);

    // Batch insert
    await this.buffer.add(kline);

    // Invalidate React Query cache
    queryClient.invalidateQueries({
      queryKey: ['klines', kline.symbol, kline.interval],
    });
  }
}
```

---

## 6. Plano de Implementação

### Fase 1: Database Optimization (1 semana)

| Task | Prioridade |
|------|------------|
| Criar continuous aggregates | P1 |
| Adicionar indexes faltando | P1 |
| Configurar retention policies | P2 |
| Compression policy para klines | P2 |

### Fase 2: Caching Layer (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar KlineCache | P1 |
| Configurar React Query defaults | P1 |
| Optimistic updates para mutations | P2 |
| Cache invalidation strategy | P2 |

### Fase 3: Real-time Sync (1 semana)

| Task | Prioridade |
|------|------------|
| Implementar KlineSyncer | P2 |
| Backpressure handling | P2 |
| Reconnection strategy | P2 |
| Error handling | P2 |

### Fase 4: Archiving & Cleanup (3 dias)

| Task | Prioridade |
|------|------------|
| Criar tabelas de archive | P3 |
| Job de archiving | P3 |
| Monitoring de disk usage | P3 |

---

## 7. Critérios de Validação

### 7.1 Performance

- [ ] Query time < 100ms para últimos 1000 klines
- [ ] Aggregations via continuous aggregates
- [ ] Cache hit rate > 80%
- [ ] Real-time latency < 500ms

### 7.2 Storage

- [ ] Compression ratio > 90%
- [ ] Retention policies configuradas
- [ ] Archiving funcional
- [ ] Disk usage monitored

### 7.3 Reliability

- [ ] WebSocket reconnection automática
- [ ] Data consistency verificada
- [ ] Backup strategy definida
- [ ] Recovery testada

### 7.4 Observability

- [ ] Query performance logged
- [ ] Cache metrics tracked
- [ ] Sync status monitored
- [ ] Alerts configurados

---

## 8. Arquivos a Modificar

### Database

1. `apps/backend/src/db/migrations/` - Novas migrations
2. `apps/backend/src/db/schema.ts` - Indexes

### Backend Services

1. `apps/backend/src/services/data/kline-cache.ts` - Criar
2. `apps/backend/src/services/data/kline-syncer.ts` - Criar
3. `apps/backend/src/services/data/archiver.ts` - Criar

### Frontend

1. `apps/electron/src/renderer/services/query-client.ts` - Configurar
2. `apps/electron/src/renderer/hooks/*.ts` - Adicionar configs
