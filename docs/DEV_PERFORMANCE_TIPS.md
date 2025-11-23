# Development Tips - Avoid Freezing on macOS

**Version:** 0.22.0  
**Last Updated:** November 23, 2025

---

## 🎯 Daily Development Best Practices

### 1. DevTools Management 🔧

**Old Behavior:**
- DevTools auto-opened every time
- ~200MB extra memory usage
- Slower startup

**New Behavior:**
- Press **F12** or **Cmd+Shift+I** to open DevTools
- Only when you need them
- Much faster startup

**Tips:**
```bash
# Start clean
npm run dev

# Open DevTools only when debugging
# Press F12 or Cmd+Shift+I

# Close DevTools when not needed
# Press F12 again
```

---

### 2. Memory Management 💾

**Monitor Memory Regularly:**
```
Activity Monitor → MarketMind process
Should stay around:
- Idle: ~350MB
- Active: ~450MB
- Max: ~550MB
```

**If Memory Grows:**
1. Check for open DevTools (close if not needed)
2. Restart the app if > 700MB
3. Check for memory leaks in your code

**Good Practices:**
- ✅ Close unused sidebars
- ✅ Limit number of open conversations
- ✅ Clear old AI studies occasionally
- ✅ Restart app after heavy development sessions

---

### 3. Real-time Updates 📡

**Now Optimized:**
- Max 60 updates/second (was 100+)
- Order processing: 2/second (was every tick)
- Smooth 60 FPS performance

**What This Means:**
- ✅ No more freezing during price updates
- ✅ Smooth chart interactions
- ✅ Lower CPU usage
- ✅ Better battery life

**If Still Laggy:**
1. Check CPU usage (Activity Monitor)
2. Close other apps
3. Check network connection
4. Restart the app

---

### 4. Chart Interactions 🎨

**Optimized Actions:**
- Pan/zoom: Smooth 60 FPS
- Crosshair: Responsive
- Tooltip: No lag

**Tips:**
- Use keyboard shortcuts (see KEYBOARD_SHORTCUTS.md)
- Pan with drag instead of mouse wheel when possible
- Avoid very fast zoom in/out (give it time to render)

---

### 5. Development Workflow 🔄

**Recommended Flow:**

```bash
# Morning - Fresh start
npm run dev

# Work on features
# Use F12 for DevTools only when needed

# Before lunch - Quick restart
# Cmd+Q to quit
npm run dev

# Afternoon - Continue working
# Monitor memory occasionally

# End of day - Run tests
npm run test:run

# Commit clean code
git add .
git commit -m "feat: description"
```

**Hot Reload:**
- Vite hot reload is very fast
- Most changes don't require restart
- Only restart if:
  - Memory > 700MB
  - App feels sluggish
  - After main process changes

---

### 6. Testing Performance 🧪

**Quick Performance Check:**

```bash
# FPS Monitor
F12 → Cmd+Shift+P → "Show Rendering"
→ Enable "Frame Rendering Stats"
Should see: 55-60 FPS

# Memory Check
Activity Monitor → MarketMind
Should be: < 500MB during development

# CPU Check
Activity Monitor → MarketMind
Should be: < 30% when active, < 5% when idle
```

**If Performance Degrades:**
1. Close DevTools
2. Restart app
3. Check for infinite loops in your code
4. Check for heavy computations in render
5. Use React DevTools Profiler

---

### 7. Code Patterns to Avoid ❌

**Don't:**
```typescript
// ❌ Heavy computation in render
function MyComponent() {
  const result = heavyCalculation(); // Runs every render!
  return <div>{result}</div>;
}

// ❌ Multiple useEffect without deps
useEffect(() => {
  // Runs on every render!
  loadData();
});

// ❌ Creating objects in render
function MyComponent() {
  const options = { foo: 'bar' }; // New object every render!
  return <Child options={options} />;
}
```

**Do:**
```typescript
// ✅ Memoize heavy computations
function MyComponent() {
  const result = useMemo(() => heavyCalculation(), [deps]);
  return <div>{result}</div>;
}

// ✅ Proper useEffect deps
useEffect(() => {
  loadData();
}, [dependency]); // Only when dependency changes

// ✅ Memoize objects
function MyComponent() {
  const options = useMemo(() => ({ foo: 'bar' }), []);
  return <Child options={options} />;
}
```

