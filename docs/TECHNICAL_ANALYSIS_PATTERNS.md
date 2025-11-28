# Technical Analysis Patterns - Complete Reference

**Version:** 1.0  
**Last Updated:** November 17, 2025  
**Status:** Research Complete - Implementation Pending

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Support and Resistance Levels](#support-and-resistance-levels)
3. [Trendlines](#trendlines)
4. [Channels](#channels)
5. [Fibonacci Retracements](#fibonacci-retracements)
6. [Chart Patterns](#chart-patterns)
   - [Head and Shoulders](#head-and-shoulders)
   - [Triangles](#triangles)
   - [Wedges](#wedges)
   - [Double Top/Bottom](#double-topbottom)
   - [Triple Top/Bottom](#triple-topbottom)
   - [Cup and Handle](#cup-and-handle)
   - [Flags and Pennants](#flags-and-pennants)
   - [Rounding Bottom](#rounding-bottom)
7. [Gaps](#gaps)
8. [Implementation Guidelines](#implementation-guidelines)
9. [References](#references)

---

## Overview

This document provides comprehensive technical details for implementing AI-driven technical analysis pattern recognition and drawing capabilities in MarketMind. All patterns are based on research from authoritative sources including Investopedia and academic financial analysis.

### Key Principles

- **Volume Confirmation:** Most patterns require volume analysis for validation
- **Time Frame:** Patterns typically form over weeks to months for reliability
- **Price Targets:** Calculated using pattern height + breakout point
- **Stop-Loss Placement:** Always positioned outside pattern boundaries
- **Fibonacci Integration:** 38.2%, 50%, 61.8% levels appear across multiple patterns

---

## Support and Resistance Levels

### Support Levels

**Definition:** Price point where an asset struggles to fall below due to concentration of buying interest.

**Identification Method:**
1. Connect lowest lows using horizontal lines
2. Minimum 2 touches for basic support, 3+ for strong support
3. Can also be identified using moving averages, trendlines

**Drawing Instructions:**
```typescript
{
  type: 'support',
  points: [
    { price: lowPrice, timestamp: timestamp1 },
    { price: lowPrice, timestamp: timestamp2 }
  ],
  style: 'solid',
  color: 'green',
  confidence: 0.85
}
```

**Trading Strategy:**
- Entry: Near support level with limit orders
- Stop-Loss: Below support (allow for volatility)
- Confirmation: Volume increase at support tests

**Key Characteristics:**
- Created by buyers entering at lower prices
- Stronger with more touches
- Can become resistance if broken (Polarity Principle)

---

### Resistance Levels

**Definition:** Price zone limiting upward movement where selling pressure concentrates.

**Identification Method:**
1. Connect highest highs using horizontal lines
2. Minimum 2 touches required, 3+ for strong resistance
3. Psychological "big figures" (round numbers: 100, 150, 200) act as natural resistance

**Drawing Instructions:**
```typescript
{
  type: 'resistance',
  points: [
    { price: highPrice, timestamp: timestamp1 },
    { price: highPrice, timestamp: timestamp2 }
  ],
  style: 'solid',
  color: 'red',
  confidence: 0.85
}
```

**Polarity Principle:**
- Broken resistance becomes support
- Broken support becomes resistance
- Requires volume confirmation on break

**Trading Strategy:**
- Entry: Sell near resistance or buy on breakout
- Stop-Loss: Above resistance (for shorts)
- Tools: Trendlines, Moving Averages, Bollinger Bands, Ichimoku Cloud

---

## Trendlines

### Uptrend Line

**Definition:** Line connecting series of higher lows, indicating bullish momentum.

**Drawing Rules:**
1. Minimum 2 pivot lows required, 3+ for validation
2. Connect lows with straight line
3. Line acts as dynamic support
4. Steeper slope = stronger trend

**Drawing Instructions:**
```typescript
{
  type: 'trendline-bullish',
  points: [
    { price: low1, timestamp: timestamp1 },
    { price: low2, timestamp: timestamp2 },
    { price: low3, timestamp: timestamp3 } // optional but preferred
  ],
  style: 'dashed',
  color: 'green',
  confidence: 0.80
}
```

**Trading Signals:**
- Buy on touches of trendline (support)
- Exit if price breaks below with volume
- Target: Project trendline forward

---

### Downtrend Line

**Definition:** Line connecting series of lower highs, indicating bearish momentum.

**Drawing Rules:**
1. Minimum 2 pivot highs required, 3+ for validation
2. Connect highs with straight line
3. Line acts as dynamic resistance
4. Steeper slope = stronger downtrend

**Drawing Instructions:**
```typescript
{
  type: 'trendline-bearish',
  points: [
    { price: high1, timestamp: timestamp1 },
    { price: high2, timestamp: timestamp2 },
    { price: high3, timestamp: timestamp3 } // optional but preferred
  ],
  style: 'dashed',
  color: 'red',
  confidence: 0.80
}
```

**Trading Signals:**
- Sell on touches of trendline (resistance)
- Exit shorts if price breaks above with volume
- Avoid longs against the trend

**Trendline Types:**
- Linear (most common)
- Logarithmic (for long-term analysis)
- Polynomial (for curved trends)

---

## Channels

### Price Channels Overview

**Definition:** Parallel trendlines (upper and lower) containing price action.

**Types:**
1. **Ascending Channel** - Bullish, higher highs and higher lows
2. **Descending Channel** - Bearish, lower highs and lower lows
3. **Horizontal Channel** - Sideways, range-bound trading

**Formation Requirements:**
- Minimum 4 contact points (2 upper, 2 lower)
- Parallel or near-parallel trendlines
- Clear trend direction

---

### Ascending Channel

**Characteristics:**
- Upward sloping parallel lines
- Positive slope
- Bullish continuation pattern

**Drawing Instructions:**
```typescript
{
  type: 'channel-ascending',
  upperLine: {
    points: [
      { price: high1, timestamp: t1 },
      { price: high2, timestamp: t2 }
    ]
  },
  lowerLine: {
    points: [
      { price: low1, timestamp: t1 },
      { price: low2, timestamp: t2 }
    ]
  },
  color: 'green',
  confidence: 0.75
}
```

**Trading Strategy:**
- Buy near lower trendline (support)
- Sell/take profit near upper trendline (resistance)
- Stop-loss below channel
- Breakout above = strong bullish signal
- Breakout below = trend reversal

**Volume Pattern:**
- Lower volume in middle of channel
- Higher volume at extremes
- Breakout requires volume surge

---

### Descending Channel

**Characteristics:**
- Downward sloping parallel lines
- Negative slope
- Bearish continuation pattern

**Drawing Instructions:**
```typescript
{
  type: 'channel-descending',
  upperLine: {
    points: [
      { price: high1, timestamp: t1 },
      { price: high2, timestamp: t2 }
    ]
  },
  lowerLine: {
    points: [
      { price: low1, timestamp: t1 },
      { price: low2, timestamp: t2 }
    ]
  },
  color: 'red',
  confidence: 0.75
}
```

**Trading Strategy:**
- Short near upper trendline (resistance)
- Cover/take profit near lower trendline (support)
- Stop-loss above channel
- Be cautious with longs
- Breakout below = strong bearish signal

---

### Horizontal Channel (Rectangle)

**Characteristics:**
- Flat parallel lines
- Range-bound trading
- Consolidation pattern

**Drawing Instructions:**
```typescript
{
  type: 'channel-horizontal',
  upperResistance: price1,
  lowerSupport: price2,
  startTime: timestamp1,
  endTime: timestamp2,
  color: 'blue',
  confidence: 0.70
}
```

**Trading Strategy:**
- Buy at support, sell at resistance
- Do nothing in middle
- Breakout direction determines next trend
- Requires volume confirmation

**Reliability Indicators:**
- 3-4 touches: Adequate channel
- 5-6 touches: Strong channel
- 6+ touches: Very reliable

---

## Fibonacci Retracements

### Overview

**Key Levels:**
- 23.6% - Shallow retracement
- 38.2% - Common retracement
- 50.0% - Psychological level (not official Fibonacci)
- 61.8% - Golden ratio, most significant
- 78.6% - Deep retracement

**Calculation:**
```
Retracement Level = Pivot High - (Retracement % × Price Range)
where Price Range = Pivot High - Pivot Low
```

---

### Drawing Fibonacci

**Uptrend Retracement:**
1. Identify swing low (start point)
2. Identify swing high (end point)
3. Draw levels downward from high

**Downtrend Retracement:**
1. Identify swing high (start point)
2. Identify swing low (end point)
3. Draw levels upward from low

**Drawing Instructions:**
```typescript
{
  type: 'fibonacci-retracement',
  startPoint: { price: swingLow, timestamp: t1 },
  endPoint: { price: swingHigh, timestamp: t2 },
  levels: [
    { ratio: 0.236, price: calculated236 },
    { ratio: 0.382, price: calculated382 },
    { ratio: 0.500, price: calculated500 },
    { ratio: 0.618, price: calculated618 },
    { ratio: 0.786, price: calculated786 }
  ],
  direction: 'uptrend', // or 'downtrend'
  confidence: 0.70
}
```

**Trading Strategy:**
- Watch for support/resistance at Fib levels
- 61.8% most reliable for reversals
- Combine with other indicators (MACD, RSI)
- Can produce false signals - requires confirmation

**Best Practices:**
- Use with trending markets
- Combine with support/resistance
- Wait for price action confirmation

---

## Chart Patterns

### Head and Shoulders

**Type:** Bearish reversal pattern  
**Reliability:** High  
**Time Frame:** 3-6 months typically

**Structure:**
1. **Left Shoulder:** First peak
2. **Head:** Higher peak (tallest)
3. **Right Shoulder:** Third peak (similar height to left)
4. **Neckline:** Line connecting two troughs

**Drawing Instructions:**
```typescript
{
  type: 'head-and-shoulders',
  leftShoulder: { price: peak1, timestamp: t1 },
  head: { price: peak2, timestamp: t2 },
  rightShoulder: { price: peak3, timestamp: t3 },
  neckline: {
    point1: { price: trough1, timestamp: t1a },
    point2: { price: trough2, timestamp: t2a }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.85
}
```

**Trading Signals:**
- Entry: Break below neckline
- Stop-Loss: Above right shoulder
- Target: Neckline - (Head height - Neckline) = Projected decline
- Volume: Should decrease in right shoulder, increase on breakdown

**Characteristics:**
- Three peaks with middle highest
- Neckline can be horizontal or sloped
- Volume crucial for confirmation
- Time frame can be long (large stop distances)

---

### Inverse Head and Shoulders

**Type:** Bullish reversal pattern

**Structure:**
1. **Left Shoulder:** First trough
2. **Head:** Lower trough (deepest)
3. **Right Shoulder:** Third trough (similar depth to left)
4. **Neckline:** Line connecting two peaks

**Drawing Instructions:**
```typescript
{
  type: 'inverse-head-and-shoulders',
  leftShoulder: { price: trough1, timestamp: t1 },
  head: { price: trough2, timestamp: t2 },
  rightShoulder: { price: trough3, timestamp: t3 },
  neckline: {
    point1: { price: peak1, timestamp: t1a },
    point2: { price: peak2, timestamp: t2a }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.85
}
```

**Trading Signals:**
- Entry: Break above neckline
- Stop-Loss: Below right shoulder
- Target: Neckline + (Neckline - Head) = Projected rise
- Volume: Should increase on breakout

---

### Triangles

#### Ascending Triangle

**Type:** Bullish continuation/reversal  
**Reliability:** High

**Characteristics:**
- Flat top (horizontal resistance)
- Rising lows (upward sloping support)
- Buyers getting more aggressive

**Drawing Instructions:**
```typescript
{
  type: 'triangle-ascending',
  resistance: { price: flatTop, startTime: t1, endTime: t2 },
  support: {
    point1: { price: low1, timestamp: t1 },
    point2: { price: low2, timestamp: t2 }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.80
}
```

**Trading Signals:**
- Entry: Break above resistance
- Stop-Loss: Below last swing low
- Target: Resistance + Triangle height
- Confirmation: 2 closes beyond trendline + volume spike

---

#### Descending Triangle

**Type:** Bearish continuation/reversal  
**Reliability:** High

**Characteristics:**
- Flat bottom (horizontal support)
- Falling highs (downward sloping resistance)
- Sellers getting more aggressive

**Drawing Instructions:**
```typescript
{
  type: 'triangle-descending',
  support: { price: flatBottom, startTime: t1, endTime: t2 },
  resistance: {
    point1: { price: high1, timestamp: t1 },
    point2: { price: high2, timestamp: t2 }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.80
}
```

**Trading Signals:**
- Entry: Break below support
- Stop-Loss: Above last swing high
- Target: Support - Triangle height
- Confirmation: 2 closes beyond trendline + volume

---

#### Symmetrical Triangle

**Type:** Continuation pattern (direction unclear)  
**Reliability:** Medium

**Characteristics:**
- Converging trendlines
- Lower highs and higher lows
- Consolidation/indecision

**Drawing Instructions:**
```typescript
{
  type: 'triangle-symmetrical',
  upperTrendline: {
    point1: { price: high1, timestamp: t1 },
    point2: { price: high2, timestamp: t2 }
  },
  lowerTrendline: {
    point1: { price: low1, timestamp: t1 },
    point2: { price: low2, timestamp: t2 }
  },
  apex: { timestamp: convergenceTime },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.70
}
```

**Trading Signals:**
- Wait for breakout direction
- Entry: Break above/below with volume
- Target: Pattern height + breakout point
- Confirmation: Volume spike essential

---

### Wedges

#### Rising Wedge

**Type:** Bearish reversal (in uptrend) or continuation (in downtrend)  
**Reliability:** Medium-High

**Characteristics:**
- Both trendlines slope upward
- Upper trendline less steep than lower
- Converging lines
- Volume decreases

**Drawing Instructions:**
```typescript
{
  type: 'wedge-rising',
  upperTrendline: {
    point1: { price: high1, timestamp: t1 },
    point2: { price: high2, timestamp: t2 }
  },
  lowerTrendline: {
    point1: { price: low1, timestamp: t1 },
    point2: { price: low2, timestamp: t2 }
  },
  convergencePoint: { timestamp: tApex },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  context: 'uptrend', // or 'downtrend'
  confidence: 0.75
}
```

**Trading Signals:**
- Entry: Break below lower trendline
- Stop-Loss: Above recent high (smaller at convergence)
- Target: Start of wedge
- Context matters: More bearish in uptrend

---

#### Falling Wedge

**Type:** Bullish reversal or continuation  
**Reliability:** Medium-High

**Characteristics:**
- Both trendlines slope downward
- Lower trendline steeper than upper
- Converging lines
- Price decline losing momentum

**Drawing Instructions:**
```typescript
{
  type: 'wedge-falling',
  upperTrendline: {
    point1: { price: high1, timestamp: t1 },
    point2: { price: high2, timestamp: t2 }
  },
  lowerTrendline: {
    point1: { price: low1, timestamp: t1 },
    point2: { price: low2, timestamp: t2 }
  },
  convergencePoint: { timestamp: tApex },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  context: 'downtrend', // or 'uptrend'
  confidence: 0.75
}
```

**Trading Signals:**
- Entry: Break above upper trendline
- Stop-Loss: Below recent low
- Target: Height of wedge + breakout
- More bullish in downtrend context

---

### Double Top/Bottom

#### Double Top

**Type:** Bearish reversal  
**Reliability:** High  
**Time Frame:** Weeks to months

**Characteristics:**
- Two peaks at similar price
- Trough between peaks (neckline)
- "M" shaped pattern

**Drawing Instructions:**
```typescript
{
  type: 'double-top',
  firstPeak: { price: peak1, timestamp: t1 },
  secondPeak: { price: peak2, timestamp: t2 },
  neckline: { price: troughPrice, timestamp: tTrough },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.85
}
```

**Trading Signals:**
- Entry: Break below neckline
- Stop-Loss: Above second peak
- Target: Neckline - (Peak - Neckline) = Projected decline
- Volume: Decreases on second peak, increases on breakdown

**Validation:**
- Peaks within 3-5% of each other
- Sufficient time between peaks
- Clear neckline
- Volume confirmation

---

#### Double Bottom

**Type:** Bullish reversal  
**Reliability:** High  
**Time Frame:** Weeks to months

**Characteristics:**
- Two troughs at similar price
- Peak between troughs (neckline)
- "W" shaped pattern

**Drawing Instructions:**
```typescript
{
  type: 'double-bottom',
  firstBottom: { price: bottom1, timestamp: t1 },
  secondBottom: { price: bottom2, timestamp: t2 },
  neckline: { price: peakPrice, timestamp: tPeak },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.85
}
```

**Trading Signals:**
- Entry: Break above neckline
- Stop-Loss: Below second bottom
- Target: Neckline + (Neckline - Bottom) = Projected rise
- Volume: Should increase on breakout

---

### Triple Top/Bottom

#### Triple Top

**Type:** Bearish reversal  
**Reliability:** Very High (but rare)  
**Time Frame:** 3-6 months

**Characteristics:**
- Three peaks at similar price level
- Two troughs forming support (neckline)
- Stronger than double top

**Drawing Instructions:**
```typescript
{
  type: 'triple-top',
  peak1: { price: p1, timestamp: t1 },
  peak2: { price: p2, timestamp: t2 },
  peak3: { price: p3, timestamp: t3 },
  neckline: {
    point1: { price: trough1, timestamp: tT1 },
    point2: { price: trough2, timestamp: tT2 }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.90
}
```

**Trading Signals:**
- Entry: Break below neckline with volume
- Stop-Loss: Above third peak
- Target: Neckline - Pattern height
- Volume: Decreases with each peak, surges on breakdown

**Psychology:**
- Three failed attempts to break resistance
- Growing skepticism and risk aversion
- Strong psychological ceiling

---

#### Triple Bottom

**Type:** Bullish reversal  
**Reliability:** Very High (but rare)  
**Time Frame:** 3-6 months

**Characteristics:**
- Three troughs at similar price level
- Two peaks forming resistance (neckline)
- Support tested and held three times

**Drawing Instructions:**
```typescript
{
  type: 'triple-bottom',
  bottom1: { price: b1, timestamp: t1 },
  bottom2: { price: b2, timestamp: t2 },
  bottom3: { price: b3, timestamp: t3 },
  neckline: {
    point1: { price: peak1, timestamp: tP1 },
    point2: { price: peak2, timestamp: tP2 }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.90
}
```

**Trading Signals:**
- Entry: Break above neckline with volume
- Stop-Loss: Below third bottom
- Target: Neckline + Pattern height
- Volume: Increases on breakout

**Psychology:**
- Market can't break support despite attempts
- Builds confidence among buyers
- Strong psychological floor

---

### Cup and Handle

**Type:** Bullish continuation  
**Reliability:** High  
**Time Frame:** 7-65 weeks (William J. O'Neil)

**Characteristics:**
- U-shaped "cup" (rounded bottom)
- Downward "handle" on right side
- Volume decreases in cup, increases on breakout
- Avoid V-bottoms (prefer rounded U)

**Drawing Instructions:**
```typescript
{
  type: 'cup-and-handle',
  cupStart: { price: p1, timestamp: t1 },
  cupBottom: { price: pBottom, timestamp: tBottom },
  cupEnd: { price: p2, timestamp: t2 },
  handleStart: { price: p2, timestamp: t2 },
  handleLow: { price: pHandleLow, timestamp: tHandleLow },
  handleEnd: { price: p3, timestamp: t3 },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.80
}
```

**Trading Signals:**
- Entry: Break above handle resistance
- Stop-Loss: Below handle low
- Target: Cup height + Breakout point
- Volume: Critical - must surge on breakout

**Cup Characteristics:**
- Should be U-shaped (not V)
- Depth: 12-33% typical
- Time: Several weeks to months

**Handle Characteristics:**
- Smaller than cup
- Downward drift
- Forms on right side
- Duration: 1-4 weeks typical

---

### Flags and Pennants

#### Flag Pattern

**Type:** Continuation pattern  
**Reliability:** Medium-High  
**Time Frame:** 1-3 weeks

**Characteristics:**
- Sharp price move (flagpole)
- Rectangular consolidation (flag)
- Parallel trendlines
- Counter-trend movement
- 5-20 price bars typically

**Bullish Flag:**
```typescript
{
  type: 'flag-bullish',
  flagpole: {
    start: { price: p1, timestamp: t1 },
    end: { price: p2, timestamp: t2 }
  },
  flag: {
    upperTrendline: {
      point1: { price: h1, timestamp: t3 },
      point2: { price: h2, timestamp: t4 }
    },
    lowerTrendline: {
      point1: { price: l1, timestamp: t3 },
      point2: { price: l2, timestamp: t4 }
    }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.75
}
```

**Bearish Flag:**
- Same structure but inverted
- Flag slopes upward after sharp decline

**Trading Signals:**
- Entry: Break of flag in pole direction
- Stop-Loss: Opposite side of flag
- Target: Flagpole height + Breakout
- Volume: High in pole, low in flag, high on breakout

**Volume Pattern (Bullish):**
- Increases during initial trend (pole)
- Decreases during consolidation (flag)
- Must increase on breakout

**Volume Pattern (Bearish):**
- May not decline in flag (fear/anxiety)
- Holding at elevated levels
- High volume on breakdown

---

#### Pennant Pattern

**Type:** Continuation pattern  
**Reliability:** Medium-High  
**Time Frame:** 1-3 weeks

**Characteristics:**
- Sharp price move (flagpole)
- Triangular consolidation (pennant)
- Converging trendlines (not parallel like flag)
- Small symmetrical triangle

**Drawing Instructions:**
```typescript
{
  type: 'pennant',
  flagpole: {
    start: { price: p1, timestamp: t1 },
    end: { price: p2, timestamp: t2 }
  },
  pennant: {
    upperTrendline: {
      point1: { price: h1, timestamp: t3 },
      point2: { price: h2, timestamp: t4 }
    },
    lowerTrendline: {
      point1: { price: l1, timestamp: t3 },
      point2: { price: l2, timestamp: t4 }
    },
    apex: { timestamp: tApex }
  },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  direction: 'bullish', // or 'bearish'
  confidence: 0.75
}
```

**Difference from Flag:**
- Pennant: Converging trendlines (triangle)
- Flag: Parallel trendlines (rectangle)

**Trading Signals:**
- Entry: Break in direction of pole
- Stop-Loss: Lowest point of pennant
- Target: Flagpole height + Breakout
- Confirmation: Above-average volume on breakout

**Psychology:**
- Brief pause/consolidation
- Market indecision temporarily
- Buyers and sellers balanced
- Breakout shows continuation commitment

---

### Rounding Bottom (Saucer Bottom)

**Type:** Bullish reversal  
**Reliability:** High (but rare)  
**Time Frame:** Weeks to months

**Characteristics:**
- U-shaped price movement
- Gradual shift from bearish to bullish
- No handle (unlike Cup & Handle)
- Extended time frame

**Drawing Instructions:**
```typescript
{
  type: 'rounding-bottom',
  start: { price: p1, timestamp: t1 },
  bottom: { price: pBottom, timestamp: tBottom },
  end: { price: p2, timestamp: t2 },
  breakoutPoint: { price: breakPrice, timestamp: tBreak },
  confidence: 0.75
}
```

**Volume Pattern:**
- Heaviest at start of decline
- Decreases as price approaches bottom
- Increases during recovery
- Peaks at breakout

**Trading Signals:**
- Entry: Break above initial decline level
- Stop-Loss: Below rounded bottom
- Target: Bottom depth + Breakout
- Patient pattern - takes time to form

**Psychology:**
- Gradual sentiment shift
- Excess supply diminishes slowly
- Buyers slowly enter at low prices
- Momentum builds gradually

---

## Gaps

### Overview

**Definition:** Discontinuity in price chart where price jumps without trading in between.

**Types:** 4 main categories

**Occurrence:**
- Due to news/events outside trading hours
- Opening price significantly different from previous close
- Many gaps get "filled" as price returns to pre-gap levels

---

### Common Gap

**Characteristics:**
- No major event/news
- Normal trading activity
- Usually filled within few days
- Also called "area gaps" or "trading gaps"
- Normal average volume

**Drawing Instructions:**
```typescript
{
  type: 'gap-common',
  gapStart: { price: closePrice, timestamp: t1 },
  gapEnd: { price: openPrice, timestamp: t2 },
  filled: false, // or true if filled
  fillDate: null, // or timestamp when filled
  confidence: 0.50
}
```

**Trading Approach:**
- Low significance
- Often fade (trade against)
- Wait for fill
- Not actionable for trend following

---

### Breakaway Gap

**Characteristics:**
- Gaps above resistance or below support
- Occurs at end of price pattern
- Marks beginning of new trend
- Significant volume increase
- Often NOT filled quickly

**Drawing Instructions:**
```typescript
{
  type: 'gap-breakaway',
  gapStart: { price: closePrice, timestamp: t1 },
  gapEnd: { price: openPrice, timestamp: t2 },
  direction: 'bullish', // or 'bearish'
  priorPattern: 'trading-range', // or pattern type
  volume: 'high',
  confidence: 0.85
}
```

**Trading Signals:**
- Entry: Trade in direction of gap
- Strong trend initiation signal
- Don't expect quick fill
- Volume confirmation essential

**Context:**
- Breaking from trading range
- Breaking from triangle, wedge, etc.
- Major resistance/support break

---

### Runaway Gap (Continuation Gap)

**Characteristics:**
- Occurs mid-trend
- Skips sequential price points
- Shows strong momentum
- Often called "measuring gap"
- Can estimate remaining move

**Drawing Instructions:**
```typescript
{
  type: 'gap-runaway',
  gapStart: { price: closePrice, timestamp: t1 },
  gapEnd: { price: openPrice, timestamp: t2 },
  trendDirection: 'up', // or 'down'
  estimatedTarget: calculatedPrice,
  confidence: 0.75
}
```

**Trading Signals:**
- Confirms trend strength
- Entry: Continue with trend
- Measuring: Gap often at midpoint of move
- Target: Project equal distance from gap

**Characteristics:**
- Intense investor interest
- High volume
- Rapid price movement
- Usually not filled during trend

---

### Exhaustion Gap

**Characteristics:**
- Occurs at end of trend
- Final burst of buying/selling
- Often filled quickly
- Marks trend reversal
- Volume may be high but unsustainable

**Drawing Instructions:**
```typescript
{
  type: 'gap-exhaustion',
  gapStart: { price: closePrice, timestamp: t1 },
  gapEnd: { price: openPrice, timestamp: t2 },
  priorTrend: 'uptrend', // or 'downtrend'
  reversalConfirmed: true,
  confidence: 0.80
}
```

**Trading Signals:**
- Warning: Trend ending
- Entry: Fade the gap (trade against)
- Expect fill and reversal
- Stop-Loss: Beyond gap extreme

**Identification:**
- After rapid price rise/fall
- Climactic volume
- Followed by reversal
- Gap filled relatively quickly

---


## Implementation Guidelines

### General Principles

1. **Volume Integration:**
   - Track volume data alongside price
   - Require volume confirmation for pattern validation
   - Volume decreases during consolidation, increases on breakout

2. **Confidence Scoring:**
   ```typescript
   confidence = (
     touchPoints × 0.3 +
     volumeConfirmation × 0.3 +
     timeInPattern × 0.2 +
     symmetry × 0.2
   )
   ```

3. **Pattern Recognition Pipeline:**
   ```
   Raw Price Data
     ↓
   Pivot Point Detection
     ↓
   Pattern Matching Algorithm
     ↓
   Volume Validation
     ↓
   Confidence Calculation
     ↓
   AI Pattern Output (JSON)
   ```

4. **Time Frame Validation:**
   - Daily charts: Most reliable for patterns
   - Hourly charts: More frequent but less reliable
   - Weekly/Monthly: Very reliable but slower signals
   - Minimum formation time: 2 weeks for most patterns

5. **Price Target Calculation:**
   ```typescript
   // For bullish patterns
   target = breakoutPrice + patternHeight
   
   // For bearish patterns
   target = breakoutPrice - patternHeight
   
   // Pattern height
   patternHeight = highestPoint - lowestPoint
   ```

6. **Stop-Loss Guidelines:**
   ```typescript
   // Bullish patterns
   stopLoss = lowestPointInPattern - (ATR × 1.5)
   
   // Bearish patterns
   stopLoss = highestPointInPattern + (ATR × 1.5)
   ```

---

### AI Prompt Enhancement

**Current vs Enhanced Prompts:**

**Before:**
```json
{
  "instruction": "Identify support and resistance levels"
}
```

**After:**
```json
{
  "instruction": "Identify support levels by connecting minimum 2 swing lows at similar price. Draw horizontal line. Validate with volume increase on tests. Confidence increases with more touches (3+ = strong). Consider polarity principle where broken support becomes resistance.",
  "drawingRules": {
    "minimumTouches": 2,
    "priceTolerancePercent": 1.5,
    "volumeConfirmation": true,
    "style": "solid",
    "color": "green"
  }
}
```

---

### New Pattern Type Structure

```typescript
export type AIPatternType =
  // Support/Resistance
  | 'support'
  | 'resistance'
  
  // Trendlines
  | 'trendline-bullish'
  | 'trendline-bearish'
  
  // Channels
  | 'channel-ascending'
  | 'channel-descending'
  | 'channel-horizontal'
  
  // Fibonacci
  | 'fibonacci-retracement'
  | 'fibonacci-extension'
  
  // Reversal Patterns
  | 'head-and-shoulders'
  | 'inverse-head-and-shoulders'
  | 'double-top'
  | 'double-bottom'
  | 'triple-top'
  | 'triple-bottom'
  | 'rounding-bottom'
  
  // Continuation Patterns
  | 'triangle-ascending'
  | 'triangle-descending'
  | 'triangle-symmetrical'
  | 'wedge-rising'
  | 'wedge-falling'
  | 'flag-bullish'
  | 'flag-bearish'
  | 'pennant'
  | 'cup-and-handle'
  
  // Gaps
  | 'gap-common'
  | 'gap-breakaway'
  | 'gap-runaway'
  | 'gap-exhaustion'
```

---

### Color Scheme

```typescript
export const PATTERN_COLORS = {
  // Support/Resistance
  support: '#22c55e',           // Green
  resistance: '#ef4444',        // Red
  
  // Trendlines
  'trendline-bullish': '#10b981',
  'trendline-bearish': '#f43f5e',
  
  // Channels
  'channel-ascending': '#059669',
  'channel-descending': '#dc2626',
  'channel-horizontal': '#3b82f6',
  
  // Fibonacci
  'fibonacci-retracement': '#8b5cf6',
  'fibonacci-extension': '#a78bfa',
  
  // Reversal Patterns
  'head-and-shoulders': '#ef4444',
  'inverse-head-and-shoulders': '#22c55e',
  'double-top': '#dc2626',
  'double-bottom': '#16a34a',
  'triple-top': '#b91c1c',
  'triple-bottom': '#15803d',
  'rounding-bottom': '#4ade80',
  
  // Continuation Patterns
  'triangle-ascending': '#10b981',
  'triangle-descending': '#f43f5e',
  'triangle-symmetrical': '#6366f1',
  'wedge-rising': '#f97316',
  'wedge-falling': '#06b6d4',
  'flag-bullish': '#84cc16',
  'flag-bearish': '#f59e0b',
  'pennant': '#8b5cf6',
  'cup-and-handle': '#14b8a6',
  
  // Gaps
  'gap-common': '#94a3b8',
  'gap-breakaway': '#6366f1',
  'gap-runaway': '#8b5cf6',
  'gap-exhaustion': '#ec4899',
  
} as const;
```

---

### Rendering Specifications

**Line Styles:**
```typescript
export const LINE_STYLES = {
  support: 'solid',
  resistance: 'solid',
  'trendline-bullish': 'dashed',
  'trendline-bearish': 'dashed',
  fibonacci: 'dotted',
  channel: 'solid',
  pattern: 'solid'
} as const;
```

**Line Widths:**
```typescript
export const LINE_WIDTHS = {
  primary: 2,      // Main pattern lines
  secondary: 1.5,  // Supporting lines
  thin: 1,         // Guidelines/references
  thick: 3         // High-confidence patterns
} as const;
```

**Opacity/Alpha:**
```typescript
export const OPACITY = {
  line: 0.8,
  zone: 0.2,       // Filled areas
  label: 0.9,
  inactive: 0.4    // When hovering other pattern
} as const;
```

---

## References

### Primary Sources

1. **Investopedia** - Technical Analysis Educational Content
   - Fibonacci Retracements: https://www.investopedia.com/terms/f/fibonacciretracement.asp
   - Support Levels: https://www.investopedia.com/terms/s/support.asp
   - Resistance Levels: https://www.investopedia.com/terms/r/resistance.asp
   - Head & Shoulders: https://www.investopedia.com/terms/h/head-shoulders.asp
   - Triangle Patterns: https://www.investopedia.com/terms/t/triangle.asp
   - Wedge Patterns: https://www.investopedia.com/terms/w/wedge.asp
   - Double Top/Bottom: https://www.investopedia.com/terms/d/double-top-and-bottom.asp
   - Cup & Handle: https://www.investopedia.com/terms/c/cupandhandle.asp
   - Price Channels: https://www.investopedia.com/terms/p/price-channel.asp
   - Flag Pattern: https://www.investopedia.com/terms/f/flag.asp
   - Pennant Pattern: https://www.investopedia.com/terms/p/pennant.asp
   - Gaps: https://www.investopedia.com/terms/g/gap.asp
   - Triple Tops/Bottoms: https://www.investopedia.com/articles/technical/02/012102.asp
   - Trendlines: https://www.investopedia.com/terms/t/trendline.asp

2. **Wikipedia** - Technical Analysis Overview
   - General technical analysis concepts and history

### Additional Reading

- William J. O'Neil - Cup and Handle pattern research

---

## Document History

- **v1.0** (2025-11-17): Initial comprehensive documentation based on Investopedia research
- Research complete, implementation pending
- 30+ pattern types documented with drawing specifications
- Integration with Fibonacci ratios and volume analysis
- Color scheme and rendering specifications defined

---

**Next Steps:**
1. Update AI prompts with detailed drawing instructions
2. Implement new pattern type system
3. Create pattern recognition algorithms
4. Update UI for pattern references (colored outlined tags)
5. Test and validate pattern detection accuracy
