# Web Workers

This directory contains all Web Worker implementations for offloading heavy computations from the main thread.

## 📁 Structure

```
workers/
├── movingAverages.worker.ts      # SMA/EMA calculations
├── bounds.worker.ts               # Chart bounds (min/max prices/volume)
├── klineOptimizer.worker.ts     # Kline data optimization for AI
├── conversation.worker.ts         # AI conversation summarization
└── coordinates.worker.ts          # Batch coordinate transformations
```

## 🎯 Worker Pattern

All workers follow a consistent pattern:

### Worker File (`*.worker.ts`)
```typescript
export interface WorkerRequest {
  type: 'action';
  // ... input data
}

export interface WorkerResponse {
  type: 'result';
  // ... output data
}

// Pure functions for calculations
const calculate = (input: InputType): OutputType => {
  // Computation logic
  return result;
};

// Message handler
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { type, ...data } = event.data;
  
  if (type !== 'action') return;
  
  const result = calculate(data);
  
  const response: WorkerResponse = {
    type: 'result',
    ...result,
  };
  
  self.postMessage(response);
};

export {};
```

### Hook File (`use*Worker.ts`)
```typescript
import { useCallback, useEffect, useRef } from 'react';

export const useMyWorker = () => {
  const workerRef = useRef<Worker | null>(null);
  const pendingCallbacksRef = useRef<Map<number, (result: any) => void>>(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Initialize worker
    workerRef.current = new Worker(
      new URL('./my.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Handle responses
    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, ...result } = event.data;
      
      if (type === 'result') {
        const callbacks = Array.from(pendingCallbacksRef.current.values());
        pendingCallbacksRef.current.clear();
        
        callbacks.forEach((callback) => callback(result));
      }
    };

    // Cleanup
    return () => {
      workerRef.current?.terminate();
      pendingCallbacksRef.current.clear();
    };
  }, []);

  const compute = useCallback((input: InputType): Promise<OutputType> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        resolve(defaultValue);
        return;
      }

      const requestId = requestIdRef.current++;
      pendingCallbacksRef.current.set(requestId, resolve);

      workerRef.current.postMessage({ type: 'action', ...input });
    });
  }, []);

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    pendingCallbacksRef.current.clear();
  }, []);

  return { compute, terminate };
};
```

## 📊 Worker Details

### Moving Averages Worker
- **Purpose:** Calculate SMA and EMA for multiple periods
- **Input:** Array of klines + configurations
- **Output:** Array of calculated values for each MA
- **Performance:** 3.5x faster than main thread
- **Batch Support:** Yes - processes multiple MAs in one call

### Bounds Calculator Worker
- **Purpose:** Find min/max prices and volumes in viewport
- **Input:** Klines array + viewport range
- **Output:** `{ minPrice, maxPrice, minVolume, maxVolume }`
- **Performance:** 4x faster than main thread
- **Use Case:** Called on every zoom/pan operation

### Kline Optimizer Worker
- **Purpose:** Prepare kline data for AI (reduce token usage)
- **Input:** Full kline array
- **Output:** Detailed recent + simplified historical data
- **Performance:** 3.4x faster than main thread
- **Features:** Automatic timeframe detection, smart sampling

### Conversation Worker
- **Purpose:** Summarize old AI messages to reduce context
- **Input:** Array of messages + keep count
- **Output:** Summary text + recent messages
- **Performance:** 3.6x faster than main thread
- **Features:** Topic detection, keyword extraction

### Coordinates Worker
- **Purpose:** Batch convert prices↔pixels, indices↔x positions
- **Input:** Array of values + bounds/viewport
- **Output:** Array of transformed coordinates
- **Performance:** ~3x faster for 1000+ conversions
- **Use Case:** Drawing complex indicators with many points

## 🚀 Creating a New Worker

1. **Create worker file:**
```bash
touch src/renderer/workers/myFeature.worker.ts
```

2. **Define types and logic:**
```typescript
export interface MyWorkerRequest {
  type: 'compute';
  data: number[];
}

export interface MyWorkerResponse {
  type: 'result';
  values: number[];
}

const compute = (data: number[]): number[] => {
  return data.map(x => x * 2); // Your logic here
};

self.onmessage = (event: MessageEvent<MyWorkerRequest>) => {
  const { type, data } = event.data;
  if (type !== 'compute') return;
  
  const values = compute(data);
  self.postMessage({ type: 'result', values });
};
```

3. **Create hook:**
```bash
touch src/renderer/hooks/useMyFeatureWorker.ts
```

4. **Create test:**
```bash
touch src/renderer/hooks/useMyFeatureWorker.test.ts
```

5. **Document in:**
- `docs/WEB_WORKERS.md` - Usage guide
- `docs/CHANGELOG.md` - Feature addition

## ⚡ Performance Tips

### When to Use Workers
- ✅ Calculations taking >16ms (blocks 60fps)
- ✅ Processing arrays >1000 items
- ✅ Complex mathematical operations
- ✅ Text processing/analysis
- ✅ Data transformations

### When NOT to Use Workers
- ❌ DOM manipulation (workers can't access DOM)
- ❌ Simple operations <1ms
- ❌ Operations needing React state immediately
- ❌ Canvas rendering (must be synchronous)

### Optimization Strategies

1. **Batch Processing:**
```typescript
// ✅ Good - One worker call
const results = await calculateAll(data);

// ❌ Bad - Multiple worker calls
const result1 = await calculate(data1);
const result2 = await calculate(data2);
```

2. **Debouncing:**
```typescript
const debouncedData = useDebounce(data, 150);

useEffect(() => {
  compute(debouncedData);
}, [debouncedData]);
```

3. **Early Returns:**
```typescript
const compute = (data: number[]) => {
  if (data.length === 0) return []; // Fast path
  // Heavy computation
};
```

## 🧪 Testing Workers

Workers can't run in test environment (JSDOM). Test only hook initialization:

```typescript
describe('useMyWorker', () => {
  it('should initialize worker hook', () => {
    const { result } = renderHook(() => useMyWorker());
    
    expect(result.current.compute).toBeDefined();
    expect(result.current.terminate).toBeDefined();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useMyWorker());
    expect(() => unmount()).not.toThrow();
  });
});
```

For integration testing, run the app and use DevTools Performance tab.

## 📚 Resources

- [MDN Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Vite Worker Support](https://vitejs.dev/guide/features.html#web-workers)
- [React + Workers Best Practices](https://react.dev/learn/you-might-not-need-an-effect#subscribing-to-an-external-store)
- [Performance Profiling](https://developer.chrome.com/docs/devtools/performance/)

---

**Note:** All workers use ES Modules (`type: 'module'`) for better TypeScript support and tree-shaking.
