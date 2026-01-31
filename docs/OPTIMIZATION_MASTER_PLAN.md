# Plano Mestre de Otimização do Sistema de Trading

**Status:** ✅ COMPLETO
**Versão:** 2.0.0
**Última Atualização:** 2026-01-31
**Autor:** Claude Opus 4.5 + Nathan

---

## 🚀 RESUMO EXECUTIVO (Para Novos Chats)

### Visão Geral
Este plano cobre a **otimização completa do sistema de trading** do MarketMind:
1. **Trailing Stop** - Parâmetros ótimos LONG/SHORT
2. **Entry Levels & R:R** - Fibonacci entry, breakout vs pullback, R:R mínimo (Seção 13)
3. **Filtro de Tendência** - EMA simples vs Combinado vs ADX (Seção 14)
4. **106 Estratégias** - Teste, eleição e otimização das melhores
5. **Rotation/QuickStart** - Screening inteligente de ativos
6. **Walk-Forward + Monte Carlo** - Validação estatística
7. **Market & Watchers Sidebar** - 3 tabs: Indicadores, Watchers ativos, Logs
8. **Aplicação dos Defaults** - Aplicar configs ótimas em TODO o sistema (Seção 15)
9. **Auditoria e Documentação** - Atualizar docs, READMEs e remover obsoletos (Seção 12)
10. **Order Book Integration** - Imbalance, Liquidity Walls, Order Flow (Seção 16)

### Estado Atual (2026-01-31 23:00) - OTIMIZAÇÃO COMPLETA

#### ✅ Otimização Trailing Stop COMPLETA
- **Combinações testadas:** 82,944/82,944 (100%)
- **Tempo total:** ~87 minutos (15:42 → 20:10)
- **Log:** `/tmp/trailing-optimization-20260131-154244.log`

**Melhores Resultados (Top 1):**
| Parâmetro | LONG | SHORT |
|-----------|------|-------|
| Activation | 90% | 80% |
| Distance | 40% | 30% |
| ATR Multiplier | 1.5 | 1.5-3.0 (insensível) |
| Breakeven | 0.5% | 0.5-1.5% (insensível) |

**Métricas:**
- PnL: **$428.68** (+42.9% em 3 anos)
- Win Rate: **37.6%**
- Sharpe Ratio: **0.535**
- Max Drawdown: **30.5%**
- Trailing activations: **194/735** (26.4% dos trades)
- Trailing exits: **7.8%** dos trades

**Observações Importantes:**
1. SHORT é insensível a ATR (1.5-3.0) e BE (0.5-1.5%) → trailing ativa pouco em shorts
2. LONG precisa de activation alta (90%) e distance larga (40%)
3. Apenas 7.8% dos exits são por trailing → maioria sai por SL/TP antes

#### ✅ Market Indicators Sidebar COMPLETA
- Fear & Greed Index (Alternative.me API) + gráfico histórico 31d
- BTC Dominance (CoinGecko API) + gráfico histórico 31d
- Open Interest + Long/Short Ratio (Binance Futures) + gráficos históricos
- BTC EMA21 Trend (LineChart com EMA + Price) + Funding Rates
- **Componentes reutilizáveis:** `MiniAreaChart`, `MiniLineChart`
- **Tooltips padronizados** com datas em todos os gráficos
- **Layout padronizado:** badges abaixo dos títulos
- **Caching otimizado:** refresh intervals inteligentes (5-30min)

#### ✅ Comparação de Timeframes COMPLETA (2026-01-31)
- **Período:** 2023-01-01 a 2026-01-01 (3 anos)
- **Timeframes:** 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d
- **Config:** 19 estratégias, Volume Filter ON, Momentum Timing ON

**📊 RESULTADOS POR P&L:**
| Timeframe | P&L | P&L% | Trades | WinRate | PF | MaxDD | LONG P&L | SHORT P&L |
|-----------|-----|------|--------|---------|-----|-------|----------|-----------|
| **🏆 12h** | **+$117** | **+11.75%** | 22 | 36.36% | 1.09 | 46.03% | +$663 | -$522 |
| 6h | -$161 | -16.13% | 13 | 23.08% | 0.71 | 38.40% | +$69 | -$222 |
| 1d | -$196 | -19.61% | 17 | 29.41% | 0.88 | 63.65% | +$847 | -$1028 |
| 8h | -$226 | -22.57% | 17 | 23.53% | 0.76 | 35.08% | -$14 | -$200 |
| 2h | -$423 | -42.32% | 41 | 26.83% | 0.56 | 54.79% | -$130 | -$273 |
| 1h | -$424 | -42.43% | 170 | 21.76% | 0.87 | 78.24% | +$375 | -$704 |
| 4h | -$522 | -52.18% | 41 | 24.39% | 0.68 | 69.36% | -$174 | -$317 |
| 30m | -$538 | -53.78% | 266 | 24.81% | 0.87 | 76.27% | -$10 | -$371 |

**🔍 INSIGHTS IMPORTANTES:**
1. **ÚNICO timeframe lucrativo:** 12h (+11.75% em 3 anos)
2. **LONGs sempre melhores que SHORTs** - Em 6/8 timeframes, LONG > SHORT
3. **Timeframes curtos (30m, 1h) têm drawdowns extremos** (76-78%)
4. **8h tem menor drawdown** (35.08%) mas P&L negativo
5. **Quanto menor o timeframe, mais trades = mais perdas**

**📌 DECISÕES BASEADAS NOS DADOS:**
1. ✅ **Focar otimização no 12h** - Único lucrativo
2. ✅ **Considerar LONG-only** - SHORTs consistentemente negativos
3. ❌ **Evitar 30m/1h para produção** - Drawdowns inaceitáveis
4. 🟡 **8h como alternativa conservadora** - Baixo drawdown, poucos trades

#### ✅ Entry Levels & R:R Optimization IMPLEMENTADO (2026-01-31 21:30)
- **Script:** `apps/backend/src/cli/optimize-entry-levels.ts`
- **Timeframe:** 12h (único lucrativo)
- **Parâmetros testados:**
  - Entry Levels: 0%, 38.2%, 50%, 61.8%, 78.6%, 100% (breakout)
  - R:R Mínimo: 0.5, 0.75, 1.0, 1.5, 2.0

**📊 RESULTADOS QUICK-TEST (12 combinações):**
| Entry Level | P&L | P&L% | WinRate | Trades | Score |
|-------------|-----|------|---------|--------|-------|
| **🏆 100%** | **$2,572** | **+257%** | 66.67% | 9 | 716.8 |
| 78.6% | $1,379 | +138% | 63.64% | 11 | 466.1 |
| 61.8% (atual) | $335 | +33.5% | 36.00% | 25 | 36.1 |

**🔍 INSIGHTS IMPORTANTES:**
1. **Entry 100% (breakout) é 7.7x melhor** que o atual (61.8%)
2. **LONGs dominam:** +$18,260 vs SHORTs: -$855
3. **Menos trades = mais qualidade:** 9 trades vs 25
4. **R:R não faz diferença significativa** nos ranges testados

**📊 RESULTADOS FULL (150 combinações):**
| Entry Level | Avg P&L | WinRate | MaxDD | Trades |
|-------------|---------|---------|-------|--------|
| 0% | $2,503 | 35% | **13.3%** | 20 |
| **100% (escolhido)** | $2,573* | 66.7% | 28.1% | 9 |
| 78.6% | $2,192 | 57.1% | 23.9% | 14 |
| 61.8% (atual) | $148 | 32% | ~46% | 28 |

*LONG-only mode | Aggregado: LONGs +$180,604 vs SHORTs -$3,139

**📌 CONFIGURAÇÃO RECOMENDADA (Entry 100%):**
```json
{
  "maxFibonacciEntryProgressPercent": 100,
  "minRiskRewardRatioLong": 0.75,
  "minRiskRewardRatioShort": 0.75,
  "onlyLong": true
}
```

**Justificativa:** Entry 100% (breakout) oferece o melhor P&L absoluto em LONG-only mode e é mais intuitivo para trading de tendência.

#### ✅ BTC Correlation Filter VALIDADO (2026-01-31 22:00)
- **Script:** `apps/backend/src/cli/compare-btc-filter.ts`
- **Altcoins testadas:** ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT
- **Período:** 2023-01-01 a 2026-01-31 (3 anos)

**📊 RESULTADOS COMPARATIVOS:**
| Métrica | COM Filter | SEM Filter | Diferença |
|---------|------------|------------|-----------|
| Total Trades | 36 | 35 | +1 |
| **Total P&L** | **$4,643** (+464%) | $830 (+83%) | **+$3,813** |
| Win Rate | 63.9% | 60.0% | +3.9% |
| **Max Drawdown** | **24.8%** | 41.8% | **-17%** |
| LONG P&L | $4,316 | $2,673 | +$1,643 |
| SHORT P&L | +$328 | **-$1,843** | **+$2,171** |

**🔍 INSIGHTS IMPORTANTES:**
1. **BTC Filter é 5.6x mais lucrativo** ($4,643 vs $830)
2. **Drawdown reduzido em 17%** (24.8% vs 41.8%)
3. **SHORTs passam de -$1,843 para +$328** - o filtro evita SHORTs contra tendência BTC
4. O filtro funciona principalmente protegendo SHORTs de altcoins

**📌 DECISÃO: MANTER BTC Correlation Filter HABILITADO**

#### ✅ LONG-only vs LONG+SHORT TESTADO (2026-01-31 22:05)
- **Símbolos:** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT

**📊 RESULTADOS (BTC + Altcoins combinados):**
| Métrica | Valor |
|---------|-------|
| Total Trades | 38 (29 LONG + 9 SHORT) |
| **Total P&L** | **$5,196** (+519.6%) |
| Win Rate | 65.8% |
| Max Drawdown | 25.6% |
| **LONG P&L** | **+$5,513** (72.4% WR) |
| **SHORT P&L** | **-$316** (44.4% WR) |

**🔍 INSIGHTS:**
1. **LONGs dominam:** $5,513 vs SHORTs -$316
2. **SHORTs em BTCUSDT são negativos** - puxam resultado para baixo
3. **SHORTs em altcoins COM BTC Filter são lucrativos** (+$328 no teste anterior)
4. O problema é SHORT em BTC, não SHORT em altcoins

**📌 DECISÃO: CONSIDERAR DESABILITAR SHORT APENAS EM BTCUSDT**
- Altcoins: manter LONG+SHORT (com BTC Correlation Filter)
- BTCUSDT: testar LONG-only mode

#### ✅ Trend Filters Comparison COMPLETO (2026-01-31 22:15)
- **Script:** `apps/backend/src/cli/compare-trend-filters.ts`
- **Base:** BTC Correlation Filter + Volume Filter (sempre habilitados)

**📊 RESULTADOS (ordenado por P&L):**
| # | Filter | P&L | P&L% | WR | DD | PF | Trades |
|---|--------|-----|------|----|----|-----|--------|
| 🏆 | **NENHUM (Baseline)** | **$5,196** | 519.6% | 65.8% | 25.6% | 1.96 | 38 |
| 2 | Market Regime Only | $5,196 | 519.6% | 65.8% | 25.6% | 1.96 | 38 |
| 3 | **Momentum Timing Only** | **$4,877** | 487.7% | **66.7%** | **21.3%** | **2.08** | 33 |
| 4 | EMA + Momentum | $2,939 | 293.9% | 62.5% | 36.5% | 1.61 | 32 |
| 5 | TODOS | $2,512 | 251.2% | 58.1% | 36.5% | 1.56 | 31 |
| 6 | EMA Trend Only | $2,130 | 213.0% | 58.1% | 38.3% | 1.42 | 31 |
| 7 | EMA + ADX | $2,120 | 212.0% | 56.3% | 43.3% | 1.45 | 32 |
| 8 | ADX Only | $2,068 | 206.8% | 56.3% | 43.3% | 1.44 | 32 |

**🔍 INSIGHTS IMPORTANTES:**
1. **Baseline SEM filtros extras é o melhor P&L** ($5,196)
2. **Momentum Timing tem melhor trade-off:** -6% P&L, mas -17% drawdown e +6% PF
3. **EMA Trend prejudica resultados** ($2,130 vs $5,196 baseline)
4. **ADX piora resultados** ($2,068 vs $5,196 baseline)
5. **Combinar TODOS os filtros é a PIOR opção** ($2,512)

**📌 DECISÕES TOMADAS:**
1. ✅ **Desabilitar EMA Trend Filter** - prejudica P&L em 59%
2. ✅ **Desabilitar ADX Filter** - prejudica P&L em 60%
3. 🟡 **Considerar Momentum Timing** - se preferir menor drawdown (21.3% vs 25.6%)
4. ✅ **Manter BTC Correlation Filter** - já validado como essencial
5. ✅ **Manter Volume Filter** - já estava no baseline

#### ✅ Entry Level Fibo Atualizado (2026-01-31 22:20)
- **Alteração:** `maxFibonacciEntryProgressPercent` de 61.8% → **100%**
- **Arquivos:**
  - `packages/types/src/filter-defaults.ts`
  - `packages/types/src/trading-config.ts`
- **Rebuild:** `pnpm --filter @marketmind/types build` ✅

**Justificativa:** Entry 100% (breakout) oferece 7.7x mais P&L que 61.8% nos testes.

#### ✅ Trailing Stop UI Atualizado (2026-01-31 22:30)
- **Alteração:** Separação de Distance% para LONG e SHORT
- **Arquivos atualizados:**
  - `packages/types/src/trading-config.ts` - Split `trailingDistancePercent` → `trailingDistancePercentLong` + `trailingDistancePercentShort`
  - `apps/backend/src/db/schema.ts` - Novas colunas no DB
  - `apps/backend/src/db/migrations/0055_trailing_distance_split.sql` - Migration
  - `apps/electron/src/renderer/components/Trading/WatcherManager/TrailingStopSection.tsx` - UI com sliders separados
  - `apps/electron/src/renderer/locales/{en,pt,es,fr}/translation.json` - Traduções

**Valores padrão atualizados:**
| Parâmetro | LONG | SHORT |
|-----------|------|-------|
| Activation | 90% | 80% |
| Distance | 40% | 30% |

#### ✅ Monte Carlo Validation COMPLETO (2026-01-31 22:45)
- **Script:** `apps/backend/src/cli/validate-robustness.ts`
- **Configuração testada:**
  - Entry Level Fibo: 100% (breakout)
  - BTC Correlation Filter: ON
  - Volume Filter: ON
  - Momentum Timing Filter: ON
  - Trailing LONG: Activation 90%, Distance 40%
  - Trailing SHORT: Activation 80%, Distance 30%
  - Timeframe: 12h
- **Período:** 2023-01-01 a 2026-01-31 (3 anos)
- **Iterações:** 1000

**📊 RESULTADOS BACKTEST BASE:**
| Métrica | Valor |
|---------|-------|
| Total Trades | 33 |
| Total P&L | $4,877.50 (+487.8%) |
| Win Rate | 66.7% |
| Max Drawdown | 21.3% |
| Profit Factor | 2.08 |

**📊 ESTATÍSTICAS MONTE CARLO:**
| Métrica | Média | Mediana | Desvio |
|---------|-------|---------|--------|
| Equity Final | $5,798.28 | $5,904.17 | $728.85 |
| Max Drawdown | 20.9% | 21.0% | - |
| Retorno Total | 479.8% | 490.4% | - |

**📊 INTERVALOS DE CONFIANÇA (95%):**
| Métrica | Lower | Upper |
|---------|-------|-------|
| Equity Final | $4,453.31 | $7,143.25 |
| Max Drawdown | 14.2% | 27.1% |
| Retorno | 345.3% | 614.3% |

**📊 PROBABILIDADES:**
| Cenário | Probabilidade |
|---------|---------------|
| Lucrativo | **100%** |
| Retorno > 10% | **100%** |
| Retorno > 20% | **100%** |
| Retorno > 50% | **100%** |
| Drawdown > 10% | 100% |
| Drawdown > 20% | 55.9% |
| Drawdown > 30% | 0% |

**📊 CENÁRIOS EXTREMOS:**
| Cenário | Equity | Drawdown | Retorno |
|---------|--------|----------|---------|
| 🔴 Pior Caso | $4,164.86 | 26.0% | +316.5% |
| 🟡 Mediana | $5,904.17 | 21.0% | +490.4% |
| 🟢 Melhor Caso | $8,019.73 | 14.0% | +702.0% |

**✅ VALIDAÇÃO DE ROBUSTEZ:**
- ✅ Prob. Lucrativa >= 90%: **100%**
- ✅ CI95 Drawdown <= 50%: **27.1%**
- ✅ Retorno Mediano > 50%: **490.4%**
- ✅ Pior Caso Lucrativo: **$4,164.86**

**🎉 CONFIGURAÇÃO APROVADA PARA PRODUÇÃO!**

#### ✅ Plano de Otimização COMPLETO
1. ~~**Trailing Stop Optimization**~~ ✅ COMPLETO (82,944 combinações)
2. ~~**Timeframe Comparison**~~ ✅ 12h é o único lucrativo
3. ~~**Entry Level & R:R**~~ ✅ 100% (breakout) é 7.7x melhor
4. ~~**BTC Correlation Filter**~~ ✅ 5.6x mais lucrativo
5. ~~**LONG-only backtest**~~ ✅ LONGs dominam (+$5,513)
6. ~~**Trend Filter optimization**~~ ✅ Momentum Timing é melhor trade-off
7. ~~**Trailing Stop UI**~~ ✅ LONG/SHORT separados
8. ~~**Monte Carlo Validation**~~ ✅ 100% probabilidade lucrativa

