# Exemplos de Uso - Position Close Tracking

## Como Verificar Logs de Fechamento

### 1. Logs em Tempo Real (Terminal)

Quando o backend está rodando, você verá logs assim:

**Fechamento Automático (Stop Loss):**
```
🤖 [ALGORITHM] Position closed automatically {
  executionId: 'exec-1765827198485-ikelld1',
  symbol: 'SOLUSDT',
  exitSource: 'ALGORITHM',
  reason: 'STOP_LOSS',
  exitPrice: 125.31,
  entryPrice: 124.43,
  quantity: 0.386,
  pnl: -0.43,
  pnlPercent: -0.35,
  newBalance: 999.57,
  isPaperTrading: false,
  message: 'Posição fechada automaticamente: Stop Loss atingido'
}
```

**Fechamento Automático (Take Profit):**
```
🤖 [ALGORITHM] Position closed automatically {
  executionId: 'exec-1765825584245-w3a926g',
  symbol: 'SOLUSDT',
  exitSource: 'ALGORITHM',
  reason: 'TAKE_PROFIT',
  exitPrice: 126.85,
  entryPrice: 124.43,
  quantity: 0.386,
  pnl: 0.93,
  pnlPercent: 0.75,
  newBalance: 1000.93,
  isPaperTrading: false,
  message: 'Posição fechada automaticamente: Take Profit atingido'
}
```

**Fechamento Manual:**
```
👤 [MANUAL] Manual close position: Binance exit order executed {
  positionId: 'pos-1765828000000-abc123',
  orderId: 12345678,
  symbol: 'SOLUSDT',
  side: 'SELL',
  quantity: 0.386,
  exitPrice: 125.50,
  exitSource: 'MANUAL',
  message: 'Posição fechada manualmente pelo usuário'
}
```

### 2. Queries SQL para Análise

#### Verificar última posição fechada
```sql
SELECT 
  id,
  symbol,
  side,
  CAST(entry_price AS DECIMAL) as entry,
  CAST(exit_price AS DECIMAL) as exit,
  CAST(pnl AS DECIMAL) as pnl,
  exit_source,
  exit_reason,
  closed_at
FROM trade_executions
WHERE status = 'closed'
ORDER BY closed_at DESC
LIMIT 1;
```

#### Comparar performance: SL vs TP vs Manual
```sql
SELECT 
  exit_source,
  exit_reason,
  COUNT(*) as total_closes,
  SUM(CASE WHEN CAST(pnl AS DECIMAL) > 0 THEN 1 ELSE 0 END) as profitable,
  ROUND(AVG(CAST(pnl AS DECIMAL)), 2) as avg_pnl,
  ROUND(AVG(CAST(pnl_percent AS DECIMAL)), 2) as avg_pnl_percent
FROM trade_executions
WHERE status = 'closed'
  AND exit_source IS NOT NULL
  AND closed_at > NOW() - INTERVAL '7 days'
GROUP BY exit_source, exit_reason
ORDER BY exit_source, exit_reason;
```

#### Efetividade do Trailing Stop
```sql
-- Posições fechadas por SL (incluindo trailing)
SELECT 
  id,
  symbol,
  side,
  CAST(entry_price AS DECIMAL) as entry,
  CAST(stop_loss AS DECIMAL) as final_sl,
  CAST(exit_price AS DECIMAL) as exit,
  CAST(pnl AS DECIMAL) as pnl,
  closed_at
FROM trade_executions
WHERE status = 'closed'
  AND exit_source = 'ALGORITHM'
  AND exit_reason = 'STOP_LOSS'
  AND CAST(pnl AS DECIMAL) > 0  -- SL que ainda lucrou (trailing protegeu lucro)
ORDER BY closed_at DESC
LIMIT 10;
```

#### Fechamentos manuais (intervenções do usuário)
```sql
SELECT 
  symbol,
  side,
  CAST(entry_price AS DECIMAL) as entry,
  CAST(exit_price AS DECIMAL) as exit,
  CAST(pnl AS DECIMAL) as pnl,
  CAST(pnl_percent AS DECIMAL) as pnl_percent,
  closed_at
FROM trade_executions
WHERE status = 'closed'
  AND exit_source = 'MANUAL'
ORDER BY closed_at DESC
LIMIT 20;
```

## 3. Exemplos de Análise

### Exemplo 1: Sistema funcionando corretamente

```
exit_source | exit_reason  | total_closes | profitable | avg_pnl | avg_pnl_percent
------------+--------------+--------------+------------+---------+-----------------
ALGORITHM   | STOP_LOSS    | 15           | 2          | -1.24   | -1.02
ALGORITHM   | TAKE_PROFIT  | 8            | 8          | 3.45    | 2.85
MANUAL      | USER_CLOSE   | 3            | 2          | 0.87    | 0.72
```

**Interpretação:**
- TP sempre lucrativo (8/8) ✅
- SL algumas vezes protegeu lucro (2/15) graças ao trailing stop ✅
- Intervenções manuais com resultado positivo (2/3 lucrativas) ✅

### Exemplo 2: Problemas potenciais

```
exit_source | exit_reason  | total_closes | profitable | avg_pnl | avg_pnl_percent
------------+--------------+--------------+------------+---------+-----------------
ALGORITHM   | STOP_LOSS    | 25           | 0          | -2.15   | -1.77
ALGORITHM   | TAKE_PROFIT  | 3            | 3          | 1.85    | 1.53
MANUAL      | USER_CLOSE   | 15           | 12         | 1.34    | 1.11
```

**Interpretação:**
- SL sendo atingido demais (25 vs 3 TP) 🚨 - SL pode estar muito apertado
- Muitas intervenções manuais (15) 🚨 - Usuário não confia no sistema
- Intervenções manuais mais lucrativas que TP 🚨 - Setup pode estar conservador demais

## 4. Teste Manual

Para testar a funcionalidade agora:

```bash
# 1. Iniciar backend
cd apps/backend && pnpm dev

# 2. Em outro terminal, verificar posições abertas
psql marketmind -c "SELECT id, symbol, side, status FROM trade_executions WHERE status = 'open';"

# 3. Fechar uma posição manualmente via API (ou interface)
# O log deve mostrar: 👤 [MANUAL] Manual close position...

# 4. Verificar no banco
psql marketmind -c "SELECT exit_source, exit_reason FROM trade_executions WHERE status = 'closed' ORDER BY closed_at DESC LIMIT 1;"
```

## 5. Próximos Passos

Com este sistema, você pode:
- Avaliar se o trailing stop está funcionando corretamente
- Identificar quando usuário está intervindo manualmente
- Comparar performance de SL/TP automáticos vs intervenções manuais
- Ajustar parâmetros baseado em dados concretos
- Detectar problemas de configuração (SL muito apertado, TP muito distante, etc)

## Debugging

Se os campos estiverem NULL:
1. Verificar migration: `psql marketmind -c "\d trade_executions" | grep exit`
2. Verificar código: campos devem ser setados em `executeExit()` e `closePosition()`
3. Verificar logs: deve aparecer 🤖 ou 👤 nos logs de fechamento
