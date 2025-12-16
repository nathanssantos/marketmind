# Análise de Performance - MarketMind
**Data**: 15 de dezembro de 2025  
**Cenário**: 4 watchers ativos + 4 gráficos abertos

## 📊 Estado Atual dos Recursos

### Consumo Total
- **CPU Total**: 182.1% (~1.8 cores)
- **Memória Total**: 21.7%

### Processos Principais
| Processo | CPU | Memória | Observação |
|----------|-----|---------|------------|
| pnpm (root) | 145.7% | 6.0% | Build/watch process |
| Backend (tsx) | 6.9% | 1.0% | Backend server |
| Electron (Main) | 1.8% | 0.8% | App principal |
| Electron (Renderer) | 1.8% | 3.8% | UI principal |
| Electron (Renderer 2) | 0.0% | 3.1% | 2º gráfico |
| Electron (Renderer 3) | 0.0% | 1.8% | 3º gráfico |
| Electron (Renderer 4) | 0.0% | 1.6% | 4º gráfico |

### 🚨 Problema Identificado: Conexões PostgreSQL

**20 conexões idle no pool** - PROBLEMA CRÍTICO

```
total_connections | state  
------------------+-------
20                | idle
1                 | active
```

## 🔍 Análise Detalhada

### 1. Backend Polling Intervals

#### Auto-Trading Scheduler
```typescript
// apps/backend/src/services/auto-trading-scheduler.ts
private pollIntervalMs: number = 60000; // 60 segundos
```
- **4 watchers ativos** = 4 loops independentes a cada 60s
- Cada loop faz múltiplas queries ao banco

#### Position Monitor
```typescript
// apps/backend/src/services/position-monitor.ts
private readonly CHECK_INTERVAL_MS = 60000; // 60 segundos
```
- 1 loop global verificando todas as posições abertas

### 2. Frontend React Query Polling

#### Execuções Ativas (ChartCanvas)
```tsx
refetchInterval: 5000  // 5 segundos
```
- **4 gráficos abertos** = 4 queries a cada 5s = **800 queries/hora**

#### Risk Display
```tsx
refetchInterval: 30000  // 30 segundos (exposição)
refetchInterval: 10000  // 10 segundos (posições)
```

#### News Panel
```tsx
refetchInterval: 300000  // 5 minutos (se habilitado)
```

### 3. WebSocket Connections

#### Binance Kline Streams
- **4 watchers** = 4 WebSocket connections para klines
- Cada watcher mantém 1 conexão para seu símbolo+intervalo

#### Binance Price Stream
- 1 conexão global para preços em tempo real
- Multiplexing de símbolos na mesma conexão

## ⚠️ Problemas Identificados

### Crítico 🔴

1. **Pool de Conexões PostgreSQL**
   - 20 conexões idle simultaneamente
   - Não há configuração explícita de pool limit
   - Drizzle ORM não está reutilizando conexões eficientemente

### Alto 🟠

2. **Frontend Polling Agressivo**
   - ChartCanvas: 4 queries a cada 5s (800/hora)
   - Multiplicado por número de gráficos abertos
   - Não há debounce ou batching

3. **Watchers com Polling Independente**
   - Cada watcher tem seu próprio setInterval
   - Não há coordenação entre watchers
   - 4 loops a cada 60s = potencial para sobrecarga

### Médio 🟡

4. **React Query Background Refetch**
   ```tsx
   refetchIntervalInBackground: true
   ```
   - Queries continuam rodando mesmo com aba inativa
   - Aumenta consumo desnecessário

5. **StaleTime Baixo**
   ```tsx
   staleTime: 5000  // 5 segundos
   ```
   - Dados ficam stale rapidamente
   - Força refetch frequente

## 🎯 Recomendações de Otimização

### 1. Pool de Conexões PostgreSQL (CRÍTICO)

```typescript
// apps/backend/src/db/index.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,              // 🆕 Limite máximo de conexões
  idleTimeoutMillis: 30000,  // 🆕 Fecha conexões idle após 30s
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool);
```

**Benefício**: Reduz de 20 para 5 conexões simultâneas, libera recursos

### 2. Aumentar staleTime no TrpcProvider

```tsx
// apps/electron/src/renderer/components/TrpcProvider.tsx
const [queryClient] = useState(() => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,  // 🆕 30s (antes: 5s)
      gcTime: 60000,     // 🆕 Garbage collection após 1 min
      retry: 1,
      refetchOnWindowFocus: false,
      refetchIntervalInBackground: false,  // 🆕 Desabilitar (antes: true)
    },
  },
}));
```

**Benefício**: Reduz refetch desnecessários, mantém dados em cache por mais tempo

### 3. Polling Adaptativo no ChartCanvas

```tsx
// apps/electron/src/renderer/components/Chart/ChartCanvas.tsx
const isChartVisible = useIsVisible(chartRef);

const { data: backendExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
  { walletId: backendWalletId ?? '', limit: 50 },
  {
    enabled: !!backendWalletId && !!symbol && isChartVisible,  // 🆕 Só quando visível
    refetchInterval: isChartVisible ? 10000 : false,  // 🆕 10s quando visível, parado quando invisível
  }
);
```

