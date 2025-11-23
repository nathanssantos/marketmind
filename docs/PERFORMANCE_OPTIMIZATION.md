# Performance Optimization Analysis - MarketMind

**Status:** 🟡 In Progress - Phase 1: 80% Complete  
**Last Updated:** November 23, 2025  
**Version:** 0.22.0  
**Progress:** 4/5 Quick Wins Implemented ✅

## 📊 Executive Summary

Based on the analysis of Electron performance best practices documentation and MarketMind's codebase, several critical performance issues were identified that can cause freezing/stuttering during development on macOS. This document outlines the issues, their impact, and recommended solutions.

---

## 🔴 Critical Issues Found

### 1. **Blocking the Main Process** (CRITICAL)
**Issue:** Heavy IPC handlers in main process without proper async/await handling  
**Location:** `src/main/index.ts`  
**Impact:** UI freezes, application hangs

#### Problems Detected:
```typescript
// ❌ BAD: Synchronous operations in IPC handlers can block UI thread
ipcMain.handle('http:fetch', async (_event, url, options = {}) => {
  // Network request without timeout
  // Large response parsing without streaming
  // No proper error boundaries
});
```

**Recommendation:**
- Move heavy network operations to dedicated utility process or web worker
- Implement request timeouts
- Use streaming for large responses
- Add proper cancellation support

---

### 2. **Excessive useEffect Dependencies** (HIGH)
**Issue:** Too many reactive dependencies causing unnecessary re-renders  
**Location:** `src/renderer/App.tsx`  
**Impact:** High CPU usage, battery drain, UI stuttering

#### Problems Detected:
```typescript
// ❌ BAD: 17+ useEffect hooks in single component
// Each effect watches different dependencies
// Creates cascade of re-renders
useEffect(() => { /* ... */ }, [dep1, dep2, dep3]);
useEffect(() => { /* ... */ }, [dep4, dep5]);
// ... 15 more effects
```

**Metrics:**
- **17 useEffect hooks** in App.tsx
- **8 useMemo** computations
- **4 useCallback** memoizations
- Potential for cascading updates

**Recommendation:**
- Split App.tsx into smaller components with focused responsibilities
- Use React.memo() for expensive child components
- Consolidate related effects
- Move business logic to custom hooks or services

---

### 3. **Canvas Re-rendering Performance** (HIGH)
**Issue:** Canvas re-draws on every state change without proper throttling  
**Location:** `src/renderer/components/Chart/ChartCanvas.tsx`  
**Impact:** High GPU usage, frame drops, freezing during interactions

#### Problems Detected:
```typescript
// ❌ No requestAnimationFrame throttling
// ❌ No dirty flag checking
// ❌ Full canvas redraw on every tooltip update
// ❌ No layer separation (static vs dynamic content)
```

**Recommendation:**
- Implement requestAnimationFrame for smooth rendering
- Use multiple canvas layers (static background, dynamic overlays)
- Add dirty flag system to skip unnecessary redraws
- Debounce tooltip/crosshair updates

---

### 4. **Real-time Updates Without Throttling** (HIGH)
**Issue:** WebSocket updates trigger state changes without rate limiting  
**Location:** `src/renderer/hooks/useRealtimeCandle.ts`, `src/renderer/App.tsx`  
**Impact:** Excessive re-renders, memory pressure

#### Problems Detected:
```typescript
// ❌ BAD: Every WebSocket message triggers React state update
const handleRealtimeUpdate = useCallback((candle: Candle, isFinal: boolean) => {
  // Direct state update without throttling
  setLiveCandles(prev => { /* ... */ });
  
  // Order processing on every price tick
  state.fillPendingOrders(symbol, currentPrice, previousPrice, appLoadTimeRef.current);
  
  // Multiple store updates per second
  activeOrders.forEach(order => {
    state.updateOrder(order.id, { currentPrice });
  });
}, [symbol]);
```

**Recommendation:**
- Implement requestAnimationFrame or requestIdleCallback for updates
- Batch state updates (React 18 automatic batching helps but not enough)
- Throttle order processing (max 1-2 times per second)
- Use Web Worker for price calculations

---

### 5. **Memory Leaks in Intervals/Timers** (MEDIUM)
**Issue:** Missing cleanup in useEffect hooks  
**Location:** Multiple locations  
**Impact:** Memory growth over time, eventual crash

