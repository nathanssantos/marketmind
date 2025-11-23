# 🎨 Canvas Testing Guide

## Overview

MarketMind now has **comprehensive canvas testing infrastructure** with two complementary approaches:

1. **Unit Tests** - Fast tests with mocked canvas (vitest-canvas-mock)
2. **Browser Tests** - Real canvas rendering with Playwright

---

## 📦 Installed Packages

```json
{
  "vitest-canvas-mock": "^0.x.x",       // Better canvas mocking for unit tests
  "@vitest/browser": "^4.x.x",          // Browser mode for Vitest
  "@vitest/browser-playwright": "^1.x.x", // Playwright provider
  "playwright": "^1.x.x"                // Browser automation
}
```

---

## 🏃 Running Tests

### Unit Tests (Fast - with Mocks)
```bash
npm test                    # Watch mode
npm run test:run            # Run once
npm run test:coverage       # With coverage report
```

### Browser Tests (Real Rendering)
```bash
npm run test:browser         # Watch mode
npm run test:browser:run     # Run once
```

### Run All Tests
```bash
npm run test:run && npm run test:browser:run
```

---

## 🧪 Test File Conventions

### Unit Tests
- **Pattern:** `*.test.ts` or `*.test.tsx`
- **Location:** Next to the file being tested
- **Environment:** jsdom with vitest-canvas-mock
- **Purpose:** Test logic, calculations, method calls

**Example:** `useCandlestickRenderer.test.ts`

### Browser Tests
- **Pattern:** `*.browser.test.ts` or `*.browser.test.tsx`
- **Location:** `src/renderer/components/Chart/` or similar
- **Environment:** Real Chromium browser via Playwright
- **Purpose:** Test actual rendering, visual validation, integration

**Example:** `ChartCanvas.browser.test.tsx`

---

## 📝 Writing Unit Tests (with vitest-canvas-mock)

### Features of vitest-canvas-mock

✅ **All canvas methods are mocked** and track calls
✅ **Parameter validation** - throws errors for invalid inputs
✅ **Snapshot testing** - can inspect drawing calls
✅ **getImageData returns mock data** - useful for basic checks

### Example Unit Test

```typescript
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCandlestickRenderer } from './useCandlestickRenderer';

describe('useCandlestickRenderer', () => {
  it('should draw candlesticks with correct colors', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const mockManager = {
      getContext: () => ctx,
      getDimensions: () => ({ width: 800, height: 600 }),
      getViewport: () => ({ start: 0, end: 100 }),
    };
    
    const { result } = renderHook(() => 
      useCandlestickRenderer({ manager: mockManager, candles: mockData })
    );
    
    // Render candles
    result.current.render();
    
    // Check that drawing methods were called
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillStyle).toBeDefined();
  });
});
```

### What You Can Test

✅ Canvas methods are called (fillRect, strokeRect, arc, etc.)
✅ Correct number of drawing operations
✅ Fill/stroke styles are set correctly
✅ Coordinate calculations
✅ Clipping regions
✅ State save/restore
✅ Text rendering calls

❌ **Cannot test:** Actual pixel output, visual appearance

---

## 🌐 Writing Browser Tests (Real Rendering)

### Features of Browser Tests

✅ **Real canvas rendering** - actual pixels drawn
✅ **getImageData returns real data** - can check pixel colors
✅ **Full Canvas API** - all methods work exactly as in browser
✅ **Integration testing** - test full component behavior

### Example Browser Test

```typescript
import { expect, test } from 'vitest';

test('Canvas renders bullish candle correctly', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No context');

  // Draw a green bullish candle
  ctx.fillStyle = '#00ff00';
  ctx.fillRect(100, 100, 50, 200);

  // Verify the pixel is actually green
  const pixelData = ctx.getImageData(125, 150, 1, 1).data;
  expect(pixelData[0]).toBe(0);    // Red
  expect(pixelData[1]).toBe(255);  // Green
  expect(pixelData[2]).toBe(0);    // Blue
  expect(pixelData[3]).toBe(255);  // Alpha

  document.body.removeChild(canvas);
});
```

### What You Can Test

✅ Actual pixel colors at specific coordinates
✅ Text rendering with correct fonts
✅ Image rendering
✅ Gradient rendering
✅ Pattern fills
✅ Complex compositing operations
✅ Visual regression (with screenshots)

---

## 🎯 Testing Strategy

### Use Unit Tests For:

1. **Renderer hooks** logic validation
2. **Coordinate calculations** (priceToY, yToPrice, etc.)
3. **Drawing utilities** (drawCandle, drawLine, drawText)
4. **Canvas manager** state management
5. **Fast feedback** during development

**Pros:**
- ⚡ Very fast (milliseconds)
- 🔄 Great for TDD
- 🤖 Works in CI without browser
- 📊 Coverage reporting

**Cons:**
- ❌ No visual validation
- ❌ Can't test actual rendering bugs

### Use Browser Tests For:

1. **Visual regression** testing
2. **Integration tests** of complete chart rendering
3. **User interactions** (mouse, touch, keyboard)
4. **Pixel-perfect validation** (if needed)
5. **Screenshot comparisons**

**Pros:**
- ✅ Tests real rendering
- ✅ Catches visual bugs
- ✅ Full API support
- ✅ User interaction testing

