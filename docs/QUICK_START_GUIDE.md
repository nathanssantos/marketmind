# Auto-Trading Backend - Quick Start Guide

## 🚀 Início Rápido

Este guia mostra como começar a usar o novo sistema de auto-trading backend.

---

## 📋 Pré-requisitos

1. PostgreSQL rodando
2. Backend configurado com as variáveis de ambiente
3. Frontend Electron configurado

---

## 🗄️ 1. Configurar o Banco de Dados

### Rodar Migrations

```bash
cd apps/backend
npm run db:push
```

Isso criará as 3 novas tabelas:
- `auto_trading_config`
- `trade_executions`
- `price_cache`

### Verificar Tabelas

```sql
-- No PostgreSQL
\dt

-- Você deve ver:
-- auto_trading_config
-- trade_executions
-- price_cache
```

---

## 🔧 2. Iniciar o Backend

```bash
cd apps/backend
npm run dev
```

Você verá nos logs:
```
🚀 Backend server running on http://localhost:3001
📡 tRPC endpoint: http://localhost:3001/trpc
🔌 WebSocket server initialized
📊 Binance kline sync initialized
📈 Position monitor service started
💹 Binance price stream service started
```

---

## 💻 3. Iniciar o Frontend

```bash
cd apps/electron
npm run dev
```

---

## 🎯 4. Usar o Sistema

### A. Ver Analytics (Nova Aba!)

1. Abra o app
2. Va para **Trading Sidebar**
3. Desative o modo simulator (botão pause/play)
4. Clique na aba **"Analytics"** (nova!)

Você verá:
- **Risk Display**: Posições abertas, exposição, PnL diário
- **Performance Panel**: Win rate, profit factor, métricas
- **Setup Stats Table**: Performance por tipo de setup

### B. Configurar Auto-Trading

```typescript
// No código ou via UI futura
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';

const { updateConfig } = useBackendAutoTrading(walletId);

await updateConfig({
  walletId,
  isEnabled: true,
  maxConcurrentPositions: 5,
  maxPositionSize: '15', // 15% do saldo
  dailyLossLimit: '3',   // 3% perda máxima diária
  enabledSetupTypes: ['Setup91', 'Setup92', 'Setup93'],
  positionSizing: 'percentage',
});
```

### C. Executar Setup Manualmente

```typescript
const { executeSetup } = useBackendAutoTrading(walletId);

try {
  const result = await executeSetup(setupId, walletId);
  console.log('Execution created:', result.executionId);
} catch (error) {
  console.error('Risk validation failed:', error.message);
}
```

### D. Monitorar Posições

As posições são monitoradas automaticamente:
- ✅ Verificação a cada 1 minuto
- ✅ Updates em tempo real via WebSocket
- ✅ SL/TP executados automaticamente
- ✅ Notificações de fechamento

---

## 🧪 5. Testar o Sistema

### Teste Manual

1. **Criar Wallet Real**:
   - Va para Trading Sidebar → Wallets
   - Adicione uma wallet com API keys da Binance

2. **Ativar Auto-Trading**:
   - Configure via código (aguardando UI)

3. **Detectar Setup**:
   - Sistema detectará automaticamente
   - Validação de risco será feita
   - Ordem será criada se passar

4. **Monitorar**:
   - Va para Analytics tab
   - Veja métricas em tempo real

### Verificar Logs

Backend mostrará:
```
[Position Monitor] Checking 3 open positions
[Price Stream] Subscribed to BTCUSDT
[Risk Manager] Position validated successfully
[Auto Trading] Execution created: exec_abc123
```

---

## 📊 6. Componentes Disponíveis

### RiskDisplay
```tsx
import { RiskDisplay } from '@renderer/components/Trading';

<RiskDisplay walletId={activeWalletId} />
```

**Mostra:**
- Posições abertas vs máximo
- Exposição total
- PnL diário
- Tamanho máximo de posição
- Alertas visuais

### PerformancePanel
```tsx
import { PerformancePanel } from '@renderer/components/Trading';

<PerformancePanel walletId={activeWalletId} />
```

**Mostra:**
- Total Return %
- Net PnL
- Win Rate
- Profit Factor
- Total Trades
- Avg Win/Loss
- Max Drawdown
- Largest Win/Loss

### SetupStatsTable
```tsx
import { SetupStatsTable } from '@renderer/components/Trading';

<SetupStatsTable walletId={activeWalletId} />
```

**Mostra:**
- Performance por tipo de setup
- Win rate de cada setup
- Total PnL por setup
- Avg PnL

---

## 🔍 7. Hooks Disponíveis

### useBackendAutoTrading
```typescript
const {
  config,                    // Configuração atual
  activeExecutions,          // Execuções ativas
  executionHistory,          // Histórico
  updateConfig,              // Atualizar config
  executeSetup,              // Executar setup
  cancelExecution,           // Cancelar
  closeExecution,            // Fechar manualmente
  toggleAutoTrading,         // Ligar/desligar
  isUpdatingConfig,          // Loading states
  isExecutingSetup,
  // ... errors
} = useBackendAutoTrading(walletId);
```

