# 🎯 Plano de Ação - Sistema de Trading MarketMind

**Data:** 15 de dezembro de 2025  
**Status:** Sistema 7/10 - Arquitetura sólida, bugs críticos impedem lucro  
**Objetivo:** Sistema lucrativo pronto para produção

---

## 📊 Diagnóstico Atual

### ✅ Pontos Fortes
- Arquitetura sólida com separação de responsabilidades
- ML nativo com 74% de precisão (XGBoost)
- Risk management robusto (max positions, daily loss, exposure)
- Market context filtering (Fear & Greed, Funding Rate, BTC Dominance)
- Pyramiding inteligente + Trailing stop sofisticado
- 13 estratégias testadas e documentadas
- PostgreSQL + TimescaleDB + tRPC end-to-end type safety

### ❌ Bloqueadores Críticos
1. ~~Exit calculator bug (indicator vs value)~~ **✅ CORRIGIDO**
2. Trailing stop só atualiza DB, não executa no Binance
3. OCO orders faltando (entry + SL/TP não são atômicos)
4. Paper trading mistura balance real
5. Slippage não modelado (backtests otimistas)

### ⚠️ Ajustes Importantes
- Kelly criterion usa dados fake (hardcoded)
- Position sizing não ajusta por volatilidade
- Trade cooldown não persiste entre restarts
- Performance tracking por estratégia inexistente
- Confidence calculation limitada

---

## 🗓️ Roadmap de Implementação

### 📅 FASE 1: Correções Críticas (SEM Testnet) - Semana 1

**Objetivo:** Corrigir lógica interna e preparar para validação  
**Duração:** 5 dias úteis (40h)  
**Testnet necessário:** ❌ NÃO

#### Dia 1 (8h) - Exit Logic & Paper Trading
- [x] **1.1 Exit calculator fix** (✅ COMPLETO)
  - Arquivo: `apps/backend/src/services/setup-detection/dynamic/ExitCalculator.ts`
  - Mudança: Priorizar `exit.indicator` sobre `exit.value`
  - Validação: Testar bollinger-breakout-crypto R:R correto
  
- [ ] **1.2 Separar paper/live balances** (1h)
  - Arquivo: `apps/backend/src/services/position-monitor.ts`
  - Adicionar check `if (wallet.walletType === 'paper')` antes de updates
  - Criar tabela `paper_trading_balances` separada (opcional)
  - Validação: Paper trade não altera balance real

- [ ] **1.3 Adicionar slippage ao entry** (1h)
  - Arquivo: `apps/backend/src/services/auto-trading-scheduler.ts`
  - Ajustar entry price: LONG +0.1%, SHORT -0.1%
  - Adicionar commission: 0.1% (Binance taker fee)
  - Validação: Comparar P&L com/sem slippage

#### Dia 2 (8h) - Position Sizing & Risk
- [ ] **2.1 Kelly criterion com dados reais** (3h)
  - Arquivo: `apps/backend/src/services/risk-manager.ts`
  - Criar função `getStrategyStatistics(strategyId, symbol, interval)`
  - Calcular win rate e avg R:R de backtests
  - Aplicar fractional Kelly (25%)
  - Validação: Size reduz em estratégias com baixo win rate

- [ ] **2.2 Position sizing com volatility** (2h)
  - Arquivo: `apps/backend/src/services/risk-manager.ts`
  - Calcular ATR% do preço
  - Fator de redução: `volatilityFactor = atrPercent > 3 ? 0.7 : 1.0`
  - Aplicar ao size final
  - Validação: Size menor em mercados voláteis

- [ ] **2.3 Fix position monitor infinite loop** (1h)
  - Arquivo: `apps/backend/src/services/position-monitor.ts`
  - Trocar `setInterval` por `setTimeout` recursivo
  - Aguardar término antes de agendar próximo
  - Validação: CPU não acumula promises

#### Dia 3 (8h) - Performance Tracking
- [ ] **3.1 Criar tabela strategy_performance** (2h)
  ```sql
  CREATE TABLE strategy_performance (
    strategy_id TEXT,
    symbol TEXT,
    interval TEXT,
    trades_count INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    total_pnl DECIMAL(20,8) DEFAULT 0,
    avg_pnl_percent DECIMAL(10,4),
    win_rate DECIMAL(5,2),
    avg_rr DECIMAL(10,4),
    sharpe_ratio DECIMAL(10,4),
    max_drawdown DECIMAL(10,4),
    last_updated TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (strategy_id, symbol, interval)
  );
  ```

- [ ] **3.2 Update performance após cada trade** (2h)
  - Arquivo: `apps/backend/src/services/position-monitor.ts`
  - Hook após fechar posição
  - Recalcular win rate, avg R:R, sharpe
  - Validação: Performance reflete trades reais