---

### 🏆 CONFIGURAÇÃO FINAL OTIMIZADA

Esta é a configuração definitiva após toda a otimização. Já aplicada nos defaults do sistema.

**Arquivos atualizados:**
- `packages/types/src/filter-defaults.ts`
- `packages/types/src/trading-config.ts`
- `apps/backend/src/db/schema.ts` + migration

#### Parâmetros Ótimos

| Categoria | Parâmetro | Valor | Arquivo |
|-----------|-----------|-------|---------|
| **Timeframe** | Único lucrativo | **12h** | `shared-backtest-config.ts` |
| **Entry** | Fibonacci Entry | **100%** (breakout) | `filter-defaults.ts` |
| **Entry** | Min R:R | **0.75** | `filter-defaults.ts` |
| **Trailing LONG** | Activation | **90%** | `trading-config.ts` |
| **Trailing LONG** | Distance | **40%** | `trading-config.ts` |
| **Trailing SHORT** | Activation | **80%** | `trading-config.ts` |
| **Trailing SHORT** | Distance | **30%** | `trading-config.ts` |
| **Filtro** | BTC Correlation | **ON** | `filter-defaults.ts` |
| **Filtro** | Volume | **ON** | `filter-defaults.ts` |
| **Filtro** | Momentum Timing | **ON** | `filter-defaults.ts` |
| **Filtro** | EMA Trend | **OFF** | `filter-defaults.ts` |
| **Filtro** | ADX | **OFF** | `filter-defaults.ts` |

#### Métricas Esperadas (Monte Carlo P95)

| Métrica | Valor |
|---------|-------|
| Retorno (3 anos) | **345% - 614%** |
| Max Drawdown | **14% - 27%** |
| Win Rate | **~67%** |
| Profit Factor | **~2.08** |
| Probabilidade Lucrativa | **100%** |

#### Scripts de Validação

```bash
# Validar configuração atual
pnpm tsx apps/backend/src/cli/validate-robustness.ts

# Comparar filtros
pnpm tsx apps/backend/src/cli/compare-trend-filters.ts

# Comparar BTC correlation
pnpm tsx apps/backend/src/cli/compare-btc-filter.ts
```

---

### O Que Já Existe (Pronto para Uso)
| Componente | Localização | Status |
|------------|-------------|--------|
| `MultiWatcherBacktestEngine` | `services/backtesting/` | ✅ Operacional |
| `WalkForwardOptimizer` | `services/backtesting/` | ✅ Pronto |
| `MonteCarloSimulator` | `services/backtesting/` | ✅ Pronto |
| `GranularPriceIndex` | `services/backtesting/trailing-stop-backtest.ts` | ✅ Pronto |
| CLI Runner | `cli/backtest-runner.ts` | ✅ Pronto |

### Scripts CLI Ativos
```
cli/
├── optimize-trailing-stop.ts     # PRINCIPAL - Trailing stop params
├── optimize-complete.ts          # Timeframes × Filtros
├── optimize-fibonacci-targets.ts # Níveis de TP
├── optimize-all-pairs.ts         # Sinergia de filtros
├── optimize-trend-ema.ts         # Período EMA
├── compare-timeframes.ts         # Comparação de timeframes
├── validate-trailing-backtest.ts # Validação rápida
├── shared-backtest-config.ts     # Config compartilhada
├── optimization-config.ts        # Config unificada
└── backtest-runner.ts            # CLI principal com subcomandos
```

### ⚠️ IMPORTANTE: Nenhuma Config é Otimizada
> **Nunca simulamos trailing stop no backtesting antes.** Portanto, TODAS as configs atuais
> (filtros, EMAs, thresholds) são baseadas em suposições, não em dados reais. Este plano
> vai testar o sistema como ele realmente funciona e descobrir as configs ótimas de verdade.

### 🔒 REGRA OBRIGATÓRIA: Validação Antes de Otimização
> **SEMPRE** rodar um teste pequeno com logs ANTES de qualquer otimização grande.
> Isso evita esperar horas por algo que vai falhar ou dar resultado impreciso.

```bash
# SEMPRE fazer isso primeiro:
pnpm tsx src/cli/[script].ts --quick-test --verbose

# Verificar:
# ✅ Trades sendo gerados corretamente
# ✅ Trailing stop simulando corretamente
# ✅ Métricas calculando corretamente
# ✅ Sem erros ou warnings

# SÓ DEPOIS rodar o completo:
pnpm tsx src/cli/[script].ts --mode=medium  # ou --mode=full
```

### 📊 MELHORES PRÁTICAS (Pesquisa 2026)

| Prática | Recomendação | Fonte |
|---------|--------------|-------|
| Walk-Forward Ratio | 70% in-sample, 30% out-of-sample | StrategyQuant |
| WFE Mínimo | Walk Forward Efficiency > 50-60% | Unger Academy |
| Ordem de Otimização | Exits (trailing) antes de Entries | Medium/Quantitative |
| Overfitting Prevention | Testar robustez a pequenas mudanças | QuantInsti |
| Simplicidade | Regras simples generalizam melhor | Quantified Strategies |

**Ordem Correta:** Trailing Stop → Entry Levels → Trend Filter → Estratégias

### Próximos Passos Após Otimização Trailing
1. Analisar top 10 configurações de trailing stop
2. Rodar Walk-Forward validation
3. Rodar Monte Carlo (1000 iterações)
4. **Otimizar Entry Levels & R:R** (Seção 13)
   - Testar níveis Fib de entrada: 0%, 38.2%, 50%, 61.8%, 78.6%, 100% (breakout)
   - Testar R:R mínimo: 0.5, 0.75, 1.0, 1.5, 2.0
   - Testar ativação trailing para breakout: 0% (imediato), 30%, 50%, 70%
5. **Otimizar Filtro de Tendência** (Seção 14)
   - Testar métodos: EMA simples vs Combinado (EMA+MACD+RSI) vs ADX
   - Testar períodos: EMA9, EMA21, EMA50, EMA200
   - Encontrar melhor método para filtrar tendência BTC
6. **Testar todas as 106 estratégias** com configs ótimas
6. **Eleger as melhores estratégias** (top 10-20)
7. **Otimizar as estratégias eleitas** individualmente
8. **Melhorar Rotation/QuickStart** com screening inteligente
9. Aplicar melhor config como default do sistema
10. Atualizar configs no banco de dados
11. **Implementar Market Indicators Sidebar** (à esquerda do gráfico)
    - BTC Trend Indicator (método otimizado)
    - Fear & Greed Index
    - BTC Dominance
    - Funding Rate & Open Interest
12. **Auditoria e Documentação Final** (Seção 12)
    - Auditar todos os apps e packages
    - Atualizar CLAUDE.md e READMEs
    - Remover documentação obsoleta

### Estratégias (106 Total)
- **Localização:** `apps/backend/strategies/builtin/*.json`
- **Loader:** `services/setup-detection/dynamic/StrategyLoader.ts`
- **CLI para teste:** `cli/backtest-runner.ts validate --strategy <name>`

### Rotation/QuickStart (Melhoria Planejada)
- **Já existe:** BTC EMA21 trend filter, capital filter, hysteresis, opportunity scoring
- **Falta:** SetupPreScanner (detectar setups pendentes), FilterPreValidator (simular filtros)
- **Objetivo:** Rotacionar para ativos que já têm setup prestes a acionar E que passaria nos filtros

### Market & Watchers Sidebar (Nova Feature)

> **Reestruturação de UI:** Esta sidebar substitui e consolida funcionalidades
> que hoje estão espalhadas entre TradingSidebar (aba Portfolio) e AutoTradeModal.

- **Localização:** `apps/electron/src/renderer/components/MarketSidebar/`
- **Posição:** À esquerda do gráfico (oposta à TradingSidebar)
- **Biblioteca:** Recharts 3.5.1 (já instalado)
- **Estilo:** Seguir padrão do `SidebarContainer` com `position="left"`

**Botão de Toggle (UI):**
- **Posição:** Ao lado do botão que abre a TradingSidebar (canto superior direito)
- **Ícone:** `TbChartAreaLine` ou `TbActivity` (Tabler Icons)
- **Tooltip:** "Market & Watchers"
- **Comportamento:** Toggle show/hide
- **Estado:** Salvar preferência em localStorage/settings

---

#### Estrutura de Tabs

```
┌─────────────────────────────────────────────────┐
│  [📊 Market]  [👁 Watchers]  [📜 Logs]          │
├─────────────────────────────────────────────────┤
│                                                 │
│   (conteúdo da tab ativa)                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Tab 1: Market Indicators (📊)**
| Indicador | Tipo de Gráfico | Fonte de Dados |
|-----------|-----------------|----------------|
| **BTC EMA21 Trend** | Indicator (↑/↓) | `getEma21Direction()` - Backend |
| Fear & Greed Index | AreaChart com gradient | Alternative.me API |
| BTC Dominance | LineChart | CoinGecko/Binance |
| Total Market Cap | AreaChart | CoinGecko API |
| ETH/BTC Ratio | LineChart | Binance |
| Open Interest | BarChart | Binance Futures |
| Funding Rate | LineChart | Binance Futures |
| Long/Short Ratio | AreaChart stacked | Binance Futures |

**Tab 2: Watchers (👁)** - Migrado de Portfolio + AutoTradeModal
| Componente | Origem Atual | Descrição |
|------------|--------------|-----------|
| **Active Watchers List** | TradingSidebar > Portfolio | Lista de watchers ativos com status |
| **QuickStart** | AutoTradeModal | Iniciar watchers rapidamente |
| **Rotation Controls** | AutoTradeModal | Controles de rotação de símbolos |
| **Emergency Stop** | AutoTradeModal | Parar todos os watchers |
| **Watcher Actions** | AutoTradeModal | Start/Stop/Pause individual |

**Tab 3: Logs (📜)** - Migrado de Portfolio
| Componente | Origem Atual | Descrição |
|------------|--------------|-----------|
| **Watcher Logs** | TradingSidebar > Portfolio | Logs de atividade dos watchers |
| **Filtros** | Novo | Filtrar por símbolo, tipo, data |
| **Export** | Novo | Exportar logs para CSV/JSON |

---

#### Migração de Componentes

**O QUE SAI da TradingSidebar (aba Portfolio):**
```
❌ WatchersList.tsx → vai para Tab Watchers
❌ WatcherLogs.tsx → vai para Tab Logs
✅ PortfolioSummary.tsx → permanece (balanço, PnL)
✅ OpenPositions.tsx → permanece
✅ OrderHistory.tsx → permanece
```

**O QUE SAI da AutoTradeModal:**
```
❌ QuickStart section → vai para Tab Watchers
❌ Rotation controls → vai para Tab Watchers
❌ Emergency Stop → vai para Tab Watchers
❌ Watcher management → vai para Tab Watchers
✅ Trading configs → vai para Global Config Modal (nova aba)
```

**O QUE É REMOVIDO:**
```
❌ AutoTradeModal.tsx → DELETAR
❌ AutoTradeButton.tsx → DELETAR (botão que abre a modal)
❌ Referências no Header/Toolbar → REMOVER
```

---

#### Nova Aba no Global Config Modal

As configurações de auto-trading que não são relacionadas a watchers
vão para uma nova aba "Auto Trading" na modal de configuração global:

```
┌─────────────────────────────────────────────────────────────────┐
│  Global Settings                                          [X]  │
├─────────────────────────────────────────────────────────────────┤
│  [General] [Trading] [Auto Trading] [Appearance] [Advanced]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Auto Trading Settings:                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Default Position Size: [____] %                         │   │
│  │ Default Leverage: [____] x                              │   │
│  │ Max Concurrent Positions: [____]                        │   │
│  │ Risk per Trade: [____] %                                │   │
│  │ ☑ Use Trailing Stop                                     │   │
│  │ ☑ Auto Breakeven                                        │   │
│  │ Trailing Activation: [____] %                           │   │
│  │ Trailing Distance: [____] %                             │   │
│  │ ...                                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                        [Cancel] [Save]          │
└─────────────────────────────────────────────────────────────────┘
```

---

#### Estrutura de Arquivos

```
components/MarketSidebar/
├── MarketSidebar.tsx              # Container principal
├── MarketSidebarTabs.tsx          # Navegação de tabs
├── tabs/
│   ├── MarketIndicatorsTab.tsx    # Tab 1: Indicadores de mercado
│   ├── WatchersTab.tsx            # Tab 2: Watchers + controles
│   └── LogsTab.tsx                # Tab 3: Logs dos watchers
├── indicators/
│   ├── BtcEma21Indicator.tsx
│   ├── FearGreedChart.tsx
│   ├── BtcDominanceChart.tsx
│   ├── FundingRateChart.tsx
│   ├── OpenInterestChart.tsx
│   └── LongShortRatioChart.tsx
├── watchers/
│   ├── ActiveWatchersList.tsx     # Migrado de TradingSidebar
│   ├── QuickStartPanel.tsx        # Migrado de AutoTradeModal
│   ├── RotationControls.tsx       # Migrado de AutoTradeModal
│   └── EmergencyStopButton.tsx    # Migrado de AutoTradeModal
├── logs/
│   ├── WatcherLogsViewer.tsx      # Migrado de TradingSidebar
│   ├── LogFilters.tsx             # Novo
│   └── LogExport.tsx              # Novo
├── hooks/
│   ├── useBtcEma21Trend.ts
│   ├── useFearGreedIndex.ts
│   ├── useBtcDominance.ts
│   └── useMarketMetrics.ts
└── index.ts

components/Settings/                # Já existente
├── SettingsDialog.tsx             # Modal existente (renomear internamente)
├── GeneralTab.tsx                 # Já existe
├── ChartSettingsTab.tsx           # Já existe
├── AboutTab.tsx                   # Já existe
├── AutoTradingTab.tsx             # NOVA: Configs de auto-trading
└── BacktestingTab.tsx             # NOVA: Configurações de backtesting
```

---

#### BTC Trend Indicator (Destaque)

- **Mesma lógica do sistema:** `getEma21Direction()` de `btc-correlation-filter.ts`
- **Cálculo:** `price > EMA21 = BULLISH` | `price < EMA21 = BEARISH`
- Componente visual simples e claro:
  - Ícone de seta (↑ verde / ↓ vermelho)
  - Label: "BULLISH" ou "BEARISH"
  - Valores: Preço atual e EMA21
  - Distância percentual do preço à EMA21
- Atualização: A cada novo kline do timeframe selecionado

---

#### Checklist de Implementação

**Fase 1: Criar Nova Sidebar** ✅ CONCLUÍDA
- [x] Criar `MarketSidebar.tsx` com `SidebarContainer position="left"`
- [x] Implementar sistema de tabs (Chakra Tabs)
- [x] Criar botão toggle ao lado do botão da TradingSidebar
- [x] Adicionar toggle state ao Zustand/localStorage

**Fase 2: Tab Market Indicators** ✅ CONCLUÍDA
- [x] Criar `MarketIndicatorsTab.tsx` com indicadores funcionais
- [x] BTC EMA21 Trend (reutiliza `getBtcTrendEmaInfo()`)
- [x] Fear & Greed Index (Alternative.me API via `FearGreedDataService`)
- [x] BTC Dominance (CoinGecko API via `BTCDominanceDataService`)
- [x] Open Interest (Binance Futures via `BinanceFuturesDataService`)
- [x] Long/Short Ratio (global + top traders)
- [x] Funding Rates (top 5 symbols)
- [x] Traduções EN/PT/ES/FR adicionadas

**Fase 3: Migrar Watchers** ✅ CONCLUÍDA
- [x] Criar `WatchersTab.tsx` com lista de watchers ativos
- [x] Criar `StartWatchersModal.tsx` (QuickStart simplificado)
- [x] Stop All watchers button
- [x] Navegação para símbolo (click no watcher)
- [x] Tabela ordenável por símbolo/interval/type/profile

**Fase 4: Migrar Logs** ✅ CONCLUÍDA
- [x] Criar `LogsTab.tsx` com logs de watchers
- [x] Controles de font size (+/-)
- [x] Auto-scroll com detecção de scroll manual
- [x] Clear logs button
- [ ] Criar `LogFilters.tsx` (símbolo, tipo, data) - futuro
- [ ] Criar `LogExport.tsx` (CSV/JSON) - futuro

**Fase 5: Migrar Configs para SettingsDialog** ✅ CONCLUÍDA
- [x] Adicionar aba `Auto-Trading` no SettingsDialog (usa TradingProfilesTab)
- [x] Adicionar aba `Backtesting` no SettingsDialog (usa BacktestingPanel)
- [x] Remover botões de Backtest e TradingProfiles da Toolbar
- [x] Traduções EN/PT/ES/FR adicionadas

**Fase 6: Limpeza de Código Obsoleto** ✅ CONCLUÍDA
> **IMPORTANTE:** Todo código obsoleto após as alterações DEVE ser removido.

- [x] Remover `WatchersSection` e `WatchersTable` de Portfolio.tsx
- [x] Remover `AutoTradeConsole` de Portfolio.tsx
- [x] Remover `BacktestDialog.tsx`
- [x] Remover botões de Backtest (LuHistory) e TradingProfiles (LuBot) da Toolbar
- [x] Atualizar imports em todo o app
- [x] Executar `pnpm type-check` para validar tipos (apenas erros pré-existentes)

**Fase 7: Unificação e Reutilização** ✅ CONCLUÍDA
- [x] `WatchersTable` reutilizado em WatchersTab
- [x] `MiniAreaChart` componente reutilizável para gráficos de área
- [x] `MiniLineChart` componente reutilizável para gráficos de linha
- [x] `formatTooltipDate` função compartilhada para tooltips
- [x] `CHART_MARGIN`, `TOOLTIP_STYLE` constantes extraídas
- [ ] Extrair `LogLine` para componente compartilhado (futuro)
- [ ] Unificar hooks de logs (`useAutoTradingLogs`) (futuro)

**Fase 8: Testes e Polish** 🟡 PENDENTE
- [ ] Testar responsividade
- [ ] Testar tema dark/light
- [ ] Testar persistência de estado
- [ ] Testar todos os fluxos de watcher
- [ ] Performance profiling
- [ ] Rodar `pnpm test` para validar testes

### Limpeza Realizada (v1.7.0)
**Scripts Removidos:**
- `optimize-master.ts`, `optimize-volume-filter.ts` (obsoletos)
- `debug-compare.ts`, `debug-short-filter.ts`, `debug-sol-shorts.ts`
- `compare-volume-*.ts`, `compare-trend-methods.ts`
- `run-fib-*.ts`, `run-fibonacci-*.ts`, `run-multi-timeframe-backtest.ts`

---

## 1. Objetivo

Implementar um sistema de simulação de trailing stop no backtesting que seja **fidedigno ao comportamento do auto-trading**, permitindo testar múltiplas combinações de parâmetros para descobrir a configuração ótima em termos de:

- **PnL (Profit & Loss)** - Maximizar retorno absoluto
- **Sharpe Ratio** - Otimizar retorno ajustado ao risco
- **Max Drawdown** - Minimizar perda máxima do pico ao vale

### Escopo do Projeto

| Aspecto | Especificação |
|---------|---------------|
| **Ativo** | BTCUSDT (Futures) |
| **Capital por Entrada** | 80% do equity |
| **Período de Teste** | 3 anos (Jan/2023 - Jan/2026) |
| **Timeframe Principal** | 2h (configurável) |
| **Timeframe Granular** | 5m (para simulação precisa do trailing) |
| **Mercado** | Futures com alavancagem configurável |

---

## 2. Arquitetura do Sistema

### 2.1 Componentes Principais

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TrailingStopBacktestEngine                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │ GranularPrice │  │ TrailingStop  │  │  ParameterOptimizer   │   │
│  │   Simulator   │  │   Simulator   │  │                       │   │
│  │               │  │               │  │  - Grid Search        │   │
│  │  - 5m Klines  │  │  - Activation │  │  - Bayesian Opt       │   │
│  │  - Tick-level │  │  - Adjustment │  │  - Parallel Runs      │   │
│  │  - OHLC Walk  │  │  - Exit Logic │  │                       │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │    Filter     │  │  Fibonacci    │  │     Results           │   │
│  │  Orchestrator │  │   Resolver    │  │    Aggregator         │   │
│  │               │  │               │  │                       │   │
│  │  - 15 Filters │  │  - Entry Lvl  │  │  - PnL Tracking       │   │
│  │  - Confluence │  │  - Target Lvl │  │  - Sharpe Calc        │   │
│  │  - Scoring    │  │  - Dynamic    │  │  - DD Analysis        │   │
│  └───────────────┘  └───────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Dados

```
1. PREPARAÇÃO
   ├── Baixar klines 2h (timeframe principal) - 3 anos
   ├── Baixar klines 5m (granular) - 3 anos (~315K candles)
   └── Indexar por timestamp para lookup rápido