#### Problems Detected:
```typescript
// ❌ Potential memory leaks found:
// - src/renderer/hooks/useCalendar.ts: setInterval without cleanup check
// - Multiple debounce timers
// - ResizeObserver not always disconnected
```

**Recommendation:**
- Audit all useEffect cleanup functions
- Ensure all intervals/timers are cleared
- Use AbortController for fetch cancellation
- Implement memory leak detection in tests

---

### 6. **Inefficient News/Calendar Correlation** (MEDIUM)
**Issue:** Multiple API calls and filtering on every render  
**Location:** `src/renderer/App.tsx`  
**Impact:** High network usage, battery drain

#### Problems Detected:
```typescript
// ❌ BAD: Multiple effects loading settings
useEffect(() => {
  const loadNewsSettings = async () => { /* ... */ };
  loadNewsSettings();
}, []);

useEffect(() => {
  const loadCalendarSettings = async () => { /* ... */ };
  loadCalendarSettings();
}, []);

// ❌ Filtering on every render
const relevantEvents = calendarCorrelateWithAI
  ? calendarEvents.filter(event => { /* ... */ })
  : [];
```

**Recommendation:**
- Consolidate settings loading into single hook
- Memoize filtering results
- Use IndexedDB for caching
- Implement stale-while-revalidate pattern

---

### 7. **Web Workers Not Fully Utilized** (MEDIUM)
**Issue:** Heavy calculations still in main thread  
**Location:** Various calculation utilities  
**Impact:** UI blocking during complex calculations

#### Detected:
- ✅ Web Workers exist for: bounds, coordinates, moving averages
- ❌ Not used for: price updates, order calculations, AI processing
- ❌ Worker communication not optimized (large data transfers)

**Recommendation:**
- Move all heavy calculations to workers
- Use Transferable objects to avoid data copying
- Implement worker pool for parallel processing
- Cache worker results

---

### 8. **Development Tools Overhead** (MEDIUM)
**Issue:** Dev tools always open, no production optimizations  
**Location:** `src/main/index.ts`  
**Impact:** Slower startup, higher memory usage

#### Problems Detected:
```typescript
// ❌ Dev tools auto-open in development
if (devServerUrl) {
  mainWindow.loadURL(devServerUrl);
  mainWindow.webContents.openDevTools(); // Always open
}
```

**Recommendation:**
- Only open DevTools on demand (keyboard shortcut)
- Enable production mode optimizations
- Use lazy loading for dev-only features
- Implement code splitting

---

### 9. **Missing BrowserWindow Optimizations** (HIGH)
**Issue:** No performance-related flags in window creation  
**Location:** `src/main/index.ts`  
**Impact:** Suboptimal rendering, high memory usage

#### Problems Detected:
```typescript
// ❌ MISSING optimizations:
webPreferences: {
  preload: join(__dirname, '../preload/preload.mjs'),
  nodeIntegration: false,
  contextIsolation: true,
  // ❌ No backgroundThrottling
  // ❌ No offscreen rendering config
  // ❌ No hardware acceleration settings
},
```

**Recommendation:**
```typescript
webPreferences: {
  preload: join(__dirname, '../preload/preload.mjs'),
  nodeIntegration: false,
  contextIsolation: true,
  
  // ✅ Performance optimizations
  backgroundThrottling: true, // Throttle when window is hidden
  enableWebSQL: false, // Disable unused features
  webgl: true, // Enable WebGL for canvas acceleration
  acceleratedMultiframe: true, // Use multiple frames for acceleration
  
  // ✅ Memory optimizations
  spellcheck: false, // Disable if not needed
  autoplayPolicy: 'user-gesture-required',
  
  // ✅ Security + Performance
  sandbox: true, // Enable sandboxing
  v8CacheOptions: 'code', // Cache V8 compiled code
},
```

---

### 10. **No Module/Code Bundling Optimization** (LOW)
**Issue:** All dependencies loaded eagerly  
**Location:** Build configuration  
**Impact:** Slow startup, high memory footprint

**Recommendation:**
- Review dependency tree (use webpack-bundle-analyzer)
- Implement code splitting for routes/features
- Lazy load heavy modules (AI SDKs, chart libraries)
- Use dynamic imports for conditional features

---

## 🎯 Priority Action Items

### Immediate (This Week) - ✅ Completed
1. ✅ **Add BrowserWindow performance flags** (30 min) - DONE
2. ✅ **Throttle real-time updates with requestAnimationFrame** (2 hours) - DONE
3. ✅ **Consolidate settings loading effects** (1 hour) - DONE
4. ⏳ **Add dirty flag system to canvas rendering** (3 hours) - NEXT