---

### 8. Debugging Performance Issues 🔍

**Chrome DevTools Performance Tab:**

```
1. F12 to open DevTools
2. Go to Performance tab
3. Click Record (circle)
4. Interact with your feature for 5-10s
5. Click Stop
6. Analyze:
   - Look for long tasks (yellow/red bars)
   - Check FPS (should be green, ~60)
   - Find the slowest functions
   - Optimize those first
```

**React DevTools Profiler:**

```
1. Install React DevTools extension
2. Open DevTools → Profiler tab
3. Click Record
4. Interact with app
5. Click Stop
6. See which components re-render too much
7. Add React.memo() where needed
```

---

### 9. Common Issues & Solutions 🔧

#### Issue: App Freezes During Price Updates
**Solution:** Already fixed! Real-time updates now throttled to 60/s

#### Issue: High CPU Usage
**Possible Causes:**
- DevTools open
- Infinite loop
- Too many re-renders
- Heavy calculations

**Solutions:**
1. Close DevTools
2. Check your code for loops
3. Use React Profiler
4. Add `useMemo`/`useCallback`

#### Issue: Memory Leak
**Symptoms:**
- Memory keeps growing
- App gets slower over time
- Eventually crashes

**Solutions:**
1. Check `useEffect` cleanup
2. Cancel pending requests on unmount
3. Clear intervals/timeouts
4. Unsubscribe from events

**Example:**
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    // Do something
  }, 1000);

  return () => {
    clearInterval(interval); // ✅ Cleanup!
  };
}, []);
```

#### Issue: Slow Startup
**Already Optimized:**
- DevTools don't auto-open
- Settings load in parallel
- Electron flags optimized

**If Still Slow:**
1. Clear cache: `rm -rf node_modules dist-electron`
2. Reinstall: `npm install`
3. Rebuild: `npm run build`

---

### 10. Monitoring in Production 📊

**When Building Release:**
```bash
npm run build
npm run dist

# Test the built app
# Should be even faster than dev mode
```

**Monitor:**
- Startup time
- Memory usage over time
- CPU usage during trading
- FPS during interactions

**Report Issues:**
- Use Performance Report Template (see PERFORMANCE_TESTING_GUIDE.md)
- Include OS, hardware specs
- Attach Chrome DevTools profile if possible

---

## 🎓 Learning Resources

### Electron Performance
- [Official Guide](https://www.electronjs.org/docs/latest/tutorial/performance)
- [VS Code Performance Lessons](https://www.youtube.com/watch?v=r0OeHRUCCb4)

### React Performance
- [React Profiler](https://react.dev/reference/react/Profiler)
- [useMemo Guide](https://react.dev/reference/react/useMemo)
- [Optimization Guide](https://react.dev/learn/render-and-commit#optimizing-performance)

### Canvas Performance
- [MDN Canvas Optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)

---

## ✅ Quick Checklist for Development

Daily:
- [ ] Monitor memory usage
- [ ] Use DevTools sparingly (F12 on demand)
- [ ] Check FPS occasionally
- [ ] Restart if app feels slow

Weekly:
- [ ] Run full test suite
- [ ] Profile performance
- [ ] Check for memory leaks
- [ ] Update dependencies

Before Commit:
- [ ] Run tests
- [ ] Type check
- [ ] No console.logs
- [ ] No memory leaks
- [ ] Performance tested

---

## 🚨 Red Flags to Watch For

**Immediate Action Required:**
- 🔴 Memory > 1GB
- 🔴 CPU constantly > 50%
- 🔴 FPS < 30 consistently
- 🔴 App freezing for > 1s
- 🔴 Crashes

**Investigate Soon:**
- 🟡 Memory slowly growing
- 🟡 CPU spikes during interaction
- 🟡 Occasional frame drops
- 🟡 Slower than expected

**Normal:**
- 🟢 Memory stable ~350-500MB
- 🟢 CPU < 30% when active
- 🟢 FPS 55-60 consistently
- 🟢 Smooth interactions

---

**Remember:** Performance is everyone's responsibility! Write efficient code from the start, and it'll save debugging time later. 🚀
