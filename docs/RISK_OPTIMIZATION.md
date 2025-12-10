# ⚖️ Risk Optimization & Kelly Criterion - MarketMind

**Version:** 1.0  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Kelly Criterion Mathematics](#kelly-criterion-mathematics)
3. [Practical Implementation](#practical-implementation)
4. [Portfolio Heat Management](#portfolio-heat-management)
5. [Risk Parity](#risk-parity)
6. [Correlation Management](#correlation-management)
7. [Volatility-Based Sizing](#volatility-based-sizing)
8. [Drawdown Management](#drawdown-management)
9. [Advanced Techniques](#advanced-techniques)
10. [Implementation Examples](#implementation-examples)

---

## Overview

Risk optimization is the science of determining optimal position sizes to maximize long-term growth while controlling drawdowns. The Kelly Criterion provides a mathematical framework for this optimization.

### Key Concepts

- **Position Sizing:** How much capital to allocate per trade
- **Kelly Criterion:** Mathematically optimal bet size
- **Portfolio Heat:** Total risk exposure across all positions
- **Risk Parity:** Equal risk contribution from each position
- **Volatility Adjustment:** Sizing based on market conditions

### Goals

1. **Maximize Compound Growth Rate:** Achieve highest long-term returns
2. **Control Drawdowns:** Limit maximum peak-to-trough decline
3. **Manage Correlations:** Avoid concentrated risk in correlated assets
4. **Adapt to Volatility:** Reduce size in uncertain markets
5. **Preserve Capital:** Survive losing streaks

---

## Kelly Criterion Mathematics

### The Formula

**General Form (Gambling/Binary Outcomes):**
```
f* = (p × b - q) / b

Where:
f* = Optimal fraction of capital to bet
p  = Probability of winning
q  = Probability of losing (1 - p)
b  = Ratio of win amount to loss amount (odds)
```

**Investment Form (Continuous Returns):**
```
f* = (μ - r) / σ²

Where:
f* = Optimal fraction of capital to invest
μ  = Expected return
r  = Risk-free rate
σ² = Variance of returns
```

**Trading Form (Win Rate & R:R):**
```
f* = (p × R - q) / R

Where:
p = Win rate
q = 1 - p (loss rate)
R = Average win / Average loss (reward-to-risk ratio)
```

### Derivation

Kelly Criterion maximizes the expected logarithmic growth rate:

```
G(f) = p × log(1 + f × b) + q × log(1 - f)

Taking derivative and setting to 0:
dG/df = p × b / (1 + f × b) - q / (1 - f) = 0

Solving for f:
f* = (p × b - q) / b
```

### Examples

**Example 1: Binary Outcome**
```
Win Rate: 60%
Odds: 1:1 (even money)

f* = (0.60 × 1 - 0.40) / 1
f* = 0.20 (20% of capital)
```

**Example 2: Trading with R:R**
```
Win Rate: 55%
Average Win: $200
Average Loss: $100
R = 200 / 100 = 2.0

f* = (0.55 × 2 - 0.45) / 2
f* = 0.325 (32.5% of capital)
```

**Example 3: Investment Form**
```
Expected Return: 15% per year
Risk-Free Rate: 3% per year
Volatility (σ): 20% per year

f* = (0.15 - 0.03) / 0.20²
f* = 0.12 / 0.04
f* = 3.0 (300% leverage - often unrealistic)
```

### Important Properties

1. **Optimality:** Maximizes long-term compound growth rate
2. **Aggressiveness:** Can recommend large position sizes
3. **Sensitivity:** Very sensitive to input parameters
4. **Assumption:** Infinite time horizon and bankroll indivisibility

---

## Practical Implementation

### Why Not Full Kelly?

**Problems with Full Kelly:**
- Extreme volatility (40-50% drawdowns common)
- Parameter estimation errors compound
- Psychological difficulty
- Assumes perfect knowledge of probabilities

**Solution: Fractional Kelly**

```typescript
const fullKelly = calculateKelly(winRate, avgWin, avgLoss)
const fractionalKelly = fullKelly * fraction

// Common fractions:
const halfKelly = fullKelly * 0.50    // Most popular
const quarterKelly = fullKelly * 0.25  // Very conservative
const thirdKelly = fullKelly * 0.33    // Balanced
```

### Kelly for Trading

```typescript
interface TradeStatistics {
  winRate: number
  avgWin: number
  avgLoss: number
  totalTrades: number
}

function calculateKellyCriterion(stats: TradeStatistics): number {
  const p = stats.winRate
  const q = 1 - p
  const R = stats.avgWin / stats.avgLoss
  
  // Trading Kelly formula
  const kelly = (p * R - q) / R
  
  // Apply constraints
  if (kelly <= 0) return 0  // Don't trade negative edge
  if (kelly > 1) return 1    // Cap at 100%
  
  return kelly
}

// Usage
const stats = {
  winRate: 0.58,
  avgWin: 250,
  avgLoss: 150,
  totalTrades: 100
}

const fullKelly = calculateKellyCriterion(stats)
// Result: 44.8%

const halfKelly = fullKelly * 0.5
// Result: 22.4% (recommended)
```

### Confidence Intervals

Account for parameter uncertainty:

```typescript
function calculateKellyWithConfidence(
  trades: Trade[]
): { lower: number; median: number; upper: number } {
  const winRate = calculateWinRate(trades)
  const [avgWin, avgLoss] = calculateAvgWinLoss(trades)
  
  // Calculate standard errors
  const n = trades.length
  const seWinRate = Math.sqrt((winRate * (1 - winRate)) / n)
  const seAvgWin = standardDeviation(trades.filter(t => t.profit > 0)) / Math.sqrt(n)
  const seAvgLoss = standardDeviation(trades.filter(t => t.profit < 0)) / Math.sqrt(n)
  
  // 95% confidence interval (±1.96 SE)
  const lowerKelly = calculateKellyCriterion({
    winRate: winRate - 1.96 * seWinRate,
    avgWin: avgWin - 1.96 * seAvgWin,
    avgLoss: avgLoss + 1.96 * seAvgLoss,
    totalTrades: n
  })
  
  const medianKelly = calculateKellyCriterion({
    winRate,
    avgWin,
    avgLoss,
    totalTrades: n
  })
  
  const upperKelly = calculateKellyCriterion({
    winRate: winRate + 1.96 * seWinRate,
    avgWin: avgWin + 1.96 * seAvgWin,
    avgLoss: avgLoss - 1.96 * seAvgLoss,
    totalTrades: n
  })
  
  return {
    lower: Math.max(0, lowerKelly),
    median: medianKelly,
    upper: Math.min(1, upperKelly)
  }
}

// Use conservative estimate
const kellyEstimate = calculateKellyWithConfidence(historicalTrades)
const position = kellyEstimate.lower * 0.5  // Half of lower bound
```

### Minimum Sample Size

```typescript
function hasEnoughData(trades: Trade[]): boolean {
  // Require minimum 30 trades for reliable statistics
  const minTrades = 30
  
  // Also check for recent data (last 90 days)
  const recentTrades = trades.filter(t => 
    Date.now() - t.timestamp < 90 * 24 * 60 * 60 * 1000
  )
  
  return trades.length >= minTrades && recentTrades.length >= 15
}

// Usage
if (!hasEnoughData(historicalTrades)) {
  console.warn('Insufficient data for Kelly - using fixed 2% risk')
  return 0.02
}
```

---

## Portfolio Heat Management

### Concept

**Portfolio Heat:** Total capital at risk across all open positions.

```
Portfolio Heat = Σ (Position Size × Stop Distance)
```

**Maximum Recommended:** 6-10% of total capital

### Implementation

```typescript
interface Position {
  symbol: string
  entryPrice: number
  currentPrice: number
  quantity: number
  stopLoss: number
  direction: 'LONG' | 'SHORT'
}

class PortfolioHeatManager {
  private maxHeat: number = 0.06  // 6% max
  
  calculateCurrentHeat(
    positions: Position[],
    balance: number
  ): number {
    let totalRisk = 0
    
    for (const pos of positions) {
      const riskPerUnit = Math.abs(pos.entryPrice - pos.stopLoss)
      const positionRisk = riskPerUnit * pos.quantity
      totalRisk += positionRisk
    }
    
    return totalRisk / balance
  }
  
  canOpenPosition(
    positions: Position[],
    newPositionRisk: number,
    balance: number
  ): boolean {
    const currentHeat = this.calculateCurrentHeat(positions, balance)
    const newHeat = currentHeat + (newPositionRisk / balance)
    
    return newHeat <= this.maxHeat
  }
  
  getAvailableRisk(
    positions: Position[],
    balance: number
  ): number {
    const currentHeat = this.calculateCurrentHeat(positions, balance)
    const availableHeat = this.maxHeat - currentHeat
    
    return availableHeat * balance
  }
}

// Usage
const heatManager = new PortfolioHeatManager()
const positions = getCurrentPositions()
const balance = getAccountBalance()

if (heatManager.canOpenPosition(positions, 2000, balance)) {
  openPosition()
} else {
  console.log('Portfolio heat limit reached')
}
```

### Dynamic Heat Limits

Adjust based on market conditions:

```typescript
function getMaxPortfolioHeat(
  volatilityRegime: 'LOW' | 'NORMAL' | 'HIGH'
): number {
  switch (volatilityRegime) {
    case 'LOW':
      return 0.08  // 8% in calm markets
    case 'NORMAL':
      return 0.06  // 6% normally
    case 'HIGH':
      return 0.04  // 4% in volatile markets
  }
}

function detectVolatilityRegime(klines: Kline[]): 'LOW' | 'NORMAL' | 'HIGH' {
  const currentATR = calculateATR(klines, 14)
  const avgATR = calculateATR(klines, 100)
  const ratio = currentATR / avgATR
  
  if (ratio > 1.3) return 'HIGH'
  if (ratio < 0.7) return 'LOW'
  return 'NORMAL'
}
```

---

## Risk Parity

### Concept

**Risk Parity:** Allocate capital so each position contributes equally to portfolio risk.

Instead of equal dollar amounts, use equal risk amounts.

### Implementation

```typescript
interface Asset {
  symbol: string
  expectedReturn: number
  volatility: number
  correlation: number[][]
}

class RiskParityAllocator {
  calculateRiskParityWeights(assets: Asset[]): number[] {
    const n = assets.length
    const targetRisk = 1 / n  // Equal risk contribution
    
    const weights: number[] = []
    
    for (let i = 0; i < n; i++) {
      // Weight inversely proportional to volatility
      const weight = 1 / assets[i].volatility
      weights.push(weight)
    }
    
    // Normalize to sum to 1
    const sum = weights.reduce((a, b) => a + b, 0)
    return weights.map(w => w / sum)
  }
  
  calculatePositionSizes(
    assets: Asset[],
    balance: number,
    riskPerAsset: number
  ): Map<string, number> {
    const weights = this.calculateRiskParityWeights(assets)
    const sizes = new Map<string, number>()
    
    for (let i = 0; i < assets.length; i++) {
      const allocation = balance * weights[i]
      sizes.set(assets[i].symbol, allocation)
    }
    
    return sizes
  }
}

// Usage
const assets = [
  { symbol: 'BTC', expectedReturn: 0.50, volatility: 0.80, correlation: [[1, 0.7], [0.7, 1]] },
  { symbol: 'ETH', expectedReturn: 0.60, volatility: 1.00, correlation: [[1, 0.7], [0.7, 1]] }
]

const allocator = new RiskParityAllocator()
const weights = allocator.calculateRiskParityWeights(assets)
// BTC: 55.6%, ETH: 44.4% (inversely proportional to volatility)
```

### Equal Risk vs Equal Capital

```typescript
// Traditional: Equal capital
const equalCapital = {
  BTC: 50000,  // $50k
  ETH: 50000   // $50k
}

// Risk Parity: Equal risk
const btcVolatility = 0.80  // 80% annual
const ethVolatility = 1.00  // 100% annual

const totalCapital = 100000
const btcAllocation = totalCapital * (1/btcVolatility) / ((1/btcVolatility) + (1/ethVolatility))
const ethAllocation = totalCapital - btcAllocation

// Result:
// BTC: $55,556 (lower volatility → larger position)
// ETH: $44,444 (higher volatility → smaller position)
```

---

## Correlation Management

### Measuring Correlation

```typescript
function calculateCorrelation(
  returns1: number[],
  returns2: number[]
): number {
  const n = Math.min(returns1.length, returns2.length)
  
  const mean1 = returns1.reduce((a, b) => a + b) / n
  const mean2 = returns2.reduce((a, b) => a + b) / n
  
  let numerator = 0
  let sum1Sq = 0
  let sum2Sq = 0
  
  for (let i = 0; i < n; i++) {
    const diff1 = returns1[i] - mean1
    const diff2 = returns2[i] - mean2
    
    numerator += diff1 * diff2
    sum1Sq += diff1 * diff1
    sum2Sq += diff2 * diff2
  }
  
  const denominator = Math.sqrt(sum1Sq * sum2Sq)
  return numerator / denominator
}

// Calculate returns from klines
function getReturns(klines: Kline[]): number[] {
  const returns: number[] = []
  
  for (let i = 1; i < klines.length; i++) {
    const ret = (klines[i].close - klines[i-1].close) / klines[i-1].close
    returns.push(ret)
  }
  
  return returns
}
```

### Correlation-Adjusted Position Sizing

```typescript
class CorrelationAdjuster {
  adjustPositionSize(
    baseSize: number,
    newSymbol: string,
    existingPositions: Position[],
    correlations: Map<string, number>
  ): number {
    let adjustmentFactor = 1.0
    
    for (const pos of existingPositions) {
      const corr = correlations.get(`${newSymbol}_${pos.symbol}`) || 0
      
      // Reduce size if high correlation
      if (Math.abs(corr) > 0.7) {
        adjustmentFactor *= (1 - Math.abs(corr) * 0.5)
      }
    }
    
    return baseSize * adjustmentFactor
  }
}

// Usage
const adjuster = new CorrelationAdjuster()
const correlations = new Map([
  ['BTC_ETH', 0.85],  // High correlation
  ['BTC_SOL', 0.70],
  ['ETH_SOL', 0.75]
])

const existingPositions = [
  { symbol: 'BTC', /* ... */ }
]

let ethSize = 10000  // Base size
ethSize = adjuster.adjustPositionSize(
  ethSize,
  'ETH',
  existingPositions,
  correlations
)
// Result: ~5,750 (reduced due to BTC correlation)
```

### Diversification Benefit

```typescript
function calculateDiversificationRatio(
  positions: Position[],
  correlations: number[][]
): number {
  const n = positions.length
  
  // Weighted average volatility
  let sumWeightedVol = 0
  for (let i = 0; i < n; i++) {
    sumWeightedVol += positions[i].weight * positions[i].volatility
  }
  
  // Portfolio volatility (accounting for correlations)
  let portfolioVariance = 0
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portfolioVariance += 
        positions[i].weight * 
        positions[j].weight * 
        positions[i].volatility * 
        positions[j].volatility * 
        correlations[i][j]
    }
  }
  
  const portfolioVol = Math.sqrt(portfolioVariance)
  
  // Diversification ratio
  return sumWeightedVol / portfolioVol
}

// Interpretation:
// 1.0 = No diversification benefit (perfect correlation)
// 1.4+ = Good diversification
// 2.0+ = Excellent diversification
```

---

## Volatility-Based Sizing

### ATR-Based Adjustment

```typescript
function calculateVolatilityAdjustedSize(
  baseSize: number,
  currentATR: number,
  avgATR: number
): number {
  const volatilityRatio = currentATR / avgATR
  
  // Reduce size in high volatility
  const adjustedSize = baseSize / volatilityRatio
  
  return adjustedSize
}

// Example
const baseSize = 10000
const currentATR = 400
const avgATR = 250

const adjusted = calculateVolatilityAdjustedSize(baseSize, currentATR, avgATR)
// Result: $6,250 (reduced due to high volatility)
```

### Volatility Targeting

```typescript
class VolatilityTargetingSizer {
  private targetVolatility: number = 0.15  // 15% annual
  
  calculatePositionSize(
    balance: number,
    assetVolatility: number
  ): number {
    // Scale position to achieve target portfolio volatility
    const leverage = this.targetVolatility / assetVolatility
    
    // Cap leverage at 2x
    const cappedLeverage = Math.min(leverage, 2.0)
    
    return balance * cappedLeverage
  }
}

// Usage
const sizer = new VolatilityTargetingSizer()

// Low volatility asset (stablecoin strategy)
const stablePosition = sizer.calculatePositionSize(100000, 0.05)
// Result: $200,000 (2x leverage, but capped)

// High volatility asset (altcoin)
const altPosition = sizer.calculatePositionSize(100000, 0.80)
// Result: $18,750 (0.1875x to target 15% vol)
```

---

## Drawdown Management

### Maximum Drawdown Limits

```typescript
interface DrawdownRule {
  maxDrawdown: number
  action: 'REDUCE' | 'PAUSE' | 'LIQUIDATE'
  sizeMultiplier: number
}

class DrawdownManager {
  private rules: DrawdownRule[] = [
    { maxDrawdown: 0.10, action: 'REDUCE', sizeMultiplier: 0.75 },
    { maxDrawdown: 0.15, action: 'REDUCE', sizeMultiplier: 0.50 },
    { maxDrawdown: 0.20, action: 'REDUCE', sizeMultiplier: 0.25 },
    { maxDrawdown: 0.25, action: 'PAUSE', sizeMultiplier: 0.00 }
  ]
  
  getCurrentDrawdown(
    currentBalance: number,
    peakBalance: number
  ): number {
    return (peakBalance - currentBalance) / peakBalance
  }
  
  getPositionMultiplier(
    currentBalance: number,
    peakBalance: number
  ): number {
    const dd = this.getCurrentDrawdown(currentBalance, peakBalance)
    
    // Find applicable rule
    for (const rule of this.rules.reverse()) {
      if (dd >= rule.maxDrawdown) {
        console.log(`Drawdown ${(dd*100).toFixed(1)}%: ${rule.action}`)
        return rule.sizeMultiplier
      }
    }
    
    return 1.0  // No reduction
  }
}

// Usage
const ddManager = new DrawdownManager()
const peakBalance = 100000
const currentBalance = 82000  // 18% drawdown

const multiplier = ddManager.getPositionMultiplier(currentBalance, peakBalance)
// Result: 0.50 (reduce position sizes to 50%)

const baseSize = 5000
const actualSize = baseSize * multiplier  // $2,500
```

### Recovery-Based Sizing

```typescript
function calculateRecoverySize(
  currentBalance: number,
  peakBalance: number,
  baseRisk: number
): number {
  const drawdown = (peakBalance - currentBalance) / peakBalance
  
  if (drawdown === 0) {
    return baseRisk  // At peak, normal sizing
  }
  
  // Gradually increase size as we recover
  const recoveryProgress = 1 - drawdown
  const sizeMultiplier = 0.25 + (0.75 * recoveryProgress)
  
  return baseRisk * sizeMultiplier
}

// Example: After 20% drawdown, recovered to 10% drawdown
const risk = calculateRecoverySize(90000, 100000, 0.02)
// 10% drawdown → 90% recovery → 0.925x multiplier
// Result: 1.85% risk (vs 2% at peak)
```

---

## Advanced Techniques

### 1. Dynamic Kelly with Regime Detection

```typescript
interface MarketRegime {
  type: 'BULL' | 'BEAR' | 'SIDEWAYS'
  volatility: 'LOW' | 'NORMAL' | 'HIGH'
}

class DynamicKellySizer {
  calculateSize(
    stats: TradeStatistics,
    regime: MarketRegime,
    balance: number
  ): number {
    const baseKelly = calculateKellyCriterion(stats)
    
    // Adjust fraction based on regime
    let fraction = 0.50  // Default half-Kelly
    
    if (regime.volatility === 'HIGH') {
      fraction = 0.25  // Quarter-Kelly in high vol
    } else if (regime.volatility === 'LOW' && regime.type === 'BULL') {
      fraction = 0.67  // Slightly more aggressive
    }
    
    const adjustedKelly = baseKelly * fraction
    
    return balance * adjustedKelly
  }
}
```

### 2. Multi-Strategy Portfolio

```typescript
interface Strategy {
  name: string
  winRate: number
  avgWin: number
  avgLoss: number
  correlation: number
  allocation: number
}

class MultiStrategyOptimizer {
  optimizeAllocations(
    strategies: Strategy[],
    totalCapital: number
  ): Map<string, number> {
    const allocations = new Map<string, number>()
    
    // Calculate Kelly for each strategy
    const kellys = strategies.map(s => 
      calculateKellyCriterion({
        winRate: s.winRate,
        avgWin: s.avgWin,
        avgLoss: s.avgLoss,
        totalTrades: 100
      })
    )
    
    // Adjust for correlations
    for (let i = 0; i < strategies.length; i++) {
      let kellySum = kellys[i]
      
      for (let j = 0; j < strategies.length; j++) {
        if (i !== j) {
          kellySum -= kellys[j] * strategies[i].correlation
        }
      }
      
      const allocation = Math.max(0, kellySum * 0.5)  // Half-Kelly
      allocations.set(strategies[i].name, totalCapital * allocation)
    }
    
    return allocations
  }
}

// Usage
const strategies: Strategy[] = [
  {
    name: 'Trend Following',
    winRate: 0.45,
    avgWin: 500,
    avgLoss: 200,
    correlation: 0.3,
    allocation: 0
  },
  {
    name: 'Mean Reversion',
    winRate: 0.65,
    avgWin: 200,
    avgLoss: 180,
    correlation: -0.2,  // Negative correlation!
    allocation: 0
  },
  {
    name: 'Grid Trading',
    winRate: 0.75,
    avgWin: 50,
    avgLoss: 100,
    correlation: 0.1,
    allocation: 0
  }
]

const optimizer = new MultiStrategyOptimizer()
const allocations = optimizer.optimizeAllocations(strategies, 100000)
// Result: Balanced allocation considering Kelly + correlations
```

### 3. Time-Decay Weighted Statistics

```typescript
function calculateTimeDecayKelly(
  trades: Trade[],
  decayFactor: number = 0.95
): number {
  let weightedWins = 0
  let weightedLosses = 0
  let weightedWinCount = 0
  let weightedTotal = 0
  
  // More recent trades get higher weight
  for (let i = 0; i < trades.length; i++) {
    const age = trades.length - i - 1
    const weight = Math.pow(decayFactor, age)
    
    weightedTotal += weight
    
    if (trades[i].profit > 0) {
      weightedWinCount += weight
      weightedWins += trades[i].profit * weight
    } else {
      weightedLosses += Math.abs(trades[i].profit) * weight
    }
  }
  
  const winRate = weightedWinCount / weightedTotal
  const avgWin = weightedWins / weightedWinCount
  const avgLoss = weightedLosses / (weightedTotal - weightedWinCount)
  
  return calculateKellyCriterion({ winRate, avgWin, avgLoss, totalTrades: trades.length })
}

// Recent trades have more influence on sizing
```

---

## Implementation Examples

### Complete Risk Manager

```typescript
class ComprehensiveRiskManager {
  private maxPortfolioHeat = 0.06
  private maxDrawdown = 0.25
  private kellyFraction = 0.50
  
  calculateOptimalPosition(
    setup: TradeSetup,
    balance: number,
    peakBalance: number,
    openPositions: Position[],
    historicalTrades: Trade[]
  ): number {
    // 1. Check drawdown limits
    const ddMultiplier = this.getDrawdownMultiplier(balance, peakBalance)
    if (ddMultiplier === 0) {
      console.log('Trading paused due to drawdown')
      return 0
    }
    
    // 2. Calculate Kelly size
    const kelly = calculateKellyCriterion(
      this.getStrategyStats(setup.strategy, historicalTrades)
    )
    let kellySize = balance * kelly * this.kellyFraction
    
    // 3. Apply drawdown adjustment
    kellySize *= ddMultiplier
    
    // 4. Volatility adjustment
    const volMultiplier = this.getVolatilityMultiplier(setup.klines)
    kellySize *= volMultiplier
    
    // 5. Correlation adjustment
    const corrMultiplier = this.getCorrelationMultiplier(
      setup.symbol,
      openPositions
    )
    kellySize *= corrMultiplier
    
    // 6. Check portfolio heat
    const riskAmount = kellySize * (Math.abs(setup.entry - setup.stopLoss) / setup.entry)
    
    if (!this.checkPortfolioHeat(openPositions, riskAmount, balance)) {
      console.log('Portfolio heat limit reached')
      return 0
    }
    
    // 7. Final position size
    return kellySize
  }
  
  private getDrawdownMultiplier(current: number, peak: number): number {
    const dd = (peak - current) / peak
    
    if (dd >= 0.25) return 0.00
    if (dd >= 0.20) return 0.25
    if (dd >= 0.15) return 0.50
    if (dd >= 0.10) return 0.75
    return 1.00
  }
  
  private getVolatilityMultiplier(klines: Kline[]): number {
    const currentATR = calculateATR(klines, 14)
    const avgATR = calculateATR(klines, 100)
    const ratio = currentATR / avgATR
    
    return 1 / ratio  // Inverse relationship
  }
  
  private getCorrelationMultiplier(
    symbol: string,
    positions: Position[]
  ): number {
    // Simplified: reduce if similar symbols open
    const similarOpen = positions.filter(p => 
      p.symbol.includes('BTC') && symbol.includes('BTC')
    ).length
    
    return 1 / (1 + similarOpen * 0.3)
  }
  
  private checkPortfolioHeat(
    positions: Position[],
    newRisk: number,
    balance: number
  ): boolean {
    const currentHeat = positions.reduce((sum, p) => {
      const risk = Math.abs(p.entryPrice - p.stopLoss) * p.quantity
      return sum + risk
    }, 0)
    
    return (currentHeat + newRisk) / balance <= this.maxPortfolioHeat
  }
  
  private getStrategyStats(
    strategy: string,
    trades: Trade[]
  ): TradeStatistics {
    const strategyTrades = trades.filter(t => t.strategy === strategy)
    
    const wins = strategyTrades.filter(t => t.profit > 0)
    const losses = strategyTrades.filter(t => t.profit < 0)
    
    return {
      winRate: wins.length / strategyTrades.length,
      avgWin: wins.reduce((s, t) => s + t.profit, 0) / wins.length,
      avgLoss: Math.abs(losses.reduce((s, t) => s + t.profit, 0) / losses.length),
      totalTrades: strategyTrades.length
    }
  }
}
```

---

## Best Practices

### 1. Start Conservative

```typescript
// Begin with quarter-Kelly
const kelly = calculateKellyCriterion(stats)
const position = balance * kelly * 0.25
```

### 2. Require Sufficient Data

```typescript
if (trades.length < 30) {
  console.warn('Using fixed 2% risk - insufficient Kelly data')
  return balance * 0.02
}
```

### 3. Regular Recalculation

```typescript
// Update Kelly monthly
const monthlyRecalc = setInterval(() => {
  const recentTrades = trades.filter(t => 
    Date.now() - t.timestamp < 90 * 24 * 60 * 60 * 1000
  )
  
  currentKelly = calculateKellyCriterion(getStats(recentTrades))
}, 30 * 24 * 60 * 60 * 1000)
```

### 4. Respect Hard Limits

```typescript
const HARD_LIMITS = {
  maxPositionSize: balance * 0.10,  // Never >10% per trade
  maxPortfolioHeat: balance * 0.06,  // Never >6% total risk
  maxDrawdown: 0.25                   // Stop at 25% DD
}
```

### 5. Monitor Performance

```typescript
interface PerformanceMetrics {
  actualDrawdown: number
  theoreticalDrawdown: number
  kellyAccuracy: number
  heatUtilization: number
}

function trackKellyPerformance(
  trades: Trade[],
  kellySizes: number[]
): PerformanceMetrics {
  // Compare actual vs Kelly predictions
  // Adjust if systematic deviation
}
```

---

## Conclusion

Effective risk optimization requires:

1. **Kelly Criterion** as mathematical foundation
2. **Fractional sizing** (half or quarter Kelly)
3. **Portfolio heat limits** (6% max total risk)
4. **Drawdown management** (reduce size after losses)
5. **Correlation awareness** (avoid concentrated risk)
6. **Volatility adjustment** (smaller in uncertain markets)

**Remember:** Kelly maximizes long-term growth but requires discipline and proper implementation.

---

**Next Steps:**
1. Calculate Kelly based on your historical performance
2. Implement fractional Kelly (start with quarter)
3. Add portfolio heat monitoring
4. Test in paper trading before live
5. Adjust parameters based on results

**Related Documentation:**
- `ADVANCED_STRATEGIES.md` - Strategy win rates for Kelly inputs
- `POSITION_MANAGEMENT.md` - Stop loss and take profit rules
- `BACKTESTING_ADVANCED.md` - Testing Kelly performance
