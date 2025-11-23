# Performance Testing Guide - MarketMind

**Version:** 0.22.0  
**Date:** November 23, 2025  
**Status:** ✅ Ready for Testing

## 🎯 Quick Start

### Before Testing
```bash
# Pull latest changes
git pull origin main

# Clean install
rm -rf node_modules dist-electron
npm install

# Run tests to verify everything works
npm run test:run
```

### Running the App
```bash
# Development mode (with performance optimizations)
npm run dev

# DevTools: Press F12 or Cmd+Shift+I to open (no longer auto-opens)
```

---

## 📊 Performance Metrics to Measure

### 1. Startup Time ⚡

**Before Testing:**
```bash
# Clean start (close all instances first)
time npm run dev
```

**Expected Results:**
- ✅ **Before:** 4-5 seconds to window visible
- ✅ **After:** 2-3 seconds to window visible
- 🎯 **Target:** < 3 seconds

**How to Measure:**
1. Close all MarketMind windows
2. Open Terminal
3. Run: `time npm run dev`
4. Note the "real" time when window appears
5. Record the result

---

### 2. Memory Usage 💾

**Tools:**
- **macOS:** Activity Monitor (Applications → Utilities → Activity Monitor)
- **Windows:** Task Manager (Ctrl+Shift+Esc)
- **Linux:** System Monitor or `htop`

**Test Scenarios:**

#### A) Idle Memory (Just Opened)
1. Launch MarketMind
2. Wait for chart to load
3. Don't interact for 30 seconds
4. Check memory usage

**Expected:**
- ✅ **Before (without DevTools):** ~450MB
- ✅ **Before (with DevTools):** ~550MB
- ✅ **After:** ~350MB
- 🎯 **Target:** < 400MB

#### B) Active Trading Memory
1. Open Trading Simulator
2. Place 5-10 orders
3. Switch between symbols
4. Let run for 5 minutes
5. Check memory usage

**Expected:**
- ✅ **Before:** ~550-600MB
- ✅ **After:** ~400-450MB
- 🎯 **Target:** < 500MB

#### C) Long Session Memory (1 hour)
1. Leave app running for 1 hour
2. Simulate normal usage (switching symbols, AI chat, trading)
3. Check memory after 1 hour

**Expected:**
- ✅ **Before:** ~600-700MB (possible leaks)
- ✅ **After:** ~450-500MB (stable)
- 🎯 **Target:** < 550MB, no continuous growth

---

### 3. CPU Usage 🔋

**Measurement Points:**

#### A) Idle CPU
1. App loaded, no interaction
2. Chart visible but not moving
3. Measure for 1 minute

**Expected:**
- ✅ **Before:** 8-12%
- ✅ **After:** 3-5%
- 🎯 **Target:** < 5%

#### B) Active Trading CPU
1. Simulator active
2. Real-time price updates
3. 5-10 open orders
4. Measure for 1 minute

**Expected:**
- ✅ **Before:** 40-60%
- ✅ **After:** 20-30%
- 🎯 **Target:** < 35%

#### C) Chart Interaction CPU
1. Pan and zoom chart continuously
2. Move crosshair around
3. Measure during interaction

**Expected:**
- ✅ **Before:** 50-70%
- ✅ **After:** 25-35%
- 🎯 **Target:** < 40%

---

### 4. Frame Rate (FPS) 🎮

**Enable FPS Counter:**
1. Press F12 to open DevTools
2. Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)
3. Type "Show Rendering"
4. Enable "Frame Rendering Stats"
5. FPS counter appears in top-right corner

**Test Scenarios:**

#### A) Chart Interaction FPS
1. Pan chart left/right
2. Zoom in/out
3. Move crosshair around

**Expected:**
- ✅ **Before:** 20-30 FPS (drops to 15 FPS)
- ✅ **After:** 55-60 FPS (stable)
- 🎯 **Target:** > 55 FPS consistently

#### B) Real-time Updates FPS
1. Enable Trading Simulator
2. Watch real-time price updates
3. Multiple orders active

**Expected:**
- ✅ **Before:** 25-35 FPS (inconsistent)
- ✅ **After:** 55-60 FPS (stable)
- 🎯 **Target:** > 55 FPS consistently

---

### 5. Real-time Update Rate 📡

**Monitor Update Frequency:**

**Before Optimization:**
```
Price updates: 100+ per second
Order calculations: Every price tick
UI re-renders: 100+ per second
Result: Lag, stuttering, high CPU
```

**After Optimization:**
```
Price updates: Max 60 per second (RAF throttled)
Order calculations: Max 2 per second
UI re-renders: Max 60 per second
Result: Smooth, responsive, low CPU
```

**How to Verify:**
1. Open DevTools Console (F12)
2. Watch for price update logs
3. Should see throttled updates
4. UI should feel smoother

---

## 🔍 Chrome DevTools Performance Profile

### How to Profile
1. Open DevTools (F12)
2. Go to "Performance" tab
3. Click "Record" (circle icon)
4. Interact with app for 10 seconds:
   - Pan/zoom chart
   - Switch symbols
   - Move crosshair
   - Place orders
5. Click "Stop" to finish recording
6. Analyze results

### What to Look For

#### ✅ Good Performance Indicators:
- **FPS:** Consistent green bars at 60 FPS
- **Main Thread:** Mostly idle (white space)
- **Tasks:** No tasks > 50ms (no red bars)
- **Memory:** Flat or slowly growing
- **Frame Drop:** < 5% dropped frames