### Short Term (Next Week) - 🔜 Planned
5. ⏳ **Split App.tsx into smaller components** (4 hours)
6. ⏳ **Implement canvas layer separation** (3 hours)
7. ⏳ **Move network requests to utility process** (1 day)
8. ⏳ **Audit and fix memory leaks** (1 day)
9. ⏳ **Optimize useEffect dependencies** (1 day)

### Medium Term (Next Sprint) - 📋 Future
10. ⏳ **Implement worker-based order calculations** (1 day)
11. ⏳ **Code splitting and lazy loading** (2 days)
12. ⏳ **Implement proper caching strategy** (2 days)
13. ⏳ **Performance monitoring and profiling** (1 day)

---

## 📈 Performance Metrics to Track

### Before Optimization (Baseline)
- [ ] FPS during chart interaction: ___
- [ ] Memory usage after 1 hour: ___
- [ ] CPU usage (idle): ___
- [ ] CPU usage (active trading): ___
- [ ] Startup time: ___
- [ ] Time to first paint: ___

### After Optimization (Target)
- [ ] FPS during chart interaction: **>55 FPS**
- [ ] Memory usage after 1 hour: **<500MB**
- [ ] CPU usage (idle): **<5%**
- [ ] CPU usage (active trading): **<30%**
- [ ] Startup time: **<3 seconds**
- [ ] Time to first paint: **<1 second**

---

## 🔧 Implementation Guide

### 1. BrowserWindow Optimizations

**File:** `src/main/index.ts`

```typescript
const createWindow = (): void => {
  console.log('Creating main window...');
  
  const windowState = windowStateManager.getState();
  
  const windowOptions: electron.BrowserWindowConstructorOptions = {
    width: windowState.width,
    height: windowState.height,
    minWidth: WINDOW_CONFIG.MIN_WIDTH,
    minHeight: WINDOW_CONFIG.MIN_HEIGHT,
    show: false,
    
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      
      // 🚀 Performance optimizations
      backgroundThrottling: true,
      enableWebSQL: false,
      webgl: true,
      spellcheck: false,
      autoplayPolicy: 'user-gesture-required',
      sandbox: true,
      v8CacheOptions: 'code',
    },
  };

  // ... rest of the code
};
```

---

### 2. Throttled Real-time Updates

**File:** `src/renderer/App.tsx`

```typescript
// ✅ GOOD: Throttled updates with requestAnimationFrame
const pendingUpdateRef = useRef<{
  candle: Candle;
  isFinal: boolean;
} | null>(null);
const rafIdRef = useRef<number | null>(null);

const handleRealtimeUpdate = useCallback((candle: Candle, isFinal: boolean) => {
  // Store the latest update
  pendingUpdateRef.current = { candle, isFinal };
  
  // Cancel any pending animation frame
  if (rafIdRef.current !== null) {
    cancelAnimationFrame(rafIdRef.current);
  }
  
  // Schedule update on next animation frame
  rafIdRef.current = requestAnimationFrame(() => {
    const update = pendingUpdateRef.current;
    if (!update) return;
    
    const { candle: latestCandle, isFinal: finalFlag } = update;
    
    // Update candles state
    setLiveCandles(prev => {
      // ... existing logic
    });
    
    // Throttled order processing
    const now = Date.now();
    if (now - lastOrderUpdateRef.current > 500) { // Max 2 updates/sec
      const currentPrice = latestCandle.close;
      const previousPrice = previousPriceRef.current;
      
      if (previousPrice !== null && previousPrice !== currentPrice) {
        // ... order processing
      }
      
      lastOrderUpdateRef.current = now;
    }
    
    rafIdRef.current = null;
    pendingUpdateRef.current = null;
  });
}, [symbol]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
  };
}, []);
```

---

### 3. Canvas Layer Separation

**File:** `src/renderer/components/Chart/ChartCanvas.tsx`

