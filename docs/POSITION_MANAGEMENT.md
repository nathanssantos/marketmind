# 🎯 Position Management Guide - MarketMind

**Version:** 1.0  
**Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Stop Loss Strategies](#stop-loss-strategies)
3. [Take Profit Strategies](#take-profit-strategies)
4. [Trailing Stops](#trailing-stops)
5. [Partial Exits](#partial-exits)
6. [Risk-Reward Optimization](#risk-reward-optimization)
7. [Position Sizing](#position-sizing)
8. [Advanced Techniques](#advanced-techniques)
9. [Implementation Examples](#implementation-examples)

---

## Overview

Position management is the difference between profitable and losing traders. This guide covers advanced techniques for managing stops, targets, and position sizing to maximize profitability while controlling risk.

### Key Principles

1. **Always define risk before entry** - Know your stop loss
2. **Use objective criteria** - No emotional decisions
3. **Let winners run** - Trail stops to capture trends
4. **Cut losers quickly** - Respect your stop loss
5. **Scale out strategically** - Take partial profits along the way

### Performance Impact

Proper position management can improve:
- **Win Rate:** +5-10% through better stop placement
- **Average R:R:** +50% through trailing and partial exits
- **Profit Factor:** +30-50% overall system improvement
- **Max Drawdown:** -20-30% through disciplined stops

---

## Stop Loss Strategies

### 1. ATR-Based Stops

**Concept:** Use Average True Range to set stops that adapt to market volatility.

**Formula:**
```typescript
const ATR = calculateATR(klines, 14)
const stopDistance = ATR * multiplier

// LONG
const stopLoss = entry - stopDistance

// SHORT
const stopLoss = entry + stopDistance
```

**Advantages:**
- Adapts to volatility
- Less likely to get stopped out in normal fluctuations
- Works across all instruments

**Recommended Multipliers:**
- **Tight:** 1.0-1.5x ATR (scalping, short-term)
- **Medium:** 1.5-2.5x ATR (swing trading)
- **Wide:** 2.5-4.0x ATR (position trading)

**Example:**
```typescript
// BTC/USDT Entry at $40,000
// ATR(14) = $300
// Multiplier = 2.0

const stopLoss = 40000 - (300 * 2.0) = $39,400
const risk = $600 per BTC
```

### 2. Structure-Based Stops

**Concept:** Place stops beyond key support/resistance levels.

**LONG Setup:**
```typescript
// Place stop below recent swing low
const swingLow = findSwingLow(klines, lookback)
const buffer = ATR * 0.3  // Small buffer
const stopLoss = swingLow - buffer
```

**SHORT Setup:**
```typescript
// Place stop above recent swing high
const swingHigh = findSwingHigh(klines, lookback)
const buffer = ATR * 0.3
const stopLoss = swingHigh + buffer
```

**Advantages:**
- Based on actual market structure
- Avoids arbitrary price levels
- Natural invalidation points

**Disadvantages:**
- May result in wider stops
- Requires proper position sizing to maintain risk

### 3. Percentage-Based Stops

**Concept:** Fixed percentage from entry price.

```typescript
const stopLossPercent = 0.02  // 2%

// LONG
const stopLoss = entry * (1 - stopLossPercent)

// SHORT  
const stopLoss = entry * (1 + stopLossPercent)
```

**Advantages:**
- Simple to calculate
- Consistent risk per trade
- Easy to backtest

**Disadvantages:**
- Ignores market structure
- May be too tight or too wide
- Doesn't adapt to volatility

**Best Use Cases:**
- Very liquid markets (BTC, ETH)
- Consistent volatility
- Beginner-friendly

### 4. Indicator-Based Stops

**Moving Average Stops:**
```typescript
// Place stop below EMA
const ema = calculateEMA(klines, 21)
const buffer = ATR * 0.5
const stopLoss = ema - buffer  // LONG
```

**Bollinger Band Stops:**
```typescript
const bb = calculateBollingerBands(klines, 20, 2)

// LONG: Stop below lower band
const stopLoss = bb.lower - (ATR * 0.3)

// SHORT: Stop above upper band
const stopLoss = bb.upper + (ATR * 0.3)
```

**Parabolic SAR Stops:**
```typescript
const sar = calculateParabolicSAR(klines)
const stopLoss = sar  // Trailing automatically
```

### 5. Time-Based Stops

**Concept:** Exit after predetermined time if conditions not met.

```typescript
const entryTime = Date.now()
const maxHoldTime = 24 * 60 * 60 * 1000  // 24 hours

if (Date.now() - entryTime > maxHoldTime) {
  exitPosition('Time stop reached')
}
```

**Use Cases:**
- Mean reversion strategies (exit if no reversion in X hours)
- Scalping strategies (exit after session close)
- Range trading (exit if range broken)

---

## Take Profit Strategies

### 1. Fixed R:R Targets

**Concept:** Set target at multiple of risk amount.

```typescript
const risk = Math.abs(entry - stopLoss)
const reward = risk * rrRatio

// LONG
const takeProfit = entry + reward

// SHORT
const takeProfit = entry - reward
```

**Common R:R Ratios:**
- **1:1** - Breakeven (50% win rate needed)
- **1:2** - Conservative (34% win rate needed)
- **1:3** - Standard (25% win rate needed)
- **1:5** - Aggressive (17% win rate needed)

**Probability of Profit (PoP) Required:**
```
PoP_required = 1 / (1 + RR)

1:1 → 50%
1:2 → 33.3%
1:3 → 25%
1:5 → 16.7%
```

### 2. Structure-Based Targets

**Fibonacci Extension Targets:**
```typescript
const swing = {
  start: swingLow,
  end: swingHigh
}

const extension = swing.end - swing.start

const targets = {
  fib1272: swing.end + (extension * 0.272),
  fib1382: swing.end + (extension * 0.382),
  fib1618: swing.end + (extension * 0.618),
  fib2618: swing.end + (extension * 1.618),
}
```

**Previous High/Low Targets:**
```typescript
// LONG: Target previous resistance
const target = findPreviousHigh(klines, lookback)

// SHORT: Target previous support
const target = findPreviousLow(klines, lookback)
```

### 3. ATR-Based Targets

**Concept:** Multiple of ATR from entry.

```typescript
const ATR = calculateATR(klines, 14)
const target = entry + (ATR * multiplier)  // LONG
```

**Conservative:** 2-3x ATR  
**Moderate:** 3-5x ATR  
**Aggressive:** 5-10x ATR

### 4. Volatility-Adjusted Targets

**Concept:** Wider targets in high volatility, tighter in low.

```typescript
const currentATR = calculateATR(klines, 14)
const avgATR = calculateATR(klines, 50)
const volatilityRatio = currentATR / avgATR

const baseTarget = entry + (risk * 3)  // Base 3:1 R:R
const adjustedTarget = entry + (risk * 3 * volatilityRatio)
```

---

## Trailing Stops

### 1. ATR Trailing Stop

**Concept:** Trail stop at ATR distance below price.

```typescript
interface TrailingStop {
  currentStop: number
  highestHigh: number  // LONG
  lowestLow: number    // SHORT
}

function updateTrailingStop(
  position: Position,
  currentPrice: number,
  ATR: number
): number {
  if (position.direction === 'LONG') {
    const newHigh = Math.max(position.highestHigh, currentPrice)
    const trailStop = newHigh - (ATR * 1.5)
    return Math.max(position.currentStop, trailStop)
  } else {
    const newLow = Math.min(position.lowestLow, currentPrice)
    const trailStop = newLow + (ATR * 1.5)
    return Math.min(position.currentStop, trailStop)
  }
}
```

**Advantages:**
- Adapts to volatility
- Captures trends
- Prevents giving back profits

### 2. Fixed Percentage Trailing

```typescript
const trailPercent = 0.03  // 3%

// LONG
const trailStop = currentPrice * (1 - trailPercent)
if (trailStop > position.currentStop) {
  position.currentStop = trailStop
}
```

### 3. Chandelier Exit

**Concept:** Trails at highest high/lowest low minus ATR multiple.

```typescript
function chandelierExit(
  klines: Kline[],
  period: number = 22,
  atrMultiplier: number = 3
): number {
  const ATR = calculateATR(klines, period)
  const highestHigh = Math.max(...klines.slice(-period).map(k => k.high))
  
  // LONG
  return highestHigh - (ATR * atrMultiplier)
}
```

### 4. Moving Average Trailing

```typescript
const ema = calculateEMA(klines, 21)
const buffer = ATR * 0.3

// LONG: Trail below EMA
const trailStop = ema - buffer

// Only raise stop, never lower
position.currentStop = Math.max(position.currentStop, trailStop)
```

### 5. Activation Rules

**Don't trail immediately - wait for profit:**

```typescript
const risk = Math.abs(entry - initialStop)

// Start trailing after 1R profit
if (currentProfit >= risk * 1.0) {
  activateTrailingStop()
}

// Tighten trail after 2R profit
if (currentProfit >= risk * 2.0) {
  trailMultiplier = 1.0  // From 1.5 to 1.0 ATR
}
```

---

## Partial Exits

### 1. Three-Tier Exit Strategy

**Concept:** Scale out at multiple levels to balance profit and risk.

```typescript
const totalQuantity = 3.0  // BTC
const risk = Math.abs(entry - stopLoss)

const exits = [
  {
    quantity: totalQuantity * 0.33,  // 33%
    target: entry + (risk * 1.5),    // 1.5R
    type: 'FIRST_TARGET'
  },
  {
    quantity: totalQuantity * 0.33,  // 33%
    target: entry + (risk * 2.5),    // 2.5R
    type: 'SECOND_TARGET'
  },
  {
    quantity: totalQuantity * 0.34,  // 34%
    target: null,                     // Trail stop
    type: 'RUNNER'
  }
]
```

**Benefits:**
- Locks in profits early (reduces risk)
- Keeps position for larger moves
- Improves win rate

**Example:**
```
Entry: $40,000
Stop: $39,400 (risk = $600)

Exit 1: $40,900 (1.5R) → Close 1 BTC → Profit $900
Exit 2: $41,500 (2.5R) → Close 1 BTC → Profit $1,500
Exit 3: Trail → Close 1 BTC → Profit $2,000+ (if trend continues)

Total: $4,400+ vs $1,800 (if holding for only 3R)
```

### 2. Break-Even Strategy

**Move stop to break-even after initial profit:**

```typescript
const risk = Math.abs(entry - initialStop)

if (currentProfit >= risk * 1.0) {
  // Move stop to entry + small profit (commission coverage)
  position.stopLoss = entry + (minTick * 5)
  console.log('Stop moved to break-even')
}
```

**Advantages:**
- Creates "free" trades
- Reduces psychological pressure
- Guarantees some profit

**Disadvantages:**
- May get stopped out on normal retracements
- Can reduce win rate if too tight

### 3. Pyramid Adding

**Add to winning positions:**

```typescript
// Initial position
const initialSize = calculatePositionSize(balance, risk)

// After 2R profit, add 50% more
if (currentProfit >= risk * 2.0 && !pyramidAdded) {
  const additionalSize = initialSize * 0.5
  addToPosition(additionalSize, currentPrice)
  
  // Adjust stop for entire position
  const avgEntry = calculateAvgEntry(positions)
  const newStop = avgEntry - (ATR * 1.5)
  
  pyramidAdded = true
}
```

**Rules:**
- Only add to winning trades
- Use smaller size for additions (50% or less)
- Adjust stop to protect profits
- Maximum 2-3 additions per trade

---

## Risk-Reward Optimization

### 1. Calculating Optimal R:R

**Win Rate vs R:R Required:**

```typescript
function calculateMinRR(winRate: number): number {
  // Break-even R:R
  return (1 - winRate) / winRate
}

// Examples:
calculateMinRR(0.50) // 1:1 (50% win rate)
calculateMinRR(0.40) // 1:1.5 (40% win rate)
calculateMinRR(0.33) // 1:2 (33% win rate)
```

**Expected Value:**
```typescript
function calculateExpectedValue(
  winRate: number,
  avgWin: number,
  avgLoss: number
): number {
  return (winRate * avgWin) - ((1 - winRate) * avgLoss)
}

// Target: EV > 0.50 (50 cents per dollar risked)
```

### 2. Dynamic R:R Based on Confidence

```typescript
function getDynamicRR(confidence: number): number {
  if (confidence >= 0.85) return 2.0  // High confidence: 1:2
  if (confidence >= 0.70) return 3.0  // Medium: 1:3
  return 4.0  // Low confidence: 1:4 (require larger reward)
}
```

### 3. Volatility-Adjusted Targets

```typescript
const currentATR = calculateATR(klines, 14)
const avgATR = calculateATR(klines, 50)
const volatilityRatio = currentATR / avgATR

let targetRR = 3.0  // Base target

// In high volatility, increase target
if (volatilityRatio > 1.3) {
  targetRR = 4.0
}

// In low volatility, decrease target
if (volatilityRatio < 0.7) {
  targetRR = 2.0
}
```

---

## Position Sizing

### 1. Fixed Risk Method

**Risk fixed dollar amount per trade:**

```typescript
function calculatePositionSize(
  balance: number,
  riskPercent: number,
  entry: number,
  stopLoss: number
): number {
  const riskAmount = balance * riskPercent
  const stopDistance = Math.abs(entry - stopLoss)
  const positionSize = riskAmount / stopDistance
  
  return positionSize
}

// Example:
// Balance: $100,000
// Risk: 2% = $2,000
// Entry: $40,000
// Stop: $39,200
// Distance: $800
// Size: $2,000 / $800 = 2.5 BTC
```

### 2. ATR-Based Position Sizing

**Adjust size based on volatility:**

```typescript
function calculateATRPositionSize(
  balance: number,
  baseRiskPercent: number,
  ATR: number,
  avgATR: number
): number {
  const volatilityRatio = ATR / avgATR
  
  // Reduce size in high volatility
  const adjustedRisk = baseRiskPercent / volatilityRatio
  
  return balance * adjustedRisk
}
```

### 3. Kelly Criterion Sizing

**Mathematically optimal position size:**

```typescript
function kellyPositionSize(
  winRate: number,
  avgWin: number,
  avgLoss: number,
  balance: number
): number {
  const p = winRate
  const q = 1 - winRate
  const b = avgWin / avgLoss
  
  // Full Kelly
  const kellyPercent = (p * b - q) / b
  
  // Use fractional Kelly (more conservative)
  const fractionalKelly = kellyPercent * 0.25  // Quarter Kelly
  
  return balance * fractionalKelly
}
```

### 4. Portfolio Heat Management

**Limit total risk across all positions:**

```typescript
interface Position {
  symbol: string
  riskAmount: number
  isOpen: boolean
}

function canOpenNewPosition(
  positions: Position[],
  newRisk: number,
  maxPortfolioHeat: number = 0.06  // 6% max
): boolean {
  const currentHeat = positions
    .filter(p => p.isOpen)
    .reduce((sum, p) => sum + p.riskAmount, 0)
  
  return (currentHeat + newRisk) <= maxPortfolioHeat
}
```

---

## Advanced Techniques

### 1. Volatility Regime Adaptation

```typescript
function adaptToVolatilityRegime(
  klines: Kline[]
): PositionParams {
  const currentVol = calculateATR(klines, 14) / klines.at(-1)!.close
  const avgVol = calculateHistoricalVolatility(klines, 100)
  
  if (currentVol > avgVol * 1.5) {
    // High volatility regime
    return {
      stopMultiplier: 2.5,
      targetRR: 4.0,
      positionSize: 0.5,  // Half size
      trailMultiplier: 2.0
    }
  } else if (currentVol < avgVol * 0.7) {
    // Low volatility regime
    return {
      stopMultiplier: 1.5,
      targetRR: 2.0,
      positionSize: 1.0,
      trailMultiplier: 1.0
    }
  }
  
  // Normal volatility
  return {
    stopMultiplier: 2.0,
    targetRR: 3.0,
    positionSize: 1.0,
    trailMultiplier: 1.5
  }
}
```

### 2. Correlation-Aware Position Sizing

```typescript
function adjustForCorrelation(
  baseSize: number,
  openPositions: Position[],
  newSymbol: string
): number {
  let totalCorrelation = 0
  
  for (const pos of openPositions) {
    const corr = calculateCorrelation(pos.symbol, newSymbol)
    if (Math.abs(corr) > 0.7) {
      totalCorrelation += Math.abs(corr)
    }
  }
  
  // Reduce size if high correlation
  const reductionFactor = 1 / (1 + totalCorrelation)
  return baseSize * reductionFactor
}
```

### 3. Time-of-Day Position Adjustment

```typescript
function getTimeOfDayMultiplier(): number {
  const hour = new Date().getUTCHours()
  
  // High activity hours (London/NY overlap)
  if (hour >= 12 && hour <= 16) {
    return 1.0  // Full size
  }
  
  // Asian session (lower liquidity)
  if (hour >= 0 && hour <= 8) {
    return 0.7  // 70% size
  }
  
  // Other hours
  return 0.85  // 85% size
}
```

### 4. Drawdown-Based Adjustment

```typescript
interface AccountState {
  balance: number
  peakBalance: number
  currentDrawdown: number
}

function adjustForDrawdown(
  state: AccountState,
  baseRisk: number
): number {
  const drawdownPercent = (state.peakBalance - state.balance) / state.peakBalance
  
  if (drawdownPercent > 0.20) {
    // 20%+ drawdown: stop trading
    return 0
  } else if (drawdownPercent > 0.15) {
    // 15-20% drawdown: 25% size
    return baseRisk * 0.25
  } else if (drawdownPercent > 0.10) {
    // 10-15% drawdown: 50% size
    return baseRisk * 0.50
  }
  
  // Normal: full size
  return baseRisk
}
```

---

## Implementation Examples

### Example 1: Complete Position Manager

```typescript
interface TradeSetup {
  symbol: string
  direction: 'LONG' | 'SHORT'
  entry: number
  confidence: number
  klines: Kline[]
}

class PositionManager {
  calculatePositionParams(setup: TradeSetup, balance: number) {
    const ATR = calculateATR(setup.klines, 14)
    
    // 1. Calculate stop loss
    const stopLoss = this.calculateStopLoss(
      setup.entry,
      setup.direction,
      ATR,
      setup.klines
    )
    
    // 2. Calculate position size
    const risk = Math.abs(setup.entry - stopLoss)
    const positionSize = this.calculatePositionSize(
      balance,
      0.02,  // 2% risk
      risk,
      setup.confidence
    )
    
    // 3. Calculate targets
    const targets = this.calculateTargets(
      setup.entry,
      stopLoss,
      setup.confidence,
      ATR
    )
    
    // 4. Setup trailing stop rules
    const trailRules = this.getTrailingRules(ATR, setup.confidence)
    
    return {
      entry: setup.entry,
      stopLoss,
      targets,
      positionSize,
      trailRules
    }
  }
  
  private calculateStopLoss(
    entry: number,
    direction: 'LONG' | 'SHORT',
    ATR: number,
    klines: Kline[]
  ): number {
    // Use structure + ATR buffer
    const swingPoint = direction === 'LONG'
      ? findSwingLow(klines, 20)
      : findSwingHigh(klines, 20)
    
    const buffer = ATR * 0.3
    
    return direction === 'LONG'
      ? swingPoint - buffer
      : swingPoint + buffer
  }
  
  private calculatePositionSize(
    balance: number,
    riskPercent: number,
    stopDistance: number,
    confidence: number
  ): number {
    const baseRisk = balance * riskPercent
    
    // Adjust for confidence
    const confidenceMultiplier = confidence >= 0.80 ? 1.2 : 1.0
    const adjustedRisk = baseRisk * confidenceMultiplier
    
    return adjustedRisk / stopDistance
  }
  
  private calculateTargets(
    entry: number,
    stopLoss: number,
    confidence: number,
    ATR: number
  ) {
    const risk = Math.abs(entry - stopLoss)
    const direction = entry > stopLoss ? 1 : -1
    
    // Base R:R from confidence
    const baseRR = confidence >= 0.80 ? 2.5 : 3.0
    
    return {
      target1: entry + (direction * risk * 1.5),
      target2: entry + (direction * risk * baseRR),
      target3: null  // Trailing stop
    }
  }
  
  private getTrailingRules(ATR: number, confidence: number) {
    return {
      activateAfterR: 1.0,  // Start trailing after 1R profit
      initialMultiplier: 1.5,  // 1.5 ATR trail
      tightenAfterR: 2.0,  // Tighten to 1.0 ATR after 2R
      tightenedMultiplier: 1.0,
      moveToBreakEvenAfterR: 1.0
    }
  }
}
```

### Example 2: Trailing Stop Manager

```typescript
class TrailingStopManager {
  private positions: Map<string, Position> = new Map()
  
  updatePosition(
    symbol: string,
    currentPrice: number,
    klines: Kline[]
  ): Position {
    const position = this.positions.get(symbol)!
    const ATR = calculateATR(klines, 14)
    const risk = Math.abs(position.entry - position.initialStop)
    const currentProfit = position.direction === 'LONG'
      ? currentPrice - position.entry
      : position.entry - currentPrice
    
    // 1. Move to break-even after 1R
    if (currentProfit >= risk * 1.0 && !position.movedToBreakEven) {
      position.currentStop = position.entry
      position.movedToBreakEven = true
      console.log(`[${symbol}] Stop moved to break-even`)
    }
    
    // 2. Start trailing after 1R
    if (currentProfit >= risk * 1.0 && !position.trailingActive) {
      position.trailingActive = true
      console.log(`[${symbol}] Trailing stop activated`)
    }
    
    // 3. Tighten trail after 2R
    if (currentProfit >= risk * 2.0) {
      position.trailMultiplier = 1.0  // From 1.5
    }
    
    // 4. Update trail stop
    if (position.trailingActive) {
      const trailDistance = ATR * position.trailMultiplier
      
      if (position.direction === 'LONG') {
        const newStop = currentPrice - trailDistance
        position.currentStop = Math.max(position.currentStop, newStop)
      } else {
        const newStop = currentPrice + trailDistance
        position.currentStop = Math.min(position.currentStop, newStop)
      }
    }
    
    // 5. Check if stopped out
    if (
      (position.direction === 'LONG' && currentPrice <= position.currentStop) ||
      (position.direction === 'SHORT' && currentPrice >= position.currentStop)
    ) {
      this.closePosition(symbol, position.currentStop, 'Stopped out')
    }
    
    return position
  }
}
```

### Example 3: Partial Exit Manager

```typescript
class PartialExitManager {
  setupExits(
    entry: number,
    stopLoss: number,
    totalQuantity: number,
    direction: 'LONG' | 'SHORT'
  ): ExitPlan {
    const risk = Math.abs(entry - stopLoss)
    const dir = direction === 'LONG' ? 1 : -1
    
    return {
      exits: [
        {
          quantity: totalQuantity * 0.33,
          price: entry + (dir * risk * 1.5),
          type: 'FIRST_TARGET',
          executed: false
        },
        {
          quantity: totalQuantity * 0.33,
          price: entry + (dir * risk * 2.5),
          type: 'SECOND_TARGET',
          executed: false
        },
        {
          quantity: totalQuantity * 0.34,
          price: null,  // Trail
          type: 'RUNNER',
          executed: false
        }
      ]
    }
  }
  
  checkExits(
    plan: ExitPlan,
    currentPrice: number
  ): ExitAction[] {
    const actions: ExitAction[] = []
    
    for (const exit of plan.exits) {
      if (exit.executed) continue
      
      if (exit.type === 'RUNNER') continue  // Managed by trailing stop
      
      // Check if target hit
      const targetHit = exit.price !== null && (
        (plan.direction === 'LONG' && currentPrice >= exit.price) ||
        (plan.direction === 'SHORT' && currentPrice <= exit.price)
      )
      
      if (targetHit) {
        actions.push({
          type: 'PARTIAL_EXIT',
          quantity: exit.quantity,
          price: exit.price!,
          reason: exit.type
        })
        
        exit.executed = true
      }
    }
    
    return actions
  }
}
```

---

## Best Practices

### 1. Always Use Stops

**Never enter a trade without a predefined stop loss:**
```typescript
if (!stopLoss) {
  throw new Error('Stop loss required before entry')
}
```

### 2. Respect Your Stops

**Never move stop further away:**
```typescript
// ✅ ALLOWED: Move stop closer or to break-even
if (newStop > currentStop) {  // LONG
  updateStop(newStop)
}

// ❌ FORBIDDEN: Move stop further away
if (newStop < currentStop) {  // LONG
  throw new Error('Cannot widen stop loss')
}
```

### 3. Risk Consistency

**Risk same amount on every trade:**
```typescript
const standardRisk = balance * 0.02  // Always 2%
const positionSize = standardRisk / stopDistance
```

### 4. Backtest Everything

**Test all position management rules:**
```typescript
const backtestResults = {
  withTrailing: runBacktest({ useTrailing: true }),
  withoutTrailing: runBacktest({ useTrailing: false }),
  
  withPartials: runBacktest({ usePartials: true }),
  withoutPartials: runBacktest({ usePartials: false })
}

// Compare profit factor, max drawdown, Sharpe
```

### 5. Monitor and Adjust

**Track actual vs expected:**
```typescript
interface PositionMetrics {
  avgStopHit: number        // Should be < 1.5R
  avgTargetHit: number       // Should be > 2R
  avgTrailProfit: number     // Runner performance
  stopoutRate: number        // Should match win rate
}
```

---

## Conclusion

Effective position management combines:

1. **Objective stop placement** (ATR or structure-based)
2. **Appropriate take profit targets** (R:R based on win rate)
3. **Trailing stops** (capture trends, protect profits)
4. **Partial exits** (balance risk vs reward)
5. **Proper position sizing** (consistent risk per trade)

**Remember:** The best entry setup means nothing without proper position management.

---

**Next Steps:**
1. Choose stop loss method appropriate for your strategy
2. Calculate optimal R:R based on win rate
3. Implement trailing stops for trend capture
4. Test partial exit levels in backtests
5. Monitor performance and adjust rules

**Related Documentation:**
- `ADVANCED_STRATEGIES.md` - Trading strategy implementations
- `RISK_OPTIMIZATION.md` - Kelly Criterion and portfolio heat
- `BACKTESTING_ADVANCED.md` - Testing position management rules
