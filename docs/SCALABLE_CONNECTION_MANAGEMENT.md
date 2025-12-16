# Gerenciamento Escalável de Conexões PostgreSQL
**Data**: 15 de dezembro de 2025  
**Versão**: v0.31.0+

## 🎯 Objetivo

Permitir abrir **quantos watchers e gráficos o computador aguentar** sem problemas de conexões, garantindo:
- ✅ Conexões são criadas sob demanda
- ✅ Conexões idle são fechadas automaticamente
- ✅ Pool escala dinamicamente até limite seguro
- ✅ Monitoramento em tempo real do pool

## 🔧 Implementação

### 1. Pool PostgreSQL Escalável

**Arquivo**: `apps/backend/src/db/client.ts`

```typescript
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 50,                    // ✅ Limite alto para escalar
  min: 0,                     // ✅ Nenhuma conexão permanente (economiza recursos)
  idleTimeoutMillis: 10000,   // ✅ Fecha conexões idle após 10s
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true,      // ✅ Pool pode fechar todas conexões se idle
});
```

**Antes:**
- ❌ max: 8 (limitava escalabilidade)
- ❌ min: 2 (mantinha conexões ociosas)
- ❌ idleTimeout: 20s (conexões ficavam abertas demais)

**Depois:**
- ✅ max: 50 (permite muitos watchers/gráficos)
- ✅ min: 0 (fecha tudo quando não precisa)
- ✅ idleTimeout: 10s (limpa rápido)

### 2. Logging de Conexões

```typescript
pool.on('connect', (client) => {
  const totalCount = pool.totalCount;
  const idleCount = pool.idleCount;
  const waitingCount = pool.waitingCount;
  console.log(`[DB Pool] Connection acquired - Total: ${totalCount}, Idle: ${idleCount}, Waiting: ${waitingCount}`);
});

pool.on('remove', (client) => {
  const totalCount = pool.totalCount;
  const idleCount = pool.idleCount;
  console.log(`[DB Pool] Connection removed - Total: ${totalCount}, Idle: ${idleCount}`);
});
```

**Logs esperados:**
```
[DB Pool] Connection acquired - Total: 3, Idle: 0, Waiting: 0
[DB Pool] Connection acquired - Total: 5, Idle: 0, Waiting: 0
[DB Pool] Connection removed - Total: 4, Idle: 2
[DB Pool] Connection removed - Total: 3, Idle: 1
```

### 3. Monitoramento Automático

```typescript
setInterval(() => {
  const stats = getPoolStats();
  if (stats.total > 0) {
    console.log(`[DB Pool] Stats - Total: ${stats.total}, Idle: ${stats.idle}, Waiting: ${stats.waiting}`);
  }
}, 60000); // A cada 1 minuto
```

### 4. Endpoint de Monitoramento

**Arquivo**: `apps/backend/src/routers/health.ts`

```typescript
poolStats: publicProcedure.query(() => {
  const stats = getPoolStats();
  return {
    total: stats.total,
    idle: stats.idle,
    waiting: stats.waiting,
    timestamp: new Date().toISOString(),
  };
}),
```

**Uso:**
```bash
curl http://localhost:3001/trpc/health.poolStats
```

### 5. Monitor Visual no Frontend

**Arquivo**: `apps/electron/src/renderer/components/Debug/PoolStatsMonitor.tsx`

- Badge fixo no canto inferior direito
- Atualiza a cada 5 segundos
- Cores indicam saúde:
  - 🟢 Verde: < 10 conexões
  - 🟡 Amarelo: 10-30 conexões
  - 🔴 Vermelho: > 30 conexões

**Tooltip mostra:**
- Total de conexões
- Conexões idle
- Queries esperando

## 📊 Comportamento Esperado

### Cenário 1: Abertura Progressiva

```
Estado Inicial: 0 conexões
↓
Abrir 1º gráfico → 2-3 conexões (queries iniciais)
↓
Abrir 2º gráfico → 4-5 conexões
↓
Abrir 3º gráfico → 6-7 conexões
↓
Abrir 4º gráfico → 8-9 conexões
↓
Após 10s idle → Reduz para 4-5 conexões (fecha idle)
```

### Cenário 2: Watchers + Gráficos

```
4 watchers ativos (1 conexão cada = 4)
+
4 gráficos abertos (2 conexões cada = 8)
=
~12 conexões ativas
+
~3-5 conexões temporárias (queries pontuais)
=
Total: 15-17 conexões (pico)
↓
Após queries: 12-14 conexões (steady state)
↓
Após 10s idle: 8-10 conexões (limpa idle)
```

### Cenário 3: Escala Máxima

```
10 watchers + 10 gráficos + queries intensas
=
~35 conexões (dentro do limite de 50)
```

## ✅ Garantias

### 1. Conexões Sempre Fechadas ✅

- **Timeout automático**: 10 segundos de idle
- **allowExitOnIdle**: Pool fecha quando não há demanda
- **min: 0**: Nenhuma conexão forçada a permanecer aberta