**Benefício**: 50% menos queries (10s vs 5s), para quando gráfico invisível

### 4. Coordenação de Watchers

```typescript
// apps/backend/src/services/auto-trading-scheduler.ts
private coordinatedPoll(): void {
  // Agrupa watchers por timestamp para execução em batch
  const now = Date.now();
  const dueWatchers = [...this.activeWatchers.values()]
    .filter(w => now - w.lastProcessedTime >= this.pollIntervalMs);
  
  if (dueWatchers.length === 0) return;
  
  // Executa todos em paralelo com Promise.all
  Promise.all(dueWatchers.map(w => this.processWatcher(w)))
    .catch(error => log('Error in coordinated poll', { error }));
}
```

**Benefício**: Reduz queries ao banco, melhor utilização de conexões

### 5. Batching de Queries tRPC

```tsx
// apps/electron/src/renderer/components/TrpcProvider.tsx
httpBatchLink({
  url: `${BACKEND_URL}/trpc`,
  maxURLLength: 2083,  // 🆕 Batch queries automático
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: 'include',
    });
  },
}),
```

**Benefício**: Agrupa múltiplas queries em 1 request HTTP

### 6. Price Cache Cleanup

```typescript
// apps/backend/src/services/position-monitor.ts
private readonly PRICE_CACHE_TTL = 3000;  // 3 segundos

private async cleanupStaleCache(): Promise<void> {
  const cutoff = new Date(Date.now() - this.PRICE_CACHE_TTL * 2);
  await db.delete(priceCache).where(lt(priceCache.timestamp, cutoff));
}
```

**Benefício**: Remove preços antigos, reduz tamanho da tabela

## 📈 Impacto Esperado

### Antes das Otimizações
- **CPU**: 182.1%
- **Memória**: 21.7%
- **Conexões DB**: 20 idle
- **Queries/hora**: ~800 (só ChartCanvas)

### Depois das Otimizações (Estimativa)
- **CPU**: ~120% (-34%)
- **Memória**: ~18% (-17%)
- **Conexões DB**: 5 max (-75%)
- **Queries/hora**: ~400 (-50%)

## ✅ Prioridades de Implementação

1. **🔴 CRÍTICO - Pool PostgreSQL** (5 minutos)
   - Maior impacto na estabilidade
   - Previne esgotamento de conexões

2. **🟠 ALTO - TrpcProvider staleTime** (2 minutos)
   - Fácil implementação
   - Grande redução de queries

3. **🟠 ALTO - Polling Adaptativo** (15 minutos)
   - Requer hook useIsVisible
   - Reduz queries quando gráfico invisível

4. **🟡 MÉDIO - Coordenação de Watchers** (30 minutos)
   - Mais complexo
   - Benefício moderado com 4 watchers

5. **🟡 MÉDIO - Price Cache Cleanup** (10 minutos)
   - Manutenção preventiva
   - Evita crescimento infinito

## 🔧 Ferramentas de Monitoramento

### PostgreSQL
```sql
-- Ver conexões ativas em tempo real
SELECT 
  pid,
  usename,
  application_name,
  state,
  wait_event_type,
  NOW() - query_start as duration,
  query
FROM pg_stat_activity
WHERE datname = 'marketmind'
ORDER BY duration DESC;

-- Verificar pool size
SHOW max_connections;

-- Queries mais lentas
SELECT 
  mean_exec_time,
  calls,
  query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### React Query DevTools
```tsx
// Adicionar ao App.tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />
```

### Backend Metrics
```typescript
// apps/backend/src/services/metrics.ts
export class MetricsService {
  private queryCount = 0;
  private queryTimes: number[] = [];
  
  trackQuery(duration: number): void {
    this.queryCount++;
    this.queryTimes.push(duration);
  }
  
  getStats(): {
    total: number;
    avgTime: number;
    maxTime: number;
  } {
    return {
      total: this.queryCount,
      avgTime: this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length,
      maxTime: Math.max(...this.queryTimes),
    };
  }
}
```

## 📝 Notas Adicionais

### Comportamento Normal
- CPU alto durante desenvolvimento é esperado (hot reload, build)
- Electron multi-process (1 main + N renderers) é normal
- WebSockets mantêm conexões abertas (necessário)

### Red Flags
- ❌ 20 conexões DB idle (deveria ser ~5)
- ❌ Polling de 5s em 4 gráficos (muito agressivo)
- ❌ Background refetch habilitado (desperdiça recursos)

### Benchmarks Recomendados
- **Conexões DB**: Max 5-10 (com 4 watchers)
- **CPU Backend**: <10% em idle
- **Memory per Renderer**: <100MB
- **Query Response Time**: <100ms (p95)

---

**Próximos Passos**: Implementar otimizações na ordem de prioridade listada acima.
