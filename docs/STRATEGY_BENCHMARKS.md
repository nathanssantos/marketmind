# Strategy Benchmarks Research

> Last Updated: 2025-12-07
> Source: Industry research and backtesting studies

## Industry Standard Metrics

| Metric | Poor | Acceptable | Good | Excellent |
|--------|------|------------|------|-----------|
| **Sharpe Ratio** | < 0.75 | 0.75-1.0 | 1.0-2.0 | > 2.0 |
| **Profit Factor** | < 1.0 | 1.0-1.5 | 1.5-2.0 | 2.0-4.0 |
| **Win Rate (Trend Following)** | < 30% | 30-40% | 40-50% | > 50% |
| **Win Rate (Mean Reversion)** | < 50% | 50-60% | 60-75% | > 75% |
| **Max Drawdown** | > 25% | 20-25% | 10-20% | < 10% |

### Important Notes
- Sharpe > 2 in backtests typically drops to 1.0-1.5 in live trading
- Profit Factor > 4 may indicate overfitting
- A strategy with 35% win rate can still be profitable with good R:R ratio
- Always add 20-30% safety margin for live trading

---

## Strategy Benchmarks

### 1. EMA Crossover (`ema-crossover`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 35-45% |
| Sharpe Ratio | 0.5-1.0 |
| Profit Factor | 1.0-1.5 |
| Best Settings | EMA 13/48 on 1H charts |

**Notes:**
- Underperforms buy-and-hold in most cases
- Works better in crypto than stocks
- SPY backtest: 3.06% CAGR vs 7.87% buy-and-hold
- Bitcoin shows better results than traditional markets