### 2. Sem Limite Artificial ✅

- **max: 50**: Suporta até 25 watchers + 25 gráficos simultaneamente
- Pool escala sob demanda conforme necessidade
- Não bloqueia abertura de novos recursos

### 3. Monitoramento Transparente ✅

- Logs em tempo real no backend
- Badge visual no frontend
- Endpoint HTTP para debugging
- Alertas automáticos se > 30 conexões

## 🧪 Como Testar

### 1. Verificar Conexões Iniciais

```bash
# Terminal 1: Iniciar backend
cd apps/backend && pnpm dev

# Terminal 2: Monitorar pool
watch -n 2 'psql marketmind -c "SELECT state, COUNT(*) FROM pg_stat_activity WHERE datname = '\''marketmind'\'' GROUP BY state;"'
```

**Esperado**: 0-2 conexões iniciais

### 2. Abrir Múltiplos Gráficos

1. Abrir app
2. Ver badge no canto inferior direito (deve mostrar 2-3 conexões)
3. Abrir 2º gráfico (criar nova aba)
4. Badge deve aumentar para 4-6 conexões
5. Repetir até 10 gráficos

**Esperado**: Conexões crescem proporcionalmente, mas não ultrapassam 30

### 3. Fechar Gráficos

1. Fechar 5 gráficos
2. Aguardar 10-15 segundos
3. Badge deve reduzir conexões

**Esperado**: Pool limpa conexões idle após 10s

### 4. Watchers em Massa

1. Ativar 10 watchers diferentes
2. Monitorar badge
3. Verificar terminal backend

**Esperado**: Logs mostram conexões sendo criadas e removidas

### 5. Teste de Stress

```bash
# Simular muitas queries simultâneas
for i in {1..20}; do
  curl http://localhost:3001/trpc/health.poolStats &
done
wait
```

**Esperado**: 
- Todas as queries completam sem erro
- Pool não ultrapassa 50 conexões
- Conexões são limpas após queries

## 🚨 Alertas e Red Flags

### 🟢 Normal
- 0-10 conexões: Uso leve
- 10-20 conexões: 4-8 watchers + gráficos
- 20-30 conexões: Uso pesado (10+ watchers)

### 🟡 Atenção
- 30-40 conexões: Limite se aproximando
- Badge amarelo no frontend
- Considerar fechar recursos não usados

### 🔴 Crítico
- 40-50 conexões: Próximo do limite
- Badge vermelho no frontend
- Console warning automático
- Possível degradação de performance

## 📝 Troubleshooting

### Problema: Conexões não fecham

**Sintoma**: Pool mantém 20+ conexões idle

**Causa**: Queries long-running ou pooling agressivo

**Solução**:
```bash
# Ver queries lentas
psql marketmind -c "SELECT pid, NOW() - query_start as duration, state, query FROM pg_stat_activity WHERE datname = 'marketmind' AND state = 'active' ORDER BY duration DESC;"

# Forçar kill de query lenta
psql marketmind -c "SELECT pg_terminate_backend(PID_AQUI);"
```

### Problema: "connection timeout"

**Sintoma**: Erro ao tentar criar conexão

**Causa**: Pool em limite máximo (50)

**Solução**:
1. Verificar quantos watchers/gráficos ativos
2. Fechar recursos desnecessários
3. Aumentar `max` se necessário (não recomendado)

### Problema: Badge não aparece

**Sintoma**: Monitor não visível no frontend

**Causa**: Erro no componente

**Solução**:
```bash
# Ver console do browser
# Verificar import em App.tsx
# Testar endpoint manualmente
curl http://localhost:3001/trpc/health.poolStats
```

## 🎯 Métricas de Sucesso

Após implementação:
- ✅ Abrir 20+ gráficos sem erro
- ✅ Pool não ultrapassa 30 conexões com 10 watchers
- ✅ Conexões reduzem após fechar gráficos
- ✅ Badge atualiza em tempo real
- ✅ Sem warnings de pool esgotado

## 🔄 Rollback

Se houver problemas:

```typescript
// apps/backend/src/db/client.ts
const pool = new Pool({
  max: 8,                    // Voltar para conservador
  min: 2,                    // Manter 2 conexões sempre
  idleTimeoutMillis: 20000,  // 20s
  allowExitOnIdle: false,    // Não fechar pool
});

// Remover event listeners
// Remover setInterval
```

## 📚 Referências

- [node-postgres Pool Documentation](https://node-postgres.com/apis/pool)
- [PostgreSQL Connection Limits](https://www.postgresql.org/docs/current/runtime-config-connection.html)
- [Drizzle ORM Connection Management](https://orm.drizzle.team/docs/rqb)

---

**Conclusão**: Sistema agora escala dinamicamente, mantém apenas conexões necessárias e fecha automaticamente quando idle. Pode abrir quantos recursos o hardware aguentar! 🚀
