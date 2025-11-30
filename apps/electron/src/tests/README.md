# Testing Guide

## Overview

This project uses **Vitest** as the testing framework with **React Testing Library** for component testing.

## Running Tests

```bash
# Run tests in watch mode
yarn test

# Run tests once
yarn test:run

# Run tests with UI
yarn test:ui

# Run tests with coverage
yarn test:coverage
```

## Writing Tests

### Test File Location

- **Component hooks**: Place test files next to the hook file
  - Example: `useChartCanvas.ts` → `useChartCanvas.test.ts`
- **Services**: Place test files next to the service file
  - Example: `AIService.ts` → `AIService.test.ts`
- **Utils**: Place test files next to the utility file
  - Example: `formatters.ts` → `formatters.test.ts`

### Hook Testing Example

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useChartCanvas } from './useChartCanvas';

describe('useChartCanvas', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useChartCanvas());
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('should update state on action', () => {
    const { result } = renderHook(() => useChartCanvas());
    
    act(() => {
      result.current.loadData();
    });
    
    expect(result.current.isLoading).toBe(true);
  });
});
```

### Component Testing Example

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ChartCanvas } from './ChartCanvas';

describe('ChartCanvas', () => {
  it('should render without crashing', () => {
    render(<ChartCanvas />);
    expect(screen.getByRole('canvas')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(<ChartCanvas isLoading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

### Service Testing Example

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIService } from './AIService';

describe('AIService', () => {
  let service: AIService;

  beforeEach(() => {
    service = new AIService();
  });

  it('should call API with correct parameters', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'success' }),
    });
    global.fetch = mockFetch;

    await service.analyze({ prompt: 'test' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/analyze'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
```

### Utility Testing Example

```typescript
import { describe, it, expect } from 'vitest';
import { formatPrice, formatDate } from './formatters';

describe('formatters', () => {
  describe('formatPrice', () => {
    it('should format price with 2 decimal places', () => {
      expect(formatPrice(1234.5)).toBe('$1,234.50');
    });

    it('should handle negative values', () => {
      expect(formatPrice(-1234.5)).toBe('-$1,234.50');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-01T12:00:00Z');
      expect(formatDate(date)).toBe('Jan 1, 2024');
    });
  });
});
```

## Best Practices

### 1. Test Naming

Use descriptive test names that explain what is being tested:

```typescript
// Good
it('should return error when API key is invalid', () => {});

// Bad
it('works', () => {});
```

### 2. Arrange-Act-Assert Pattern

Organize tests with clear sections:

```typescript
it('should update count when button is clicked', () => {
  // Arrange
  const { result } = renderHook(() => useCounter());
  
  // Act
  act(() => {
    result.current.increment();
  });
  
  // Assert
  expect(result.current.count).toBe(1);
});
```

### 3. Mock External Dependencies

Always mock external services, APIs, and browser APIs:

```typescript
import { vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn();

// Mock window.matchMedia (already done in setup.ts)
// Mock canvas methods
HTMLCanvasElement.prototype.getContext = vi.fn();
```

### 4. Test Coverage

Aim for high test coverage but focus on critical paths:

- **Must test**: Business logic, data transformations, calculations
- **Should test**: User interactions, error handling, edge cases
- **Optional**: Simple getters/setters, trivial formatting

### 5. Isolate Tests

Each test should be independent:

```typescript
import { beforeEach, afterEach } from 'vitest';

describe('MyComponent', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
    vi.clearAllMocks();
  });
});
```

## Available Matchers

### Vitest Matchers
- `expect(value).toBe(expected)` - Strict equality
- `expect(value).toEqual(expected)` - Deep equality
- `expect(value).toBeTruthy()` - Truthy check
- `expect(value).toBeNull()` - Null check
- `expect(fn).toThrow()` - Function throws error

### Testing Library Matchers (from @testing-library/jest-dom)
- `expect(element).toBeInTheDocument()`
- `expect(element).toHaveTextContent(text)`
- `expect(element).toHaveAttribute(attr, value)`
- `expect(element).toBeVisible()`
- `expect(element).toBeDisabled()`

See full list: https://github.com/testing-library/jest-dom

## Troubleshooting

### Test fails with "Cannot find module"
Make sure all dependencies are installed:
```bash
yarn install
```

### Canvas tests fail
Canvas API needs to be mocked in tests:
```typescript
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  clearRect: vi.fn(),
  // ... other canvas methods
}));
```

### React hooks tests fail
Use `renderHook` from `@testing-library/react`:
```typescript
import { renderHook } from '@testing-library/react';
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Jest-DOM](https://github.com/testing-library/jest-dom)
