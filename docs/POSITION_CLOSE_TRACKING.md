# Position Close Tracking

## Overview

O sistema MarketMind agora rastreia a origem de cada fechamento de posição, identificando se foi uma ação automática do algoritmo ou uma ação manual do usuário.

## Database Schema

### Campos Adicionados à Tabela `trade_executions`

```sql
exit_source VARCHAR(50)  -- Origem do fechamento: 'ALGORITHM' ou 'MANUAL'
exit_reason VARCHAR(50)  -- Razão específica do fechamento
```

## Valores Possíveis

### exit_source

- **`ALGORITHM`**: Posição fechada automaticamente pelo sistema
  - Stop Loss atingido
  - Take Profit atingido
  - Trailing Stop acionado
  - Exit setup detectado

- **`MANUAL`**: Posição fechada manualmente pelo usuário
  - Através da interface de trading
  - Via API endpoint `closePosition`

### exit_reason

Quando `exit_source = 'ALGORITHM'`:
- `STOP_LOSS`: Stop loss atingido
- `TAKE_PROFIT`: Take profit atingido

Quando `exit_source = 'MANUAL'`:
- `USER_CLOSE`: Usuário fechou a posição manualmente

## Logs Detalhados

### Fechamento Automático (ALGORITHM)

```typescript
logger.info({
  executionId: execution.id,
  symbol: execution.symbol,
  exitSource: 'ALGORITHM',
  reason: 'STOP_LOSS',
  exitPrice,
  entryPrice,
  quantity,
  pnl: pnl.toFixed(2),
  pnlPercent: adjustedPnlPercent.toFixed(2),
  newBalance: newBalance.toFixed(2),
  isPaperTrading: isPaperWallet(wallet),
  message: 'Posição fechada automaticamente: Stop Loss atingido',
}, '🤖 [ALGORITHM] Position closed automatically');
```

### Fechamento Manual (MANUAL)

```typescript
logger.info({
  positionId: position.id,
  orderId: exitOrderId,
  symbol: position.symbol,
  side: orderSide,
  quantity: qty,
  exitPrice,
  exitSource: 'MANUAL',
  message: 'Posição fechada manualmente pelo usuário',
}, '👤 [MANUAL] Manual close position: Binance exit order executed');
```

## Arquivos Modificados

### Backend

1. **`apps/backend/src/db/schema.ts`**
   - Adicionados campos `exitSource` e `exitReason` à tabela `trade_executions`

2. **`apps/backend/src/services/position-monitor.ts`**
   - Método `executeExit()` atualizado para gravar `exitSource: 'ALGORITHM'` e `exitReason`
   - Logs detalhados com emoji 🤖 para identificar visualmente

3. **`apps/backend/src/routers/trading.ts`**
   - Endpoint `closePosition` atualizado para gravar `exitSource: 'MANUAL'`
   - Logs detalhados com emoji 👤 para identificar visualmente

### Database Migration

```sql
-- Migration: 0010_early_sleepwalker.sql
ALTER TABLE "trade_executions" ADD COLUMN "exit_source" varchar(50);
ALTER TABLE "trade_executions" ADD COLUMN "exit_reason" varchar(50);
```

## Exemplos de Queries

### Listar posições fechadas automaticamente

```sql
SELECT 
  id,
  symbol,
  side,
  entry_price,
  exit_price,
  pnl,
  exit_source,
  exit_reason,
  closed_at
FROM trade_executions
WHERE status = 'closed'
  AND exit_source = 'ALGORITHM'
ORDER BY closed_at DESC;
```

### Listar posições fechadas manualmente

```sql
SELECT 
  id,
  symbol,
  side,
  entry_price,
  exit_price,
  pnl,
  exit_source,
  exit_reason,
  closed_at
FROM trade_executions
WHERE status = 'closed'
  AND exit_source = 'MANUAL'
ORDER BY closed_at DESC;
```

### Estatísticas de fechamento

```sql
SELECT 
  exit_source,
  exit_reason,
  COUNT(*) as count,
  SUM(CAST(pnl AS DECIMAL)) as total_pnl,
  AVG(CAST(pnl_percent AS DECIMAL)) as avg_pnl_percent
FROM trade_executions
WHERE status = 'closed'
  AND exit_source IS NOT NULL
GROUP BY exit_source, exit_reason
ORDER BY exit_source, exit_reason;
```

### Stop Loss vs Take Profit

```sql
SELECT 
  exit_reason,
  COUNT(*) as count,
  SUM(CASE WHEN CAST(pnl AS DECIMAL) > 0 THEN 1 ELSE 0 END) as winners,
  SUM(CASE WHEN CAST(pnl AS DECIMAL) < 0 THEN 1 ELSE 0 END) as losers,
  AVG(CAST(pnl AS DECIMAL)) as avg_pnl
FROM trade_executions
WHERE status = 'closed'
  AND exit_source = 'ALGORITHM'
GROUP BY exit_reason;
```

## Benefícios

1. **Rastreamento Completo**: Identifica exatamente como cada posição foi fechada
2. **Análise de Performance**: Permite avaliar eficácia dos SL/TP vs intervenções manuais
3. **Debugging**: Facilita investigação de problemas específicos
4. **Auditoria**: Registro claro de todas as ações do sistema vs usuário
5. **Logs Visíveis**: Emojis (🤖 e 👤) facilitam identificação visual nos logs

## Notas Importantes

- **Trailing Stop**: Quando o trailing stop move o SL, o campo `stop_loss` no banco é atualizado
- **Histórico**: Posições fechadas antes desta versão terão `exit_source` e `exit_reason` como NULL
- **Logs**: Todos os fechamentos agora incluem mensagem em português para melhor UX
- **Testes**: 579 testes backend passando com as novas features

## Versão

- **Implementado em**: v0.31.0+
- **Migration**: 0010_early_sleepwalker.sql
- **Data**: 15 de dezembro de 2025