- [ ] **3.3 Auto-disable estratégias ruins** (2h)
  - Arquivo: `apps/backend/src/services/auto-trading-scheduler.ts`
  - Skip setup se win rate < 40% e trades > 20
  - Log: "⚠️ Strategy disabled due to poor performance"
  - Validação: Estratégia ruim não executa

#### Dia 4 (8h) - Trade Cooldown & Confidence
- [ ] **4.1 Trade cooldown persistente** (3h)
  ```sql
  CREATE TABLE setup_cooldowns (
    strategy_id TEXT,
    symbol TEXT,
    interval TEXT,
    wallet_id TEXT,
    last_execution TIMESTAMP,
    cooldown_until TIMESTAMP,
    PRIMARY KEY (strategy_id, symbol, interval, wallet_id)
  );
  ```
  - Check DB antes de executar trade
  - Insert/update após execução
  - Validação: Setup não re-executa durante cooldown

- [ ] **4.2 Enhanced confidence calculation** (3h)
  - Arquivo: `apps/backend/src/services/setup-detection/dynamic/StrategyInterpreter.ts`
  - Adicionar trend alignment bonus (EMA200): +10%
  - Adicionar recent performance: ±20%
  - Penalty se estratégia em drawdown: -15%
  - Validação: Confidence reflete condições reais

#### Dia 5 (8h) - Otimizações & Paper Trading
- [ ] **5.1 Optimize price cache** (2h)
  - Arquivo: `apps/backend/src/services/position-monitor.ts`
  - Trocar `DELETE FROM price_cache` por `UPDATE ... ON CONFLICT`
  - Adicionar TTL: `WHERE updated_at < NOW() - INTERVAL '5 minutes'`
  - Validação: Queries mais rápidas

- [ ] **5.2 Paper trading intensivo** (6h)
  - Ativar 3 estratégias: larry-williams-9-1, bollinger-breakout-crypto, parabolic-sar-crypto
  - Executar por 6h contínuas
  - Monitorar: execuções, P&L, R:R real vs esperado
  - Validar: Todos os 5 fixes funcionando
  - Documentar: Diferenças entre backtest e paper trading

---

### 📅 FASE 2: Integração Binance (COM Testnet) - Semana 2

**Objetivo:** Validar integrações com API real  
**Duração:** 5 dias úteis (40h)  
**Testnet necessário:** ✅ SIM

#### Setup Testnet (1h)
```bash
# 1. Criar conta
https://testnet.binance.vision/

# 2. Gerar API keys (fake money)

# 3. Adicionar ao .env
BINANCE_TESTNET_API_KEY=your_key
BINANCE_TESTNET_API_SECRET=your_secret
USE_TESTNET=true

# 4. Verificar saldo fake
curl https://testnet.binance.vision/api/v3/account
```

#### Dia 6 (8h) - OCO Orders Implementation
- [ ] **6.1 Criar BinanceOrderManager service** (3h)
  - Arquivo: `apps/backend/src/services/binance-order-manager.ts`
  - Funções: `createEntryOrder()`, `createOCO()`, `cancelOrder()`, `modifyOrder()`
  - Error handling: retry logic, rate limit
  - Validação testnet: Entry → OCO criado automaticamente

- [ ] **6.2 Integrar OCO no auto-trading** (3h)
  - Arquivo: `apps/backend/src/services/auto-trading-scheduler.ts`
  - Fluxo: Entry order → aguarda fill → cria OCO
  - Salvar IDs: `entryOrderId`, `stopLossOrderId`, `takeProfitOrderId`
  - Validação testnet: Ordens aparecem no Binance

- [ ] **6.3 Testar cancelamentos** (2h)
  - Cancelar entry antes de fill
  - Cancelar OCO quando TP bate
  - Verificar que ordem oposta cancela
  - Validação testnet: Sem ordens órfãs

#### Dia 7 (8h) - Trailing Stop Execution
- [ ] **7.1 Implementar updateStopLoss()** (4h)
  - Arquivo: `apps/backend/src/services/binance-order-manager.ts`
  - Cancelar ordem SL atual
  - Criar nova ordem SL no novo preço
  - Atualizar DB com novo `stopLossOrderId`
  - Validação testnet: SL move no Binance

- [ ] **7.2 Integrar no position monitor** (2h)
  - Arquivo: `apps/backend/src/services/position-monitor.ts`
  - Após calcular novo SL: `await orderManager.updateStopLoss(...)`
  - Log: "🔄 Trailing stop updated on Binance"
  - Validação testnet: SL trail conforme preço sobe

- [ ] **7.3 Fallback se Binance falhar** (2h)
  - Try/catch com retry (3 tentativas)
  - Se falhar: manter SL antigo, alertar
  - Não deixar posição sem proteção
  - Validação testnet: Simular erro de rede

