# Algorithmic Pattern Detection - Implementation Plan

**Version:** 1.0  
**Created:** November 25, 2025  
**Status:** Planning Phase  
**Branch:** To be created from `develop`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Objectives](#objectives)
3. [Current State Analysis](#current-state-analysis)
4. [Architecture](#architecture)
5. [Implementation Phases](#implementation-phases)
6. [Technical Specifications](#technical-specifications)
7. [Testing Strategy](#testing-strategy)
8. [Performance Considerations](#performance-considerations)
9. [AI Integration Strategy](#ai-integration-strategy)
10. [Success Metrics](#success-metrics)

---

## Overview

This document outlines the implementation plan for automatic technical analysis pattern detection using algorithmic approaches instead of relying solely on AI models. The goal is to create a deterministic, rule-based system that follows the patterns documented in `TECHNICAL_ANALYSIS_PATTERNS.md`.

### Problem Statement

**Current System:**
- 100% dependent on AI models for pattern detection
- Sends large context (candle data) to AI APIs
- Variable accuracy based on AI model interpretation
- High API costs for pattern recognition
- No control over detection logic

**Proposed Solution:**
- Implement algorithmic pattern detection using documented rules
- AI focuses on interpretation and market context analysis
- Reduce data sent to AI APIs (send detected patterns instead of raw candles)
- Deterministic, testable, reproducible pattern detection
- Lower costs and improved performance

---

## Objectives

### Primary Goals

1. **Implement algorithmic detection** for 34 pattern types documented in `TECHNICAL_ANALYSIS_PATTERNS.md`
2. **Maintain compatibility** with existing `AIStudy` type system and rendering
3. **Reduce AI API usage** by offloading pattern detection to local algorithms
4. **Improve reliability** with deterministic, rule-based detection
5. **Enable hybrid mode** where algorithms detect patterns and AI provides interpretation

### Secondary Goals

1. Performance optimization using Web Workers for background detection
2. Real-time pattern updates as new candles arrive
3. Comprehensive test coverage for all pattern detection algorithms
4. User-configurable detection sensitivity and thresholds
5. Pattern detection confidence visualization

---

## Current State Analysis

### Available Assets

✅ **Complete Type System**
- `src/shared/types/study.ts` - 34 study types defined
- All pattern interfaces with required fields
- Compatible with existing rendering system

✅ **Candle Data Structure**
```typescript
interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
```

✅ **Drawing Infrastructure**
- `src/renderer/utils/canvasUtils.ts` - Canvas primitives
- `src/renderer/utils/chartUtils.ts` - Coordinate conversions
- Study renderers for all 34 pattern types

✅ **Technical Indicators**
- `calculateSMA()` / `calculateEMA()` - Moving averages
- `calculateRSI()` - Relative Strength Index
- `calculateStochastic()` - Stochastic oscillator

✅ **Comprehensive Documentation**
- `docs/TECHNICAL_ANALYSIS_PATTERNS.md` - 1400+ lines of pattern rules
- Drawing specifications for each pattern
- Volume confirmation requirements
- Confidence scoring formula

✅ **Storage & Persistence**
- `src/renderer/services/AIStudyStorage.ts` - Study persistence per symbol

### Missing Components

❌ **Pattern Detection Algorithms**
- No pivot point detection
- No swing high/low identification
- No pattern matching logic
- No automatic study generation

❌ **Validation System**
- No programmatic confidence scoring
- No volume pattern validation
- No time frame validation

---

## Architecture

### Module Structure

```
src/renderer/utils/patternDetection/
├── index.ts                          # Public API exports
├── types.ts                          # Detection-specific types
├── constants.ts                      # Thresholds, tolerances
│
├── core/
│   ├── pivotPoints.ts                # Swing high/low detection
│   ├── volumeAnalysis.ts             # Volume pattern validation
│   ├── confidenceScoring.ts          # Confidence calculation
│   └── patternValidator.ts           # Generic pattern validation
│
├── patterns/
│   ├── supportResistance.ts          # Support/resistance levels
│   ├── trendlines.ts                 # Bullish/bearish trendlines
│   ├── channels.ts                   # Ascending/descending/horizontal
│   ├── fibonacci.ts                  # Fibonacci retracements
│   ├── chartPatterns.ts              # Complex chart patterns
│   │   ├── headAndShoulders.ts       # H&S and inverse
│   │   ├── triangles.ts              # Ascending/descending/symmetrical
│   │   ├── wedges.ts                 # Rising/falling wedges
│   │   ├── doubleTops.ts             # Double/triple top/bottom
│   │   ├── cupAndHandle.ts           # Cup and handle
│   │   ├── flagsAndPennants.ts       # Flags and pennants
│   │   └── roundingBottom.ts         # Rounding bottom
│   ├── gaps.ts                       # Gap detection (4 types)
│   └── elliottWave.ts                # Elliott Wave (low priority)
│
└── services/
    └── PatternDetectionService.ts    # Main orchestrator
```

### Service Integration

```typescript
// New service
class PatternDetectionService {
  detectPatterns(candles: Candle[]): AIStudy[] {
    // Orchestrate all pattern detectors
    // Apply confidence thresholds
    // Return compatible AIStudy objects
  }
}

// Integration with existing system
class AIService {
  async analyzeChart(params: {
    candles: Candle[];
    useAlgorithmicDetection: boolean;
  }) {
    let studies: AIStudy[] = [];
    
    if (useAlgorithmicDetection) {
      // Use PatternDetectionService
      studies = patternDetectionService.detectPatterns(candles);
      
      // Send detected patterns to AI for interpretation
      const aiResponse = await this.interpretPatterns(studies);
      return aiResponse;
    } else {
      // Traditional AI-only approach
      const aiResponse = await this.analyzeWithAI(candles);
      return aiResponse;
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1-2)

**Priority:** Critical  
**Dependencies:** None

#### 1.1 Pivot Point Detection

**File:** `src/renderer/utils/patternDetection/core/pivotPoints.ts`

**Features:**
- Detect swing highs using lookback/lookahead windows
- Detect swing lows using lookback/lookahead windows
- Configurable sensitivity (window size: 3-10 candles)
- Return pivot point with confidence score

**Algorithm:**
```typescript
interface PivotPoint {
  index: number;
  price: number;
  timestamp: number;
  type: 'high' | 'low';
  strength: number; // How many candles confirmed
}

function findPivotHighs(
  candles: Candle[],
  lookback: number = 5,
  lookahead: number = 5
): PivotPoint[] {
  // For each candle, check if high > all highs in window
  // Return pivot points with strength score
}
```

**Tests:**
- Identify obvious peaks in sample data
- Handle edge cases (start/end of array)
- Configurable sensitivity

#### 1.2 Volume Analysis

**File:** `src/renderer/utils/patternDetection/core/volumeAnalysis.ts`

**Features:**
- Calculate average volume over period
- Detect volume spikes (>1.5x average)
- Volume trend analysis (increasing/decreasing)
- Volume confirmation for patterns

**Functions:**
```typescript
function calculateAverageVolume(candles: Candle[], period: number): number
function detectVolumeSpike(candle: Candle, avgVolume: number): boolean
function getVolumePattern(candles: Candle[]): 'increasing' | 'decreasing' | 'stable'
function validateVolumeConfirmation(pattern: PatternData): boolean
```

#### 1.3 Confidence Scoring

**File:** `src/renderer/utils/patternDetection/core/confidenceScoring.ts`

**Formula (from TECHNICAL_ANALYSIS_PATTERNS.md):**
```typescript
confidence = (
  touchPoints × 0.3 +
  volumeConfirmation × 0.3 +
  timeInPattern × 0.2 +
  symmetry × 0.2
)
```

**Implementation:**
```typescript
interface ConfidenceFactors {
  touchPoints: number;      // 0-1 normalized (touches / ideal touches)
  volumeConfirmation: number; // 0-1 (volume rules satisfied)
  timeInPattern: number;     // 0-1 (formation time vs minimum)
  symmetry: number;          // 0-1 (pattern symmetry score)
}

function calculateConfidence(factors: ConfidenceFactors): number
```

---

### Phase 2: Basic Patterns (Week 3-4)

**Priority:** High  
**Dependencies:** Phase 1 complete

#### 2.1 Support and Resistance

**File:** `src/renderer/utils/patternDetection/patterns/supportResistance.ts`

**Algorithm:**
1. Find all pivot lows (for support)
2. Cluster pivots within price tolerance (1-2%)
3. Require minimum 2 touches
4. Validate with volume (increase on tests)
5. Calculate confidence score

**Implementation:**
```typescript
function detectSupport(candles: Candle[], pivots: PivotPoint[]): SupportStudy[] {
  // Cluster pivot lows by price
  const clusters = clusterPivotsByPrice(
    pivots.filter(p => p.type === 'low'),
    priceTolerancePercent: 1.5
  );
  
  // Filter by minimum touches
  const validClusters = clusters.filter(c => c.touches >= 2);
  
  // Validate volume patterns
  // Calculate confidence
  // Return SupportStudy objects
}

function detectResistance(candles: Candle[], pivots: PivotPoint[]): ResistanceStudy[]
```

**Tests:**
- Detect horizontal support at repeated lows
- Detect horizontal resistance at repeated highs
- Polarity principle (broken support becomes resistance)

#### 2.2 Trendlines

**File:** `src/renderer/utils/patternDetection/patterns/trendlines.ts`

**Algorithm:**
1. Connect pivot points using linear regression
2. Validate minimum 2 points (prefer 3+)
3. Check if price respects trendline (bounces)
4. Calculate angle/slope
5. Return trendline study

**Implementation:**
```typescript
function detectBullishTrendlines(
  candles: Candle[],
  pivots: PivotPoint[]
): TrendlineBullishStudy[] {
  // Connect ascending pivot lows
  // Use least squares regression
  // Validate bounces off trendline
  // Calculate confidence
}

function detectBearishTrendlines(
  candles: Candle[],
  pivots: PivotPoint[]
): TrendlineBearishStudy[]
```

**Linear Regression:**
```typescript
function fitTrendline(points: Point[]): {
  slope: number;
  intercept: number;
  r2: number; // Goodness of fit
}
```

#### 2.3 Channels

**File:** `src/renderer/utils/patternDetection/patterns/channels.ts`

**Algorithm:**
1. Find parallel trendlines (upper and lower)
2. Require 4+ contact points (2 upper, 2 lower)
3. Validate parallelism (slopes within tolerance)
4. Calculate channel width consistency

**Implementation:**
```typescript
function detectAscendingChannels(
  candles: Candle[],
  pivots: PivotPoint[]
): ChannelAscendingStudy[] {
  // Find upward sloping trendline (lows)
  // Find parallel resistance line (highs)
  // Validate 4+ touches
  // Check slope consistency
}

function detectDescendingChannels(...)
function detectHorizontalChannels(...) // Range-bound
```

---

### Phase 3: Fibonacci & Chart Patterns (Week 5-6)

**Priority:** High  
**Dependencies:** Phase 2 complete

#### 3.1 Fibonacci Retracements

**File:** `src/renderer/utils/patternDetection/patterns/fibonacci.ts`

**Algorithm:**
1. Identify significant swing high and swing low
2. Calculate Fibonacci levels (23.6%, 38.2%, 50%, 61.8%, 78.6%)
3. Check if price respects levels (support/resistance)
4. Return Fibonacci study with all levels

**Implementation:**
```typescript
function detectFibonacciRetracements(
  candles: Candle[],
  pivots: PivotPoint[]
): FibonacciRetracementStudy[] {
  // Find major swing points (highest high, lowest low)
  const swingHigh = findHighestPivot(pivots);
  const swingLow = findLowestPivot(pivots);
  
  // Calculate levels
  const range = swingHigh.price - swingLow.price;
  const levels = {
    '23.6%': swingHigh.price - (range * 0.236),
    '38.2%': swingHigh.price - (range * 0.382),
    '50.0%': swingHigh.price - (range * 0.500),
    '61.8%': swingHigh.price - (range * 0.618),
    '78.6%': swingHigh.price - (range * 0.786),
  };
  
  // Validate price reactions at levels
  // Return study
}
```

#### 3.2 Triangles

**File:** `src/renderer/utils/patternDetection/patterns/chartPatterns.ts`

**Patterns:**
- Ascending Triangle (flat top + rising lows)
- Descending Triangle (flat bottom + falling highs)
- Symmetrical Triangle (converging trendlines)

**Algorithm:**
```typescript
function detectAscendingTriangles(
  candles: Candle[],
  pivots: PivotPoint[]
): TriangleAscendingStudy[] {
  // Find horizontal resistance (repeated highs)
  // Find rising support trendline (ascending lows)
  // Validate convergence
  // Check for breakout
}
```

#### 3.3 Head and Shoulders

**File:** `src/renderer/utils/patternDetection/patterns/chartPatterns.ts`

**Algorithm:**
1. Find 3 peaks (left shoulder, head, right shoulder)
2. Validate: head > shoulders, shoulders similar height
3. Draw neckline through troughs
4. Check volume (decreasing in right shoulder)

**Implementation:**
```typescript
function detectHeadAndShoulders(
  candles: Candle[],
  pivots: PivotPoint[]
): HeadAndShouldersStudy[] {
  // Find sequence of 3 pivot highs
  // Validate middle is highest
  // Validate shoulders within 5% height
  // Find neckline (connect troughs)
  // Volume validation
}
```

---

### Phase 4: Advanced Patterns (Week 7-8)

**Priority:** Medium  
**Dependencies:** Phase 3 complete

#### 4.1 Wedges

- Rising Wedge (bearish)
- Falling Wedge (bullish)

#### 4.2 Double/Triple Tops and Bottoms

**Algorithm:**
1. Find 2 or 3 peaks at similar price (within 3-5%)
2. Validate time between peaks (weeks to months)
3. Identify neckline
4. Volume confirmation

#### 4.3 Flags and Pennants

**Algorithm:**
1. Detect strong price move (flagpole)
2. Identify consolidation pattern
3. Flags: Parallel trendlines (rectangular)
4. Pennants: Converging trendlines (triangular)
5. Validate breakout direction

#### 4.4 Cup and Handle

**Algorithm:**
1. Identify U-shaped bottom (cup)
2. Detect downward drift on right side (handle)
3. Validate cup depth (12-33% typical)
4. Check time frame (7-65 weeks)
5. Volume pattern validation

#### 4.5 Gaps

**Types:**
- Common Gap
- Breakaway Gap
- Runaway Gap (Continuation)
- Exhaustion Gap

**Algorithm:**
```typescript
function detectGaps(candles: Candle[]): GapStudy[] {
  // Find gaps where open != previous close
  // Classify gap type based on:
  //   - Volume
  //   - Trend context
  //   - Whether gap gets filled
  //   - Position in trend
}
```

---

### Phase 5: Service Integration (Week 9)

**Priority:** Critical  
**Dependencies:** Phases 1-4 complete

#### 5.1 Pattern Detection Service

**File:** `src/renderer/services/PatternDetectionService.ts`

**Features:**
```typescript
class PatternDetectionService {
  private detectors = [
    detectSupport,
    detectResistance,
    detectBullishTrendlines,
    detectBearishTrendlines,
    // ... all pattern detectors
  ];
  
  detectPatterns(
    candles: Candle[],
    options?: DetectionOptions
  ): AIStudy[] {
    // 1. Find pivot points
    const pivots = findPivotPoints(candles);
    
    // 2. Run all pattern detectors in parallel
    const allStudies = await Promise.all(
      this.detectors.map(detector => detector(candles, pivots))
    );
    
    // 3. Flatten and filter by confidence threshold
    const studies = allStudies
      .flat()
      .filter(s => s.confidence >= options.minConfidence);
    
    // 4. Remove duplicates/overlapping patterns
    const deduplicated = deduplicateStudies(studies);
    
    // 5. Sort by priority (reversals > continuations > S/R)
    const sorted = sortByPriority(deduplicated);
    
    // 6. Assign study numbers
    return assignStudyNumbers(sorted);
  }
  
  detectPatternsIncremental(
    existingStudies: AIStudy[],
    newCandles: Candle[]
  ): AIStudy[] {
    // Optimized for real-time updates
    // Only recalculate patterns affected by new candles
  }
}
```

#### 5.2 AI Service Integration

**File:** `src/renderer/services/AIService.ts`

**Refactor AI flow:**
```typescript
async analyzeChart(params: AnalysisParams): Promise<AIResponse> {
  const { symbol, candles, useAlgorithmicDetection } = params;
  
  if (useAlgorithmicDetection) {
    // Phase 1: Detect patterns algorithmically
    const detectedStudies = patternDetectionService.detectPatterns(candles);
    
    // Phase 2: Send detected patterns to AI for interpretation
    const prompt = this.buildInterpretationPrompt(detectedStudies, candles);
    const aiResponse = await this.callAI(prompt);
    
    // Phase 3: Merge algorithmic studies with AI insights
    return {
      studies: detectedStudies,
      analysis: aiResponse.analysis,
      confidence: aiResponse.confidence
    };
  } else {
    // Traditional full AI analysis
    return this.analyzeWithAI(candles);
  }
}

private buildInterpretationPrompt(
  studies: AIStudy[],
  recentCandles: Candle[]
): string {
  return `
    The following patterns have been detected in the chart:
    ${studies.map(s => `- Study #${s.number}: ${s.type}`).join('\n')}
    
    Recent price action: ${formatRecentCandles(recentCandles)}
    
    Please provide:
    1. Market context and interpretation of detected patterns
    2. Trading implications and potential price targets
    3. Risk assessment and key levels to watch
    4. Overall market sentiment analysis
  `;
}
```

---

### Phase 6: UI Integration (Week 10)

**Priority:** High  
**Dependencies:** Phase 5 complete

#### 6.1 Settings Toggle

**File:** `src/renderer/store/settingsStore.ts`

**New Settings:**
```typescript
interface AISettings {
  // Existing...
  provider: AIProvider;
  apiKey: string;
  
  // New
  patternDetectionMode: 'ai-only' | 'algorithmic-only' | 'hybrid';
  algorithmicSettings: {
    minConfidence: number; // 0.5 - 0.9
    pivotSensitivity: number; // 3-10 candles
    enabledPatterns: AIStudyType[]; // User can disable specific patterns
  };
}
```

**UI Component:**
```tsx
<FormControl>
  <FormLabel>{t('settings.ai.patternDetection')}</FormLabel>
  <Select value={patternDetectionMode} onChange={...}>
    <option value="ai-only">{t('settings.ai.aiOnly')}</option>
    <option value="algorithmic-only">{t('settings.ai.algorithmicOnly')}</option>
    <option value="hybrid">{t('settings.ai.hybrid')}</option>
  </Select>
</FormControl>

{patternDetectionMode !== 'ai-only' && (
  <>
    <Slider
      label={t('settings.ai.minConfidence')}
      value={minConfidence}
      min={0.5}
      max={0.9}
      step={0.05}
    />
    
    <CheckboxGroup
      label={t('settings.ai.enabledPatterns')}
      value={enabledPatterns}
      options={PATTERN_OPTIONS}
    />
  </>
)}
```

#### 6.2 Study Visualization Enhancements

**Show detection method:**
```tsx
<Badge colorScheme={study.detectedBy === 'algorithm' ? 'blue' : 'purple'}>
  {study.detectedBy === 'algorithm' ? '🔢 Algorithmic' : '🤖 AI'}
</Badge>
```

**Confidence visualization:**
```tsx
<Progress
  value={study.confidence * 100}
  colorScheme={study.confidence > 0.7 ? 'green' : 'yellow'}
  size="sm"
/>
```

---

## Technical Specifications

### Configuration Constants

**File:** `src/renderer/utils/patternDetection/constants.ts`

```typescript
export const PATTERN_DETECTION_CONFIG = {
  // Pivot Points
  PIVOT_LOOKBACK_DEFAULT: 5,
  PIVOT_LOOKAHEAD_DEFAULT: 5,
  PIVOT_LOOKBACK_MIN: 3,
  PIVOT_LOOKBACK_MAX: 10,
  
  // Clustering
  PRICE_TOLERANCE_PERCENT: 1.5, // For S/R clustering
  TIME_TOLERANCE_CANDLES: 5,    // For pattern alignment
  
  // Support/Resistance
  MIN_TOUCHES_SUPPORT: 2,
  MIN_TOUCHES_RESISTANCE: 2,
  STRONG_LEVEL_TOUCHES: 5,
  
  // Trendlines
  MIN_PIVOTS_TRENDLINE: 2,
  PREFERRED_PIVOTS_TRENDLINE: 3,
  MAX_TRENDLINE_DEVIATION: 0.02, // 2% from regression line
  
  // Channels
  MIN_CHANNEL_TOUCHES: 4,
  PARALLEL_TOLERANCE: 0.1, // Slope difference tolerance
  
  // Chart Patterns
  SHOULDER_HEIGHT_TOLERANCE: 0.05, // 5% for H&S
  DOUBLE_TOP_TOLERANCE: 0.03,      // 3% for double tops
  TRIPLE_TOP_TOLERANCE: 0.05,      // 5% for triple tops
  
  // Volume
  VOLUME_SPIKE_THRESHOLD: 1.5, // 1.5x average
  VOLUME_PERIOD: 20,           // Period for average calculation
  
  // Confidence
  MIN_CONFIDENCE_THRESHOLD: 0.5,
  HIGH_CONFIDENCE_THRESHOLD: 0.75,
  
  // Time Frames
  MIN_PATTERN_FORMATION_CANDLES: 10,
  IDEAL_PATTERN_FORMATION_CANDLES: 30,
  
  // Gaps
  GAP_MIN_PERCENT: 0.5, // Minimum gap size
  
  // Fibonacci
  FIBONACCI_LEVELS: [0.236, 0.382, 0.5, 0.618, 0.786],
  FIBONACCI_TOLERANCE: 0.01, // 1% around level for "touch"
  
  // Performance
  MAX_PATTERNS_PER_TYPE: 5, // Limit to top 5 per pattern type
  DETECTION_DEBOUNCE_MS: 500, // Debounce rapid candle updates
} as const;
```

### Type Extensions

**File:** `src/renderer/utils/patternDetection/types.ts`

```typescript
export interface PivotPoint {
  index: number;
  price: number;
  timestamp: number;
  type: 'high' | 'low';
  strength: number;
  volume?: number;
}

export interface TrendlineData {
  slope: number;
  intercept: number;
  r2: number;
  points: PivotPoint[];
  angle: number;
}

export interface PatternCluster {
  price: number;
  touches: number;
  timestamps: number[];
  indices: number[];
  avgVolume: number;
}

export interface DetectionOptions {
  minConfidence?: number;
  pivotSensitivity?: number;
  enabledPatterns?: AIStudyType[];
  prioritizeRecent?: boolean;
  maxPatternsPerType?: number;
}

export interface DetectionResult {
  studies: AIStudy[];
  metadata: {
    pivotsFound: number;
    patternsDetected: number;
    executionTime: number;
    candlesAnalyzed: number;
  };
}

export interface VolumeAnalysis {
  average: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  spikes: number[];
  confirmation: boolean;
}
```

### Performance Optimization

**Web Worker Implementation:**

```typescript
// src/renderer/workers/patternDetection.worker.ts
import { PatternDetectionService } from '../services/PatternDetectionService';

self.onmessage = (event: MessageEvent) => {
  const { candles, options } = event.data;
  
  const service = new PatternDetectionService();
  const result = service.detectPatterns(candles, options);
  
  self.postMessage(result);
};

// Usage in main thread
class PatternDetectionManager {
  private worker: Worker;
  
  async detectAsync(candles: Candle[]): Promise<AIStudy[]> {
    return new Promise((resolve) => {
      this.worker.postMessage({ candles });
      this.worker.onmessage = (event) => resolve(event.data);
    });
  }
}
```

**Caching Strategy:**

```typescript
class PatternCache {
  private cache = new Map<string, {
    studies: AIStudy[];
    lastCandle: number;
    timestamp: number;
  }>();
  
  get(symbol: string, lastCandleTime: number): AIStudy[] | null {
    const cached = this.cache.get(symbol);
    if (!cached) return null;
    
    // Cache valid if last candle matches and < 5 minutes old
    if (cached.lastCandle === lastCandleTime &&
        Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.studies;
    }
    
    return null;
  }
  
  set(symbol: string, studies: AIStudy[], lastCandleTime: number): void {
    this.cache.set(symbol, {
      studies,
      lastCandle: lastCandleTime,
      timestamp: Date.now()
    });
  }
}
```

---

## Testing Strategy

### Unit Tests

**Test Coverage Requirements:**
- Minimum 80% code coverage
- 100% coverage for core algorithms (pivot detection, confidence scoring)
- Each pattern detector has dedicated test suite

**Test Files:**
```
src/renderer/utils/patternDetection/__tests__/
├── pivotPoints.test.ts
├── supportResistance.test.ts
├── trendlines.test.ts
├── channels.test.ts
├── fibonacci.test.ts
├── chartPatterns.test.ts
├── gaps.test.ts
├── volumeAnalysis.test.ts
├── confidenceScoring.test.ts
└── PatternDetectionService.test.ts
```

**Sample Test:**
```typescript
describe('Support Detection', () => {
  it('should detect horizontal support with 2+ touches', () => {
    const candles = mockCandlesWithSupport(100, 3); // 3 touches at $100
    const pivots = findPivotPoints(candles);
    
    const supports = detectSupport(candles, pivots);
    
    expect(supports).toHaveLength(1);
    expect(supports[0].price).toBeCloseTo(100, 2);
    expect(supports[0].touches).toBe(3);
    expect(supports[0].confidence).toBeGreaterThan(0.6);
  });
  
  it('should require minimum 2 touches', () => {
    const candles = mockCandlesWithSupport(100, 1);
    const pivots = findPivotPoints(candles);
    
    const supports = detectSupport(candles, pivots);
    
    expect(supports).toHaveLength(0);
  });
  
  it('should validate volume increase on support tests', () => {
    const candles = mockCandlesWithSupportAndVolume(100, 3, [100, 150, 200]);
    const pivots = findPivotPoints(candles);
    
    const supports = detectSupport(candles, pivots);
    
    expect(supports[0].volumeConfirmation).toBe(true);
    expect(supports[0].confidence).toBeGreaterThan(0.7);
  });
});
```

### Integration Tests

**Test real pattern detection flow:**
```typescript
describe('Pattern Detection Integration', () => {
  it('should detect multiple pattern types on historical data', async () => {
    const btcData = await loadHistoricalData('BTC/USDT', '1d', 100);
    
    const service = new PatternDetectionService();
    const result = service.detectPatterns(btcData);
    
    expect(result.studies.length).toBeGreaterThan(0);
    expect(result.studies).toContainEqual(
      expect.objectContaining({ type: 'support' })
    );
    expect(result.studies).toContainEqual(
      expect.objectContaining({ type: 'resistance' })
    );
  });
  
  it('should maintain compatibility with AIStudy type', () => {
    const candles = mockCandles();
    const studies = patternDetectionService.detectPatterns(candles);
    
    studies.forEach(study => {
      expect(study).toHaveProperty('id');
      expect(study).toHaveProperty('type');
      expect(study).toHaveProperty('confidence');
      expect(study).toHaveProperty('number');
    });
  });
});
```

### Visual Regression Tests

**Ensure pattern rendering is correct:**
```typescript
describe('Pattern Rendering', () => {
  it('should render support line at correct price level', () => {
    const support: SupportStudy = {
      type: 'support',
      price: 100,
      touches: 3,
      // ...
    };
    
    const canvas = renderStudyToCanvas(support, mockCandles());
    const imageData = canvas.toDataURL();
    
    expect(imageData).toMatchSnapshot();
  });
});
```

### Performance Benchmarks

```typescript
describe('Performance', () => {
  it('should detect patterns in <100ms for 100 candles', () => {
    const candles = mockCandles(100);
    
    const start = performance.now();
    patternDetectionService.detectPatterns(candles);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(100);
  });
  
  it('should handle 1000 candles in <500ms', () => {
    const candles = mockCandles(1000);
    
    const start = performance.now();
    patternDetectionService.detectPatterns(candles);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(500);
  });
});
```

---

## Performance Considerations

### Optimization Strategies

#### 1. **Incremental Detection**
```typescript
class PatternDetectionService {
  private lastDetection: {
    candles: Candle[];
    studies: AIStudy[];
  } | null = null;
  
  detectPatternsIncremental(newCandles: Candle[]): AIStudy[] {
    if (!this.lastDetection) {
      return this.detectPatterns(newCandles);
    }
    
    // Only recompute patterns affected by new candles
    const affectedStudies = this.getAffectedStudies(newCandles);
    const unchangedStudies = this.lastDetection.studies.filter(
      s => !affectedStudies.includes(s)
    );
    
    const updatedStudies = this.detectPatterns(
      [...this.lastDetection.candles, ...newCandles]
    );
    
    return [...unchangedStudies, ...updatedStudies];
  }
}
```

#### 2. **Lazy Loading**
```typescript
// Don't detect all patterns on initial load
// Detect high-priority patterns first (S/R, trendlines)
// Detect complex patterns on demand or in background
async detectPatternsPrioritized(candles: Candle[]): Promise<AIStudy[]> {
  const priorityStudies = await this.detectPriorityPatterns(candles);
  
  // Show priority patterns immediately
  this.emit('patterns-detected', priorityStudies);
  
  // Detect remaining patterns in background
  setTimeout(() => {
    const allStudies = this.detectAllPatterns(candles);
    this.emit('patterns-complete', allStudies);
  }, 0);
  
  return priorityStudies;
}
```

#### 3. **Debouncing**
```typescript
// Don't recalculate on every candle update
const debouncedDetection = debounce(
  (candles: Candle[]) => patternDetectionService.detectPatterns(candles),
  500 // Wait 500ms after last candle before detecting
);
```

#### 4. **Data Windowing**
```typescript
// Only analyze recent candles for most patterns
const ANALYSIS_WINDOW = 200; // Last 200 candles

function detectPatterns(allCandles: Candle[]): AIStudy[] {
  // Use only recent candles for pattern detection
  const recentCandles = allCandles.slice(-ANALYSIS_WINDOW);
  
  // Detect patterns
  const studies = this.runDetectors(recentCandles);
  
  // Map study timestamps back to full dataset
  return studies.map(s => ({
    ...s,
    timestamp: adjustTimestamp(s.timestamp, allCandles, recentCandles)
  }));
}
```

#### 5. **Parallel Processing**
```typescript
// Run independent pattern detectors in parallel
async detectPatterns(candles: Candle[]): Promise<AIStudy[]> {
  const pivots = findPivotPoints(candles);
  
  const [
    supports,
    resistances,
    bullishTrendlines,
    bearishTrendlines,
    channels,
    fibonacci,
    patterns
  ] = await Promise.all([
    detectSupport(candles, pivots),
    detectResistance(candles, pivots),
    detectBullishTrendlines(candles, pivots),
    detectBearishTrendlines(candles, pivots),
    detectChannels(candles, pivots),
    detectFibonacci(candles, pivots),
    detectChartPatterns(candles, pivots)
  ]);
  
  return [
    ...supports,
    ...resistances,
    ...bullishTrendlines,
    // ...
  ];
}
```

### Memory Management

```typescript
// Limit number of studies kept in memory
const MAX_STUDIES_PER_SYMBOL = 50;

function pruneStudies(studies: AIStudy[]): AIStudy[] {
  // Keep high-confidence studies
  const highConfidence = studies.filter(s => s.confidence > 0.75);
  
  // Keep recent studies
  const recent = studies
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_STUDIES_PER_SYMBOL);
  
  // Merge and deduplicate
  return [...new Set([...highConfidence, ...recent])];
}
```

### Target Performance Metrics

- **Pattern Detection:** <100ms for 100 candles, <500ms for 1000 candles
- **Incremental Update:** <50ms for single new candle
- **Memory Usage:** <50MB per symbol with full pattern detection
- **UI Responsiveness:** No blocking of main thread (use Web Workers)

---

## AI Integration Strategy

### Hybrid Mode: Best of Both Worlds

**Concept:** Combine algorithmic detection with AI interpretation

```typescript
async analyzeChartHybrid(params: {
  symbol: string;
  candles: Candle[];
}): Promise<HybridAnalysisResult> {
  // Step 1: Algorithmic pattern detection
  const detectedStudies = await patternDetectionService.detectPatterns(
    params.candles
  );
  
  // Step 2: Build AI prompt with detected patterns
  const prompt = `
    Chart Analysis for ${params.symbol}
    
    DETECTED PATTERNS (Algorithmic):
    ${this.formatStudiesForAI(detectedStudies)}
    
    RECENT PRICE ACTION:
    ${this.formatRecentCandles(params.candles.slice(-20))}
    
    Please provide:
    1. **Pattern Interpretation**: Analyze the significance of detected patterns
    2. **Market Context**: What do these patterns suggest about market sentiment?
    3. **Trading Implications**: Entry/exit points, risk/reward
    4. **Key Levels**: Critical support/resistance to watch
    5. **Outlook**: Short-term and medium-term price expectations
    
    Focus on interpretation and context, NOT on finding new patterns.
  `;
  
  // Step 3: Get AI interpretation
  const aiResponse = await this.callAI(prompt);
  
  // Step 4: Combine results
  return {
    studies: detectedStudies,
    analysis: aiResponse.analysis,
    confidence: this.calculateOverallConfidence(detectedStudies),
    detectionMethod: 'hybrid'
  };
}
```

### AI Prompt Refactoring

**Before (AI finds patterns):**
```
Analyze this chart and identify technical patterns:
- Support and resistance levels
- Trendlines
- Chart patterns (H&S, triangles, wedges, etc.)
- Fibonacci retracements
- Gaps

Recent candles: [1000+ candles of OHLCV data]
```
**Context size:** ~50-100KB

**After (AI interprets patterns):**
```
The following patterns have been algorithmically detected:

SUPPORT LEVELS:
- Study #1: Support at $42,500 (3 touches, confidence: 0.82)
- Study #2: Support at $40,000 (5 touches, confidence: 0.91)

RESISTANCE LEVELS:
- Study #3: Resistance at $45,000 (4 touches, confidence: 0.78)

TRENDLINES:
- Study #4: Bullish trendline from Oct 1 to Nov 15 (angle: 23°, confidence: 0.85)

CHART PATTERNS:
- Study #5: Ascending triangle forming (flat top: $45k, rising lows, confidence: 0.73)

Recent price action: Last 20 candles [minimal data]

Provide market interpretation and trading guidance.
```
**Context size:** ~5-10KB (90% reduction!)

### Cost Savings Estimate

**Current AI-only approach:**
- Input tokens: ~50,000 (candle data + prompt)
- Output tokens: ~1,500 (analysis + studies JSON)
- Cost per analysis (GPT-4): ~$0.50

**Hybrid approach:**
- Input tokens: ~5,000 (studies + recent candles + prompt)
- Output tokens: ~1,000 (interpretation only)
- Cost per analysis: ~$0.05

**Savings:** 90% reduction in API costs!

### AI Provider Optimization

```typescript
// Different strategies for different providers
const AI_STRATEGIES = {
  'openai': {
    mode: 'hybrid',
    reason: 'GPT-4 expensive, use for interpretation only'
  },
  'anthropic': {
    mode: 'hybrid',
    reason: 'Claude excellent at interpretation, save tokens'
  },
  'gemini': {
    mode: 'ai-only',
    reason: 'Gemini cheap/free, can afford full analysis'
  }
} as const;
```

---

## Success Metrics

### Quantitative Metrics

1. **Detection Accuracy**
   - Target: >85% match rate with manually identified patterns
   - Measured by comparing with expert-labeled dataset

2. **Performance**
   - Target: <100ms for 100 candles
   - Target: <500ms for 1000 candles
   - Measured with performance benchmarks

3. **Cost Reduction**
   - Target: 80-90% reduction in AI API costs
   - Measured by comparing token usage before/after

4. **Code Coverage**
   - Target: >80% unit test coverage
   - Measured by Vitest coverage reports

5. **Confidence Correlation**
   - Target: High-confidence patterns (>0.75) should have >90% accuracy
   - Measured by backtesting on historical data

### Qualitative Metrics

1. **User Satisfaction**
   - Faster pattern detection
   - More consistent results (deterministic)
   - Ability to customize sensitivity

2. **Code Maintainability**
   - Well-documented algorithms
   - Modular pattern detectors
   - Easy to add new patterns

3. **System Reliability**
   - Deterministic results (same input = same output)
   - No dependency on AI API availability
   - Offline pattern detection capability

---

## Implementation Timeline

### Week-by-Week Breakdown

**Week 1-2: Core Infrastructure**
- [ ] Pivot point detection algorithm
- [ ] Volume analysis utilities
- [ ] Confidence scoring system
- [ ] Unit tests for core utilities

**Week 3-4: Basic Patterns**
- [ ] Support/Resistance detection
- [ ] Trendline detection
- [ ] Channel detection
- [ ] Unit tests for basic patterns

**Week 5-6: Fibonacci & Chart Patterns**
- [ ] Fibonacci retracements
- [ ] Triangle detection (3 types)
- [ ] Head and Shoulders
- [ ] Unit tests for chart patterns

**Week 7-8: Advanced Patterns**
- [ ] Wedges (rising/falling)
- [ ] Double/Triple tops and bottoms
- [ ] Flags and Pennants
- [ ] Cup and Handle
- [ ] Gap detection
- [ ] Unit tests for advanced patterns

**Week 9: Service Integration**
- [ ] PatternDetectionService implementation
- [ ] AI service refactoring (hybrid mode)
- [ ] Caching and performance optimization
- [ ] Integration tests

**Week 10: UI & Testing**
- [ ] Settings UI for detection modes
- [ ] Pattern visualization enhancements
- [ ] End-to-end testing
- [ ] Performance benchmarking
- [ ] Documentation

**Week 11-12: Polish & Launch**
- [ ] Bug fixes and refinements
- [ ] User acceptance testing
- [ ] Performance tuning
- [ ] Release preparation
- [ ] Update CHANGELOG.md

---

## Risk Mitigation

### Potential Risks

1. **Algorithm complexity**
   - **Risk:** Pattern detection algorithms harder than expected
   - **Mitigation:** Start with simple patterns, iterate based on results
   - **Fallback:** Keep AI-only mode as backup

2. **Performance issues**
   - **Risk:** Pattern detection too slow for real-time use
   - **Mitigation:** Use Web Workers, implement caching, optimize algorithms
   - **Fallback:** Reduce number of patterns detected simultaneously

3. **False positives**
   - **Risk:** Algorithm detects patterns that aren't meaningful
   - **Mitigation:** Strict confidence thresholds, volume confirmation required
   - **Fallback:** User can disable specific pattern types

4. **Compatibility issues**
   - **Risk:** Algorithmic studies don't integrate with existing rendering
   - **Mitigation:** Use same AIStudy type system, maintain compatibility
   - **Fallback:** Create separate rendering path if needed

5. **User resistance**
   - **Risk:** Users prefer AI-only mode
   - **Mitigation:** Make hybrid mode default, show cost/performance benefits
   - **Fallback:** Keep all three modes (AI-only, algorithmic-only, hybrid)

---

## Future Enhancements

### Phase 2 Features (After Initial Release)

1. **Machine Learning Enhancement**
   - Train ML model on historical patterns
   - Learn optimal thresholds per asset class
   - Improve confidence scoring with feedback loop

2. **Pattern Backtesting**
   - Analyze historical accuracy of detected patterns
   - Calculate win rate, risk/reward ratios
   - Surface most profitable patterns for each symbol

3. **Custom Pattern Builder**
   - Allow users to define custom patterns
   - Visual pattern editor
   - Save and share custom patterns

4. **Alert System**
   - Real-time alerts when patterns form
   - Pattern completion notifications
   - Breakout alerts

5. **Multi-Timeframe Analysis**
   - Detect patterns across multiple timeframes
   - Show pattern alignment (e.g., H&S on daily + weekly)
   - Confluence scoring

6. **Pattern Statistics**
   - Track pattern success rate over time
   - Show historical performance per pattern type
   - Optimize detection based on results

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building algorithmic technical analysis pattern detection in MarketMind. The phased approach ensures steady progress while maintaining system stability and allowing for iterative improvements.

**Key Benefits:**
- ✅ Deterministic, reproducible pattern detection
- ✅ 80-90% reduction in AI API costs
- ✅ Faster analysis (no network latency)
- ✅ Works offline
- ✅ Fully customizable sensitivity and thresholds
- ✅ Compatible with existing rendering system
- ✅ Enables AI to focus on interpretation vs pattern finding

**Next Steps:**
1. Create feature branch: `feature/algorithmic-pattern-detection`
2. Begin Phase 1: Core Infrastructure
3. Set up testing framework
4. Implement pivot point detection
5. Build from there following the phased approach

---

**Document Version:** 1.0  
**Last Updated:** November 25, 2025  
**Status:** ✅ Complete - Ready for Implementation