```typescript
// ✅ Use multiple canvas layers for better performance
// Layer 1: Static background (grid, volume bars) - rarely updates
// Layer 2: Price data (candles, MAs) - updates on pan/zoom
// Layer 3: Dynamic overlays (crosshair, tooltip) - updates on mouse move

const ChartCanvas = ({ ... }: ChartCanvasProps) => {
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const dirtyFlags = useRef({
    background: true,
    chart: true,
    overlay: true,
  });
  
  // Only redraw layers that changed
  const draw = useCallback(() => {
    if (dirtyFlags.current.background) {
      drawBackground();
      dirtyFlags.current.background = false;
    }
    
    if (dirtyFlags.current.chart) {
      drawChart();
      dirtyFlags.current.chart = false;
    }
    
    if (dirtyFlags.current.overlay) {
      drawOverlay();
      dirtyFlags.current.overlay = false;
    }
  }, []);
  
  return (
    <Box position="relative" width={width} height={height}>
      <canvas ref={backgroundCanvasRef} style={{ position: 'absolute', zIndex: 1 }} />
      <canvas ref={chartCanvasRef} style={{ position: 'absolute', zIndex: 2 }} />
      <canvas ref={overlayCanvasRef} style={{ position: 'absolute', zIndex: 3 }} />
    </Box>
  );
};
```

---

### 4. Component Splitting

**Create:** `src/renderer/components/App/ChartSection.tsx`

```typescript
import { memo } from 'react';

interface ChartSectionProps {
  marketData: MarketData | null;
  displayCandles: Candle[];
  symbol: string;
  timeframe: Timeframe;
  // ... other props
}

export const ChartSection = memo(function ChartSection({
  marketData,
  displayCandles,
  symbol,
  timeframe,
  // ... other props
}: ChartSectionProps) {
  return (
    <>
      {loading && <LoadingSpinner message={t('app.loadingMarketData')} />}
      
      {error && <ErrorMessage ... />}
      
      {marketData && <ChartCanvas ... />}
    </>
  );
});
```

**Create:** `src/renderer/components/App/RealtimeDataManager.tsx`

```typescript
// Extract real-time update logic into separate component
export const RealtimeDataManager = ({ ... }) => {
  useRealtimeCandle(...);
  usePriceUpdates();
  useOrderNotifications();
  
  return null; // Logic-only component
};
```

---

## 🧪 Testing & Validation

### Performance Tests to Add

```typescript
// tests/performance/app-performance.test.ts
describe('App Performance', () => {
  it('should render within 1 second', async () => {
    const startTime = performance.now();
    render(<App />);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(1000);
  });
  
  it('should maintain 55+ FPS during chart interaction', async () => {
    // ... FPS monitoring test
  });
  
  it('should not leak memory after 100 real-time updates', async () => {
    // ... memory leak test
  });
});
```

---

## 📚 References

### Electron Best Practices
- [Official Performance Guide](https://www.electronjs.org/docs/latest/tutorial/performance)
- [VS Code Performance Lessons](https://www.youtube.com/watch?v=r0OeHRUCCb4)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

### React Performance
- [React Profiler](https://react.dev/reference/react/Profiler)
- [useMemo vs useCallback](https://react.dev/reference/react/useMemo)
- [React 18 Automatic Batching](https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching)

### Canvas Optimization
- [Canvas Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

---

## ✅ Implementation Checklist

### Phase 1: Quick Wins (Week 1) - ✅ 5/5 Completed
- [x] Add BrowserWindow performance flags
- [x] Disable DevTools auto-open (F12 toggle)
- [x] Implement requestAnimationFrame throttling for real-time updates
- [x] Add dirty flag system to canvas rendering
- [x] Consolidate settings loading effects

### Phase 2: Structural Changes (Week 2) - 🔜 Next
- [ ] Split App.tsx into logical components
- [ ] Implement canvas layer separation
- [ ] Move network requests to utility process
- [ ] Add memory leak tests
- [ ] Optimize useEffect dependencies

### Phase 3: Advanced Optimizations (Week 3-4) - 📋 Planned
- [ ] Implement code splitting
- [ ] Add proper caching with IndexedDB
- [ ] Move heavy calculations to Web Workers
- [ ] Implement worker pool for parallel processing
- [ ] Add performance monitoring dashboard

### Phase 4: Validation (Ongoing) - 📋 Planned
- [ ] Measure baseline performance metrics
- [ ] Implement performance regression tests
- [ ] Set up CI performance benchmarks
- [ ] Document performance budgets
- [ ] Create performance monitoring alerts

---

**Next Steps:**
1. Review this document with the team
2. Prioritize action items based on impact
3. Create GitHub issues for each task
4. Schedule implementation sprints
5. Set up performance monitoring

**Note:** Performance optimization is an iterative process. Start with the highest-impact items and measure results before moving to the next optimization.