#### Dia 8 (8h) - Order State Machine
- [ ] **8.1 Expandir status da ordem** (2h)
  ```sql
  ALTER TABLE trade_executions 
  ADD COLUMN order_status TEXT DEFAULT 'pending',
  ADD COLUMN filled_at TIMESTAMP,
  ADD COLUMN cancelled_at TIMESTAMP,
  ADD COLUMN error_message TEXT;
  
  -- Status: pending, filled, partially_filled, cancelled, failed, expired
  ```

- [ ] **8.2 Webhook de order updates** (4h)
  - Arquivo: `apps/backend/src/services/binance-webhook-handler.ts`
  - Escutar `executionReport` do User Data Stream
  - Atualizar status na tabela
  - Transições: PENDING → FILLED → MONITORING → CLOSED
  - Validação testnet: Status muda em tempo real

- [ ] **8.3 Reconciliation job** (2h)
  - Cron job: a cada 5 minutos
  - Comparar status DB vs Binance
  - Corrigir discrepâncias
  - Validação testnet: Detecta status dessincroniziado

#### Dia 9 (8h) - Slippage Real Measurement
- [ ] **9.1 Criar tabela execution_metrics** (1h)
  ```sql
  CREATE TABLE execution_metrics (
    execution_id TEXT PRIMARY KEY,
    expected_entry DECIMAL(20,8),
    actual_entry DECIMAL(20,8),
    slippage_percent DECIMAL(10,4),
    fill_time_ms INT,
    commission_paid DECIMAL(20,8),
    FOREIGN KEY (execution_id) REFERENCES trade_executions(id)
  );
  ```

- [ ] **9.2 Capturar dados reais** (3h)
  - Arquivo: `apps/backend/src/services/binance-order-manager.ts`
  - Ao receber fill: comparar preço esperado vs real
  - Calcular slippage: `(actual - expected) / expected * 100`
  - Salvar metrics
  - Validação testnet: Slippage registrado

- [ ] **9.3 Análise de slippage** (2h)
  - Query: avg slippage por símbolo, timeframe, hora do dia
  - Identificar: market orders têm mais slippage que limit?
  - Ajustar modelo: usar avg slippage medido
  - Validação: Modelo mais realista

#### Dia 10 (8h) - Testes Intensivos Testnet
- [ ] **10.1 Executar 50 trades reais** (6h)
  - 3 estratégias simultâneas
  - Mix de LONG/SHORT, múltiplos símbolos
  - Monitorar: execuções, cancelamentos, trailing, OCO
  - Coletar: logs de erros, slippage real, fill time
  - Validar: Taxa de sucesso > 95%

- [ ] **10.2 Stress test** (2h)
  - Detectar 10+ setups simultâneos
  - Verificar: rate limit da API respeitado
  - Confirmar: sem race conditions
  - Validação: Sistema estável sob carga

---

### 📅 FASE 3: Live Micro-Test (Produção) - Semana 3

**Objetivo:** Validar com dinheiro real em escala micro  
**Duração:** 7 dias (24h monitoring)  
**Capital:** 0.1% do total (ex: $10 de $10,000)

#### Dia 11-17: Live Trading (Monitoring Contínuo)
- [ ] **11.1 Setup produção** (2h)
  ```bash
  # .env
  USE_TESTNET=false
  BINANCE_API_KEY=real_key
  BINANCE_API_SECRET=real_secret
  ENABLE_LIVE_TRADING=true
  MAX_POSITION_SIZE=0.1  # 0.1% do capital
  MAX_CONCURRENT_POSITIONS=2
  ```

- [ ] **11.2 Ativar 1 estratégia conservadora** (1h)
  - Escolher: larry-williams-9-1 (mais testada)
  - Símbolo: BTCUSDT (maior liquidez)
  - Timeframe: 15m (meio termo)
  - Position size: 0.05% (ultra-conservador)
  - Validação: Primeira ordem executada

- [ ] **11.3 Monitoring 24/7** (7 dias)
  - Verificar 3x/dia: posições abertas, P&L, erros
  - Alertas: Telegram/Discord para trades
  - Métricas: win rate, avg R:R, slippage real
  - Comparação: resultado real vs backtest esperado
  - Meta: Gap < 20% entre expectativa e realidade

- [ ] **11.4 Análise pós-semana** (4h)
  - Calcular: Sharpe ratio real, max drawdown, avg trade duration
  - Comparar: Cada métrica vs backtest
  - Identificar: Maior fonte de diferença (slippage? timing? fees?)
  - Decisão: Continuar → aumentar capital vs Pausar → ajustar

---

## 📈 Critérios de Sucesso

### Fase 1 (Paper Trading)
- [x] Exit calculator corrigido
- [ ] 0 trades executam com R:R negativo
- [ ] Paper trading não altera balance real
- [ ] Cooldown previne duplicatas
- [ ] Performance tracking atualiza após trades
- [ ] Confidence calculation usa dados reais