2. DETECÇÃO DE SETUPS
   ├── Executar SetupDetectionService no timeframe 2h
   ├── Filtrar setups por confiança e filtros habilitados
   └── Ordenar cronologicamente

3. SIMULAÇÃO DE TRADE
   Para cada setup:
   ├── Resolver entry price (Fibonacci ou fixed)
   ├── Resolver SL/TP iniciais
   ├── Aplicar filtros (15 disponíveis)
   └── Iniciar simulação granular

4. SIMULAÇÃO GRANULAR (5m)
   Para cada candle de 5 minutos após entrada:
   ├── Verificar hit de SL inicial
   ├── Verificar hit de TP inicial
   ├── Verificar ativação do trailing stop
   │   └── Se ativado:
   │       ├── Calcular novo SL (4 métodos)
   │       ├── Selecionar melhor candidato
   │       └── Atualizar SL se melhorou
   └── Continuar até exit ou fim do período

5. AGREGAÇÃO DE RESULTADOS
   ├── Calcular métricas por combinação de params
   ├── Gerar equity curve
   ├── Calcular Sharpe, Sortino, Max DD
   └── Rankear combinações
```

---

## 3. Parâmetros a Testar

### 3.1 Trailing Stop Configuration (Otimização Independente por Direção)

> **Importante:** O sistema otimiza parâmetros LONG e SHORT de forma independente.
> Cada direção pode ter valores iguais ou diferentes - o otimizador descobrirá
> a melhor combinação caso a caso.

#### Parâmetros por Direção
| Parâmetro | Tipo | Range | Step | Default LONG | Default SHORT |
|-----------|------|-------|------|--------------|---------------|
| `trailingActivationPercent{Dir}` | number | 50% - 150% | 10% | 100% | 88.6% |
| `trailingDistancePercent{Dir}` | number | 10% - 60% | 5% | 30% | 30% |
| `atrMultiplier{Dir}` | number | 1.0 - 4.0 | 0.5 | 2.0 | 2.0 |
| `breakevenProfitThreshold{Dir}` | number | 0.5% - 3% | 0.5% | 1% | 1% |

#### Configurações Globais
| Parâmetro | Tipo | Range | Step | Default |
|-----------|------|-------|------|---------|
| `trailingStopEnabled` | boolean | [true, false] | - | true |
| `useAdaptiveTrailing` | boolean | [true, false] | - | true |

**Exemplo de Otimização:**
- O sistema pode descobrir que LONG performa melhor com activation=100%, distance=25%
- Enquanto SHORT performa melhor com activation=88.6%, distance=40%
- Ou pode descobrir que ambos performam melhor com os mesmos valores

**Total de combinações trailing:** ~5,000+ (LONG × SHORT otimizados independentemente)

### 3.2 Fibonacci Entry/Target Levels

| Parâmetro | Tipo | Valores |
|-----------|------|---------|
| `minFibEntryLevel` | number | [0.382, 0.5, 0.618, 0.786] |
| `maxFibEntryProgress` | number | [60%, 70%, 75%, 80%] |
| `fibTargetLevelLong` | string | ['auto', '1.272', '1.382', '1.5', '1.618', '2', '2.618'] |
| `fibTargetLevelShort` | string | ['auto', '1.272', '1.382', '1.5', '1.618', '2', '2.618'] |
| `useDynamicFibTarget` | boolean | [true, false] |

**Total de combinações Fibonacci:** ~400+

### 3.3 Filter Combinations

| Filtro | Habilitado por Default | Prioridade de Teste |
|--------|------------------------|---------------------|
| `useTrendFilter` | true | Alta |
| `useDirectionFilter` | true | Alta |
| `useStochasticFilter` | false | Média |
| `useMomentumTimingFilter` | false | Média |
| `useAdxFilter` | true | Alta |
| `useMtfFilter` | true | Alta |
| `useVolumeFilter` | true | Alta |
| `useMarketRegimeFilter` | true | Alta |
| `useChoppinessFilter` | false | Média |
| `useBollingerSqueezeFilter` | false | Baixa |
| `useVwapFilter` | false | Baixa |
| `useSupertrendFilter` | false | Média |
| `useConfluenceScoring` | true | Alta |
| `confluenceMinScore` | 60 | [50, 60, 70, 80] |

**Total de combinações filtros:** ~500+ (subset estratégico)

### 3.4 Position Sizing

| Parâmetro | Valor Fixo |
|-----------|------------|
| `initialCapital` | $1,000 |
| `capitalPerTrade` | 100% |
| `leverage` | 5x (configurável para testes) |
| `maxConcurrentPositions` | 1 |

### 3.5 Modo de Validação (Obrigatório Antes do Backtest Completo)

> **IMPORTANTE:** Sempre rodar validação antes do backtest completo de 3 anos.

#### Configuração de Validação
| Aspecto | Validação | Produção |
|---------|-----------|----------|
| **Período** | 1 mês (Jan/2025) | 3 anos |
| **Combinações** | 5-10 fixas | 5,000+ |
| **Verbose** | true (debug) | false |
| **Output** | Console + arquivo | Apenas arquivo |

#### Checklist de Validação
- [ ] Download de dados funciona (2h + 5m)
- [ ] GranularPriceIndex indexa corretamente
- [ ] Trailing stop ativa no momento correto
- [ ] Trailing stop ajusta SL conforme esperado
- [ ] Exit por trailing stop é detectado
- [ ] Exit por TP é detectado
- [ ] Exit por SL inicial é detectado
- [ ] Métricas calculadas corretamente
- [ ] Sem memory leaks (monitorar heap)
- [ ] Output não causa overflow

#### CLI de Validação
```bash
# Rodar validação rápida (1 mês, 5 combinações)
pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts \
  --symbol BTCUSDT \
  --timeframe 2h \
  --start 2025-01-01 \
  --end 2025-01-31 \
  --validate \
  --verbose
```

### 3.6 Controle de Output e Logging

> **CRÍTICO:** Evitar logs excessivos que causam travamentos e overflow de buffer.

#### Níveis de Log
| Nível | Quando Usar | Exemplo |
|-------|-------------|---------|
| `silent` | Produção (apenas erros críticos) | - |
| `summary` | Produção (progresso a cada N%) | "Progress: 50% (2500/5000)" |
| `verbose` | Validação/Debug | Cada trade, cada SL update |

#### Regras de Output
```typescript
interface OutputConfig {
  // Controle de verbosidade
  logLevel: 'silent' | 'summary' | 'verbose';

  // Progress reporting
  progressIntervalPercent: number;  // Report a cada N% (default: 5%)
  progressIntervalSeconds: number;  // Ou a cada N segundos (default: 30)

  // Arquivo de output
  outputFile: string;               // Resultados salvos em arquivo
  appendMode: boolean;              // Append vs overwrite

  // Limites de segurança
  maxConsoleLines: number;          // Máximo de linhas no console (default: 1000)
  flushIntervalMs: number;          // Flush buffer a cada N ms (default: 5000)
}
```

#### Estrutura de Output
```typescript
interface BacktestOutput {
  // Metadata
  runId: string;
  startedAt: Date;
  completedAt: Date;
  config: OptimizationConfig;

  // Resumo (sempre logado)
  summary: {
    totalCombinations: number;
    completedCombinations: number;
    failedCombinations: number;
    elapsedTimeMs: number;
    estimatedRemainingMs: number;
  };

  // Resultados (salvos em arquivo, não no console)
  results: OptimizationResult[];

  // Erros (logados individualmente)
  errors: Array<{
    combination: number;
    error: string;
    stack?: string;
  }>;
}
```

#### Exemplo de Progress Output (Modo Summary)
```
[2026-01-31 10:00:00] Starting optimization: 5000 combinations
[2026-01-31 10:00:30] Progress:   5% (  250/5000) | ETA: 9m 30s | Best PnL: +45.2%
[2026-01-31 10:01:00] Progress:  10% (  500/5000) | ETA: 9m 00s | Best PnL: +52.1%
[2026-01-31 10:01:30] Progress:  15% (  750/5000) | ETA: 8m 30s | Best PnL: +52.1%
...
[2026-01-31 10:10:00] Completed: 5000/5000 | Total time: 10m 00s
[2026-01-31 10:10:00] Results saved to: results/trailing-opt-2026-01-31.json
[2026-01-31 10:10:00] Top 3 by composite score:
  1. PnL: +156.3% | Sharpe: 2.41 | DD: 12.3% | Score: 0.847
  2. PnL: +142.8% | Sharpe: 2.55 | DD: 14.1% | Score: 0.832
  3. PnL: +168.2% | Sharpe: 2.12 | DD: 18.7% | Score: 0.819
```

#### Prevenção de Problemas
```typescript
class SafeLogger {
  private lineCount = 0;
  private buffer: string[] = [];

  log(message: string): void {
    if (this.config.logLevel === 'silent') return;

    // Limite de linhas no console
    if (this.lineCount >= this.config.maxConsoleLines) {
      console.log('... [output truncated, see file for full results]');
      return;
    }

    // Buffer com flush periódico
    this.buffer.push(message);
    if (this.buffer.length >= 100 || this.shouldFlush()) {
      this.flush();
    }

    this.lineCount++;
  }

  private flush(): void {
    if (this.buffer.length === 0) return;
    console.log(this.buffer.join('\n'));
    this.buffer = [];
  }
}
```

---

## 4. Implementação Detalhada

### 4.1 Fase 1: Infraestrutura de Dados (Semana 1)

#### 4.1.1 Kline Downloader Service

**Arquivo:** `apps/backend/src/services/backtesting/KlineDownloaderService.ts`

```typescript
interface KlineDownloadConfig {
  symbol: string;
  intervals: IntervalKey[];  // ['2h', '5m']
  startDate: Date;
  endDate: Date;
  marketType: 'FUTURES';
}

class KlineDownloaderService {
  // Baixa e armazena klines em batch
  async downloadAndStore(config: KlineDownloadConfig): Promise<void>;

  // Verifica gaps e preenche automaticamente
  async backfillGaps(symbol: string, interval: IntervalKey): Promise<void>;

  // Estima tempo de download
  estimateDownloadTime(config: KlineDownloadConfig): Duration;
}
```

**Estimativa de dados para 3 anos:**
- 2h: ~13,140 candles (~400KB)
- 5m: ~315,360 candles (~10MB comprimido)

#### 4.1.2 Granular Price Index

**Arquivo:** `apps/backend/src/services/backtesting/GranularPriceIndex.ts`

```typescript
interface GranularPriceIndex {
  // Índice otimizado para lookup por timestamp
  getKlinesInRange(startTs: number, endTs: number): Kline[];

  // Retorna preço mais próximo de um timestamp
  getPriceAtTimestamp(ts: number): { price: number; kline: Kline };

  // Itera por cada kline no range (generator)
  *iterateKlines(startTs: number, endTs: number): Generator<Kline>;
}
```

**Otimização:** Usar `Map<timestamp, Kline>` com lazy loading por chunks de 1 semana.

---

### 4.2 Fase 2: Trailing Stop Simulator (Semana 2)

#### 4.2.1 Core Simulator

**Arquivo:** `apps/backend/src/services/backtesting/TrailingStopSimulator.ts`

```typescript
interface TrailingStopSimulatorConfig {
  // Configuração global
  trailingStopEnabled: boolean;
  useAdaptiveTrailing: boolean;

  // Configuração LONG (otimizada independentemente)
  trailingActivationPercentLong: number;  // Fibonacci level para ativação
  trailingDistancePercentLong: number;    // Distância do trailing
  atrMultiplierLong: number;              // Multiplicador ATR
  breakevenProfitThresholdLong: number;   // Threshold de breakeven

  // Configuração SHORT (otimizada independentemente)
  trailingActivationPercentShort: number;
  trailingDistancePercentShort: number;
  atrMultiplierShort: number;
  breakevenProfitThresholdShort: number;

  // Configuração de fees
  makerFee: number;  // 0.02%
  takerFee: number;  // 0.04%
  useBnbDiscount: boolean;
}

interface TrailingSimulationState {
  isActivated: boolean;
  activatedAt: number | null;
  highestPrice: number;  // Para LONG
  lowestPrice: number;   // Para SHORT
  currentStopLoss: number;
  stopLossHistory: Array<{
    timestamp: number;
    price: number;
    reason: 'fees_covered' | 'swing_trail' | 'atr_trail' | 'progressive_trail';
  }>;
}

interface TrailingSimulationResult {
  exitPrice: number;
  exitTime: number;
  exitReason: 'TRAILING_STOP' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'END_OF_PERIOD';
  trailingState: TrailingSimulationState;
  pricePathSummary: {
    maxFavorableExcursion: number;  // MFE
    maxAdverseExcursion: number;    // MAE
    timeToActivation: number | null;
  };
}

class TrailingStopSimulator {
  constructor(
    private config: TrailingStopSimulatorConfig,
    private granularIndex: GranularPriceIndex
  ) {}

  // Simula trailing stop para um trade específico
  simulateTrade(trade: BacktestTradeSetup): TrailingSimulationResult {
    const state = this.initializeState(trade);

    // Iterar por cada kline de 5m após entrada
    for (const kline of this.granularIndex.iterateKlines(
      trade.entryTime,
      trade.maxExitTime
    )) {
      // Simular movimento de preço dentro do candle
      const exitResult = this.processKline(kline, trade, state);
      if (exitResult) return exitResult;
    }

    return this.createEndOfPeriodResult(state);
  }

