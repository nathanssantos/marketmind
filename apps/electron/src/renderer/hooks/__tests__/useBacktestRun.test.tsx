import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BacktestCompletePayload,
  BacktestFailedPayload,
  BacktestProgressPayload,
  ServerToClientEvents,
  SimpleBacktestInput,
} from '@marketmind/types';

type ServerHandler = (payload: unknown) => void;
type ServerEvent = keyof ServerToClientEvents;

const socketListeners = new Map<ServerEvent, Set<ServerHandler>>();

const mockMutateAsync = vi.fn<(input: SimpleBacktestInput) => Promise<{ backtestId: string }>>();
const mockGetResultData = { id: 'result-1', status: 'COMPLETED', metrics: { totalTrades: 5 } };

vi.mock('../../utils/trpc', () => ({
  trpc: {
    backtest: {
      run: { useMutation: () => ({ mutateAsync: mockMutateAsync }) },
      getResult: {
        useQuery: (input: { id: string }, opts: { enabled?: boolean }) => ({
          data: opts?.enabled && input.id ? mockGetResultData : undefined,
          isLoading: false,
        }),
      },
    },
  },
}));

vi.mock('../../services/socketBus', () => ({
  socketBus: {
    on: <E extends ServerEvent>(event: E, handler: ServerToClientEvents[E]) => {
      let set = socketListeners.get(event);
      if (!set) {
        set = new Set();
        socketListeners.set(event, set);
      }
      set.add(handler as unknown as ServerHandler);
      return () => {
        set?.delete(handler as unknown as ServerHandler);
      };
    },
    emit: vi.fn(),
  },
}));

const emit = <E extends ServerEvent>(event: E, payload: Parameters<ServerToClientEvents[E]>[0]) => {
  const set = socketListeners.get(event);
  if (!set) return;
  for (const handler of set) handler(payload);
};

const sampleInput: SimpleBacktestInput = {
  symbol: 'BTCUSDT',
  interval: '1h',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  initialCapital: 10_000,
};

const importHook = async () => (await import('../useBacktestRun')).useBacktestRun;

beforeEach(() => {
  socketListeners.clear();
  mockMutateAsync.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBacktestRun', () => {
  it('initializes in idle with everything null', async () => {
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());

    expect(result.current.status).toBe('idle');
    expect(result.current.progress).toBeNull();
    expect(result.current.backtestId).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeUndefined();
  });

  it('start() flips to running and stores the backtestId', async () => {
    mockMutateAsync.mockResolvedValueOnce({ backtestId: 'bt-7' });
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());

    await act(async () => {
      await result.current.start(sampleInput);
    });

    expect(result.current.status).toBe('running');
    expect(result.current.backtestId).toBe('bt-7');
  });

  it('start() flips to failed when the mutation rejects', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('mutation boom'));
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());

    await act(async () => {
      await result.current.start(sampleInput);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('mutation boom');
    expect(result.current.backtestId).toBeNull();
  });

  it('captures backtest:progress when ids match', async () => {
    mockMutateAsync.mockResolvedValueOnce({ backtestId: 'bt-1' });
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());
    await act(async () => { await result.current.start(sampleInput); });

    const payload: BacktestProgressPayload = {
      backtestId: 'bt-1',
      phase: 'simulating',
      processed: 30,
      total: 100,
      etaMs: 5_000,
      startedAt: Date.now(),
    };

    act(() => emit('backtest:progress', payload));

    expect(result.current.progress).toEqual(payload);
  });

  it('ignores backtest:progress for a different backtestId', async () => {
    mockMutateAsync.mockResolvedValueOnce({ backtestId: 'bt-1' });
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());
    await act(async () => { await result.current.start(sampleInput); });

    act(() => emit('backtest:progress', {
      backtestId: 'bt-other',
      phase: 'simulating',
      processed: 50,
      total: 100,
      etaMs: 1_000,
      startedAt: Date.now(),
    }));

    expect(result.current.progress).toBeNull();
  });

  it('flips to success and exposes resultId on backtest:complete', async () => {
    mockMutateAsync.mockResolvedValueOnce({ backtestId: 'bt-9' });
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());
    await act(async () => { await result.current.start(sampleInput); });

    const payload: BacktestCompletePayload = {
      backtestId: 'bt-9',
      resultId: 'result-1',
      durationMs: 1_234,
    };
    act(() => emit('backtest:complete', payload));

    expect(result.current.status).toBe('success');
    await waitFor(() => expect(result.current.result).toEqual(mockGetResultData));
  });

  it('ignores backtest:complete for a different backtestId', async () => {
    mockMutateAsync.mockResolvedValueOnce({ backtestId: 'bt-9' });
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());
    await act(async () => { await result.current.start(sampleInput); });

    act(() => emit('backtest:complete', {
      backtestId: 'bt-other',
      resultId: 'result-x',
      durationMs: 100,
    }));

    expect(result.current.status).toBe('running');
  });

  it('flips to failed on backtest:failed with the matching backtestId', async () => {
    mockMutateAsync.mockResolvedValueOnce({ backtestId: 'bt-3' });
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());
    await act(async () => { await result.current.start(sampleInput); });

    const payload: BacktestFailedPayload = {
      backtestId: 'bt-3',
      error: 'engine exploded',
    };
    act(() => emit('backtest:failed', payload));

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('engine exploded');
  });

  it('reset() returns to idle and clears state', async () => {
    mockMutateAsync.mockResolvedValueOnce({ backtestId: 'bt-r' });
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());
    await act(async () => { await result.current.start(sampleInput); });

    act(() => emit('backtest:complete', {
      backtestId: 'bt-r',
      resultId: 'r-1',
      durationMs: 100,
    }));

    act(() => result.current.reset());

    expect(result.current.status).toBe('idle');
    expect(result.current.backtestId).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('viewResult(id) jumps to success and triggers the result query', async () => {
    const useBacktestRun = await importHook();
    const { result } = renderHook(() => useBacktestRun());

    act(() => result.current.viewResult('result-1'));

    expect(result.current.status).toBe('success');
    await waitFor(() => expect(result.current.result).toEqual(mockGetResultData));
  });
});
