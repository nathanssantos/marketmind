# useBackendSetups Hook

React Query hook for consuming the backend setup detection API.

## Features

- Real-time setup detection with `useDetectCurrent`
- Historical range detection with `useDetectRange`
- Cached setup history with `useHistory`
- Analytics with `useStats`
- Configuration management with `useConfig` and `updateConfig`
- Automatic cache invalidation on config updates
- TypeScript type safety

## Usage

```typescript
import { useBackendSetups } from '../hooks/useBackendSetups';

const MyComponent = () => {
  const {
    useDetectCurrent,
    useDetectRange,
    useHistory,
    useStats,
    useConfig,
    updateConfig,
  } = useBackendSetups();

  // Real-time detection (auto-refetches every 60 seconds)
  const current = useDetectCurrent({ symbol: 'BTCUSDT', interval: '1m' });
  
  // Historical range detection
  const range = useDetectRange(
    'BTCUSDT',
    '1m',
    new Date('2024-01-01'),
    new Date('2024-01-31')
  );
  
  // Cached history with filters
  const history = useHistory({
    symbol: 'BTCUSDT',
    setupType: 'setup91',
    direction: 'LONG',
    startDate: new Date('2024-01-01'),
    limit: 50,
  });
  
  // Analytics
  const stats = useStats({
    symbol: 'BTCUSDT',
    startDate: new Date('2024-01-01'),
  });
  
  // Configuration
  const config = useConfig();
  
  // Update configuration
  const handleUpdateConfig = async () => {
    await updateConfig.mutateAsync({
      minConfidence: 70,
      minRiskReward: 2.0,
      setup91: { enabled: true, emaPeriod: 9 },
    });
  };
  
  return (
    <div>
      {current.data?.setups.map(setup => (
        <div key={setup.id}>{setup.setupType}</div>
      ))}
    </div>
  );
};
```

## API Reference

### `useDetectCurrent(params)`

Detect setups on current klines (last 500).

**Parameters:**
- `symbol: string` - Trading symbol (e.g., 'BTCUSDT')
- `interval: Interval` - Kline interval (e.g., '1m', '5m', '1h')

**Returns:** React Query result with `{ setups: TradingSetup[], detectedAt: Date }`

**Options:**
- Auto-refetch: Every 60 seconds
- Enabled: Only when symbol and interval are provided

### `useDetectRange(symbol, interval, startTime, endTime)`

Detect setups on a historical time range.

**Parameters:**
- `symbol: string` - Trading symbol
- `interval: Interval` - Kline interval
- `startTime: Date` - Range start time
- `endTime: Date` - Range end time

**Returns:** React Query result with `{ setups: TradingSetup[], detectedAt: Date }`

**Options:**
- Stale time: 5 minutes
- Enabled: Only when all parameters are provided

### `useHistory(params)`

Query cached setup detection history.

**Parameters:**
- `symbol?: string` - Filter by symbol
- `setupType?: SetupType` - Filter by setup type
- `direction?: 'LONG' | 'SHORT'` - Filter by direction
- `startDate?: Date` - Filter by start date
- `endDate?: Date` - Filter by end date
- `limit?: number` - Limit results

**Returns:** React Query result with `{ setups: array, total: number }`

**Options:**
- Stale time: 30 seconds

### `useStats(params)`

Get analytics for detected setups.

**Parameters:**
- `symbol?: string` - Filter by symbol
- `startDate?: Date` - Filter by start date
- `endDate?: Date` - Filter by end date

**Returns:** React Query result with analytics object:
```typescript
{
  totalSetups: number;
  byType: Record<string, number>;
  byDirection: { LONG: number; SHORT: number };
  avgConfidence: number;
  avgRiskReward: number;
}
```

**Options:**
- Stale time: 60 seconds

### `useConfig()`

Get current setup detection configuration.

**Returns:** React Query result with config object

**Options:**
- Stale time: Infinity (cached until mutation)

### `updateConfig`

Mutation for updating setup detection configuration.

**Usage:**
```typescript
await updateConfig.mutateAsync({
  minConfidence: 70,
  minRiskReward: 2.0,
  trendFilterEnabled: true,
  setup91: { enabled: true, emaPeriod: 9 },
});
```

**Side Effects:**
- Invalidates all setup-related queries
- Triggers refetch of current detections, history, stats, and config

## Setup Types

Available setup types:
- `setup91` - Larry Williams 9.1 (Trend Reversal)
- `setup92` - Larry Williams 9.2 (EMA9 Pullback)
- `setup93` - Larry Williams 9.3 (EMA9 Double Pullback)
- `setup94` - Larry Williams 9.4 (EMA9 Continuation)
- `pattern123` - 1-2-3 Pattern
- `bullTrap` - Bull Trap Pattern
- `bearTrap` - Bear Trap Pattern
- `breakoutRetest` - Breakout Retest

## Backend Endpoints

This hook consumes the following tRPC endpoints:

- `setup.detectCurrent` - Real-time detection
- `setup.detectRange` - Historical range detection
- `setup.getHistory` - Cached history query
- `setup.getStats` - Analytics aggregations
- `setup.getConfig` - Configuration retrieval
- `setup.updateConfig` - Configuration update

## Database Schema

Detected setups are cached in the `setup_detections` table with:
- 17 columns (id, userId, symbol, interval, setupType, direction, prices, confidence, etc.)
- 5 indices for optimized queries
- 24-hour expiration (expiresAt field)
- Auto-save on detectCurrent

## Testing

All functionality is tested with:
- 47 backend tests (100% pass rate)
- 1,894 frontend tests (100% pass rate)
- TypeScript strict mode (zero errors)

## Related Documentation

- [Backend Integration Status](../docs/BACKEND_INTEGRATION_STATUS.md)
- [Setup Detection Guide](../docs/SETUP_DETECTION_GUIDE.md)
- [Backend README](../../apps/backend/README.md)