**Sources:**
- [Medium/Superalgos - Quantitative Study of EMA Cross](https://medium.com/superalgos/quantitative-study-of-the-ema-cross-trading-strategy-29d5ed655a4)
- [QuantifiedStrategies - 20 EMA Strategy](https://www.quantifiedstrategies.com/20-ema-trading-strategy/)

---

### 2. Mean Reversion BB+RSI (`mean-reversion-bb-rsi`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | ~35% (combined) |
| Sharpe Ratio | Low |
| Profit Factor | < 1.5 |

**Notes:**
- One of the WORST combined strategies tested
- BB alone: 55% win rate
- RSI alone: 49% win rate
- Combined: only 35% win rate!
- Had 11 false signals in a row during trends

**Sources:**
- [TradingRush - BB RSI Strategy Tested 100 Times](https://tradingrush.net/bollinger-bands-rsi-trading-strategy-tested-100-times-will-this-make-profit-for-you/)

---

### 3. RSI Oversold Bounce (`rsi-oversold-bounce`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 60-75% |
| Sharpe Ratio | 2.0-3.0 |
| Profit Factor | 3.0+ |
| Best Settings | RSI 2 period |

**Notes:**
- RSI 2 on QQQ: 75% win rate, Sharpe 2.85, PF 3.15
- CAGR 12.75% vs 9% buy-and-hold
- Works better in crypto than stocks
- Entry threshold at RSI < 10 gives best edge
- Performed 98.9% return in 2008/09 crisis

**Sources:**
- [QuantifiedStrategies - RSI Trading Strategy 91% Win Rate](https://www.quantifiedstrategies.com/rsi-trading-strategy/)
- [QuantifiedStrategies - RSI Mean Reversion QQQ](https://www.quantifiedstrategies.com/rsi-mean-reversion-trading-strategy/)

---

### 4. MACD Divergence (`macd-divergence`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 27-36% |
| Sharpe Ratio | 0.5-1.0 |
| Profit Factor | < 1.5 |

**Notes:**
- Bullish crossover: ~36% win rate
- Bearish crossover: ~27% win rate
- Improves significantly with RSI/volume filters
- Combined with RSI: ~50-55% accuracy
- Performance varies greatly by time period

**Sources:**
- [Medium - Bitcoin MACD Strategy 2023](https://medium.com/thecapital/bitcoin-backtest-how-effective-was-the-macd-strategy-in-2023-0f3a4e5dd6f0)
- [Medium/Coinmonks - Profitable Crypto MACD](https://medium.com/coinmonks/profitable-crypto-trading-strategies-part-7-macd-1-0-655712e37dd2)

---

### 5. ADX + EMA Trend (`adx-ema-trend`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 38-45% |
| Sharpe Ratio | 1.0-2.0 |
| Profit Factor | 1.5-2.0 |
| Best Settings | ADX > 25-26 threshold |

**Notes:**
- Low win rate but filtered trades are more profitable
- ADX filter helps avoid false signals
- Average trade value increases significantly with ADX filter
- Struggles with trend reversals

**Sources:**
- [ForexTester - ADX + EMA Strategy](https://forextester.com/blog/adx-14-ema-strategy/)
- [QuantifiedStrategies - Trend Following](https://www.quantifiedstrategies.com/trend-following-trading-strategy/)

---

### 6. CCI Trend Rider (`cci-trend-rider`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 50-53% |
| Total Return | 1108% over 20 years |
| Best Settings | CCI 50 on daily charts |

**Notes:**
- CCI 50 setting outperformed S&P 500 by 2x (1108% vs 555%)
- 43,297 trades tested
- Best on daily timeframe with short lookback (5-9 days)
- Standard CCI (20,100,-100) is unprofitable on most timeframes!

**Sources:**
- [LiberatedStockTrader - CCI Tests](https://www.liberatedstocktrader.com/commodity-channel-index/)
- [QuantifiedStrategies - CCI Trading Strategy](https://www.quantifiedstrategies.com/cci-trading-strategy/)

---

### 7. Donchian Breakout (`donchian-breakout`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 30-45% |
| Sharpe Ratio | 0.5-1.5 |
| Profit Factor | 1.5-2.0 |

**Notes:**
- 45% win rate is HIGH for trend-following (usually 30-35%)
- Works well on commodities and currencies, NOT stocks
- Suffers significantly in sideways markets
- Consider using as mean reversion for stocks (inverted logic)

**Sources:**
- [QuantifiedStrategies - Donchian Channel](https://www.quantifiedstrategies.com/donchian-channel/)
- [LuxAlgo - Donchian Channels Strategy](https://www.luxalgo.com/blog/donchian-channels-breakout-and-trend-following-strategy/)

---

### 8. Keltner Squeeze (`keltner-squeeze`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 54-77% |
| Sharpe Ratio | 1.0-2.0 |
| Profit Factor | 2.0 |
| CAGR | 6.3% |
| Best Settings | 6-day period, 1.3 ATR |

**Notes:**
- 77% win rate with 288 trades on S&P 500
- Performance declined after 2016
- BB/Keltner squeeze alone: 54% WR, initially -15.8% loss
- With stop-loss/take-profit: 87.65% profit

**Sources:**
- [QuantifiedStrategies - Keltner Bands 77% WinRate](https://www.quantifiedstrategies.com/keltner-bands-trading-strategies/)
- [Medium - Bollinger Bands Squeeze Study](https://medium.com/superalgos/a-quantitative-study-of-the-bollinger-bands-squeeze-strategy-9f47143f33fb)

---

### 9. OBV Divergence (`obv-divergence`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 46-73% |
| Sharpe Ratio | 0.5-1.5 |
| Profit Factor | 2.09 |
| Avg Gain/Trade | 0.55% |

**Notes:**
- 73% win rate with 337 trades
- Max drawdown 24%
- Volume alone is not optimal - combine with other indicators
- OBV breakout: 46% win rate, 35% excess returns vs buy-and-hold

**Sources:**
- [QuantifiedStrategies - On Balance Volume Strategy](https://www.quantifiedstrategies.com/on-balance-volume-strategy/)

---

### 10. Supertrend Follow (`supertrend-follow`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 43% |
| Sharpe Ratio | 1.0-1.5 |
| Profit Factor | 1.44 |
| Annualized ROI | 11.61% |

**Notes:**
- 46 trades, 43.48% profitable
- Avg holding time: 2 weeks 4 days
- Beat buy-and-hold until May 2021, then -94%
- Best with ATR 10-20, multiplier 3-6 for crypto

**Sources:**
- [Netpicks - Supertrend Settings Backtest](https://www.netpicks.com/supertrend-indicator/)
- [Vestinda - Supertrend Backtesting](https://www.vestinda.com/academy/supertrend-backtesting-strategies-unleashing-profit-potential)

---

### 11. Williams %R Momentum (`williams-momentum`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 44-81% |
| Sharpe Ratio | 1.5-2.5 |
| Profit Factor | 2.2 |
| CAGR | 11.9% |
| Max Drawdown | 17% |

**Notes:**
- 598 trades, market exposure only 22%
- Risk-adjusted return: 52%
- 2-day lookback period is best
- Performed 98.9% in 2008/09 crisis, 43.3% in COVID
- Does NOT work for shorts!
- Outperforms RSI and Stochastics

**Sources:**
- [QuantifiedStrategies - Williams %R 81% Win Rate](https://www.quantifiedstrategies.com/williams-r-trading-strategy/)
- [TradingRush - 100 Trades Williams %R](https://tradingrush.net/100-trades-with-williams-r-trading-strategy/)

---

### 12. VWAP Pullback (`vwap-pullback`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 29-30% |
| Reward/Risk | 4.1 |
| Best Chart | Heikin Ashi + 5min |

**Notes:**
- Standard chart: 30% win rate (not profitable)
- Heikin Ashi chart: 93% outperformance!
- Low win rate but high R:R compensates
- Best for intraday, resets at midnight UTC
- Not suitable for long-term trading

**Sources:**
- [LiberatedStockTrader - VWAP Tests](https://www.liberatedstocktrader.com/vwap-indicator/)
- [QuantifiedStrategies - VWAP Trading Strategy](https://www.quantifiedstrategies.com/vwap-trading-strategy/)

---

### 13. Triple EMA Confluence (`triple-ema-confluence`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 40-50% |
| Sharpe Ratio | 0.5-1.5 |
| Profit Factor | 1.0-1.5 |

**Notes:**
- TEMA has little predictive value
- What matters is holding time, not crossing signals
- Other moving averages perform BETTER
- Best periods: 9/21/55 or 5/9/21 for scalping
- Multiple confirmations reduce false signals but also reduce trades

**Sources:**
- [QuantifiedStrategies - Triple EMA TEMA](https://www.quantifiedstrategies.com/triple-exponential-moving-average-tema/)
- [Medium - Triple EMA Trend Following](https://medium.com/@redsword_23261/triple-ema-trend-following-quantitative-trading-strategy-cc7e23dc10a1)

---

### 14. Momentum Breakout (`momentum-breakout-2025`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 35-45% |
| Sharpe Ratio | 1.0-2.0 |
| Profit Factor | 1.5-2.5 |
| Max Drawdown | ~39% |

**Notes:**
- 7-day momentum is most stable for crypto
- 5-day average: CAGR up to 145% (optimized)
- Exponential averages work better than simple
- 1-day momentum leads to mean reversion (not continuation)
- 30-day momentum shows mean-reversion since Sept 2023

**Sources:**
- [QuantifiedStrategies - Trend Following Bitcoin](https://www.quantifiedstrategies.com/trend-following-and-momentum-on-bitcoin/)
- [ForexTester - Momentum Trading Strategies](https://forextester.com/blog/momentum-trading-strategies/)

---

## Newly Implemented Strategies (From Research)

### 15. RSI 2 Mean Reversion (`rsi2-mean-reversion`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 75% |
| Sharpe Ratio | 2.85 |
| Profit Factor | 3.15 |
| Best Settings | RSI 2, entry < 10 |

**Notes:**
- Larry Connors-style RSI 2 strategy
- Extremely short RSI period for high-probability oversold bounces
- Entry threshold at RSI < 10 gives best edge
- Works best with 200 SMA trend filter

**Sources:**
- [QuantifiedStrategies - RSI Trading Strategy](https://www.quantifiedstrategies.com/rsi-trading-strategy/)

---

### 16. Williams %R Reversal (`williams-r-reversal`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 44-81% |
| Sharpe Ratio | 1.5-2.5 |
| Profit Factor | 2.2 |
| CAGR | 11.9% |

**Notes:**
- 2-day lookback period is optimal
- Outperforms RSI and Stochastics in backtests
- Does NOT work for shorts - only longs!
- Performed 98.9% return in 2008/09 crisis

**Sources:**
- [QuantifiedStrategies - Williams %R 81% Win Rate](https://www.quantifiedstrategies.com/williams-r-trading-strategy/)

---

### 17. 7-Day Momentum Crypto (`7day-momentum-crypto`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 40-50% |
| CAGR | Up to 145% (optimized) |
| Max Drawdown | ~39% |

**Notes:**
- 7-day is the most stable momentum period for crypto
- Exponential averages work better than simple
- Uses EMA 8/21 for trend confirmation
- RSI filter 50-75 for momentum confirmation

**Sources:**
- [QuantifiedStrategies - Trend Following Bitcoin](https://www.quantifiedstrategies.com/trend-following-and-momentum-on-bitcoin/)

---

### 18. Keltner Breakout Optimized (`keltner-breakout-optimized`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 77% |
| Sharpe Ratio | 1.0-2.0 |
| Profit Factor | 2.0 |
| CAGR | 6.3% |

**Notes:**
- Uses 6-day EMA period (not standard 20!)
- Uses 1.3 ATR multiplier (not standard 2!)
- 288 trades backtested on S&P 500
- Performance declined after 2016

**Sources:**
- [QuantifiedStrategies - Keltner Bands 77% WinRate](https://www.quantifiedstrategies.com/keltner-bands-trading-strategies/)

---

### 19. CCI Optimized Daily (`cci-optimized-daily`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 53% |
| Total Return | 1108% over 20 years |
| Best Settings | CCI 50 on daily (NOT 20!) |

**Notes:**
- CCI 50 setting outperformed S&P 500 by 2x
- Standard CCI (20,100,-100) is UNPROFITABLE!
- 43,297 trades tested
- Best on daily timeframe with short lookback

**Sources:**
- [LiberatedStockTrader - CCI Tests](https://www.liberatedstocktrader.com/commodity-channel-index/)

---

### 20. Connors RSI 2 Original (`connors-rsi2-original`)

| Metric | Expected Value |
|--------|---------------|
| Win Rate | 75% |
| Sharpe Ratio | 2.0+ |
| Profit Factor | 3.0+ |
| Time in Market | 22% |

**Notes:**
- Original Larry Connors strategy from 2008 book
- Rules: RSI(2) < 5, above 200 SMA = long
- Exit: close > 5 SMA
- Connors advocates NO stops (we add for safety)
- Backtested over 34 years (1990-2024)

**Sources:**
- [StockCharts - RSI(2) Strategy](https://school.stockcharts.com/doku.php?id=trading_strategies:rsi2)
- [QuantifiedStrategies - Connors RSI](https://www.quantifiedstrategies.com/connors-rsi/)

---

## Strategies Identified But NOT Yet Implemented

### Future Implementation

1. **Heikin Ashi + VWAP**
   - Outperformance: 93%
   - R:R: 4.1
   - Requires Heikin Ashi candle calculation (not yet supported)

2. **Woodies CCI**
   - Advanced CCI system
   - Multiple patterns: ghost, zero line reject, sidewinder
   - Complex pattern recognition required

3. **Cumulative RSI**
   - Sum of RSI over N periods
   - Even better results than RSI 2 alone
   - 30.3% annual return reported

---

## Recommended Timeframes by Strategy

> Based on research from multiple sources. Using the correct timeframe is CRITICAL for strategy performance.

| Strategy | Primary Timeframe | Secondary | Notes |
|----------|------------------|-----------|-------|
| **RSI 2 / Connors RSI** | **Daily** | 4H | Connors tested exclusively on daily; 30m-1h for day trading |
| **Williams %R Reversal** | **Daily** | 4H | 14-period on daily is standard; 2-period for optimal results |
| **Keltner Breakout** | **Daily / 4H** | 1H | Daily for swing; 4H for position trading |
| **CCI Optimized** | **Daily** | 4H | Best on daily with 50 period; weekly for trend confirmation |
| **ADX Trend Following** | **Daily** | 4H, 1H | Daily for swing; 4H for medium-term |
| **Donchian/Turtle** | **Daily** | Weekly | Original Turtle used 20/55 day periods |
| **Supertrend** | **4H / Daily** | 1H | Crypto: 4H-Daily; Stocks: Weekly |
| **MACD** | **4H** | Daily, 1H | 4H is sweet spot; avoid <1H |
| **EMA Crossover (8/21)** | **Daily** | 4H, 1H | 1H minimum to avoid noise |
| **VWAP** | **Intraday (5-15m)** | 1m-30m | Resets daily; only for intraday |
| **OBV Volume** | **Daily** | 4H | Avoid short timeframes due to noise |
| **MFI** | **Daily** | 4H, 1H | 14-period on daily is optimal |
| **7-Day Momentum Crypto** | **4H / Daily** | 1H | Crypto-specific; 4H smooths whipsaws |

### Timeframe Guidelines

**Daily Timeframe (Recommended for most strategies):**
- Less noise, more reliable signals
- Best for mean-reversion (RSI, Williams %R)
- Most backtested data is from daily charts
- Connors strategies were ALL tested on daily

**4-Hour Timeframe:**
- Good balance between signal frequency and reliability
- Ideal for active traders who can't wait for daily signals
- Works well for Keltner, MACD, Supertrend

**1-Hour Timeframe:**
- More signals but more noise
- Requires tighter stops and faster reactions
- Use with caution for mean-reversion strategies

**Intraday (<1H):**
- Only recommended for VWAP and scalping strategies
- High noise, many false signals
- Requires different parameter settings

### Sources
- [StockCharts - RSI(2)](https://school.stockcharts.com/doku.php?id=trading_strategies:rsi2)
- [QuantifiedStrategies - Williams %R](https://www.quantifiedstrategies.com/williams-r-trading-strategy/)
- [The Robust Trader - Keltner Channel](https://therobusttrader.com/keltner-channel/)
- [QuantifiedStrategies - CCI Strategy](https://www.quantifiedstrategies.com/cci-trading-strategy/)
- [XS - ADX Indicator](https://www.xs.com/en/blog/adx-indicator/)
- [Lizard Indicators - Donchian/Turtle](https://www.lizardindicators.com/donchian-channel-strategy/)
- [Good Crypto - Supertrend](https://goodcrypto.app/supertrend-indicator-how-to-set-up-use-and-create-profitable-crypto-trading-strategy/)
- [OpoFinance - MACD 4H](https://blog.opofinance.com/en/best-macd-settings-for-4-hour-chart/)
- [StockCharts - EMA Crossover](https://chartschool.stockcharts.com/table-of-contents/trading-strategies-and-models/trading-strategies/moving-average-trading-strategies/using-the-5-8-13-ema-crossover-for-short-term-trades)
- [HighStrike - VWAP](https://highstrike.com/best-vwap-settings-for-day-trading/)
- [Liberated Stock Trader - OBV](https://www.liberatedstocktrader.com/obv-indicator/)
- [Liberated Stock Trader - MFI](https://www.liberatedstocktrader.com/money-flow-index/)

---

## Key Takeaways

### What Works Best
1. **RSI with short periods (2-7 days)** - Consistently high performance
2. **Williams %R** - Outperforms RSI and Stochastics
3. **Keltner Channel** - 77% win rate with proper settings
4. **ADX as filter** - Improves any trend strategy

### What Doesn't Work Well
1. **BB + RSI combined** - Worse than either alone
2. **MACD alone** - Low win rate, needs filters
3. **Triple EMA** - Little predictive value
4. **Standard indicator settings** - Almost always suboptimal

### Best Practices
1. Use shorter lookback periods (2-9 days) for oscillators
2. Daily timeframe generally outperforms intraday
3. Combine indicators strategically (don't just add them)
4. Always use ATR-based stops
5. Crypto requires different settings than stocks

---

## Sources Summary

### General Metrics
- [LuxAlgo - Top 5 Metrics](https://www.luxalgo.com/blog/top-5-metrics-for-evaluating-trading-strategies/)
- [QuantifiedStrategies - Trading Performance](https://www.quantifiedstrategies.com/trading-performance/)
- [QuantStrategy - Essential Backtesting Metrics](https://quantstrategy.io/blog/essential-backtesting-metrics-understanding-drawdown-sharpe/)
- [HighStrike - Good Sharpe Ratio 2025](https://highstrike.com/what-is-a-good-sharpe-ratio/)

### Strategy-Specific
- [QuantifiedStrategies](https://www.quantifiedstrategies.com/) - Multiple strategy backtests
- [TradingRush](https://tradingrush.net/) - 100-trade tests
- [ForexTester](https://forextester.com/blog/) - Forex strategy research
- [LiberatedStockTrader](https://www.liberatedstocktrader.com/) - Large-scale indicator testing