  private processKline(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): TrailingSimulationResult | null {
    // Ordem de processamento dentro do candle 5m:
    // 1. Verificar SL hit (usa low para LONG, high para SHORT)
    // 2. Verificar ativação do trailing
    // 3. Se ativado, calcular novo SL
    // 4. Verificar TP hit
    // 5. Atualizar extremos (highest/lowest)

    const isLong = trade.side === 'LONG';

    // 1. Check stop loss hit
    const slHit = isLong
      ? kline.low <= state.currentStopLoss
      : kline.high >= state.currentStopLoss;

    if (slHit) {
      return this.createStopLossResult(kline, state);
    }

    // 2. Check trailing activation
    if (!state.isActivated) {
      const shouldActivate = this.checkActivation(kline, trade, state);
      if (shouldActivate) {
        state.isActivated = true;
        state.activatedAt = kline.closeTime;
      }
    }

    // 3. Update trailing stop if activated
    if (state.isActivated) {
      this.updateTrailingStop(kline, trade, state);
    }

    // 4. Check take profit hit
    const tpHit = isLong
      ? kline.high >= trade.takeProfit
      : kline.low <= trade.takeProfit;

    if (tpHit) {
      return this.createTakeProfitResult(kline, trade);
    }

    // 5. Update extremes
    if (isLong) {
      state.highestPrice = Math.max(state.highestPrice, kline.high);
    } else {
      state.lowestPrice = Math.min(state.lowestPrice, kline.low);
    }

    return null; // Continue simulation
  }

  private checkActivation(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): boolean {
    const isLong = trade.side === 'LONG';
    const activationLevel = isLong
      ? this.config.trailingActivationPercentLong
      : this.config.trailingActivationPercentShort;

    if (trade.fibonacciProjection) {
      // Fibonacci-based activation
      return this.hasReachedFibonacciLevel(
        kline.close,
        trade.fibonacciProjection,
        activationLevel / 100, // Convert % to decimal
        isLong
      );
    } else {
      // Percentage-based activation
      const profitPercent = isLong
        ? (kline.close - trade.entryPrice) / trade.entryPrice
        : (trade.entryPrice - kline.close) / trade.entryPrice;

      const tpDistance = Math.abs(trade.takeProfit - trade.entryPrice);
      const activationDistance = tpDistance * (activationLevel / 100);
      const currentDistance = Math.abs(kline.close - trade.entryPrice);

      return currentDistance >= activationDistance;
    }
  }

  private updateTrailingStop(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): void {
    // Calcular candidatos de trailing stop
    const candidates = this.calculateTrailingCandidates(kline, trade, state);

    // Selecionar o melhor (mais apertado para LONG, mais solto para SHORT)
    const best = this.selectBestCandidate(candidates, trade.side === 'LONG');

    // Só atualiza se melhorar
    const isImprovement = trade.side === 'LONG'
      ? best.price > state.currentStopLoss
      : best.price < state.currentStopLoss;

    if (isImprovement) {
      state.currentStopLoss = best.price;
      state.stopLossHistory.push({
        timestamp: kline.closeTime,
        price: best.price,
        reason: best.reason
      });
    }
  }

  private calculateTrailingCandidates(
    kline: Kline,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): TrailingCandidate[] {
    const isLong = trade.side === 'LONG';
    const candidates: TrailingCandidate[] = [];

    // 1. Fees Covered Floor
    const roundTripFee = (this.config.takerFee * 2) *
      (this.config.useBnbDiscount ? 0.75 : 1);
    const feesCoveredPrice = isLong
      ? trade.entryPrice * (1 + roundTripFee)
      : trade.entryPrice * (1 - roundTripFee);
    candidates.push({ price: feesCoveredPrice, reason: 'fees_covered' });

    // 2. ATR Trail (usa multiplicador específico por direção)
    if (trade.atr) {
      const atrMultiplier = isLong
        ? this.config.atrMultiplierLong
        : this.config.atrMultiplierShort;
      const atrDistance = trade.atr * atrMultiplier;
      const extremePrice = isLong ? state.highestPrice : state.lowestPrice;
      const atrStop = isLong
        ? extremePrice - atrDistance
        : extremePrice + atrDistance;
      candidates.push({ price: atrStop, reason: 'atr_trail' });
    }

    // 3. Progressive Floor (usa distância específica por direção)
    const trailingDistance = isLong
      ? this.config.trailingDistancePercentLong
      : this.config.trailingDistancePercentShort;
    const extremePrice = isLong ? state.highestPrice : state.lowestPrice;
    const peakProfit = isLong
      ? (extremePrice - trade.entryPrice) / trade.entryPrice
      : (trade.entryPrice - extremePrice) / trade.entryPrice;
    const floorProfit = peakProfit * (1 - trailingDistance / 100);
    const progressiveFloor = isLong
      ? trade.entryPrice * (1 + floorProfit)
      : trade.entryPrice * (1 - floorProfit);
    candidates.push({ price: progressiveFloor, reason: 'progressive_trail' });

    // 4. Swing Trail (requer swing points pre-calculados)
    // TODO: Implementar swing point detection no granular timeframe

    return candidates;
  }
}
```

---

### 4.3 Fase 3: Parameter Optimizer (Semana 3)

#### 4.3.1 Grid Search Implementation

**Arquivo:** `apps/backend/src/services/backtesting/ParameterOptimizer.ts`

```typescript
interface OptimizationConfig {
  // Parâmetros de trailing stop (LONG e SHORT independentes)
  trailingParams: {
    // LONG
    activationPercentLong: number[];    // [50, 60, 70, 80, 90, 100, 110, 120]
    distancePercentLong: number[];      // [10, 20, 30, 40, 50, 60]
    atrMultiplierLong: number[];        // [1.0, 1.5, 2.0, 2.5, 3.0]
    // SHORT
    activationPercentShort: number[];   // [50, 60, 70, 80, 88.6, 100, 110, 120]
    distancePercentShort: number[];     // [10, 20, 30, 40, 50, 60]
    atrMultiplierShort: number[];       // [1.0, 1.5, 2.0, 2.5, 3.0]
    // Global
    useAdaptive: boolean[];             // [true, false]
  };

  // Parâmetros de Fibonacci
  fibParams: {
    entryLevels: number[];              // [0.382, 0.5, 0.618, 0.786]
    targetLevelsLong: string[];         // ['auto', '1.618', '2', '2.618']
    targetLevelsShort: string[];        // ['auto', '1.272', '1.618', '2']
  };

  // Filtros a testar
  filterCombinations: FilterCombination[];

  // Métricas objetivo
  objective: 'pnl' | 'sharpe' | 'calmar' | 'combined';
  objectiveWeights?: {
    pnl: number;
    sharpe: number;
    maxDrawdown: number;  // Penalidade
  };
}

interface OptimizationResult {
  params: Record<string, unknown>;
  metrics: {
    totalPnl: number;
    totalPnlPercent: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    calmarRatio: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    avgTradeDuration: number;
  };
  equityCurve: EquityPoint[];
  tradeLog: TradeLogEntry[];
}

class ParameterOptimizer {
  private results: OptimizationResult[] = [];

  constructor(
    private engine: TrailingStopBacktestEngine,
    private config: OptimizationConfig
  ) {}

  // Executa grid search paralelo
  async runGridSearch(concurrency: number = 4): Promise<OptimizationResult[]> {
    const combinations = this.generateCombinations();
    console.log(`Total combinations to test: ${combinations.length}`);

    // Divide em batches para processamento paralelo
    const batches = this.chunk(combinations, concurrency);

    for (const batch of batches) {
      const promises = batch.map(params => this.runSingleBacktest(params));
      const results = await Promise.all(promises);
      this.results.push(...results);

      // Progress logging
      console.log(`Progress: ${this.results.length}/${combinations.length}`);
    }

    return this.rankResults();
  }