#### ❌ Performance Problems:
- **FPS:** Yellow/red bars, dropping below 30 FPS
- **Main Thread:** Saturated (solid yellow)
- **Tasks:** Many tasks > 50ms (red bars)
- **Memory:** Rapid growth (leak)
- **Frame Drop:** > 10% dropped frames

---

## 🧪 Automated Performance Tests

### Run Performance Benchmarks
```bash
# Basic tests (already passing)
npm run test:run

# Browser-based tests
npm run test:browser:run

# Type checking
npm run type-check
```

### Performance Test Suite (Future)
```bash
# TODO: Add performance regression tests
npm run test:performance
```

---

## 📋 Testing Checklist

### Phase 1: Basic Functionality ✅
- [x] App starts successfully
- [x] Chart loads and displays correctly
- [x] Real-time updates work
- [x] Trading simulator functions
- [x] AI chat responds
- [x] Settings persist
- [x] All 1338 tests passing

### Phase 2: Performance Validation ⚡ (NEEDS TESTING)
- [ ] Startup < 3 seconds (Expected: 2-3s, was 4-5s)
- [ ] Memory (idle) < 400MB (Expected: ~350MB, was ~450MB)
- [ ] Memory (active) < 500MB (Expected: ~450MB, was ~600MB)
- [ ] CPU (idle) < 5% (Expected: 3-5%, was 8-12%)
- [ ] CPU (active) < 35% (Expected: 20-30%, was 40-60%)
- [ ] FPS consistently > 55 (Expected: 55-60, was 20-30)

### Phase 3: Stability Testing 🔒 (NEEDS TESTING)
- [ ] No freezing during price updates (Should be fixed with RAF throttling)
- [ ] No lag when placing orders (Should be improved with throttling)
- [ ] Smooth chart pan/zoom (Should be 60 FPS now)
- [ ] No memory leaks (1 hour test) (RAF cleanup added)
- [ ] No crashes

### Phase 4: User Experience 🎯 (NEEDS TESTING)
- [ ] App feels responsive
- [ ] No stuttering (RAF should fix this)
- [x] DevTools opens on F12 (Changed from auto-open)
- [ ] All features work as before
- [ ] No regressions

---

## 🐛 Known Issues & Workarounds

### Issue: DevTools Don't Auto-Open
**Expected Behavior:** This is intentional!
**Solution:** Press F12 or Cmd+Shift+I to open DevTools

### Issue: Some TypeScript Errors
**Status:** Pre-existing, not related to performance changes
**Impact:** None - app runs fine, tests pass
**Fix:** Will be addressed in separate PR

### Issue: ESLint Config Missing
**Status:** Known issue, not critical
**Impact:** `npm run lint` fails
**Fix:** Not blocking, can be addressed later

---

## 📊 Performance Comparison Table

| Metric | Before | After | Improvement | Status |
|--------|--------|-------|-------------|--------|
| **Startup Time** | 4-5s | 2-3s | 50% faster | ⏱️ Test |
| **Memory (Idle)** | 450MB | 350MB | 100MB saved | 💾 Test |
| **Memory (DevTools)** | 550MB | 350MB | 200MB saved | 💾 Test |
| **Memory (1 hour)** | 600-700MB | 450-500MB | More stable | 💾 Test |
| **CPU (Idle)** | 8-12% | 3-5% | 60% lower | 🔋 Test |
| **CPU (Active)** | 40-60% | 20-30% | 50% lower | 🔋 Test |
| **FPS (Chart)** | 20-30 | 55-60 | 2x better | 🎮 Test |
| **Update Rate** | 100+/s | 60/s | Optimized | 📡 Test |
| **Order Updates** | Every tick | 2/s | Throttled | ⚡ Test |

---

## 📝 Reporting Results

### Performance Report Template

```markdown
## Performance Test Results

**Date:** [Date]
**Version:** 0.22.0
**OS:** [macOS/Windows/Linux]
**Hardware:** [Your specs]

### Startup Time
- Measured: [X seconds]
- Target: < 3s
- Status: [✅/❌]

### Memory Usage
- Idle: [X MB]
- Active: [X MB]
- After 1 hour: [X MB]
- Target: < 400MB idle, < 500MB active
- Status: [✅/❌]

### CPU Usage
- Idle: [X %]
- Active: [X %]
- Target: < 5% idle, < 35% active
- Status: [✅/❌]

### Frame Rate
- Chart interaction: [X FPS]
- Real-time updates: [X FPS]
- Target: > 55 FPS
- Status: [✅/❌]

### Overall Experience
- Smoothness: [1-5 stars]
- Responsiveness: [1-5 stars]
- Stability: [1-5 stars]
- Regressions: [None/List]

### Notes
[Any observations, issues, or feedback]
```

---

## 🚀 Next Steps After Testing

### If Performance is Good ✅
1. Create PR with results
2. Merge to main
3. Deploy to production
4. Monitor in production

### If Performance Needs Work ⚠️
1. Document specific issues
2. Run Chrome DevTools profiler
3. Identify bottlenecks
4. Implement Phase 2 optimizations

### Phase 2 Optimizations (If Needed)
- Canvas multi-layer rendering
- Dirty flag system
- Component code splitting
- Web Worker for order calculations

---

## 📞 Support

If you encounter any issues during testing:
1. Check this guide first
2. Review PERFORMANCE_OPTIMIZATION.md
3. Check PERFORMANCE_QUICK_WINS.md
4. Open GitHub issue with performance report

---

**Happy Testing! 🚀**
