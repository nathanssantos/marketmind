# Otimizações de Performance Aplicadas
**Data**: 15 de dezembro de 2025  
**Versão**: v0.31.0+

## 🎯 Objetivo
Reduzir consumo de recursos com 4 watchers + 4 gráficos abertos:
- Diminuir conexões PostgreSQL de 20 para ~8
- Reduzir queries React Query em ~50%
- Melhorar responsividade geral

## ✅ Otimizações Implementadas

### 1. Pool PostgreSQL (CRÍTICO) ✅

**Arquivo**: `apps/backend/src/db/client.ts`

**Antes:**
```typescript
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,  // ❌ Muitas conexões
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Depois:**
```typescript
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 8,                    // ✅ Reduzido de 20 para 8
  min: 2,                    // ✅ Mantém 2 conexões sempre prontas
  idleTimeoutMillis: 20000,  // ✅ Fecha idle após 20s (antes: 30s)
  connectionTimeoutMillis: 3000,
  allowExitOnIdle: false,    // ✅ Pool persiste
});
```

**Impacto:**
- ✅ Redução de 60% nas conexões máximas (20 → 8)
- ✅ Melhor controle de recursos
- ✅ Previne esgotamento de conexões

---

### 2. React Query Defaults (ALTO) ✅

**Arquivo**: `apps/electron/src/renderer/components/TrpcProvider.tsx`

**Antes:**
```tsx
staleTime: 5000,                    // ❌ Dados ficam stale rápido
retry: 1,
refetchOnWindowFocus: false,
refetchIntervalInBackground: true,  // ❌ Polling com aba inativa
```

**Depois:**
```tsx
staleTime: 30000,                   // ✅ 30s (6x mais tempo de cache)
gcTime: 60000,                      // ✅ Garbage collection após 1 min
retry: 1,
refetchOnWindowFocus: false,
refetchIntervalInBackground: false,  // ✅ Para polling em background
```

**Impacto:**
- ✅ Cache 6x mais longo (5s → 30s)
- ✅ Sem polling em background
- ✅ Redução ~40% em queries desnecessárias

---

### 3. ChartCanvas Polling (ALTO) ✅

**Arquivo**: `apps/electron/src/renderer/components/Chart/ChartCanvas.tsx`

**Antes:**
```tsx
refetchInterval: 5000,  // ❌ 5 segundos = 720 queries/hora (com 1 gráfico)
```

**Depois:**
```tsx
refetchInterval: 10000,  // ✅ 10 segundos = 360 queries/hora (com 1 gráfico)
```

**Impacto (4 gráficos):**
- ✅ Redução de 50% no polling (5s → 10s)
- ✅ De 2,880 para 1,440 queries/hora
- ✅ Menos carga no backend e banco

---

## 📊 Resultados Esperados

### Antes
| Métrica | Valor |
|---------|-------|
| CPU Total | 182.1% |
| Memória Total | 21.7% |
| Conexões DB | 20 idle |
| Queries/hora (4 gráficos) | ~2,880 |
| staleTime | 5s |

### Depois (Estimativa)
| Métrica | Valor | Melhoria |
|---------|-------|----------|
| CPU Total | ~130% | -29% |
| Memória Total | ~19% | -12% |
| Conexões DB | ~8 max | -60% |
| Queries/hora (4 gráficos) | ~1,440 | -50% |
| staleTime | 30s | +500% |

## 🧪 Como Verificar Melhorias

### 1. Verificar Conexões PostgreSQL

```bash
# Terminal 1: Monitorar conexões em tempo real
watch -n 2 'psql marketmind -c "SELECT COUNT(*) as total, state FROM pg_stat_activity WHERE datname = '\''marketmind'\'' GROUP BY state;"'

# Esperado: max 8-10 conexões (antes: 20)
```

### 2. Verificar Uso de Recursos

```bash
# CPU e memória dos processos
ps aux | grep -E "marketmind|electron|node.*backend" | grep -v grep | \
  awk '{printf "%-20s CPU: %6s MEM: %6s\n", $11, $3"%", $4"%"}'
```

### 3. React Query DevTools

Adicionar ao `App.tsx`:
```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Dentro do return
<ReactQueryDevtools initialIsOpen={false} position="bottom-right" />
```

Verificar:
- Queries ativas (deve ser menor)
- Frequência de refetch (10s em vez de 5s)
- Estado dos dados (deve permanecer "fresh" por mais tempo)

### 4. Backend Logs

Observar frequência de logs no terminal do backend:
```
[Auto-Trading] Polling watchers...
```
- Deve continuar a cada 60s (inalterado)
- Menos queries ao banco por iteração

## 🔄 Otimizações Futuras (Não Implementadas)

### 4. Polling Adaptativo (MÉDIO)

Parar polling quando gráfico não está visível:

```tsx
const isChartVisible = useIsVisible(chartRef);

const { data } = trpc.autoTrading.getActiveExecutions.useQuery(
  { walletId: backendWalletId ?? '', limit: 50 },
  {
    enabled: !!backendWalletId && !!symbol && isChartVisible,
    refetchInterval: isChartVisible ? 10000 : false,
  }
);
```

**Benefício**: +30% redução de queries quando gráficos em tabs inativas

---

### 5. Coordenação de Watchers (MÉDIO)

Executar watchers em batch:

```typescript
private async coordinatedPoll(): Promise<void> {
  const dueWatchers = [...this.activeWatchers.values()]
    .filter(w => Date.now() - w.lastProcessedTime >= this.pollIntervalMs);
  
  if (dueWatchers.length === 0) return;
  
  await Promise.all(dueWatchers.map(w => this.processWatcher(w)));
}
```

**Benefício**: Melhor utilização de conexões DB, menos overhead

---

### 6. Price Cache Cleanup (BAIXO)

Limpar preços antigos do cache:

```typescript
private async cleanupStaleCache(): Promise<void> {
  const cutoff = new Date(Date.now() - 60000);
  await db.delete(priceCache).where(lt(priceCache.timestamp, cutoff));
}
```

**Benefício**: Previne crescimento infinito da tabela `price_cache`

---

## 📝 Notas de Rollback

Se houver problemas após as otimizações:

### Reverter Pool PostgreSQL
```typescript
max: 20,  // Voltar para 20
// Remover: min, allowExitOnIdle
idleTimeoutMillis: 30000,  // Voltar para 30s
```

### Reverter React Query
```typescript
staleTime: 5000,  // Voltar para 5s
// Remover: gcTime
refetchIntervalInBackground: true,  // Voltar para true
```

### Reverter ChartCanvas
```tsx
refetchInterval: 5000,  // Voltar para 5s
```

## ✅ Testes Necessários

- [ ] Verificar conexões DB < 10 com 4 watchers ativos
- [ ] Confirmar dados ainda atualizam corretamente em 10s
- [ ] Testar abertura/fechamento de múltiplos gráficos
- [ ] Validar auto-trading continua funcionando normalmente
- [ ] Monitorar por 30 minutos para estabilidade

## 🎯 Métricas de Sucesso

Após 30 minutos de uso:
- ✅ Conexões DB: max 8-10 (antes: 20)
- ✅ CPU backend: < 10% idle (antes: ~7%)
- ✅ Latência queries: < 100ms p95
- ✅ Sem erros de timeout
- ✅ Interface responsiva

---

**Próximos Passos**:
1. Reiniciar backend e frontend
2. Monitorar recursos por 30 min
3. Comparar com baseline anterior
4. Ajustar se necessário