  // Gera todas as combinações de parâmetros (LONG e SHORT independentes)
  private generateCombinations(): Record<string, unknown>[] {
    const { trailingParams, fibParams, filterCombinations } = this.config;
    const combinations: Record<string, unknown>[] = [];

    // Nested loops para LONG params
    for (const actLong of trailingParams.activationPercentLong) {
      for (const distLong of trailingParams.distancePercentLong) {
        for (const atrLong of trailingParams.atrMultiplierLong) {
          // Nested loops para SHORT params (independente de LONG)
          for (const actShort of trailingParams.activationPercentShort) {
            for (const distShort of trailingParams.distancePercentShort) {
              for (const atrShort of trailingParams.atrMultiplierShort) {
                // Params globais
                for (const adaptive of trailingParams.useAdaptive) {
                  // Fibonacci params
                  for (const entryLvl of fibParams.entryLevels) {
                    for (const tgtLong of fibParams.targetLevelsLong) {
                      for (const tgtShort of fibParams.targetLevelsShort) {
                        for (const filters of filterCombinations) {
                          combinations.push({
                            // LONG trailing config
                            trailingActivationPercentLong: actLong,
                            trailingDistancePercentLong: distLong,
                            atrMultiplierLong: atrLong,
                            // SHORT trailing config
                            trailingActivationPercentShort: actShort,
                            trailingDistancePercentShort: distShort,
                            atrMultiplierShort: atrShort,
                            // Global
                            useAdaptiveTrailing: adaptive,
                            // Fibonacci
                            minFibEntryLevel: entryLvl,
                            fibTargetLevelLong: tgtLong,
                            fibTargetLevelShort: tgtShort,
                            ...filters
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return combinations;
  }

  // Rankeia resultados por objetivo composto
  private rankResults(): OptimizationResult[] {
    const weights = this.config.objectiveWeights || {
      pnl: 0.3,
      sharpe: 0.4,
      maxDrawdown: 0.3
    };

    return this.results
      .map(r => ({
        ...r,
        compositeScore: this.calculateCompositeScore(r.metrics, weights)
      }))
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }

  private calculateCompositeScore(
    metrics: OptimizationResult['metrics'],
    weights: { pnl: number; sharpe: number; maxDrawdown: number }
  ): number {
    // Normalizar métricas para escala 0-1
    const normalizedPnl = Math.tanh(metrics.totalPnlPercent / 100);
    const normalizedSharpe = Math.tanh(metrics.sharpeRatio / 3);
    const normalizedDD = 1 - Math.min(metrics.maxDrawdownPercent / 50, 1);

    return (
      weights.pnl * normalizedPnl +
      weights.sharpe * normalizedSharpe +
      weights.maxDrawdown * normalizedDD
    );
  }
}
```

---

### 4.4 Fase 4: Results Aggregator (Semana 4)

#### 4.4.1 Métricas e Relatórios

**Arquivo:** `apps/backend/src/services/backtesting/ResultsAggregator.ts`

```typescript
interface AggregatedResults {
  // Top performers
  topByPnl: OptimizationResult[];
  topBySharpe: OptimizationResult[];
  topByCalmar: OptimizationResult[];
  topByComposite: OptimizationResult[];

  // Análise de sensibilidade
  sensitivityAnalysis: {
    parameter: string;
    impact: number;  // Correlação com performance
    optimalRange: { min: number; max: number };
  }[];

  // Estatísticas gerais
  summary: {
    totalCombinationsTested: number;
    profitableCombinations: number;
    avgPnl: number;
    avgSharpe: number;
    avgMaxDrawdown: number;
    bestPnl: number;
    bestSharpe: number;
    lowestDrawdown: number;
  };

  // Análise de correlação
  correlationMatrix: Record<string, Record<string, number>>;
}

class ResultsAggregator {
  aggregate(results: OptimizationResult[]): AggregatedResults;

  // Exporta para análise externa
  exportToCSV(results: OptimizationResult[], path: string): void;
  exportToJSON(results: AggregatedResults, path: string): void;

  // Gera relatório visual (HTML)
  generateReport(results: AggregatedResults): string;

  // Análise de robustez (Monte Carlo)
  runRobustnessAnalysis(
    topParams: Record<string, unknown>,
    iterations: number
  ): RobustnessResult;
}
```

---

## 5. CLI Scripts

### 5.1 Download de Dados

**Arquivo:** `apps/backend/src/cli/download-granular-data.ts`

```bash
# Uso
pnpm tsx apps/backend/src/cli/download-granular-data.ts \
  --symbol BTCUSDT \
  --intervals 2h,5m \
  --start 2023-01-01 \
  --end 2026-01-31 \
  --market FUTURES
```

### 5.2 Otimização de Trailing Stop

**Arquivo:** `apps/backend/src/cli/optimize-trailing-stop.ts`

```bash
# Uso básico
pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts \
  --symbol BTCUSDT \
  --timeframe 2h \
  --start 2023-01-01 \
  --end 2026-01-31 \
  --capital 10000 \
  --capitalPerTrade 0.8 \
  --leverage 5 \
  --concurrency 4

# Com filtros específicos
pnpm tsx apps/backend/src/cli/optimize-trailing-stop.ts \
  --symbol BTCUSDT \
  --filters "trend,direction,adx,mtf,volume" \
  --fibTargets "1.618,2,2.618" \
  --trailingActivation "80,90,100,110" \
  --trailingDistance "20,30,40,50"
```

### 5.3 Análise de Resultados

**Arquivo:** `apps/backend/src/cli/analyze-trailing-results.ts`

```bash
# Gerar relatório
pnpm tsx apps/backend/src/cli/analyze-trailing-results.ts \
  --input results/trailing-optimization-2026-01-31.json \
  --output reports/trailing-analysis.html \
  --top 20
```

---

## 6. Estrutura de Arquivos

```
apps/backend/src/
├── services/
│   └── backtesting/
│       ├── TrailingStopBacktestEngine.ts    # Engine principal
│       ├── TrailingStopSimulator.ts         # Simulador granular
│       ├── GranularPriceIndex.ts            # Índice de preços 5m
│       ├── KlineDownloaderService.ts        # Download de dados
│       ├── ParameterOptimizer.ts            # Grid search
│       ├── ResultsAggregator.ts             # Agregação de resultados
│       └── types/
│           └── trailing-backtest.ts         # Tipos específicos
├── cli/
│   ├── download-granular-data.ts
│   ├── optimize-trailing-stop.ts
│   └── analyze-trailing-results.ts
└── __tests__/
    └── backtesting/
        ├── trailing-stop-simulator.test.ts
        └── parameter-optimizer.test.ts
```

---

## 7. Cronograma de Implementação

### Semana 1: Infraestrutura de Dados
- [x] Implementar `GranularPriceIndex`
- [x] Implementar `SafeLogger` (controle de output)
- [x] Implementar `TrailingStopSimulator`
- [x] Criar tipos reutilizando @marketmind/types
- [x] Criar CLI de validação
- [ ] Implementar `KlineDownloaderService` (usando prefetchKlines existente)
- [ ] Baixar 1 mês de dados (validação) + 3 anos (produção)
- [ ] Criar testes unitários

### Semana 2: Trailing Stop Simulator
- [ ] Implementar `TrailingStopSimulator`
- [ ] Portar lógica de `trailing-stop-core.ts`
- [ ] Implementar os 4 métodos de trailing (direction-aware)
- [ ] Integrar com `GranularPriceIndex`
- [ ] Criar testes de simulação
- [ ] **VALIDAÇÃO:** Rodar 1 mês com 5 combinações

### Semana 3: Parameter Optimizer + Validação
- [ ] Implementar `ParameterOptimizer`
- [ ] Criar gerador de combinações (LONG/SHORT independentes)
- [ ] Implementar execução paralela
- [ ] Criar sistema de ranking
- [ ] Implementar CLI de otimização
- [ ] **VALIDAÇÃO COMPLETA:**
  - [ ] Testar com 1 mês, 50 combinações
  - [ ] Verificar memory usage
  - [ ] Verificar output não trava
  - [ ] Comparar resultados com backtest manual

### Semana 4: Backtest Completo + Analysis
- [ ] ✅ Validação aprovada → Rodar backtest 3 anos
- [ ] Implementar `ResultsAggregator`
- [ ] Criar exportadores (CSV, JSON)
- [ ] Implementar análise de sensibilidade
- [ ] Criar gerador de relatório HTML
- [ ] Documentar resultados

---

## 8. Combinações Prioritárias de Teste

### 8.1 Trailing Stop (Alta Prioridade)

> Cada combinação testa LONG e SHORT com parâmetros independentes

| ID | Act. Long | Act. Short | Dist. Long | Dist. Short | ATR Long | ATR Short | Adaptive |
|----|-----------|------------|------------|-------------|----------|-----------|----------|
| T1 | 100% | 88.6% | 30% | 30% | 2.0 | 2.0 | true |
| T2 | 100% | 88.6% | 25% | 35% | 2.0 | 2.5 | true |
| T3 | 80% | 80% | 30% | 30% | 2.0 | 2.0 | true |
| T4 | 120% | 100% | 40% | 45% | 2.5 | 3.0 | true |
| T5 | 100% | 100% | 20% | 20% | 1.5 | 1.5 | false |
| T6 | 90% | 88.6% | 35% | 40% | 2.0 | 2.5 | true |
| T7 | 100% | 70% | 30% | 50% | 2.0 | 3.0 | true |

### 8.2 Fibonacci Targets (Alta Prioridade)

| ID | Entry Level | Target Long | Target Short |
|----|-------------|-------------|--------------|
| F1 | 0.618 | auto | auto |
| F2 | 0.618 | 1.618 | 1.272 |
| F3 | 0.5 | 2.0 | 1.618 |
| F4 | 0.618 | 2.618 | 2.0 |
| F5 | 0.786 | 1.618 | 1.618 |

### 8.3 Filter Combinations (Alta Prioridade)

| ID | Filters Enabled | Confluence Min |
|----|-----------------|----------------|
| FL1 | trend, direction, adx, mtf | 60 |
| FL2 | trend, direction, adx, mtf, volume | 65 |
| FL3 | trend, direction, adx, mtf, volume, regime | 70 |
| FL4 | trend, direction, adx, stochastic, momentum | 60 |
| FL5 | all enabled | 75 |

---

## 9. Métricas de Sucesso

### 9.1 Objetivos Mínimos

| Métrica | Target Mínimo | Target Ideal |
|---------|---------------|--------------|
| PnL Total (3 anos) | > 100% | > 300% |
| Sharpe Ratio | > 1.5 | > 2.5 |
| Max Drawdown | < 30% | < 15% |
| Win Rate | > 45% | > 55% |
| Profit Factor | > 1.5 | > 2.0 |
| Calmar Ratio | > 1.0 | > 2.0 |

### 9.2 Fórmula de Score Composto

```
CompositeScore = (
  0.30 × normalize(PnL%) +
  0.35 × normalize(Sharpe) +
  0.25 × (1 - normalize(MaxDD%)) +
  0.10 × normalize(WinRate)
)
```

---

## 10. Considerações de Performance

### 10.1 Otimizações de Memória

- Usar streams para processar klines 5m (não carregar 315K candles na RAM)
- Implementar chunked processing (processar 1 semana por vez)
- Liberar memória entre combinações de teste

### 10.2 Otimizações de Tempo

- Paralelizar com worker threads (até 8 cores)
- Cache de indicadores calculados
- Early exit em combinações claramente ruins

### 10.3 Estimativa de Tempo

| Combinações | Concurrency | Tempo Estimado |
|-------------|-------------|----------------|
| 1,000 | 4 | ~2 horas |
| 10,000 | 4 | ~20 horas |
| 50,000 | 8 | ~50 horas |

---

## 11. Consolidação de Scripts de Otimização

### 11.1 Sistema Principal

O sistema de otimização foi consolidado em scripts focados:

| Script | Status | Propósito |
|--------|--------|-----------|
| `optimize-trailing-stop.ts` | **PRINCIPAL** | Trailing stop params (LONG/SHORT) |
| `optimize-complete.ts` | MANTER | Timeframes × Filtros |
| `optimize-fibonacci-targets.ts` | MANTER | Níveis de TP Fibonacci |
| `optimize-all-pairs.ts` | MANTER | Descoberta de sinergias |
| `optimize-trend-ema.ts` | MANTER | Período EMA |

### 11.2 Scripts Removidos

| Script | Status | Motivo |
|--------|--------|--------|
| `optimize-filter-combinations.ts` | ✅ Removido | Duplicava optimize-master.ts |
| `optimize-master.ts` | ✅ Removido | Coberto por optimize-complete.ts |
| `optimize-volume-filter.ts` | ✅ Removido | Volume já testado em complete.ts |

### 11.3 Estrutura Recomendada

```
cli/
├── optimize-trailing-stop.ts     # Trailing stop (CORE)
├── optimize-complete.ts          # Timeframes × Filtros
├── optimize-fibonacci-targets.ts # TP levels
├── optimize-all-pairs.ts         # Filter synergies
├── optimize-trend-ema.ts         # EMA period
├── validate-trailing-backtest.ts # Validação
└── README-OPTIMIZATION.md        # Documentação
```

### 11.4 Config Unificada

Arquivo: `apps/backend/src/cli/optimization-config.ts`

```typescript
export const OPTIMIZATION_DEFAULTS = {
  symbol: 'BTCUSDT',
  marketType: 'FUTURES',
  initialCapital: 1000,
  capitalPerTrade: 1.0,
  leverage: 5,
  mainInterval: '2h',
  granularInterval: '5m',
  startDate: '2023-01-01',
  endDate: '2026-01-31',
};

export const TRAILING_STOP_PARAM_RANGES = {
  quick: { ... },   // 27 combinações
  medium: { ... },  // ~82,944 combinações
  full: { ... },    // ~25M combinações
};

export const SCORE_WEIGHTS = {
  pnl: 0.4,
  sharpe: 0.4,
  maxDrawdown: 0.2,
};
```

### 11.5 Performance Atual

| Métrica | 6 Meses | 3 Anos |
|---------|---------|--------|
| Klines 5m | 51,876 | 324,324 |
| Trades | 178 | 735 |
| Combinações | 82,944 | 82,944 |
| Tempo | ~20 min | ~80 min |
| Memória | ~500MB | ~2GB |

### 11.6 Otimizações de Performance (TODO)

- [ ] **Paralelização:** Worker threads para processar combinações
- [ ] **Cache:** Memoizar cálculos de indicadores
- [ ] **Early Exit:** Pular combinações claramente ruins
- [ ] **Streaming:** Processar klines em chunks
- [ ] **GPU:** Considerar CUDA/WebGPU para cálculos massivos

---

## 12. Aplicação dos Resultados Ótimos

### 11.1 Objetivo Final

Ao final da otimização, a melhor configuração encontrada será aplicada como **default do sistema**:

1. **Trailing Stop Config** - Parâmetros ótimos para LONG e SHORT
2. **Fibonacci Target Levels** - Níveis ótimos por direção
3. **Filter Combinations** - Filtros habilitados/desabilitados
4. **Timeframe** - Intervalo principal otimizado
5. **Confluence Score** - Threshold mínimo

### 11.2 Arquivos a Atualizar

| Arquivo | Descrição |
|---------|-----------|
| `packages/types/src/trading-defaults.ts` | Constantes globais |
| `packages/types/src/filters.ts` | Configuração de filtros |
| `apps/backend/src/cli/shared-backtest-config.ts` | Config de backtest |
| `apps/backend/src/constants.ts` | Constantes do backend |

### 11.3 Atualização de Configs no Banco

```sql
-- Atualizar trading profiles com configs otimizadas
UPDATE trading_profiles SET
  trailing_stop_enabled = true,
  trailing_activation_percent_long = :optimalActivationLong,
  trailing_activation_percent_short = :optimalActivationShort,
  trailing_distance_percent_long = :optimalDistanceLong,
  trailing_distance_percent_short = :optimalDistanceShort,
  atr_multiplier_long = :optimalAtrLong,
  atr_multiplier_short = :optimalAtrShort,
  fibonacci_target_level_long = :optimalFibLong,
  fibonacci_target_level_short = :optimalFibShort
WHERE use_default_config = true;

-- Atualizar auto_trading_configs
UPDATE auto_trading_configs SET
  trailing_config = :optimalTrailingConfigJson,
  filter_config = :optimalFilterConfigJson
WHERE is_template = true;
```

### 11.4 CLI de Aplicação

```bash
# Aplicar melhor config como defaults
pnpm tsx apps/backend/src/cli/apply-optimal-config.ts \
  --results-file results/optimization-2026-01-31.json \
  --update-code \
  --update-database \
  --dry-run  # Mostra o que seria atualizado

# Execução real
pnpm tsx apps/backend/src/cli/apply-optimal-config.ts \
  --results-file results/optimization-2026-01-31.json \
  --update-code \
  --update-database
```

### 11.5 Validação Pós-Aplicação

- [ ] Rodar backtest com novos defaults
- [ ] Comparar métricas com otimização
- [ ] Verificar que DB foi atualizado
- [ ] Testar auto-trading em paper mode
- [ ] Documentar mudanças no CHANGELOG.md

---

## 13. Melhoria do Sistema de Rotation e QuickStart

### 13.1 O Que Já Existe (Funcional)

O sistema atual em `dynamic-symbol-rotation.ts` **já possui**:

| Feature | Status | Descrição |
|---------|--------|-----------|
| **BTC EMA21 Trend Filter** | ✅ | Alinha ativos com tendência BTC (linhas 109-176) |
| **Capital/Notional Filter** | ✅ | Valida capital suficiente (linhas 79-100) |
| **Hysteresis (10 pts)** | ✅ | Evita churn excessivo (linha 14) |
| **Misaligned Removal** | ✅ | Remove watchers contra BTC trend (linhas 205-234) |
| **Kline Availability** | ✅ | Verifica dados suficientes (linhas 298-309) |
| **Opportunity Scoring** | ✅ | Ranking por marketCap, volume, volatilidade |

### 13.2 O Que Falta (Melhorias Propostas)

| Feature | Status | Benefício Esperado |
|---------|--------|-------------------|
| **Setup Pre-Scanner** | ❌ | Detectar setups pendentes antes de rotacionar |
| **Filter Pre-Validator** | ❌ | Validar se setup passaria nos filtros |
| **BTC Dominance Check** | ❌ | Reduzir alts quando BTC.D > 60% |
| **ADX Trend Strength** | ❌ | Evitar rotação em mercados choppy |
| **Historical Win Rate** | ❌ | Priorizar símbolos com melhor histórico |
| **Altcoin Season Index** | ❌ | Timing para rotação de alts |

### 13.3 Arquitetura Proposta (Incremental)

```
┌─────────────────────────────────────────────────────────────────┐
│                 Enhanced Rotation System v2                      │
├─────────────────────────────────────────────────────────────────┤
│  EXISTENTE                    │  NOVO (a implementar)           │
│  ┌──────────────────────────┐ │  ┌──────────────────────────┐   │
│  │ BTC EMA21 Trend ✅       │ │  │ Setup Pre-Scanner ❌     │   │
│  │ Capital Filter ✅        │ │  │ Filter Pre-Validator ❌  │   │
│  │ Hysteresis ✅            │ │  │ BTC Dominance Check ❌   │   │
│  │ Opportunity Score ✅     │ │  │ ADX Trend Strength ❌    │   │
│  └──────────────────────────┘ │  └──────────────────────────┘   │
│              │                │              │                   │
│              ▼                │              ▼                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                  Opportunity Scorer v2                      │ │
│  │  Atual: marketCap×0.15 + volume×0.20 + volatility×0.15 +   │ │
│  │         priceChange×0.10 + setupFreq×0.20 + winRate×0.10 + │ │
│  │         profitFactor×0.10                                   │ │
│  │                                                             │ │
│  │  Proposto: + SetupPending×0.20 + FilterPassRate×0.15       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 13.4 Componentes a Adicionar

#### 13.4.1 Setup Pre-Scanner
```typescript
interface SetupScanResult {
  symbol: string;
  hasPendingSetup: boolean;
  pendingSetups: Array<{
    type: string;
    side: 'LONG' | 'SHORT';
    confidence: number;
  }>;
  alignedWithBTC: boolean;  // Já calculado pelo sistema atual
}
```

**Benefício:** Priorizar ativos que têm setups **prestes a acionar** ao invés de esperar rotacionar e depois esperar setup.

#### 13.4.2 Filter Pre-Validator
```typescript
interface FilterValidationResult {
  symbol: string;
  wouldPassFilters: boolean;
  confluenceScore: number;
  failingFilters: string[];
}
```

**Benefício:** Não rotacionar para ativo cujo setup não passaria nos filtros de qualquer forma.

### 13.5 Ajustes de Parâmetros

| Parâmetro | Atual | Proposto | Motivo |
|-----------|-------|----------|--------|
| `HYSTERESIS_THRESHOLD` | 10 | 15-20 | Menos rotações = menos oportunidades perdidas |
| Antecipação rotation | 5 min | 10-15 min | Mais tempo para pre-scan |
| Min rotação | cada candle | cada 2 candles | Qualidade > quantidade |

### 13.6 TODO (Priorizado)

**Alta Prioridade:**
- [ ] Implementar `SetupPreScanner` - detectar setups pendentes
- [ ] Implementar `FilterPreValidator` - simular confluenceScore
- [ ] Adicionar ao scoring: `hasPendingSetup` weight

**Média Prioridade:**
- [ ] Adicionar BTC Dominance check (API CoinGecko/CMC)
- [ ] Aumentar `HYSTERESIS_THRESHOLD` para 15-20
- [ ] Criar métricas de qualidade de rotação

**Baixa Prioridade:**
- [ ] Integrar Altcoin Season Index
- [ ] ADX check no rotation (não só no trade filter)

### 13.7 Pesquisa de Mercado (2025-2026)

- **BTC Dominance** em ~59.4% limita momentum de alts
- **Correlação BTC-Alts** > 0.8 em crashes - sistema já considera EMA21
- **Volume confirma breakouts** - já está no scoring atual
- **Mercados de alta favorecem momentum** - sistema já usa momentum metrics

**Fontes:**
- [Bitcoin Momentum and Altcoin Rotation](https://www.ainvest.com/news/bitcoin-momentum-altcoin-rotation-signal-bullish-phase-2026-2601/)
- [Momentum Trading Strategy Guide](https://stoic.ai/blog/momentum-trading-indicators-strategy-expert-crypto-trading-guide/)

---

## 14. Teste e Otimização das 106 Estratégias

### 13.1 Visão Geral

O sistema possui **106 estratégias** definidas em JSON em `apps/backend/strategies/builtin/`. Com o backtesting completo funcionando (incluindo trailing stop), o próximo passo é:

1. **Testar todas as 106** com a config ótima de trailing stop
2. **Eleger as melhores** (top 10-20 por métricas)
3. **Otimizar individualmente** as estratégias eleitas

### 13.2 Categorias de Estratégias

| Categoria | Exemplos | Quantidade |
|-----------|----------|------------|
| Larry Williams | 9.1, 9.2, 9.3, 9.4 | 4 |
| Momentum | momentum-breakout-2025, momentum-rotation | ~15 |
| Mean Reversion | rsi-oversold-bounce, mean-reversion-bb-rsi | ~12 |
| Trend Following | ema-crossover, supertrend-follow, golden-cross-sma | ~20 |
| Breakout | breakout-retest, range-breakout, keltner-breakout | ~15 |
| Pattern | engulfing-pattern, three-bar-reversal, pattern-123 | ~10 |
| Divergence | rsi-divergence, macd-divergence, obv-divergence | ~8 |
| Volume/Order Flow | whale-accumulation, liquidity-sweep, order-block-fvg | ~10 |
| Outros | scalping, grid-trading, arbitrage | ~12 |

### 13.3 Processo de Seleção

```
Fase 1: Screening (106 → ~30)
├── Testar todas com config padrão
├── Filtrar por: PnL > 0, Trades > 50, WinRate > 40%
└── Excluir: Drawdown > 40%, ProfitFactor < 1.2

Fase 2: Ranking (30 → 15)
├── Score = PnL×0.3 + Sharpe×0.4 + (1-DD)×0.3
├── Considerar consistência entre timeframes
└── Validar com Walk-Forward

Fase 3: Otimização (15 estratégias)
├── Otimizar parâmetros específicos de cada estratégia
├── Testar combinações de filtros
└── Validar com Monte Carlo
```

### 13.4 CLI para Teste em Massa

```bash
# Testar todas as estratégias com config padrão
pnpm tsx apps/backend/src/cli/test-all-strategies.ts \
  --symbol BTCUSDT \
  --interval 2h \
  --start 2023-01-01 \
  --end 2026-01-31 \
  --output results/strategy-ranking-$(date +%Y%m%d).json

# Otimizar uma estratégia específica
pnpm tsx apps/backend/src/cli/optimize-strategy.ts \
  --strategy momentum-breakout-2025 \
  --symbol BTCUSDT \
  --interval 2h
```

### 13.5 Métricas de Avaliação

| Métrica | Peso | Threshold Mínimo |
|---------|------|------------------|
| PnL Total | 30% | > 0 |
| Sharpe Ratio | 40% | > 1.0 |
| Max Drawdown | 30% | < 30% |
| Win Rate | - | > 40% |
| Profit Factor | - | > 1.2 |
| Total Trades | - | > 50 |

### 13.6 TODO

- [ ] Criar `test-all-strategies.ts` para screening em massa
- [ ] Criar `optimize-strategy.ts` para otimização individual
- [ ] Implementar ranking automático com Score
- [ ] Gerar relatório comparativo (CSV/HTML)
- [ ] Integrar com Walk-Forward e Monte Carlo

---

## 14. Melhores Práticas de Backtesting (Pesquisa 2026)

### 13.1 Walk-Forward Optimization (WFO)

**Por quê:** Previne overfitting ao testar parâmetros em dados que não foram usados na otimização.

**Implementação:**
```
│ 3 Anos de Dados │
├─────────────────┼─────────────────┼─────────────────┤
│   In-Sample 1   │  Out-Sample 1   │                 │
│   (Otimiza)     │  (Valida)       │                 │
├─────────────────┼─────────────────┼─────────────────┤
│                 │   In-Sample 2   │  Out-Sample 2   │
│                 │   (Otimiza)     │  (Valida)       │
└─────────────────┴─────────────────┴─────────────────┘

Janela: 6 meses in-sample → 2 meses out-of-sample → Rola
```

**Benefícios:**
- Testa robustez em diferentes condições de mercado
- Detecta quando estratégia para de funcionar
- Simula cenário real de re-otimização periódica

**TODO:**
- [ ] Implementar `WalkForwardOptimizer` com janelas configuráveis
- [ ] Adicionar flag `--walk-forward` ao CLI
- [ ] Gerar relatório de consistência entre janelas

### 13.2 Monte Carlo Simulation

**Por quê:** Testa se os resultados são estatisticamente significativos ou apenas sorte.

**Técnicas:**
1. **Trade Shuffling** - Embaralha ordem dos trades e recalcula métricas
2. **Bootstrap Sampling** - Amostra trades com reposição
3. **Noise Injection** - Adiciona variação aleatória aos preços de entrada/saída

**Implementação:**
```typescript
interface MonteCarloConfig {
  iterations: number;      // 1000-10000
  method: 'shuffle' | 'bootstrap' | 'noise';
  noisePercent?: number;   // 0.1% - 0.5%
  confidenceLevel: number; // 0.95 (95%)
}

interface MonteCarloResult {
  original: BacktestMetrics;
  percentiles: {
    p5: BacktestMetrics;   // Worst case (5%)
    p50: BacktestMetrics;  // Median
    p95: BacktestMetrics;  // Best case (95%)
  };
  significanceTest: {
    profitable: number;    // % das simulações lucrativas
    exceedsBaseline: number; // % > buy-and-hold
  };
}
```

**TODO:**
- [ ] Implementar `MonteCarloSimulator`
- [ ] Adicionar ao relatório final com intervalos de confiança
- [ ] Rejeitar configs onde p5 é negativo

### 13.3 Bayesian Optimization (Otimização Eficiente)

**Por quê:** Grid search é exponencial. Bayesian encontra ótimo com menos iterações.

**Comparação:**
| Método | 10 Params | Eficiência |
|--------|-----------|------------|
| Grid Search | 10^10 combinações | Baixa |
| Random Search | ~60% do ótimo com 1% das amostras | Média |
| Bayesian Opt | ~95% do ótimo com 0.1% das amostras | Alta |

**Quando usar:**
- Grid Search: < 10K combinações (atual)
- Bayesian: > 100K combinações (full mode)

**TODO:**
- [ ] Pesquisar libs: `hyperopt`, `optuna` (Python) ou equivalente TS
- [ ] Implementar modo `--optimization=bayesian` para full search
- [ ] Comparar resultados Bayesian vs Grid em subset

### 13.4 Market Regime Detection

**Por quê:** Diferentes regimes (bull/bear/ranging) requerem diferentes configs.

**Regimes:**
| Regime | Características | Config Ideal |
|--------|-----------------|--------------|
| Bull Trend | ADX > 25, Price > EMA200 | Trailing largo, TP extensão 2.0+ |
| Bear Trend | ADX > 25, Price < EMA200 | Trailing apertado, TP conservador |
| Ranging/Chop | ADX < 20, Choppiness > 60 | Filtrar (não operar) ou scalp |
| High Volatility | ATR > 2× média | Stops maiores, position menor |

**Implementação:**
```typescript
type MarketRegime = 'BULL_TREND' | 'BEAR_TREND' | 'RANGING' | 'HIGH_VOLATILITY';

interface RegimeAwareConfig {
  [regime: MarketRegime]: TrailingStopConfig;
}

// Otimização por regime
const optimalConfigs = {
  BULL_TREND: { activationLong: 120, distanceLong: 40, ... },
  BEAR_TREND: { activationShort: 80, distanceShort: 30, ... },
  RANGING: null, // Skip trades
};
```

**TODO:**
- [ ] Implementar `MarketRegimeDetector`
- [ ] Otimizar configs separadamente por regime
- [ ] Adicionar flag `--regime-aware` ao optimizer

### 13.5 Custos Realistas de Transação

**Por quê:** Ignorar custos leva a estratégias que não funcionam em produção.

**Custos a considerar:**
| Custo | Valor Típico | Impact |
|-------|--------------|--------|
| Trading Fee (maker) | 0.02% | Baixo |
| Trading Fee (taker) | 0.04% | Médio |
| Slippage | 0.05% - 0.20% | Alto |
| Funding Rate | ±0.01%/8h | Médio (shorts) |
| Spread | 0.01% - 0.05% | Baixo |

**Implementação atual:** ✅ Fees incluídos
**TODO:**
- [ ] Adicionar slippage configurável (0.1% default)
- [ ] Simular funding rates para posições overnight
- [ ] Considerar spread em entradas/saídas

### 13.6 Métricas Adicionais Recomendadas

| Métrica | Fórmula | Target |
|---------|---------|--------|
| Sortino Ratio | Return / Downside Dev | > 2.0 |
| Calmar Ratio | CAGR / Max DD | > 1.0 |
| Ulcer Index | Sqrt(Mean(DD²)) | < 10 |
| Recovery Factor | Total Return / Max DD | > 3.0 |
| Expectancy | (WR × AvgWin) - ((1-WR) × AvgLoss) | > 0.3R |

**TODO:**
- [ ] Adicionar Sortino, Calmar, Ulcer Index ao relatório
- [ ] Incluir Expectancy por trade

---

## 14. Arquitetura de Backtesting (Existente)

### 14.1 Estrutura Atual

O sistema de backtesting já está implementado em `apps/backend/src/services/backtesting/`:

```
apps/backend/src/services/backtesting/
├── index.ts                     # Exports públicos
├── BacktestEngine.ts            # Engine base
├── MultiWatcherBacktestEngine.ts # Engine principal (multi-watcher)
├── FuturesBacktestEngine.ts     # Especializado para futures
├── WalkForwardOptimizer.ts      # ✅ Implementado
├── MonteCarloSimulator.ts       # ✅ Implementado
├── BacktestOptimizer.ts         # Grid search
├── FullSystemOptimizer.ts       # Otimização completa
├── ParameterGenerator.ts        # Gerador de combinações
├── ParameterSensitivityAnalyzer.ts # Análise de sensibilidade
├── PermutationTest.ts           # Teste estatístico
├── IndicatorCache.ts            # Cache de indicadores
├── ResultManager.ts             # Gerenciamento de resultados
├── FilterManager.ts             # Gerenciamento de filtros
├── ExitManager.ts               # Lógica de saída
├── TradeExecutor.ts             # Execução de trades
├── PositionSizer.ts             # Dimensionamento de posição
├── SharedPortfolioManager.ts    # Portfolio compartilhado
└── configLoader.ts              # Carregamento de configs
```

### 14.2 Componentes de Validação (Prontos para Uso)

| Componente | Status | Descrição |
|------------|--------|-----------|
| `WalkForwardOptimizer` | ✅ Pronto | Previne overfitting com janelas IS/OS |
| `MonteCarloSimulator` | ✅ Pronto | Validação estatística (shuffle trades) |
| `ParameterSensitivityAnalyzer` | ✅ Pronto | Análise de impacto de parâmetros |
| `PermutationTest` | ✅ Pronto | Teste de significância estatística |

### 14.3 Integração com CLI (TODO)

**Próximo passo:** Integrar os componentes de validação com o CLI de otimização:

```bash
# Após otimização grid search
pnpm tsx apps/backend/src/cli/validate-optimization.ts \
  --results results/optimization-2026-01-31.json \
  --walk-forward \
  --monte-carlo 1000 \
  --sensitivity
```

**TODO:**
- [ ] Criar CLI `validate-optimization.ts`
- [ ] Integrar WalkForwardOptimizer com resultados da otimização
- [ ] Gerar relatório de robustez (markdown ou HTML)

---

## 15. Atualizações do Plano

### v2.0.6 (2026-01-31 20:30)
- **Trailing Stop Optimization COMPLETA:**
  - 82,944 combinações testadas em ~87 minutos
  - Melhor config: LONG(Act=90%, Dist=40%, ATR=1.5), SHORT(Act=80%, Dist=30%)
  - Resultados: PnL +$428 (42.9%), Sharpe 0.535, Max DD 30.5%
  - **Observação crítica:** Apenas 7.8% dos trades saíram via trailing
- **Market Indicators Sidebar COMPLETA:**
  - Fear & Greed Index (Alternative.me API)
  - BTC Dominance (CoinGecko API)
  - Open Interest + Long/Short Ratio (Binance Futures)
  - BTC EMA21 Trend + Funding Rates
  - Badges com `px={2}` corrigidos
  - Cards de Dominance/OI com `wrap="wrap"` para sidebars estreitas
- **Compare Timeframes iniciado:** 8 timeframes sendo testados

### v2.0.5 (2026-01-31)
- **Requisitos Adicionais:**
  - BacktestDialog → nova aba "Backtesting" no SettingsDialog
  - Remoção de BacktestDialog e botões da toolbar
  - Todo código obsoleto DEVE ser removido
  - Todo código reutilizável DEVE ser unificado
  - Fase 7 adicionada: Unificação e Reutilização
  - Fase 8: Testes e validação

### v2.0.4 (2026-01-31)
- **Market & Watchers Sidebar:** Reestruturação completa da UI
  - Nova sidebar com 3 tabs: Market, Watchers, Logs
  - Migração de WatchersList e WatcherLogs de TradingSidebar > Portfolio
  - Migração de QuickStart, Rotation, Emergency Stop de AutoTradeModal
  - Nova aba "Auto Trading" no SettingsDialog
  - Nova aba "Backtesting" no SettingsDialog
  - Remoção de AutoTradeModal e BacktestDialog
  - Checklist de implementação em 8 fases

### v2.0.3 (2026-01-31)
- **Seção 16 expandida:** Visualização no Canvas + Performance
  - Liquidity Walls como linhas horizontais no gráfico
  - Imbalance Histogram lateral
  - Toggle no IndicatorTogglePopover (todos desativados por padrão)
  - Estratégias de performance: throttling, memoização, lazy connection
  - OffscreenCanvas para histograma
  - Limites de recursos (4 updates/s, 20 níveis, 5 walls max)

### v2.0.2 (2026-01-31)
- **Seção 16 adicionada:** Order Book Integration (Feature Futura)
  - Dados disponíveis: depth, bookTicker, aggTrades
  - Indicadores: Imbalance Ratio, Liquidity Walls, Order Book Velocity
  - Novo filtro: `useOrderBookFilter`
  - Integração com Market Indicators Sidebar
  - Implementação em 4 fases

### v2.0.1 (2026-01-31)
- **Market Indicators Sidebar:** Adicionado requisito de botão toggle
  - Botão ao lado do toggle da TradingSidebar (canto superior direito)
  - Ícone: `TbChartAreaLine` ou `TbChartBar`
  - Tooltip: "Market Indicators"
  - Salvar preferência do usuário

### v1.9.0 (2026-01-31)
- **Seção 13 revisada:** Melhoria do Sistema de Rotation e QuickStart
  - Documentado o que **já existe**: BTC EMA21 trend, capital filter, hysteresis, scoring
  - Identificado o que **falta**: SetupPreScanner, FilterPreValidator
  - Proposta incremental (adicionar ao existente, não reescrever)
  - TODOs priorizados por impacto
  - Pesquisa de mercado 2025-2026 incorporada

### v1.8.0 (2026-01-31)
- **Seção 14 adicionada:** Teste e Otimização das 106 Estratégias
  - Workflow de screening, ranking e otimização
  - Categorização das estratégias
  - Métricas de avaliação
  - CLI TODO: `test-all-strategies.ts`, `optimize-strategy.ts`
- **README-OPTIMIZATION.md atualizado** com workflow de estratégias

### v1.7.0 (2026-01-31)
- **Limpeza massiva de código obsoleto:**
  - Removido 7 scripts de debug/compare: `debug-*.ts`, `compare-volume-*.ts`, `compare-trend-methods.ts`
  - Removido 5 scripts de fibonacci duplicados: `run-fib-*.ts`, `run-fibonacci-*.ts`
  - Removido `run-multi-timeframe-backtest.ts` (coberto por compare-timeframes.ts)
  - Total: 14 arquivos obsoletos removidos
- **Resumo executivo adicionado** no início do documento para novos chats
- **Documentação da estrutura de CLI** atualizada com scripts ativos

### v1.6.0 (2026-01-31)
- **Pesquisa de melhores práticas adicionada (Seção 13):**
  - Walk-Forward Optimization para prevenir overfitting
  - Monte Carlo Simulation para validação estatística
  - Bayesian Optimization para searches eficientes (>100K combos)
  - Market Regime Detection para configs adaptativas
  - Custos realistas (slippage, funding rates)
  - Métricas adicionais (Sortino, Calmar, Ulcer Index)
- **Auditoria de código existente (Seção 14):**
  - Descoberto que WalkForwardOptimizer já existe e está pronto
  - Descoberto que MonteCarloSimulator já existe e está pronto
  - ParameterSensitivityAnalyzer e PermutationTest também disponíveis
  - NÃO criar pacote separado - código já organizado no backend
- **Limpeza de código:**
  - Removido `optimize-master.ts` (obsoleto)
  - Removido `optimize-volume-filter.ts` (obsoleto)
- **TODOs priorizados:**
  - Integrar WalkForward e MonteCarlo com CLI (alta prioridade)
  - Criar CLI de validação de resultados (alta prioridade)
  - Bayesian Optimization (baixa prioridade - só se precisar full mode)

### v1.5.0 (2026-01-31)
- **Sistema de otimização principal definido:** `optimize-trailing-stop.ts`
  - Este é o único sistema de otimização oficial do projeto
  - Scripts obsoletos serão removidos para evitar confusão
- **README.md criado** para documentar o sistema
- **Performance otimizada:**
  - 82,944 combinações em ~80 minutos (3 anos de dados)
  - 735 trades reais (vs 178 anterior)
  - 324K 5m klines processados
- **Configs unificadas:**
  - Parâmetros em arquivo centralizado
  - Modos: quick, medium, full
  - Fácil extensão para novos parâmetros
- **Próximos passos de performance:**
  - Paralelização com worker threads
  - Cache de indicadores
  - Early exit para combinações ruins

### v1.4.0 (2026-01-31)
- **Capital atualizado:**
  - `initialCapital`: $10,000 → **$1,000**
  - `capitalPerTrade`: 80% → **100%**
- **CLI de otimização criada:** `optimize-trailing-stop.ts`
  - Suporte a quick-test (25 combinações) e full (5000+ combinações)
  - Download automático de klines para date range especificado
  - Cálculo de Sharpe ratio e Max Drawdown
  - Score composto para ranking
- **Seção 11 adicionada:** Aplicação dos Resultados Ótimos
  - Procedimento para atualizar defaults do sistema
  - Queries SQL para atualizar banco de dados
  - CLI para aplicação automática
- **Validação aprovada:** Quick test passou com 25 combinações

### v1.3.0 (2026-01-31)
- **Implementação inicial concluída:**
  - `GranularPriceIndex` - índice eficiente para lookup de klines 5m
  - `SafeLogger` - controle de output com níveis e limites
  - `TrailingStopSimulator` - reutiliza `trailing-stop-core.ts`
  - `validate-trailing-backtest.ts` - CLI de validação
- Tipos reutilizam `@marketmind/types` (BacktestMetrics, etc.)
- Branch criada: `feature/trailing-stop-backtest-simulation`

### v1.2.0 (2026-01-31)
- Adicionado **Modo de Validação** obrigatório antes do backtest completo
- Adicionado **Controle de Output** (SafeLogger) para evitar overflow
- Definidos níveis de log: silent, summary, verbose
- Checklist de validação com critérios de aprovação
- Progress reporting com ETA e best results
- Limite de linhas no console para evitar travamentos

### v1.1.0 (2026-01-31)
- Alterado timeframe principal de 4h para **2h**
- Alterado timeframe granular de 1m para **5m** (mais eficiente, menos ruído)
- Adicionada **otimização independente por direção** (LONG/SHORT)
- Parâmetros separados: activation, distance, ATR multiplier por direção
- Atualizada estimativa de dados: ~315K candles (vs 1.5M anterior)

### v1.0.0 (2026-01-31)
- Criação do plano inicial
- Definição de arquitetura
- Listagem de parâmetros a testar
- Cronograma de 4 semanas

---

## Próximos Passos Imediatos

### Fase Atual: Otimização 3 Anos (Em Execução)
- [x] Sistema de otimização principal criado (`optimize-trailing-stop.ts`)
- [x] Download automático de klines implementado
- [x] Validação aprovada (quick test passou)
- [🔄] Otimização 3 anos rodando (82,944 combinações)

### Próxima Fase: Validação de Robustez
1. **Após otimização completar:**
   - [ ] Analisar top 10 configurações
   - [ ] Verificar se há overfitting (configs muito específicas)
   - [ ] Comparar LONG vs SHORT performance

2. **Implementar Walk-Forward Optimization:**
   - [ ] Dividir dados em janelas (6 meses in-sample, 2 meses out-of-sample)
   - [ ] Re-otimizar em cada janela
   - [ ] Verificar consistência das configs ótimas

3. **Implementar Monte Carlo Validation:**
   - [ ] Rodar 1000 simulações com trade shuffling
   - [ ] Calcular intervalos de confiança (95%)
   - [ ] Rejeitar configs onde P5 é negativo

### Fase Final: Aplicação dos Resultados
4. **Aplicar configuração ótima:**
   - [ ] Atualizar defaults no código
   - [ ] Atualizar configs no banco de dados
   - [ ] Testar em paper trading

5. **Arquitetura (Médio Prazo):**
   - [ ] Criar pacote `@marketmind/backtesting`
   - [ ] Migrar engine e otimizadores
   - [ ] Desacoplar de dependências do backend

---

## 12. Fase Final: Auditoria e Documentação do Sistema

> **Objetivo:** Após completar TODAS as fases do plano, realizar uma auditoria completa do sistema, atualizando toda a documentação e removendo qualquer conteúdo obsoleto.

### 12.1 Escopo da Auditoria

**Apps a Auditar:**
| App | Localização | Itens a Documentar |
|-----|-------------|-------------------|
| `electron` | `apps/electron/` | Componentes, hooks, stores, features |
| `backend` | `apps/backend/` | Routers, services, CLI scripts, utils |

**Pacotes a Auditar:**
| Pacote | Localização | Itens a Documentar |
|--------|-------------|-------------------|
| `@marketmind/types` | `packages/types/` | Tipos exportados, interfaces principais |
| `@marketmind/indicators` | `packages/indicators/` | Funções de indicadores, uso |
| `@marketmind/logger` | `packages/logger/` | Sistema de logging, buffers |

### 12.2 Documentação a Atualizar

**Documentos Principais:**
```
docs/
├── CLAUDE.md                      # Instruções para AI - ATUALIZAR
├── OPTIMIZATION_MASTER_PLAN.md    # Este plano - MANTER ATUALIZADO
├── IMPLEMENTATION_PLAN.md         # Roadmap geral - REVISAR/ATUALIZAR
├── BACKEND_QUICKSTART.md          # Guia backend - REVISAR
├── BACKEND_INTEGRATION_STATUS.md  # Status integração - ATUALIZAR
└── [outros]                       # AVALIAR obsolescência
```

**READMEs por Módulo:**
```
apps/
├── electron/README.md             # Frontend - ATUALIZAR
├── backend/README.md              # Backend - ATUALIZAR
└── backend/src/cli/README-OPTIMIZATION.md  # CLI otimização - ATUALIZAR

packages/
├── types/README.md                # Tipos - ATUALIZAR/CRIAR
├── indicators/README.md           # Indicadores - ATUALIZAR/CRIAR
└── logger/README.md               # Logger - ATUALIZAR/CRIAR
```

### 12.3 Checklist de Auditoria por Módulo

#### Apps/Electron (Frontend)
- [ ] Listar todos os componentes e suas responsabilidades
- [ ] Documentar hooks customizados (useBackend*, useChart*, etc.)
- [ ] Documentar stores Zustand (uiStore, chartStore, etc.)
- [ ] Documentar integração com backend (tRPC client)
- [ ] Atualizar CLAUDE.md com padrões atuais do frontend
- [ ] Verificar se todos os componentes têm traduções (i18n)

#### Apps/Backend (Backend)
- [ ] Listar todos os routers tRPC e endpoints
- [ ] Documentar services principais (auto-trading, backtesting, etc.)
- [ ] Documentar CLI scripts ativos e seus usos
- [ ] Documentar schema do banco (Drizzle)
- [ ] Documentar utils e helpers
- [ ] Atualizar CLAUDE.md com padrões atuais do backend

#### Packages/Types
- [ ] Listar todos os tipos exportados
- [ ] Documentar interfaces principais (Kline, Trade, Setup, etc.)
- [ ] Verificar se há tipos não utilizados (remover)
- [ ] Garantir que tipos estão bem organizados por domínio

#### Packages/Indicators
- [ ] Listar todos os indicadores disponíveis
- [ ] Documentar parâmetros e retornos de cada função
- [ ] Exemplos de uso
- [ ] Verificar se há código duplicado (consolidar)

#### Packages/Logger
- [ ] Documentar sistema de logging
- [ ] Documentar buffers (watcher-buffer, etc.)
- [ ] Documentar níveis de log e configurações

### 12.4 Remoção de Documentação Obsoleta

**Critérios para Remoção:**
1. Documento descreve feature que não existe mais
2. Documento descreve processo que foi substituído
3. Documento contém informações desatualizadas que podem confundir
4. README de módulo removido ou consolidado

**Processo de Remoção:**
```bash
# 1. Listar todos os docs
find docs/ -name "*.md" -type f

# 2. Para cada doc, verificar:
#    - Última atualização (git log)
#    - Se referencia código que ainda existe
#    - Se está linkado em outros docs

# 3. Docs obsoletos:
#    - Remover do git
#    - Atualizar links em outros docs
#    - Commitar com mensagem clara
```

**Documentos Candidatos a Remoção (avaliar após plano):**
- [ ] Docs de features removidas
- [ ] Docs de scripts deletados
- [ ] Docs de processos antigos
- [ ] READMEs de diretórios vazios

### 12.5 Atualização do CLAUDE.md

**Seções a Revisar:**
1. **Tech Stack** - Atualizar versões e novas dependências
2. **Project Structure** - Refletir estrutura atual
3. **Backend Integration** - Atualizar status e padrões
4. **Testing Approach** - Atualizar com novos padrões de teste
5. **Current Development Phase** - Atualizar progresso
6. **Quick Reference** - Revisar convenções

**Novas Seções a Adicionar:**
- [ ] Backtesting System - Como usar o sistema de backtest
- [ ] Optimization CLI - Comandos disponíveis
- [ ] Market Indicators - Nova sidebar, toggle button e indicadores (Fear & Greed, BTC.D, etc.)
- [ ] Strategy System - 106 estratégias e como testar

### 12.6 Entregáveis da Fase de Documentação

| Entregável | Descrição | Status |
|------------|-----------|--------|
| CLAUDE.md atualizado | Instruções AI completas e atuais | [ ] |
| READMEs por módulo | Cada app/package com README atualizado | [ ] |
| Docs obsoletos removidos | Nenhum doc desatualizado no repo | [ ] |
| Changelog atualizado | CHANGELOG.md com todas as mudanças | [ ] |
| API Documentation | Endpoints tRPC documentados | [ ] |
| CLI Documentation | Scripts de otimização documentados | [ ] |

### 12.7 Timeline Estimada

| Tarefa | Duração Estimada |
|--------|------------------|
| Auditoria Apps | 2-3 horas |
| Auditoria Packages | 1-2 horas |
| Atualização READMEs | 2-3 horas |
| Atualização CLAUDE.md | 1-2 horas |
| Remoção docs obsoletos | 1 hora |
| Revisão final | 1 hora |
| **Total** | **8-12 horas** |

---

## 13. Otimização de Entry Levels e Risk:Reward

> **Contexto:** Com trailing stop funcionando, podemos reconsiderar as regras de entrada.
> A regra atual de 61.8% de recuo mínimo impede trades de rompimento (breakout).
> Talvez possamos entrar mais cedo e deixar o trailing stop proteger os lucros.

### 13.1 Configurações Atuais

```typescript
// packages/types/src/trading-config.ts
MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT: 61.8,  // Máximo progresso permitido para entry

// packages/types/src/trading-config.ts
MIN_RISK_REWARD_RATIO: 1.0,       // R:R mínimo geral
MIN_RISK_REWARD_RATIO_LONG: 1.0,  // R:R mínimo para LONG
MIN_RISK_REWARD_RATIO_SHORT: 1.0, // R:R mínimo para SHORT

// packages/types/src/filter-defaults.ts
fibonacciTargetLevelLong: '1',      // TP em 100% extensão para LONG
fibonacciTargetLevelShort: '1.272', // TP em 127.2% extensão para SHORT
```

### 13.2 Problema Atual

```
Cenário: Setup de rompimento (breakout)

Preço atual: $100 (já rompeu o swing high de $98)
Swing Low: $90
Nível 61.8%: $95.05

Regra atual: Preço $100 > Nível 61.8% $95.05 → ENTRY BLOQUEADO ❌
Resultado: Perdemos o trade de rompimento

Com trailing stop, poderíamos:
- Entrar em $100 (breakout)
- SL em $95 (abaixo do último swing)
- Ativar trailing desde o início
- Se continuar subindo, trailing protege
- Se reverter, SL limita perda
```

### 13.3 Parâmetros a Otimizar

| Parâmetro | Atual | Ranges a Testar |
|-----------|-------|-----------------|
| `maxFibEntryProgress` | 61.8% | 0%, 38.2%, 50%, 61.8%, 78.6%, 100% (breakout) |
| `minRiskRewardLong` | 1.0 | 0.5, 0.75, 1.0, 1.5, 2.0 |
| `minRiskRewardShort` | 1.0 | 0.5, 0.75, 1.0, 1.5, 2.0 |
| `fibTargetLevelLong` | 1.0 | 1.0, 1.272, 1.618, 2.0 |
| `fibTargetLevelShort` | 1.272 | 1.0, 1.272, 1.618, 2.0 |
| `trailingActivationLong` | [a definir] | 0% (imediato), 30%, 50%, 70% |
| `trailingActivationShort` | [a definir] | 0% (imediato), 30%, 50%, 70% |

### 13.4 Cenários de Teste

#### Cenário A: Pullback Tradicional (atual)
```
Entry: Espera recuo até 61.8%
R:R: Mínimo 1.0
Trailing: Ativa em 70-80% do TP
Resultado esperado: Menos trades, maior win rate
```

#### Cenário B: Breakout com Trailing Imediato
```
Entry: Permite até 100% (breakout)
R:R: Mínimo 0.5 (aceita R:R pior)
Trailing: Ativa imediatamente (0%)
Resultado esperado: Mais trades, trailing compensa R:R ruim
```

#### Cenário C: Híbrido
```
Entry: Permite até 78.6%
R:R: Mínimo 0.75
Trailing: Ativa em 30% do TP
Resultado esperado: Balanceado
```

### 13.5 Métricas de Comparação

Para cada combinação, medir:
1. **Total Trades** - Quantos trades são gerados
2. **Win Rate** - % de vencedores
3. **Avg Win / Avg Loss** - Tamanho médio dos ganhos vs perdas
4. **PnL Total** - Lucro absoluto
5. **Sharpe Ratio** - Retorno ajustado ao risco
6. **Max Drawdown** - Perda máxima
7. **Recovery Time** - Tempo para recuperar drawdowns
8. **Trailing Exits** - % de trades que saíram por trailing (não TP/SL)

### 13.6 CLI para Otimização

**Arquivo:** `apps/backend/src/cli/optimize-entry-levels.ts`

```bash
# Testar diferentes níveis de entry
pnpm tsx src/cli/optimize-entry-levels.ts \
  --entry-levels=0,38.2,50,61.8,78.6,100 \
  --rr-min=0.5,0.75,1.0,1.5 \
  --trailing-activation=0,30,50,70

# Quick test
pnpm tsx src/cli/optimize-entry-levels.ts --quick-test

# Comparar breakout vs pullback
pnpm tsx src/cli/optimize-entry-levels.ts --compare-strategies
```

### 13.7 Hipóteses a Validar

| Hipótese | Teste |
|----------|-------|
| Breakout + trailing imediato > Pullback tradicional | Comparar PnL e Sharpe |
| R:R 0.5 com trailing > R:R 2.0 sem trailing | Comparar Sharpe |
| Ativação imediata de trailing é melhor para breakouts | Testar activation 0% vs 70% |
| LONG e SHORT precisam configs diferentes | Otimizar separadamente |

---

## 14. Otimização do Filtro de Tendência (antiga Seção 13)

> **Contexto:** Atualmente usamos EMA21 simples para determinar tendência do BTC.
> Nas versões anteriores, usávamos uma combinação de EMA21 + MACD + RSI com scoring ponderado.
> Precisamos testar qual método realmente funciona melhor com o sistema completo (incluindo trailing stop).

### 13.1 Métodos a Testar

#### Método 1: EMA Simples (Atual)
```typescript
// btc-correlation-filter.ts - getEma21Direction()
const direction = price > ema21 ? 'BULLISH' : 'BEARISH';
```
- **Prós:** Simples, rápido, fácil de entender
- **Contras:** Pode gerar muitos falsos sinais em consolidação

#### Método 2: Combinado EMA + MACD + RSI (Versão Anterior)
```typescript
// Scoring ponderado:
const SCORE_WEIGHTS = {
  emaPosition: 40,    // Preço acima/abaixo EMA21
  macdMomentum: 30,   // MACD histogram bullish/bearish
  rsiMomentum: 20,    // RSI subindo/descendo
  rsiLevel: 10,       // RSI acima/abaixo de 50
};

// Thresholds assimétricos:
LONG_BLOCK_SCORE: 35,   // Bloqueia LONG se score < 35
SHORT_BLOCK_SCORE: 65,  // Bloqueia SHORT se score > 65
```
- **Prós:** Mais robusto, considera momentum
- **Contras:** Mais complexo, mais parâmetros para otimizar

#### Método 3: ADX + Trend Direction
```typescript
// ADX mede força da tendência, não direção
const adx = calculateADX(klines, 14);
const plusDI = calculatePlusDI(klines, 14);
const minusDI = calculateMinusDI(klines, 14);

const isTrending = adx > 25;
const direction = plusDI > minusDI ? 'BULLISH' : 'BEARISH';
```
- **Prós:** Bom para filtrar consolidações
- **Contras:** Pode ser lento para reagir a reversões

#### Método 4: EMAs Múltiplas
```typescript
// Usar stack de EMAs
const ema9 = calculateEMA(klines, 9);
const ema21 = calculateEMA(klines, 21);
const ema50 = calculateEMA(klines, 50);

// Bullish: price > ema9 > ema21 > ema50
// Bearish: price < ema9 < ema21 < ema50
```
- **Prós:** Confirma tendência forte
- **Contras:** Muito conservador, pode perder oportunidades

### 13.2 Parâmetros a Otimizar

| Método | Parâmetros | Ranges de Teste |
|--------|-----------|-----------------|
| EMA Simples | período | 9, 13, 21, 34, 50, 100, 200 |
| Combinado | weights, thresholds | Grid search nos 4 weights + 2 thresholds |
| ADX | período, threshold | período: 10-20, threshold: 20-30 |
| EMAs Múltiplas | períodos | (9,21,50), (13,34,89), (20,50,200) |

### 13.3 Métricas de Avaliação

Para cada método, medir:
1. **Win Rate por Direção** - % de trades vencedores LONG vs SHORT
2. **PnL por Direção** - Lucro total LONG vs SHORT
3. **Trades Bloqueados Corretamente** - Trades que seriam perdedores
4. **Trades Bloqueados Incorretamente** - Trades que seriam vencedores
5. **Sharpe Ratio Geral** - Retorno ajustado ao risco

### 13.4 Processo de Otimização

```
1. BASELINE (Sem Filtro de Tendência)
   └── Rodar backtest com trailing otimizado, SEM filtro de tendência
   └── Medir PnL, Sharpe, WinRate base

2. TESTAR CADA MÉTODO
   Para cada método (EMA, Combinado, ADX, Multi-EMA):
   ├── Para cada combinação de parâmetros:
   │   ├── Rodar backtest completo
   │   ├── Comparar com baseline
   │   └── Registrar melhoria/piora
   └── Eleger melhor config do método

3. COMPARAR MÉTODOS
   └── Ranking dos 4 métodos com suas melhores configs
   └── Eleger método vencedor

4. VALIDAÇÃO
   └── Walk-Forward no método vencedor
   └── Monte Carlo no método vencedor
   └── Se passar, adotar como padrão do sistema
```

### 13.5 CLI para Otimização de Trend Filter

**Arquivo:** `apps/backend/src/cli/optimize-trend-filter.ts`

```bash
# Testar método EMA simples com vários períodos
pnpm tsx src/cli/optimize-trend-filter.ts --method=ema --periods=9,21,50

# Testar método combinado
pnpm tsx src/cli/optimize-trend-filter.ts --method=combined

# Testar ADX
pnpm tsx src/cli/optimize-trend-filter.ts --method=adx

# Comparar todos os métodos
pnpm tsx src/cli/optimize-trend-filter.ts --compare-all
```

---

## 15. Aplicação das Configs Ótimas como Default do Sistema

> **Objetivo:** Após descobrir as melhores configurações para TUDO (trailing stop, filtro de tendência,
> timeframe, estratégias), aplicar automaticamente como defaults em TODOS os lugares do sistema.

### 14.1 Configs a Aplicar

| Config | Origem | Destinos |
|--------|--------|----------|
| **Trailing Stop LONG** | Seção 5 otimização | `trailing-stop-core.ts`, DB `trading_profiles`, UI defaults |
| **Trailing Stop SHORT** | Seção 5 otimização | `trailing-stop-core.ts`, DB `trading_profiles`, UI defaults |
| **Filtro de Tendência** | Seção 13 otimização | `btc-correlation-filter.ts`, `direction-filter.ts` |
| **Timeframe Ótimo** | Backtests comparativos | `shared-backtest-config.ts`, UI defaults |
| **Estratégias Eleitas** | Seção 6 screening | `enabled-strategies` defaults, UI |
| **Filtros Habilitados** | Backtests de filtros | `filter-orchestrator.ts` defaults |

### 14.2 Locais de Configuração no Sistema

```
apps/backend/
├── src/
│   ├── constants/
│   │   └── defaults.ts                    # ⭐ NOVO: Defaults centralizados
│   ├── services/
│   │   ├── trailing-stop-core.ts          # Params trailing
│   │   └── auto-trading/
│   │       └── filter-validator.ts        # Quais filtros habilitados
│   ├── utils/filters/
│   │   ├── btc-correlation-filter.ts      # Método de tendência
│   │   └── direction-filter.ts            # EMA period
│   └── db/
│       └── seeds/                         # ⭐ Seed com defaults ótimos

apps/electron/
├── src/renderer/
│   ├── constants/
│   │   └── trading-defaults.ts            # Defaults UI
│   └── components/Trading/
│       └── [forms com defaults]

packages/types/
└── src/
    └── defaults.ts                        # ⭐ Tipos dos defaults
```

### 14.3 Script de Aplicação Automática

**Arquivo:** `apps/backend/src/cli/apply-optimized-configs.ts`

```bash
# Ver configs ótimas encontradas (dry-run)
pnpm tsx src/cli/apply-optimized-configs.ts --dry-run

# Aplicar em arquivos de código
pnpm tsx src/cli/apply-optimized-configs.ts --apply-code

# Aplicar no banco de dados
pnpm tsx src/cli/apply-optimized-configs.ts --apply-db

# Aplicar tudo
pnpm tsx src/cli/apply-optimized-configs.ts --apply-all
```

### 14.4 Arquivo de Resultados Ótimos

**Arquivo:** `apps/backend/optimization-results/optimal-config.json`

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-02-XX",
  "validationPassed": true,

  "trailingStop": {
    "long": {
      "activationPercent": 80,
      "distancePercent": 35,
      "atrMultiplier": 1.5,
      "breakevenProfitThreshold": 0.5
    },
    "short": {
      "activationPercent": 70,
      "distancePercent": 30,
      "atrMultiplier": 1.5,
      "breakevenProfitThreshold": 0.5
    }
  },

  "trendFilter": {
    "method": "combined",
    "params": {
      "emaPeriod": 21,
      "weights": { "emaPosition": 40, "macdMomentum": 30, "rsiMomentum": 20, "rsiLevel": 10 },
      "thresholds": { "longBlock": 35, "shortBlock": 65 }
    }
  },

  "timeframe": "2h",

  "enabledFilters": [
    "btc-correlation",
    "volume",
    "momentum-timing",
    "choppiness"
  ],

  "electedStrategies": [
    "larry-williams-9.1",
    "larry-williams-9.2",
    "momentum-breakout-2025",
    "..."
  ]
}
```

### 14.5 Checklist de Aplicação

- [ ] Gerar `optimal-config.json` com resultados da otimização
- [ ] Atualizar `trailing-stop-core.ts` com params ótimos
- [ ] Atualizar `btc-correlation-filter.ts` com método ótimo
- [ ] Atualizar `direction-filter.ts` com EMA period ótimo
- [ ] Atualizar defaults no banco (trading_profiles)
- [ ] Atualizar defaults na UI (trading-defaults.ts)
- [ ] Atualizar `shared-backtest-config.ts` com timeframe ótimo
- [ ] Commitar tudo com mensagem clara
- [ ] Criar tag de release com versão otimizada

---

## 16. Order Book Integration (Feature Futura)

> **Contexto:** A Binance oferece dados de order book (bids/asks) que podem ser usados
> para criar indicadores de pressão compradora/vendedora e validar entradas.

### 16.1 Dados Disponíveis na Binance API

| Endpoint | Descrição | Rate Limit |
|----------|-----------|------------|
| `GET /fapi/v1/depth` | Order book snapshot | 5-50 req/min |
| `@depth` WebSocket | Updates em tempo real | Ilimitado |
| `@bookTicker` WebSocket | Melhor bid/ask | Ilimitado |
| `GET /fapi/v1/aggTrades` | Trades agregados | 20 req/min |

### 16.2 O Que Já Usamos (Relacionado)

| Indicador | Status | Arquivo |
|-----------|--------|---------|
| Funding Rate | ✅ | `funding-rate-service.ts` |
| Open Interest | ✅ | `binance-futures-data.ts` |
| Liquidations | ✅ | `IndicatorEngine.ts` |
| Long/Short Ratio | ✅ | `binance-futures-data.ts` |
| Delta Volume | ✅ | `calculateDeltaVolume()` |

### 16.3 Novos Indicadores Propostos

#### Imbalance Ratio (Desequilíbrio de Ordens)
```typescript
interface OrderBookImbalance {
  ratio: number;        // -1 a 1 (negativo = pressão vendedora)
  bidVolume: number;    // Volume total de bids
  askVolume: number;    // Volume total de asks
  spreadPercent: number; // Bid-ask spread em %
}

const calculateImbalance = (bids: Order[], asks: Order[]): number => {
  const bidVol = bids.reduce((sum, b) => sum + b.quantity, 0);
  const askVol = asks.reduce((sum, a) => sum + a.quantity, 0);
  return (bidVol - askVol) / (bidVol + askVol);
};

// Interpretação:
// > 0.3: Forte pressão compradora → Favorece LONG
// < -0.3: Forte pressão vendedora → Favorece SHORT
// Entre -0.3 e 0.3: Neutro
```

#### Liquidity Walls (Muros de Liquidez)
```typescript
interface LiquidityWall {
  price: number;
  volume: number;
  type: 'BID' | 'ASK';
  distancePercent: number; // Distância do preço atual
}

// Detectar ordens grandes (> 2x média)
const detectWalls = (orders: Order[], avgSize: number): LiquidityWall[] => {
  return orders
    .filter(o => o.quantity > avgSize * 2)
    .map(o => ({ ...o, distancePercent: (o.price - currentPrice) / currentPrice * 100 }));
};

// Uso: Validar SL/TP próximos a muros
```

#### Order Book Velocity
```typescript
interface OrderBookVelocity {
  bidAddRate: number;     // Ordens bid adicionadas/s
  bidRemoveRate: number;  // Ordens bid removidas/s
  askAddRate: number;
  askRemoveRate: number;
  netFlow: number;        // Fluxo líquido (positivo = mais bids)
}

// Alta velocidade + direção consistente = movimento iminente
```

### 16.4 Novo Filtro: `useOrderBookFilter`

```typescript
interface OrderBookFilterConfig {
  enabled: boolean;
  minImbalanceRatio: number;      // Default: 0.2
  maxSpreadPercent: number;       // Default: 0.1%
  minLiquidityScore: number;      // Default: 50
  wallDetectionMultiplier: number; // Default: 2.0
}

// Condições para LONG aprovado:
// 1. imbalanceRatio > minImbalanceRatio
// 2. spreadPercent < maxSpreadPercent
// 3. Sem askWall próximo (< 1% de distância)

// Condições para SHORT aprovado:
// 1. imbalanceRatio < -minImbalanceRatio
// 2. spreadPercent < maxSpreadPercent
// 3. Sem bidWall próximo (< 1% de distância)
```

### 16.5 Integração com Market Indicators Sidebar

```typescript
// Novo componente para sidebar
components/MarketIndicators/charts/
├── OrderFlowIndicator.tsx    // Gauge de pressão compradora/vendedora
├── LiquidityHeatmap.tsx      // Heatmap de bids/asks por nível
└── SpreadChart.tsx           // Histórico de spread

// Hook para dados
hooks/useOrderBookMetrics.ts
```

**Visualização Order Flow:**
```
┌─────────────────────────┐
│   ORDER FLOW            │
│   ████████░░░░  62%     │
│   BUY PRESSURE          │
│                         │
│   Spread: 0.02%         │
│   Bid Wall: -1.2%       │
│   Ask Wall: +2.5%       │
└─────────────────────────┘
```

### 16.6 Visualização no Canvas (Gráfico do Ativo)

Alguns indicadores de Order Book podem ser visualizados diretamente no gráfico de preços:

#### Indicadores para Canvas

| Indicador | Tipo de Visualização | Descrição |
|-----------|---------------------|-----------|
| **Liquidity Walls** | Linhas horizontais | Níveis com alta liquidez (suporte/resistência) |
| **Imbalance Histogram** | Barras laterais | Histograma de pressão compradora/vendedora |
| **Spread Band** | Área sombreada | Visualização do bid-ask spread |
| **Order Flow Delta** | Barras coloridas | CVD estilo footprint |

#### Liquidity Walls no Canvas
```typescript
// Renderer: LiquidityWallsRenderer.ts
interface LiquidityWallsRenderOptions {
  showBidWalls: boolean;      // Linhas verdes (suporte)
  showAskWalls: boolean;      // Linhas vermelhas (resistência)
  minWallSize: number;        // Filtro de tamanho mínimo
  maxWalls: number;           // Máximo de linhas (default: 5)
  lineStyle: 'solid' | 'dashed';
  showLabels: boolean;        // Mostrar volume no label
  opacity: number;            // 0.3 - 0.8
}

// Visualização no canvas:
// ═══════════════════════════ ASK WALL $105,200 (250 BTC) ═══════
//          ┌──────────┐
//          │  CANDLE  │
//          └──────────┘
// ═══════════════════════════ BID WALL $103,800 (180 BTC) ═══════
```

#### Imbalance Histogram (Lateral)
```typescript
// Renderer: ImbalanceHistogramRenderer.ts
interface ImbalanceHistogramOptions {
  position: 'left' | 'right';  // Lado do gráfico
  width: number;               // Largura em pixels (default: 60)
  colorBuy: string;            // Verde para pressão compradora
  colorSell: string;           // Vermelho para pressão vendedora
  levels: number;              // Níveis de preço (default: 20)
}

// Visualização no canvas:
// ████████░░ 80% buy  | $105,500
// ██████░░░░ 60% buy  | $105,400
// ░░░░░░░░░░ neutral  | $105,300
// ░░░░██████ 60% sell | $105,200
// ░░████████ 80% sell | $105,100
```

#### Toggle no Seletor de Indicadores

> **IMPORTANTE:** Todos os indicadores de Order Book vêm **DESATIVADOS por padrão**.
> São indicadores avançados que consomem recursos (WebSocket) e devem ser ativados
> manualmente pelo usuário quando necessário.

```typescript
// packages/types/src/indicator-config.ts
interface IndicatorToggleConfig {
  // ... indicadores existentes ...

  // Order Book Indicators (novo grupo - TODOS desativados por padrão)
  orderBook: {
    liquidityWalls: boolean;      // Default: false ❌
    imbalanceHistogram: boolean;  // Default: false ❌
    spreadBand: boolean;          // Default: false ❌
    orderFlowDelta: boolean;      // Default: false ❌
  };
}

// Defaults explícitos
const ORDER_BOOK_DEFAULTS: IndicatorToggleConfig['orderBook'] = {
  liquidityWalls: false,
  imbalanceHistogram: false,
  spreadBand: false,
  orderFlowDelta: false,
};

// UI: IndicatorTogglePopover.tsx
// Adicionar nova seção "Order Book" com os toggles
// Mostrar badge "Advanced" ou ícone de warning para indicar consumo de recursos
```

#### Estrutura de Arquivos (Canvas)

```
apps/electron/src/renderer/
├── components/Chart/
│   └── renderers/
│       ├── LiquidityWallsRenderer.ts    # Linhas de muros
│       ├── ImbalanceHistogramRenderer.ts # Histograma lateral
│       ├── SpreadBandRenderer.ts        # Banda de spread
│       └── OrderFlowDeltaRenderer.ts    # CVD footprint style
├── hooks/
│   └── useOrderBookCanvas.ts            # Hook para dados canvas
└── store/
    └── indicatorStore.ts                # Adicionar toggles orderBook
```

#### Exemplo Visual Completo

```
┌─────────────────────────────────────────────────────────────────┐
│ BTCUSDT 2h                                    [📊] [⚡] [📈]   │
├────┬────────────────────────────────────────────────────────────┤
│    │ ════════════════ ASK WALL $105,500 (320 BTC) ════════════ │
│ 80%│              ┌──────┐                                      │
│ 60%│          ┌───┤      │                                      │
│ 40%│      ┌───┤   │      ├───┐                                  │
│ 20%│  ┌───┤   │   │      │   ├───┐     ┌───┐                    │
│  0%│──┴───┴───┴───┴──────┴───┴───┴─────┴───┴────────────────   │
│-20%│                                        ├───┤               │
│-40%│                                    ┌───┤   │               │
│    │ ════════════════ BID WALL $103,200 (280 BTC) ════════════ │
├────┴────────────────────────────────────────────────────────────┤
│ Imbalance: +62% BUY | Spread: 0.02% | Walls: 2 bid, 1 ask       │
└─────────────────────────────────────────────────────────────────┘
```

#### Checklist de Implementação (Canvas)

- [ ] Criar `LiquidityWallsRenderer.ts` com linhas horizontais
- [ ] Criar `ImbalanceHistogramRenderer.ts` com barras laterais
- [ ] Adicionar grupo "Order Book" no `IndicatorTogglePopover`
- [ ] Adicionar toggles ao `indicatorStore` (Zustand)
- [ ] Criar `useOrderBookCanvas.ts` para dados em tempo real
- [ ] Integrar renderers no `ChartCanvas` principal
- [ ] Adicionar opções de configuração (cores, opacidade, etc.)
- [ ] Testar performance com updates frequentes

#### Performance e Otimização (Canvas)

> **CRÍTICO:** Order Book tem updates muito frequentes (100ms). Sem otimização
> adequada, vai causar lag, re-renders excessivos e consumo de CPU/memória.

**Estratégias de Performance:**

```typescript
// 1. THROTTLING DE UPDATES
// Não re-renderizar a cada update do WebSocket
const RENDER_THROTTLE_MS = 250; // Máximo 4 renders/segundo

const useOrderBookCanvas = () => {
  const [data, setData] = useState<OrderBookData | null>(null);
  const lastRenderRef = useRef(0);

  useEffect(() => {
    const handleUpdate = (update: OrderBookUpdate) => {
      const now = Date.now();
      if (now - lastRenderRef.current < RENDER_THROTTLE_MS) return;

      lastRenderRef.current = now;
      setData(processUpdate(update));
    };

    return subscribe(handleUpdate);
  }, []);

  return data;
};

// 2. MEMOIZAÇÃO DE CÁLCULOS PESADOS
const useLiquidityWalls = (orderBook: OrderBookData) => {
  return useMemo(() => {
    if (!orderBook) return [];
    return detectLiquidityWalls(orderBook.bids, orderBook.asks);
  }, [orderBook?.lastUpdateId]); // Só recalcula se updateId mudar
};

// 3. CACHE COM SHALLOW COMPARE
// Evitar re-renders se dados não mudaram significativamente
const areWallsEqual = (prev: LiquidityWall[], next: LiquidityWall[]) => {
  if (prev.length !== next.length) return false;
  return prev.every((wall, i) =>
    Math.abs(wall.price - next[i].price) < 0.01 && // Tolera 0.01% de diferença
    Math.abs(wall.volume - next[i].volume) < wall.volume * 0.05 // 5% de volume
  );
};

// 4. LAZY CONNECTION
// Só conectar WebSocket quando indicador estiver ativo
const useOrderBookConnection = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    const ws = connectOrderBookStream();
    return () => ws.close();
  }, [enabled]);
};

// 5. OFFSCREEN CANVAS (para histograma)
// Renderizar em canvas separado e copiar para principal
const renderHistogramOffscreen = (data: ImbalanceData) => {
  const offscreen = new OffscreenCanvas(60, 400);
  const ctx = offscreen.getContext('2d')!;
  // ... render ...
  return offscreen.transferToImageBitmap();
};

// 6. RAF (RequestAnimationFrame) BATCHING
// Agrupar múltiplos renders em um único frame
const useAnimationFrame = (callback: () => void, deps: unknown[]) => {
  const rafRef = useRef<number>();

  useEffect(() => {
    const animate = () => {
      callback();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current!);
  }, deps);
};
```

**Limites de Recursos:**

| Recurso | Limite | Motivo |
|---------|--------|--------|
| Updates/segundo | 4 max | Evitar CPU spike |
| Níveis de preço | 20 max | Limitar memória |
| Walls renderizados | 5 max | Evitar poluição visual |
| WebSocket connections | 1 por símbolo | Rate limit |
| Cache TTL | 500ms | Balance atualização/performance |

**Checklist de Performance:**
- [ ] Implementar throttle de 250ms nos updates
- [ ] Usar `useMemo` para cálculos de walls
- [ ] Implementar shallow compare para evitar re-renders
- [ ] Lazy connection (só conectar se indicador ativo)
- [ ] Usar OffscreenCanvas para histograma
- [ ] Batch renders com RAF
- [ ] Limitar a 20 níveis de preço
- [ ] Desconectar WebSocket quando indicador desativado
- [ ] Profile com React DevTools antes de deploy

### 16.7 Considerações Técnicas

| Aspecto | Solução |
|---------|---------|
| **Rate Limits** | Usar WebSocket para dados em tempo real |
| **Latência** | Cache local com TTL de 100-500ms |
| **Backtest** | Não é possível fazer backtest preciso (dados históricos caros) |
| **Spoofing** | Filtrar ordens muito grandes (> 5x média) que podem ser fake |
| **Memória** | Manter apenas top 20 níveis de cada lado |

### 16.7 Implementação Incremental

**Fase 1: Coleta de Dados**
- [ ] Criar `OrderBookService` com WebSocket connection
- [ ] Implementar cache local com merge de updates
- [ ] Criar testes de integração

**Fase 2: Indicadores**
- [ ] Implementar `calculateImbalance()`
- [ ] Implementar `detectLiquidityWalls()`
- [ ] Adicionar ao `IndicatorEngine`

**Fase 3: Filtro**
- [ ] Criar `order-book-filter.ts`
- [ ] Integrar com `FilterOrchestrator`
- [ ] Adicionar ao confluence scoring

**Fase 4: UI**
- [ ] Criar `OrderFlowIndicator.tsx`
- [ ] Adicionar à Market Indicators Sidebar
- [ ] Criar toggle em settings

### 16.8 Prioridade e Dependências

| Prioridade | Motivo |
|------------|--------|
| **Média-Baixa** | Não afeta backtest, difícil validar historicamente |
| **Depende de:** | Market Indicators Sidebar implementada |
| **Benefício:** | Confirmação adicional para trades em tempo real |

**Referências:**
- [Binance Order Book API](https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/websocket-api/Order-Book)
- [CoinGlass Order Depth Delta](https://www.coinglass.com/pro/depth-delta)
- [binance npm package](https://www.npmjs.com/package/binance)

---

**Assinatura:**
Claude Opus 4.5 + Nathan Santos
MarketMind Project - 2026