### useBackendAnalytics
```typescript
const {
  performance,               // Métricas de performance
  setupStats,                // Stats por setup
  equityCurve,              // Curva de equity
  tradeHistory,             // Histórico de trades
  isLoading,                // Loading state
} = useBackendAnalytics(walletId, 'month');
```

### usePositionUpdates
```typescript
const {
  isConnected,              // Status WebSocket
} = usePositionUpdates(walletId, enabled);
```

### useAutoTrading (Unified)
```typescript
const {
  executeSetup,             // Funciona em simulator E backend
  isAutoTradingEnabled,     // Status
  config,                   // Config
} = useAutoTrading({
  walletId,
  isSimulatorMode: false,
});
```

---

## ⚙️ 8. Configurações Recomendadas

### Para Testes
```typescript
{
  isEnabled: true,
  maxConcurrentPositions: 2,
  maxPositionSize: '5',      // 5% do saldo
  dailyLossLimit: '2',       // 2% perda máxima
  enabledSetupTypes: ['Setup91'],
  positionSizing: 'fixed',
}
```

### Para Produção Conservadora
```typescript
{
  isEnabled: true,
  maxConcurrentPositions: 3,
  maxPositionSize: '10',     // 10% do saldo
  dailyLossLimit: '3',       // 3% perda máxima
  enabledSetupTypes: ['Setup91', 'Setup92', 'Setup93'],
  positionSizing: 'percentage',
}
```

### Para Produção Agressiva
```typescript
{
  isEnabled: true,
  maxConcurrentPositions: 5,
  maxPositionSize: '15',     // 15% do saldo
  dailyLossLimit: '5',       // 5% perda máxima
  enabledSetupTypes: ['Setup91', 'Setup92', 'Setup93', 'Setup94'],
  positionSizing: 'kelly',   // Kelly Criterion
}
```

---

## 🐛 9. Troubleshooting

### Backend não inicia
```bash
# Verificar PostgreSQL
psql -U postgres -c "SELECT version();"

# Verificar .env
cat apps/backend/.env

# Verificar logs
tail -f apps/backend/logs/app.log
```

### Migrations não rodam
```bash
# Verificar connection string
echo $DATABASE_URL

# Rodar manualmente
cd apps/backend
npx drizzle-kit push:pg
```

### WebSocket não conecta
```bash
# Verificar porta
lsof -i :3001

# Verificar CORS
# Em apps/backend/src/index.ts, verificar:
origin: env.CORS_ORIGIN
```

### Position Monitor não funciona
```bash
# Verificar logs do backend
# Deve mostrar:
# [Position Monitor] Checking N open positions

# Se não aparecer, verificar:
# - Serviço iniciou? (ver logs de startup)
# - Há posições abertas?
```

---

## 📚 10. ChartCanvas Integration

✅ **Já Implementado!** O ChartCanvas agora usa o hook `useAutoTrading` que:

- **Modo Simulador**: Quando ativo, executa setups usando `tradingStore` (frontend)
- **Modo Backend**: Quando inativo, executa setups via backend tRPC endpoints
- **Execução Automática**: Detecta setups e cria ordens automaticamente
- **Validação Unificada**: Mesma lógica de risk validation em ambos os modos

### Como Funciona:

```typescript
// ChartCanvas.tsx (já migrado)
const { executeSetup: executeAutoTradingSetup } = useAutoTrading({
  walletId: isSimulatorActive ? activeWalletId : backendWalletId,
  isSimulatorMode: isSimulatorActive,
});

// Quando um setup é detectado:
executeAutoTradingSetup(setup, symbol, quantity, fees, currentPrice)
  .then((result) => {
    if (result.success) {
      console.log('Setup executado com sucesso!');
    }
  })
  .catch((error) => {
    console.error('Falha na execução:', error.message);
  });
```

## 📚 11. Próximos Passos

1. **Rodar Migrations** (essencial)
   - Execute `npm run db:push` no backend
   - Verifique as 3 tabelas criadas

2. **Adicionar UI de Configuração**
   - Dialog para configurar auto-trading
   - Toggle para enable/disable

3. **Testes de Integração**
   - Testar com Binance testnet
   - Validar fluxo completo

4. **Monitoramento**
   - Adicionar Sentry ou similar
   - Dashboard de monitoring

---

## 🆘 Suporte

### Documentação Completa
- [AUTO_TRADING_IMPLEMENTATION.md](./AUTO_TRADING_IMPLEMENTATION.md)
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
- [TRADING_BACKEND_MIGRATION_PLAN.md](./TRADING_BACKEND_MIGRATION_PLAN.md)

### Arquivos Principais
**Backend:**
- `apps/backend/src/routers/auto-trading.ts`
- `apps/backend/src/routers/analytics.ts`
- `apps/backend/src/services/position-monitor.ts`
- `apps/backend/src/services/risk-manager.ts`

**Frontend:**
- `apps/electron/src/renderer/hooks/useBackendAutoTrading.ts`
- `apps/electron/src/renderer/hooks/useBackendAnalytics.ts`
- `apps/electron/src/renderer/components/Trading/RiskDisplay.tsx`
- `apps/electron/src/renderer/components/Trading/PerformancePanel.tsx`

---

**Versão:** 1.0
**Última Atualização:** 3 de Dezembro de 2025
