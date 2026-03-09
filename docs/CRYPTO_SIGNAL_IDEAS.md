# Crypto Signal Ideas — Backlog

Alternativas ao GEX com valor real para crypto, para implementação futura como setups e/ou filtros de backtesting.

---

## 1. Liquidation Heatmaps

**O que é:** Mapa de onde estão concentrados os stops e liquidações do mercado em diferentes price levels. Exchanges como Binance e Bybit acumulam posições alavancadas com stops previsíveis — zonas de alta densidade de liquidações funcionam como magnetos de preço.

**Valor:** Price tende a "caçar" liquidações antes de reverter (liquidity grab). Identifica zonas de alta probabilidade de spike e reversão.

**Fontes de dados:** Hyblock, Coinglass (APIs pagas/limitadas). Alternativa: estimativa própria via open interest por strike em futuros.

**Possíveis aplicações no MarketMind:**
- Setup: entrada após liquidity sweep de uma zona densa
- Filtro: evitar entries com zona de liquidação imediatamente acima/abaixo

---

## 2. Funding Rate Extremes

**O que é:** Em futuros perpétuos, o funding rate é pago periodicamente entre longs e longs/shorts para ancorar o preço ao spot. Valores extremos (muito positivos ou negativos) indicam excesso de alavancagem em uma direção.

**Valor:** Funding rate extremo positivo = mercado excessivamente long = candidato a reversão ou correção. Negativo extremo = mercado excessivamente short = candidato a short squeeze. Historicamente confiável como filtro contrarian.

**Fontes de dados:** Binance API já disponível (`GET /fapi/v1/fundingRate`). Sem custo adicional.

**Possíveis aplicações no MarketMind:**
- Filtro de backtesting: `useFundingFilter` — só permite longs quando funding < threshold
- Setup: entrada contrarian quando funding atinge extremo histórico + sinal técnico confirmando

---

## 3. CVD Divergence (Cumulative Volume Delta)

**O que é:** CVD é a soma acumulada do delta de volume (volume de compra agressiva menos venda agressiva). Divergência entre CVD e preço indica absorção ou exaustão — o preço sobe mas o CVD cai, mostrando que o move é fraco internamente.

**Valor:** Um dos sinais de order flow mais confiáveis. Amplamente usado por traders institucionais e de tape reading. Detecta moves "falsos" antes de reverterem.

**Fontes de dados:** Calculável a partir de tick data ou trades (Binance WebSocket `aggTrade`). Requer acumulação própria — não disponível diretamente como kline.

**Possíveis aplicações no MarketMind:**
- Indicador no chart (CVD como sub-painel)
- Setup: divergência CVD/preço em zona de suporte/resistência
- Filtro: só permitir longs quando CVD confirma acumulação

---

## 4. Open Interest Spikes

**O que é:** Open interest (OI) é o número de contratos de futuros em aberto. Um spike de OI junto com move de preço indica entrada de capital novo (confirma o move). OI spike sem move de preço ou OI caindo durante move indica liquidações (move pode ser exaustão).

**Valor:** Diferencia moves sustentados de fake breakouts. OI crescendo + preço subindo = tendência saudável. OI caindo + preço subindo = short covering, não entrada nova — move fraco.

**Fontes de dados:** Binance API (`GET /fapi/v1/openInterest`, `/fapi/v1/openInterestHist`). Disponível sem custo.

**Possíveis aplicações no MarketMind:**
- Filtro de backtesting: `useOIConfirmation` — só permite breakout entries quando OI confirma
- Setup: OI spike + volume spike + breakout de estrutura = entrada
- Filtro: rejeitar setups quando OI cai durante o move que gerou o sinal

---

## Prioridade sugerida

| # | Feature | Dados | Complexidade | Valor estimado |
|---|---------|-------|-------------|----------------|
| 1 | Funding Rate Extremes | Binance API (grátis) | Baixa | Alto |
| 2 | Open Interest Spikes | Binance API (grátis) | Baixa | Alto |
| 3 | CVD Divergence | Tick data próprio | Alta | Alto |
| 4 | Liquidation Heatmaps | API paga/estimativa | Média-alta | Médio |

Funding rate e OI são os mais fáceis de começar — dados já disponíveis na Binance API que o projeto já usa.