**Cons:**
- 🐢 Slower (seconds per test)
- 💻 Requires browser installation
- 🎭 More complex CI setup

---

## 🔧 Configuration Files

### `vitest.config.ts` (Unit Tests)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',           // jsdom with vitest-canvas-mock
    setupFiles: './src/tests/setup.ts',
    coverage: {
      provider: 'v8',
      // ... coverage settings
    },
  },
});
```

### `vitest.browser.config.ts` (Browser Tests)

```typescript
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.browser.test.{ts,tsx}'],  // Only browser tests
    browser: {
      enabled: true,
      provider: playwright(),                  // Use Playwright
      instances: [{ browser: 'chromium' }],   // Chromium browser
      headless: true,                          // Headless mode
    },
  },
});
```

### `src/tests/setup.ts`

```typescript
import 'vitest-canvas-mock';  // Import canvas mock first!
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// ... other global mocks
```

---

## 📊 Current Test Coverage

### Overall: **90.62%** ✅ (Exceeds 80% target!)

### By Category:

| Category | Coverage | Status |
|----------|----------|--------|
| **Hooks** | 84.64% | ✅ Good |
| **Stores** | 78.55% | ✅ Good |
| **Services** | 85-97% | ✅ Excellent |
| **Utils** | 92.45% | ✅ Excellent |
| **Canvas Utils** | 85.50% | ✅ Good |
| **Components** | ~5% | ⚠️ **Needs Improvement** |

### Recently Added Tests:

✅ `useCandlestickRenderer.test.ts` (16 tests)
✅ `useVolumeRenderer.test.ts` (13 tests)
✅ `useGridRenderer.test.ts` (11 tests)
✅ `ChartCanvas.browser.test.tsx` (4 browser tests)

**Total Tests:** 1010 passing ✅

---

## 🚀 Next Steps

### Priority 1: Complete Renderer Hooks Coverage

- [ ] useCrosshairRenderer.test.ts
- [ ] useIndicatorsRenderer.test.ts
- [ ] useOrdersRenderer.test.ts
- [ ] useWatermarkRenderer.test.ts
- [ ] useTooltipRenderer.test.ts

### Priority 2: Component Testing

- [ ] ChartCanvas.test.tsx (unit tests)
- [ ] Settings components (9 components)
- [ ] Chat components
- [ ] Trading components

### Priority 3: Worker Testing

- [ ] Test worker calculation logic directly
- [ ] Improve integration tests for workers

### Priority 4: Visual Regression

- [ ] Add screenshot-based tests for critical views
- [ ] Set up visual regression CI pipeline

---

## 💡 Tips & Best Practices

### 1. Use the Right Test Type

```typescript
// ✅ Good - Unit test for logic
it('should calculate Y position from price', () => {
  const y = priceToY(price, bounds, height);
  expect(y).toBe(expectedY);
});

// ❌ Bad - Don't use browser test for simple calculations
test('should calculate Y position', async () => {
  // Overkill - use unit test instead
});
```

### 2. Mock Heavy Dependencies

```typescript
// ✅ Good - Mock canvas manager
const mockManager = {
  getContext: () => mockContext,
  getDimensions: () => ({ width: 800, height: 600 }),
};

// ❌ Bad - Creating real instances
const manager = new CanvasManager(canvas);
```

### 3. Test One Thing at a Time

```typescript
// ✅ Good - Focused test
it('should draw bullish candles green', () => {
  render();
  expect(ctx.fillStyle).toContain('#00ff00');
});

// ✅ Good - Separate test
it('should draw bearish candles red', () => {
  render();
  expect(ctx.fillStyle).toContain('#ff0000');
});
```

### 4. Use Descriptive Test Names

```typescript
// ✅ Good
it('should clip drawing to chart area when rendering', () => {});

// ❌ Bad
it('should work', () => {});
```

### 5. Clean Up After Tests

```typescript
// ✅ Good - Clean up DOM
afterEach(() => {
  document.body.innerHTML = '';
});

// ✅ Good - Clear mocks
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

## 🐛 Troubleshooting

### Canvas Methods Not Mocked

**Problem:** `TypeError: ctx.fillRect is not a function`

**Solution:** Make sure `vitest-canvas-mock` is imported in setup.ts:
```typescript
import 'vitest-canvas-mock';
```

### Browser Tests Not Running

**Problem:** Tests not found or config error

**Solution:** 
1. Check file pattern: `*.browser.test.{ts,tsx}`
2. Use correct config: `--config vitest.browser.config.ts`
3. Verify Playwright is installed: `npx playwright install chromium`

### Coverage Not Including New Files

**Problem:** New test files not affecting coverage

**Solution:**
1. Run with coverage: `npm run test:coverage`
2. Check exclude patterns in `vitest.config.ts`
3. Ensure files are imported by tests

### Browser Tests Failing in CI

**Problem:** Browser tests timeout or fail in CI

**Solution:**
1. Ensure browsers are installed in CI:
   ```yaml
   - run: npx playwright install --with-deps chromium
   ```
2. Use headless mode (already configured)
3. Increase timeout if needed

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [vitest-canvas-mock](https://github.com/hustcc/jest-canvas-mock)
- [Vitest Browser Mode](https://vitest.dev/guide/browser.html)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)

---

**Last Updated:** November 23, 2025
**Version:** 1.0
**Project Version:** 0.23.0