### Fase 2 (Testnet)
- [ ] 100% das ordens entry executam com sucesso
- [ ] 100% das ordens entry criam OCO automaticamente
- [ ] Trailing stop move no Binance (não só DB)
- [ ] 0 ordens órfãs após cancelamentos
- [ ] Slippage medido: média < 0.15%
- [ ] Taxa de erro API < 1%

### Fase 3 (Live)
- [ ] Win rate real ≥ 90% do backtest
- [ ] Avg R:R real ≥ 80% do backtest
- [ ] Slippage real ≤ slippage modelado
- [ ] Max drawdown real ≤ 1.5x backtest
- [ ] 0 posições perdidas por bugs
- [ ] P&L positivo após 1 semana

---

## 🚨 Red Flags & Circuit Breakers

### Pausar imediatamente se:
- **Drawdown > 5%** em 24h (algo está errado)
- **Slippage real > 0.5%** (liquidez insuficiente)
- **Taxa de erro API > 5%** (problema de integração)
- **Posições órfãs detectadas** (bug crítico)
- **Gap real vs backtest > 50%** (modelo quebrado)

### Logs críticos para monitorar:
```
❌ "Failed to create OCO" → Bug na integração
❌ "Position without stop loss" → Risco ilimitado
❌ "Trailing stop update failed" → Proteção perdida
⚠️ "Paper trading cooldown active" → Normal
⚠️ "Strategy disabled due to poor performance" → Normal
```

---

## 📊 Métricas de Acompanhamento

### Diárias
- Trades executados hoje
- Win rate (7 dias rolling)
- P&L acumulado
- Drawdown atual vs max histórico
- Avg slippage
- API error rate

### Semanais
- Sharpe ratio
- Sortino ratio
- Max drawdown
- Avg holding time
- Best/worst strategy
- Correlation entre posições

### Mensais
- ROI total
- Risk-adjusted return
- Win rate por estratégia
- Win rate por símbolo
- Win rate por timeframe
- Curva de equity

---

## 🛠️ Ferramentas de Apoio

### Scripts úteis
```bash
# Verificar status do sistema
npm run trading:status

# Ver posições abertas
npm run trading:positions

# Ver performance por estratégia
npm run trading:performance

# Limpar paper trading
npm run trading:reset-paper

# Ativar/desativar estratégia
npm run trading:toggle larry-williams-9-1
```

### Queries SQL úteis
```sql
-- Performance por estratégia (últimos 30 dias)
SELECT 
  setup_type,
  COUNT(*) as trades,
  SUM(CASE WHEN pnl_percent > 0 THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as win_rate,
  AVG(pnl_percent) as avg_pnl_pct,
  SUM(pnl) as total_pnl
FROM trade_executions
WHERE created_at > NOW() - INTERVAL '30 days'
  AND status = 'closed'
GROUP BY setup_type
ORDER BY total_pnl DESC;

-- Slippage médio
SELECT 
  symbol,
  AVG(slippage_percent) as avg_slippage,
  MAX(slippage_percent) as max_slippage
FROM execution_metrics
GROUP BY symbol;

-- Estratégias em cooldown
SELECT 
  strategy_id,
  symbol,
  last_execution,
  cooldown_until,
  EXTRACT(EPOCH FROM (cooldown_until - NOW())) / 60 as minutes_remaining
FROM setup_cooldowns
WHERE cooldown_until > NOW()
ORDER BY minutes_remaining;
```

---

## 📚 Documentos Relacionados

- `TRADING_SYSTEM.md` - Visão geral do sistema
- `SETUP_GUIDE.md` - Guia de estratégias
- `RISK_OPTIMIZATION.md` - Gestão de risco
- `BINANCE_OCO_PATTERN.md` - Padrão OCO
- `POSITION_MANAGEMENT.md` - Gerenciamento de posições
- `BACKTESTING_ADVANCED.md` - Backtesting avançado

---

## 🎯 Próximos Passos Imediatos

**HOJE (2h):**
1. ✅ Exit calculator - COMPLETO
2. Separar paper/live balances
3. Adicionar slippage ao entry

**AMANHÃ (8h):**
4. Kelly criterion real
5. Position sizing com volatility
6. Fix position monitor loop

**Esta Semana:**
- Completar Fase 1 (Dias 1-5)
- Iniciar paper trading intensivo

**Próxima Semana:**
- Ativar testnet Binance
- Completar Fase 2 (Dias 6-10)

**Semana Seguinte:**
- Live micro-test com $10-50
- Coletar métricas reais

---

**Última atualização:** 15/12/2025  
**Responsável:** Desenvolvimento MarketMind  
**Revisão:** Após cada fase completada
