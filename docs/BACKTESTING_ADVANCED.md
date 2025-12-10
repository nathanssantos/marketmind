# 🧪 Advanced Backtesting Guide - MarketMind

**Version:** 1.0  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Backtesting Best Practices](#backtesting-best-practices)
3. [Walk-Forward Analysis](#walk-forward-analysis)
4. [Monte Carlo Simulation](#monte-carlo-simulation)
5. [Parameter Sensitivity Analysis](#parameter-sensitivity-analysis)
6. [Out-of-Sample Testing](#out-of-sample-testing)
7. [Common Backtesting Biases](#common-backtesting-biases)
8. [Performance Metrics](#performance-metrics)
9. [Visual Backtesting](#visual-backtesting)
10. [Implementation Examples](#implementation-examples)

---

## Overview

Backtesting is the process of testing a trading strategy on historical data. However, most backtests are misleading due to biases and overfitting. This guide covers advanced techniques to create **robust, realistic backtests** that predict live performance.

### Goals

1. **Avoid Overfitting:** Ensure strategy works on unseen data
2. **Measure Robustness:** Test sensitivity to parameter changes
3. **Estimate Risk:** Calculate realistic drawdowns via Monte Carlo
4. **Validate Edge:** Prove statistical significance
5. **Visualize Performance:** Enable trade-by-trade analysis

### Key Principles

- **Never test on all data** - Always save out-of-sample data
- **Use walk-forward analysis** - Simulate real-world deployment
- **Account for slippage** - Be realistic about execution
- **Test multiple scenarios** - Monte Carlo for risk assessment
- **Measure stability** - Parameter sensitivity analysis

---

## Backtesting Best Practices

### 1. Data Quality

**Requirements:**
- High-quality tick or 1-minute data
- Include gaps and missing data (realistic)
- Adjust for splits, dividends (stocks)
- Verify timestamp accuracy

```typescript
interface DataQuality {
  startDate: Date
  endDate: Date
  totalBars: number
  missingBars: number
  dataQuality: number  // 0-1 score
}

function assessDataQuality(klines: Kline[]): DataQuality {
  const expectedBars = calculateExpectedBars(
    klines[0].openTime,
    klines.at(-1)!.closeTime,
    '1h'
  )
  
  const missingBars = expectedBars - klines.length
  const quality = klines.length / expectedBars
  
  return {
    startDate: new Date(klines[0].openTime),
    endDate: new Date(klines.at(-1)!.closeTime),
    totalBars: klines.length,
    missingBars,
    dataQuality: quality
  }
}
```

### 2. Transaction Costs

**Always include:**
- **Commission:** Typically 0.1% per side (0.2% round-trip)
- **Slippage:** 0.05-0.1% per trade
- **Spread:** Bid-ask spread cost
- **Funding Rates:** For perpetual futures

```typescript
interface TransactionCosts {
  commission: number       // 0.001 = 0.1%
  slippage: number         // 0.0005 = 0.05%
  spreadPercent: number    // 0.0003 = 0.03%
}

function calculateRealizedPrice(
  marketPrice: number,
  direction: 'BUY' | 'SELL',
  costs: TransactionCosts
): number {
  let realizedPrice = marketPrice
  
  // Apply slippage
  if (direction === 'BUY') {
    realizedPrice *= (1 + costs.slippage)
    realizedPrice *= (1 + costs.spreadPercent)
  } else {
    realizedPrice *= (1 - costs.slippage)
    realizedPrice *= (1 - costs.spreadPercent)
  }
  
  return realizedPrice
}

function calculateNetProfit(
  entry: number,
  exit: number,
  quantity: number,
  costs: TransactionCosts
): number {
  const grossProfit = (exit - entry) * quantity
  const totalCommission = (entry + exit) * quantity * costs.commission
  
  return grossProfit - totalCommission
}
```

### 3. Execution Realism

**Avoid look-ahead bias:**

```typescript
// ❌ WRONG: Using close price when signal appears
if (emaFast > emaSlow) {
  entry = kline.close  // You don't know close until bar closes!
}

// ✅ CORRECT: Entry at next bar's open
if (emaFast > emaSlow) {
  signal = 'BUY'
}
// Next iteration
if (signal === 'BUY') {
  entry = currentKline.open
  signal = null
}
```

**Limit orders:**
```typescript
// Can't assume limit fills
function checkLimitFill(
  limitPrice: number,
  direction: 'BUY' | 'SELL',
  kline: Kline
): boolean {
  if (direction === 'BUY') {
    return kline.low <= limitPrice  // Price reached
  } else {
    return kline.high >= limitPrice
  }
}
```

### 4. Position Sizing

**Use realistic sizing:**

```typescript
function calculateRealisticSize(
  balance: number,
  riskPercent: number,
  entry: number,
  stopLoss: number,
  maxPosition: number
): number {
  const riskAmount = balance * riskPercent
  const stopDistance = Math.abs(entry - stopLoss)
  let size = riskAmount / stopDistance
  
  // Cap at maximum position
  size = Math.min(size, maxPosition)
  
  // Round to exchange precision
  size = roundToPrecision(size, 0.001)  // 3 decimals for BTC
  
  return size
}
```

---

## Walk-Forward Analysis

### Concept

**Walk-Forward Analysis** simulates real-world deployment by:
1. Training on historical window
2. Testing on following unseen period
3. Rolling forward through time
4. Never using future data

### Implementation

```typescript
interface WalkForwardConfig {
  inSampleMonths: number    // Training window (e.g., 6 months)
  outSampleMonths: number   // Testing window (e.g., 2 months)
  stepMonths: number        // Roll forward by (e.g., 1 month)
  optimizeParams: boolean   // Re-optimize each window
}

interface WalkForwardResult {
  inSampleResults: BacktestResult[]
  outSampleResults: BacktestResult[]
  stability: number  // How consistent performance is
}

class WalkForwardAnalyzer {
  async runWalkForward(
    klines: Kline[],
    strategy: Strategy,
    config: WalkForwardConfig
  ): Promise<WalkForwardResult> {
    const inSampleResults: BacktestResult[] = []
    const outSampleResults: BacktestResult[] = []
    
    const windowSize = config.inSampleMonths * 30 * 24  // Hours
    const testSize = config.outSampleMonths * 30 * 24
    const step = config.stepMonths * 30 * 24
    
    let start = 0
    
    while (start + windowSize + testSize < klines.length) {
      // In-sample period (training)
      const inSample = klines.slice(start, start + windowSize)
      
      // Out-of-sample period (validation)
      const outSample = klines.slice(
        start + windowSize,
        start + windowSize + testSize
      )
      
      // Optimize on in-sample if enabled
      let params = strategy.params
      if (config.optimizeParams) {
        params = this.optimizeParameters(inSample, strategy)
      }
      
      // Test in-sample
      const inResult = await this.backtest(inSample, strategy, params)
      inSampleResults.push(inResult)
      
      // Test out-of-sample (realistic performance)
      const outResult = await this.backtest(outSample, strategy, params)
      outSampleResults.push(outResult)
      
      console.log(`Window ${inSampleResults.length}:`)
      console.log(`  In-sample Sharpe: ${inResult.sharpeRatio.toFixed(2)}`)
      console.log(`  Out-sample Sharpe: ${outResult.sharpeRatio.toFixed(2)}`)
      
      // Roll forward
      start += step
    }
    
    // Calculate stability
    const stability = this.calculateStability(outSampleResults)
    
    return {
      inSampleResults,
      outSampleResults,
      stability
    }
  }
  
  private calculateStability(results: BacktestResult[]): number {
    // Measure consistency of out-of-sample performance
    const sharpes = results.map(r => r.sharpeRatio)
    const avgSharpe = sharpes.reduce((a, b) => a + b) / sharpes.length
    const stdDev = Math.sqrt(
      sharpes.reduce((sum, s) => sum + Math.pow(s - avgSharpe, 2), 0) / sharpes.length
    )
    
    // Stability: higher mean, lower variance = better
    return avgSharpe / (stdDev + 0.01)
  }
  
  private optimizeParameters(
    klines: Kline[],
    strategy: Strategy
  ): StrategyParams {
    // Grid search or genetic algorithm
    // Return best parameters on this data
    return strategy.params  // Simplified
  }
}

// Usage
const wfAnalyzer = new WalkForwardAnalyzer()
const config: WalkForwardConfig = {
  inSampleMonths: 6,   // Train on 6 months
  outSampleMonths: 2,  // Test on 2 months
  stepMonths: 1,       // Roll forward by 1 month
  optimizeParams: true
}

const results = await wfAnalyzer.runWalkForward(klines, strategy, config)

console.log(`Average out-of-sample Sharpe: ${
  results.outSampleResults.reduce((s, r) => s + r.sharpeRatio, 0) / 
  results.outSampleResults.length
}`)
```

### Interpreting Results

```typescript
function analyzeWalkForward(result: WalkForwardResult): Analysis {
  const inAvg = average(result.inSampleResults.map(r => r.sharpeRatio))
  const outAvg = average(result.outSampleResults.map(r => r.sharpeRatio))
  
  const degradation = (inAvg - outAvg) / inAvg
  
  if (degradation > 0.50) {
    return {
      verdict: 'OVERFITTED',
      message: 'In-sample performance >>50% better than out-of-sample'
    }
  } else if (degradation > 0.30) {
    return {
      verdict: 'MODERATE_OVERFIT',
      message: 'Some overfitting detected, reduce complexity'
    }
  } else if (degradation > 0.10) {
    return {
      verdict: 'ACCEPTABLE',
      message: 'Reasonable performance degradation'
    }
  } else {
    return {
      verdict: 'ROBUST',
      message: 'Strategy performs consistently on unseen data'
    }
  }
}
```

---

## Monte Carlo Simulation

### Concept

Monte Carlo simulation tests strategy robustness by:
1. Randomly reordering historical trades
2. Running thousands of simulations
3. Generating distribution of outcomes
4. Calculating probabilistic risk metrics

### Implementation

```typescript
interface MonteCarloConfig {
  iterations: number        // Default: 1000
  confidenceLevel: number   // Default: 0.95 (95%)
}

interface MonteCarloResult {
  expectedReturn: number
  worstCase5th: number      // 5th percentile
  bestCase95th: number      // 95th percentile
  maxDrawdownDistribution: number[]
  sharpeDistribution: number[]
  probabilityOfRuin: number
}

class MonteCarloSimulator {
  runSimulation(
    trades: Trade[],
    initialBalance: number,
    config: MonteCarloConfig
  ): MonteCarloResult {
    const results: SimulationResult[] = []
    
    for (let i = 0; i < config.iterations; i++) {
      // Randomly reorder trades
      const shuffled = this.shuffleTrades([...trades])
      
      // Simulate equity curve
      const equity = this.simulateEquity(shuffled, initialBalance)
      
      results.push({
        finalBalance: equity.at(-1)!,
        maxDrawdown: this.calculateMaxDrawdown(equity),
        sharpe: this.calculateSharpe(equity),
        returnPct: (equity.at(-1)! - initialBalance) / initialBalance
      })
    }
    
    // Sort for percentile calculations
    const sortedReturns = results.map(r => r.returnPct).sort((a, b) => a - b)
    const sortedDrawdowns = results.map(r => r.maxDrawdown).sort((a, b) => a - b)
    const sortedSharpes = results.map(r => r.sharpe).sort((a, b) => a - b)
    
    return {
      expectedReturn: this.average(sortedReturns),
      worstCase5th: sortedReturns[Math.floor(config.iterations * 0.05)],
      bestCase95th: sortedReturns[Math.floor(config.iterations * 0.95)],
      maxDrawdownDistribution: sortedDrawdowns,
      sharpeDistribution: sortedSharpes,
      probabilityOfRuin: this.calculateRuin(results, initialBalance)
    }
  }
  
  private shuffleTrades(trades: Trade[]): Trade[] {
    // Fisher-Yates shuffle
    for (let i = trades.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [trades[i], trades[j]] = [trades[j], trades[i]]
    }
    return trades
  }
  
  private simulateEquity(trades: Trade[], initial: number): number[] {
    const equity = [initial]
    let balance = initial
    
    for (const trade of trades) {
      balance += trade.profit
      equity.push(balance)
      
      if (balance <= 0) {
        // Ruin - fill rest with 0
        while (equity.length <= trades.length) {
          equity.push(0)
        }
        break
      }
    }
    
    return equity
  }
  
  private calculateMaxDrawdown(equity: number[]): number {
    let maxDD = 0
    let peak = equity[0]
    
    for (const value of equity) {
      if (value > peak) peak = value
      const dd = (peak - value) / peak
      if (dd > maxDD) maxDD = dd
    }
    
    return maxDD
  }
  
  private calculateSharpe(equity: number[]): number {
    const returns: number[] = []
    
    for (let i = 1; i < equity.length; i++) {
      returns.push((equity[i] - equity[i-1]) / equity[i-1])
    }
    
    const avgReturn = this.average(returns)
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    )
    
    return avgReturn / (stdDev || 0.0001)
  }
  
  private calculateRuin(results: SimulationResult[], initial: number): number {
    const ruined = results.filter(r => r.finalBalance <= initial * 0.10).length
    return ruined / results.length
  }
  
  private average(arr: number[]): number {
    return arr.reduce((a, b) => a + b, 0) / arr.length
  }
}

// Usage
const mcSimulator = new MonteCarloSimulator()
const trades = getHistoricalTrades()

const mcResult = mcSimulator.runSimulation(
  trades,
  100000,  // $100k initial
  { iterations: 1000, confidenceLevel: 0.95 }
)

console.log('Monte Carlo Results:')
console.log(`Expected Return: ${(mcResult.expectedReturn * 100).toFixed(1)}%`)
console.log(`5th Percentile (worst case): ${(mcResult.worstCase5th * 100).toFixed(1)}%`)
console.log(`95th Percentile (best case): ${(mcResult.bestCase95th * 100).toFixed(1)}%`)
console.log(`Probability of Ruin: ${(mcResult.probabilityOfRuin * 100).toFixed(2)}%`)

// Visualize distribution
const ddPercentiles = [0.50, 0.75, 0.90, 0.95, 0.99]
console.log('Max Drawdown Distribution:')
for (const p of ddPercentiles) {
  const idx = Math.floor(mcResult.maxDrawdownDistribution.length * p)
  const dd = mcResult.maxDrawdownDistribution[idx]
  console.log(`  ${(p * 100)}th percentile: ${(dd * 100).toFixed(1)}%`)
}
```

### Risk Metrics

```typescript
interface RiskMetrics {
  valueAtRisk95: number     // VaR at 95% confidence
  conditionalVaR: number    // Expected loss beyond VaR
  maxDrawdown95: number     // 95th percentile max DD
  probabilityProfit: number // P(profit > 0)
}

function calculateRiskMetrics(mcResult: MonteCarloResult): RiskMetrics {
  const returns = [...mcResult.sharpeDistribution].sort((a, b) => a - b)
  const drawdowns = [...mcResult.maxDrawdownDistribution].sort((a, b) => b - a)
  
  // Value at Risk (95% confidence)
  const var95Idx = Math.floor(returns.length * 0.05)
  const var95 = returns[var95Idx]
  
  // Conditional VaR (average of worst 5%)
  const worstReturns = returns.slice(0, var95Idx)
  const cvar = worstReturns.reduce((a, b) => a + b, 0) / worstReturns.length
  
  // Max DD at 95th percentile
  const dd95Idx = Math.floor(drawdowns.length * 0.95)
  const maxDD95 = drawdowns[dd95Idx]
  
  // Probability of profit
  const profitable = returns.filter(r => r > 0).length
  const probProfit = profitable / returns.length
  
  return {
    valueAtRisk95: var95,
    conditionalVaR: cvar,
    maxDrawdown95: maxDD95,
    probabilityProfit: probProfit
  }
}
```

---

## Parameter Sensitivity Analysis

### Concept

Test how strategy performance changes with parameter variations. Robust strategies should:
- Work across range of parameters
- Not have single optimal value
- Show smooth performance surface

### Implementation

```typescript
interface ParameterRange {
  name: string
  min: number
  max: number
  step: number
}

interface SensitivityResult {
  parameter: string
  value: number
  sharpe: number
  winRate: number
  profitFactor: number
  maxDrawdown: number
}

class ParameterSensitivityAnalyzer {
  async analyzeParameter(
    klines: Kline[],
    strategy: Strategy,
    param: ParameterRange
  ): Promise<SensitivityResult[]> {
    const results: SensitivityResult[] = []
    
    for (let value = param.min; value <= param.max; value += param.step) {
      // Update parameter
      const testParams = { ...strategy.params, [param.name]: value }
      
      // Run backtest
      const result = await this.backtest(klines, strategy, testParams)
      
      results.push({
        parameter: param.name,
        value,
        sharpe: result.sharpeRatio,
        winRate: result.winRate,
        profitFactor: result.profitFactor,
        maxDrawdown: result.maxDrawdown
      })
      
      console.log(`${param.name}=${value}: Sharpe ${result.sharpeRatio.toFixed(2)}`)
    }
    
    return results
  }
  
  async analyze2DParameter(
    klines: Kline[],
    strategy: Strategy,
    param1: ParameterRange,
    param2: ParameterRange
  ): Promise<Map<string, SensitivityResult>> {
    const results = new Map<string, SensitivityResult>()
    
    for (let v1 = param1.min; v1 <= param1.max; v1 += param1.step) {
      for (let v2 = param2.min; v2 <= param2.max; v2 += param2.step) {
        const testParams = {
          ...strategy.params,
          [param1.name]: v1,
          [param2.name]: v2
        }
        
        const result = await this.backtest(klines, strategy, testParams)
        
        const key = `${v1},${v2}`
        results.set(key, {
          parameter: `${param1.name},${param2.name}`,
          value: 0,  // N/A for 2D
          sharpe: result.sharpeRatio,
          winRate: result.winRate,
          profitFactor: result.profitFactor,
          maxDrawdown: result.maxDrawdown
        })
      }
    }
    
    return results
  }
  
  assessRobustness(results: SensitivityResult[]): RobustnessScore {
    const sharpes = results.map(r => r.sharpe)
    const avgSharpe = sharpes.reduce((a, b) => a + b) / sharpes.length
    const maxSharpe = Math.max(...sharpes)
    const minSharpe = Math.min(...sharpes)
    
    // Good strategy: avg close to max (not one spike)
    const robustness = avgSharpe / maxSharpe
    
    // Also check variance
    const variance = sharpes.reduce((sum, s) => 
      sum + Math.pow(s - avgSharpe, 2), 0
    ) / sharpes.length
    
    return {
      robustness,  // > 0.80 is good
      variance,    // < 0.5 is good
      spread: maxSharpe - minSharpe,
      verdict: robustness > 0.80 && variance < 0.5 ? 'ROBUST' : 'FRAGILE'
    }
  }
}

// Usage
const analyzer = new ParameterSensitivityAnalyzer()

// Test EMA period
const emaResults = await analyzer.analyzeParameter(
  klines,
  strategy,
  { name: 'emaPeriod', min: 5, max: 50, step: 5 }
)

const robustness = analyzer.assessRobustness(emaResults)
console.log(`Robustness Score: ${robustness.robustness.toFixed(2)}`)
console.log(`Verdict: ${robustness.verdict}`)

// 2D heatmap: EMA period vs ATR multiplier
const heatmap = await analyzer.analyze2DParameter(
  klines,
  strategy,
  { name: 'emaPeriod', min: 10, max: 30, step: 5 },
  { name: 'atrMultiplier', min: 1.0, max: 3.0, step: 0.5 }
)
```

### Visualization

```typescript
function generateHeatmap(results: Map<string, SensitivityResult>): void {
  // Convert to 2D array for visualization
  const data: number[][] = []
  
  results.forEach((result, key) => {
    const [x, y] = key.split(',').map(Number)
    if (!data[x]) data[x] = []
    data[x][y] = result.sharpe
  })
  
  // Render heatmap (pseudo-code)
  // In MarketMind, use Canvas API or Chart library
  console.table(data)
}
```

---

## Out-of-Sample Testing

### Train/Validate/Test Split

```typescript
interface DataSplit {
  train: Kline[]    // 60% - optimize parameters
  validate: Kline[] // 20% - select best model
  test: Kline[]     // 20% - final evaluation (NEVER touch until end)
}

function splitData(klines: Kline[]): DataSplit {
  const trainEnd = Math.floor(klines.length * 0.60)
  const validateEnd = Math.floor(klines.length * 0.80)
  
  return {
    train: klines.slice(0, trainEnd),
    validate: klines.slice(trainEnd, validateEnd),
    test: klines.slice(validateEnd)
  }
}

// Workflow:
// 1. Optimize on TRAIN
// 2. Evaluate variations on VALIDATE
// 3. Final test on TEST (ONCE ONLY)
```

### K-Fold Cross-Validation

```typescript
function kFoldCrossValidation(
  klines: Kline[],
  strategy: Strategy,
  k: number = 5
): CrossValidationResult[] {
  const foldSize = Math.floor(klines.length / k)
  const results: CrossValidationResult[] = []
  
  for (let i = 0; i < k; i++) {
    const testStart = i * foldSize
    const testEnd = (i + 1) * foldSize
    
    // Use fold i as test set
    const testData = klines.slice(testStart, testEnd)
    
    // Use all other folds as training
    const trainData = [
      ...klines.slice(0, testStart),
      ...klines.slice(testEnd)
    ]
    
    // Optimize on training
    const params = optimizeParameters(trainData, strategy)
    
    // Test on validation fold
    const result = backtest(testData, strategy, params)
    results.push(result)
  }
  
  return results
}
```

---

## Common Backtesting Biases

### 1. Look-Ahead Bias

**Problem:** Using future information not available at trade time.

```typescript
// ❌ WRONG: Using bar close for entry
if (ema[i] > ema[i-1]) {
  entry = klines[i].close  // Don't know close until bar ends!
}

// ✅ CORRECT: Next bar open
if (ema[i] > ema[i-1]) {
  signal = 'BUY'
}
entry = klines[i+1].open  // Next bar
```

### 2. Survivorship Bias

**Problem:** Only testing on assets that still exist.

**Solution:** Include delisted/failed assets in data.

```typescript
// Crypto: Include coins that went to zero
// Stocks: Include bankrupt companies
```

### 3. Optimization Bias (Curve Fitting)

**Problem:** Over-optimizing parameters to fit historical data.

**Solution:** Use walk-forward, limit parameters, test out-of-sample.

```typescript
// ❌ BAD: 10 parameters optimized on all data
// ✅ GOOD: 2-3 parameters, walk-forward validated
```

### 4. Data Mining Bias

**Problem:** Testing hundreds of strategies, only showing best.

**Solution:** Test ONE strategy, document all results.

```typescript
// Keep log of ALL strategies tested
// Report honestly: "Tested 10 strategies, 7 failed, 3 promising"
```

### 5. Ignoring Transaction Costs

**Problem:** Not accounting for commissions, slippage, spreads.

**Solution:** Always include realistic costs.

```typescript
const profit = (exit - entry) * quantity - (entry + exit) * quantity * 0.001
// Always subtract commission
```

---

## Performance Metrics

### Essential Metrics

```typescript
interface BacktestMetrics {
  // Return metrics
  totalReturn: number
  annualizedReturn: number
  cagr: number
  
  // Risk metrics
  maxDrawdown: number
  volatility: number
  sharpeRatio: number
  sortinoRatio: number
  
  // Trade metrics
  totalTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  
  // Consistency
  winningMonths: number
  losingMonths: number
  maxConsecutiveWins: number
  maxConsecutiveLosses: number
}

class MetricsCalculator {
  calculate(trades: Trade[], initialBalance: number): BacktestMetrics {
    const equity = this.buildEquityCurve(trades, initialBalance)
    const returns = this.calculateReturns(equity)
    
    const wins = trades.filter(t => t.profit > 0)
    const losses = trades.filter(t => t.profit < 0)
    
    const totalReturn = (equity.at(-1)! - initialBalance) / initialBalance
    const tradingDays = this.calculateTradingDays(trades)
    const years = tradingDays / 365
    
    return {
      totalReturn,
      annualizedReturn: totalReturn / years,
      cagr: Math.pow(1 + totalReturn, 1 / years) - 1,
      
      maxDrawdown: this.calculateMaxDrawdown(equity),
      volatility: this.calculateVolatility(returns),
      sharpeRatio: this.calculateSharpe(returns),
      sortinoRatio: this.calculateSortino(returns),
      
      totalTrades: trades.length,
      winRate: wins.length / trades.length,
      avgWin: this.average(wins.map(t => t.profit)),
      avgLoss: Math.abs(this.average(losses.map(t => t.profit))),
      profitFactor: this.calculateProfitFactor(wins, losses),
      
      winningMonths: this.countWinningMonths(trades),
      losingMonths: this.countLosingMonths(trades),
      maxConsecutiveWins: this.maxConsecutive(trades, 'win'),
      maxConsecutiveLosses: this.maxConsecutive(trades, 'loss')
    }
  }
  
  private calculateSharpe(returns: number[]): number {
    const avgReturn = this.average(returns)
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    )
    
    // Annualize (assuming daily returns)
    const annualizedReturn = avgReturn * 252
    const annualizedVol = stdDev * Math.sqrt(252)
    
    const riskFreeRate = 0.03  // 3%
    
    return (annualizedReturn - riskFreeRate) / annualizedVol
  }
  
  private calculateSortino(returns: number[]): number {
    const avgReturn = this.average(returns)
    
    // Only downside deviation
    const downside = returns.filter(r => r < 0)
    const downsideStdDev = Math.sqrt(
      downside.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / downside.length
    )
    
    const annualizedReturn = avgReturn * 252
    const annualizedDownsideVol = downsideStdDev * Math.sqrt(252)
    
    const riskFreeRate = 0.03
    
    return (annualizedReturn - riskFreeRate) / annualizedDownsideVol
  }
  
  private calculateProfitFactor(wins: Trade[], losses: Trade[]): number {
    const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0)
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0))
    
    return grossProfit / (grossLoss || 1)
  }
}
```

---

## Visual Backtesting

### Trade Replay

```typescript
interface ReplayConfig {
  speed: number  // 1x, 2x, 10x
  showIndicators: boolean
  showTrades: boolean
  pauseOnTrade: boolean
}

class BacktestReplayer {
  private currentIndex = 0
  private isPlaying = false
  
  async replay(
    klines: Kline[],
    trades: Trade[],
    config: ReplayConfig
  ): Promise<void> {
    this.currentIndex = 0
    this.isPlaying = true
    
    while (this.isPlaying && this.currentIndex < klines.length) {
      const currentKline = klines[this.currentIndex]
      
      // Render chart up to current index
      this.renderChart(klines.slice(0, this.currentIndex + 1))
      
      // Check for trades at this timestamp
      const tradesAtTime = trades.filter(t => 
        t.entryTime === currentKline.openTime ||
        t.exitTime === currentKline.closeTime
      )
      
      if (tradesAtTime.length > 0) {
        this.highlightTrades(tradesAtTime)
        
        if (config.pauseOnTrade) {
          await this.pause()
        }
      }
      
      // Wait based on speed
      await this.sleep(1000 / config.speed)
      
      this.currentIndex++
    }
  }
  
  private renderChart(klines: Kline[]): void {
    // Use existing ChartCanvas component
    // Draw klines, indicators, trade markers
  }
  
  private highlightTrades(trades: Trade[]): void {
    // Draw entry/exit arrows
    // Show profit/loss tooltip
    // Update equity curve
  }
}
```

### Equity Curve Visualization

```typescript
function renderEquityCurve(
  trades: Trade[],
  initialBalance: number,
  canvas: HTMLCanvasElement
): void {
  const ctx = canvas.getContext('2d')!
  const equity = buildEquityCurve(trades, initialBalance)
  
  // Draw baseline
  ctx.strokeStyle = '#666'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, canvas.height / 2)
  ctx.lineTo(canvas.width, canvas.height / 2)
  ctx.stroke()
  
  // Draw equity curve
  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 2
  ctx.beginPath()
  
  for (let i = 0; i < equity.length; i++) {
    const x = (i / equity.length) * canvas.width
    const y = canvas.height - ((equity[i] - initialBalance) / initialBalance) * canvas.height
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  
  ctx.stroke()
  
  // Mark drawdown periods
  this.highlightDrawdowns(equity, ctx, canvas)
}
```

---

## Implementation Examples

### Complete Backtest Engine

```typescript
class AdvancedBacktestEngine {
  async runComprehensiveBacktest(
    klines: Kline[],
    strategy: Strategy
  ): Promise<ComprehensiveResult> {
    console.log('Starting comprehensive backtest...')
    
    // 1. Basic backtest
    console.log('1/5: Running basic backtest...')
    const basic = await this.basicBacktest(klines, strategy)
    
    // 2. Walk-forward analysis
    console.log('2/5: Running walk-forward analysis...')
    const walkForward = await this.walkForwardAnalysis(klines, strategy)
    
    // 3. Monte Carlo simulation
    console.log('3/5: Running Monte Carlo simulation...')
    const monteCarlo = this.monteCarloSimulation(basic.trades, 100000)
    
    // 4. Parameter sensitivity
    console.log('4/5: Running parameter sensitivity...')
    const sensitivity = await this.parameterSensitivity(klines, strategy)
    
    // 5. Out-of-sample test
    console.log('5/5: Running out-of-sample test...')
    const outOfSample = await this.outOfSampleTest(klines, strategy)
    
    // Generate report
    return this.generateReport({
      basic,
      walkForward,
      monteCarlo,
      sensitivity,
      outOfSample
    })
  }
  
  private generateReport(results: any): ComprehensiveResult {
    return {
      summary: {
        sharpeRatio: results.basic.sharpeRatio,
        maxDrawdown: results.basic.maxDrawdown,
        winRate: results.basic.winRate,
        profitFactor: results.basic.profitFactor,
        
        walkForwardStability: results.walkForward.stability,
        monteCarloWorstCase: results.monteCarlo.worstCase5th,
        sensitivityRobustness: results.sensitivity.robustness,
        outOfSampleDegradation: this.calculateDegradation(
          results.basic,
          results.outOfSample
        )
      },
      
      recommendation: this.getRecommendation(results),
      
      fullResults: results
    }
  }
  
  private getRecommendation(results: any): string {
    const checks = [
      results.basic.sharpeRatio > 1.5,
      results.walkForward.stability > 0.80,
      results.monteCarlo.probabilityOfRuin < 0.05,
      results.sensitivity.robustness > 0.75,
      results.outOfSample.degradation < 0.30
    ]
    
    const passed = checks.filter(c => c).length
    
    if (passed >= 4) {
      return 'EXCELLENT - Strategy is robust and ready for live trading'
    } else if (passed >= 3) {
      return 'GOOD - Strategy shows promise, continue paper trading'
    } else if (passed >= 2) {
      return 'FAIR - Strategy needs improvement before live trading'
    } else {
      return 'POOR - Strategy not recommended for live trading'
    }
  }
}
```

---

## Conclusion

Comprehensive backtesting requires:

1. **Walk-Forward Analysis** - Simulate real deployment
2. **Monte Carlo Simulation** - Understand risk distribution
3. **Parameter Sensitivity** - Ensure robustness
4. **Out-of-Sample Testing** - Validate on unseen data
5. **Avoid Biases** - Realistic costs, no look-ahead

**Remember:** A backtest is only as good as its assumptions. Be conservative, be realistic, be honest.

---

**Next Steps:**
1. Implement walk-forward on your strategy
2. Run Monte Carlo to understand worst-case scenarios
3. Test parameter sensitivity
4. Reserve 20% data for final out-of-sample test
5. Document ALL results (even failures)

**Related Documentation:**
- `ADVANCED_STRATEGIES.md` - Strategies to backtest
- `POSITION_MANAGEMENT.md` - Rules to test
- `RISK_OPTIMIZATION.md` - Kelly Criterion validation
