import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// onSuccess mocks — captured once per useMutation call so we can fire them
// from the test exactly the way React Query would.
let updateOnSuccess: ((data: unknown, variables: unknown) => unknown) | null = null;
let removeOnSuccess: ((data: unknown, variables: unknown) => unknown) | null = null;
let resetOnSuccess: ((data: unknown, variables: unknown) => unknown) | null = null;

const updateMutate = vi.fn();
const removeMutate = vi.fn();
const resetMutate = vi.fn();
const createMutate = vi.fn();
const duplicateMutate = vi.fn();

const invalidate = vi.fn().mockResolvedValue(undefined);

vi.mock('@/renderer/utils/trpc', () => ({
  trpc: {
    useUtils: () => ({
      userIndicators: { list: { invalidate } },
    }),
    userIndicators: {
      list: {
        useQuery: () => ({
          data: [],
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        }),
      },
      create: {
        useMutation: () => ({ mutate: createMutate, mutateAsync: createMutate, isPending: false }),
      },
      update: {
        useMutation: (opts: { onSuccess: typeof updateOnSuccess }) => {
          updateOnSuccess = opts.onSuccess;
          return { mutate: updateMutate, mutateAsync: updateMutate, isPending: false };
        },
      },
      delete: {
        useMutation: (opts: { onSuccess: typeof removeOnSuccess }) => {
          removeOnSuccess = opts.onSuccess;
          return { mutate: removeMutate, mutateAsync: removeMutate, isPending: false };
        },
      },
      duplicate: {
        useMutation: () => ({ mutate: duplicateMutate, mutateAsync: duplicateMutate, isPending: false }),
      },
      reset: {
        useMutation: (opts: { onSuccess: typeof resetOnSuccess }) => {
          resetOnSuccess = opts.onSuccess;
          return { mutate: resetMutate, mutateAsync: resetMutate, isPending: false };
        },
      },
    },
  },
}));

import { useIndicatorStore } from '@/renderer/store/indicatorStore';
import { useUserIndicators } from './useUserIndicators';

const seedInstances = (entries: Array<{ id: string; userIndicatorId: string; params: Record<string, unknown> }>) => {
  useIndicatorStore.setState({
    instances: entries.map((e) => ({
      id: e.id,
      userIndicatorId: e.userIndicatorId,
      catalogType: 'ema',
      params: e.params,
      visible: true,
    })),
  });
};

describe('useUserIndicators — chart-instance sync side effects', () => {
  beforeEach(() => {
    updateOnSuccess = null;
    removeOnSuccess = null;
    resetOnSuccess = null;
    invalidate.mockClear();
    useIndicatorStore.setState({ instances: [] });
  });

  afterEach(() => {
    useIndicatorStore.setState({ instances: [] });
  });

  it('exposes the mutation API as expected', () => {
    const { result } = renderHook(() => useUserIndicators());
    expect(typeof result.current.create.mutateAsync).toBe('function');
    expect(typeof result.current.update.mutateAsync).toBe('function');
    expect(typeof result.current.remove.mutateAsync).toBe('function');
    expect(typeof result.current.duplicate.mutateAsync).toBe('function');
    expect(typeof result.current.reset.mutateAsync).toBe('function');
    expect(result.current.indicators).toEqual([]);
  });

  it('update onSuccess re-applies new params onto every active chart instance of that indicator', () => {
    seedInstances([
      { id: 'inst-a', userIndicatorId: 'ema-20', params: { color: '#ffffff', period: 20 } },
      { id: 'inst-b', userIndicatorId: 'ema-20', params: { color: '#ffffff', period: 20 } },
      { id: 'inst-c', userIndicatorId: 'rsi-14', params: { color: '#ffffff', period: 14 } },
    ]);

    renderHook(() => useUserIndicators());
    expect(updateOnSuccess).not.toBeNull();

    act(() => {
      updateOnSuccess?.(undefined, {
        id: 'ema-20',
        label: 'EMA 20',
        params: { color: '#22c55e', period: 50 },
      });
    });

    const after = useIndicatorStore.getState().instances;
    expect(after.find((i) => i.id === 'inst-a')?.params).toEqual({ color: '#22c55e', period: 50 });
    expect(after.find((i) => i.id === 'inst-b')?.params).toEqual({ color: '#22c55e', period: 50 });
    // Untouched: different userIndicatorId.
    expect(after.find((i) => i.id === 'inst-c')?.params).toEqual({ color: '#ffffff', period: 14 });
  });

  it('update onSuccess without params does not touch any instance', () => {
    seedInstances([
      { id: 'inst-a', userIndicatorId: 'ema-20', params: { color: '#ffffff', period: 20 } },
    ]);

    renderHook(() => useUserIndicators());

    act(() => {
      updateOnSuccess?.(undefined, { id: 'ema-20', label: 'Renamed only' });
    });

    expect(useIndicatorStore.getState().instances[0]?.params).toEqual({ color: '#ffffff', period: 20 });
  });

  it('remove onSuccess drops every active instance referring to the deleted indicator', () => {
    seedInstances([
      { id: 'inst-a', userIndicatorId: 'ema-20', params: {} },
      { id: 'inst-b', userIndicatorId: 'ema-20', params: {} },
      { id: 'inst-c', userIndicatorId: 'rsi-14', params: {} },
    ]);

    renderHook(() => useUserIndicators());

    act(() => {
      removeOnSuccess?.(undefined, { id: 'ema-20' });
    });

    const after = useIndicatorStore.getState().instances;
    expect(after).toHaveLength(1);
    expect(after[0]?.userIndicatorId).toBe('rsi-14');
  });

  it('reset onSuccess wipes every chart instance so the auto-activator can re-seed defaults', () => {
    seedInstances([
      { id: 'inst-a', userIndicatorId: 'ema-20', params: {} },
      { id: 'inst-b', userIndicatorId: 'rsi-14', params: {} },
    ]);

    renderHook(() => useUserIndicators());

    act(() => {
      resetOnSuccess?.(undefined, undefined);
    });

    expect(useIndicatorStore.getState().instances).toEqual([]);
  });

  it('all mutation onSuccess hooks invalidate the list query', () => {
    renderHook(() => useUserIndicators());
    invalidate.mockClear();

    act(() => {
      updateOnSuccess?.(undefined, { id: 'x', params: { color: '#000000' } });
    });
    expect(invalidate).toHaveBeenCalledTimes(1);

    invalidate.mockClear();
    act(() => {
      removeOnSuccess?.(undefined, { id: 'x' });
    });
    expect(invalidate).toHaveBeenCalledTimes(1);

    invalidate.mockClear();
    act(() => {
      resetOnSuccess?.(undefined, undefined);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
