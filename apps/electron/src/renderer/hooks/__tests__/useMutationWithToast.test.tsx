import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const successMock = vi.fn();
const errorMock = vi.fn();

vi.mock('../useToast', () => ({
  useToast: () => ({
    success: successMock,
    error: errorMock,
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && Object.keys(values).length > 0
        ? `${key}:${JSON.stringify(values)}`
        : key,
  }),
}));

import { useMutationWithToast } from '../useMutationWithToast';

describe('useMutationWithToast', () => {
  beforeEach(() => {
    successMock.mockClear();
    errorMock.mockClear();
  });

  it('shows the success toast and returns the result on resolve', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ id: 7 });
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useMutationWithToast(
        { mutateAsync, isPending: false },
        { successKey: 'foo.success', failureKey: 'foo.failure', onSuccess },
      ),
    );

    let value: unknown = undefined;
    await act(async () => {
      value = await result.current.run({ x: 1 });
    });

    expect(value).toEqual({ id: 7 });
    expect(mutateAsync).toHaveBeenCalledWith({ x: 1 });
    expect(successMock).toHaveBeenCalledWith('foo.success');
    expect(errorMock).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith({ id: 7 }, { x: 1 });
  });

  it('shows the failure toast with the error message and returns null on reject', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('boom'));
    const onError = vi.fn();
    const { result } = renderHook(() =>
      useMutationWithToast(
        { mutateAsync },
        { successKey: 'foo.success', failureKey: 'foo.failure', onError },
      ),
    );

    let value: unknown = 'sentinel';
    await act(async () => {
      value = await result.current.run({ x: 1 });
    });

    expect(value).toBeNull();
    expect(errorMock).toHaveBeenCalledWith('foo.failure', 'boom');
    expect(successMock).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), { x: 1 });
  });

  it('skips the success toast when no successKey is provided', async () => {
    const mutateAsync = vi.fn().mockResolvedValue('ok');
    const { result } = renderHook(() =>
      useMutationWithToast({ mutateAsync }, { failureKey: 'foo.failure' }),
    );
    await act(async () => {
      await result.current.run(undefined as unknown as never);
    });
    expect(successMock).not.toHaveBeenCalled();
  });

  it('coerces non-Error rejections to a string', async () => {
    const mutateAsync = vi.fn().mockRejectedValue({ code: 'BAD' });
    const { result } = renderHook(() =>
      useMutationWithToast({ mutateAsync }, { failureKey: 'foo.failure' }),
    );
    await act(async () => {
      await result.current.run({});
    });
    expect(errorMock).toHaveBeenCalledWith('foo.failure', '[object Object]');
  });

  it('mirrors the upstream isPending flag', async () => {
    const mutateAsync = vi.fn().mockResolvedValue('ok');
    const { result, rerender } = renderHook(
      ({ pending }: { pending: boolean }) =>
        useMutationWithToast({ mutateAsync, isPending: pending }, { failureKey: 'f' }),
      { initialProps: { pending: false } },
    );
    expect(result.current.isPending).toBe(false);
    rerender({ pending: true });
    expect(result.current.isPending).toBe(true);
  });

  it('falls back to its own pending state when the mutation does not expose isPending', async () => {
    let resolve: (v: string) => void = () => {};
    const mutateAsync = vi.fn(() => new Promise<string>((r) => { resolve = r; }));
    const { result } = renderHook(() =>
      useMutationWithToast({ mutateAsync }, { failureKey: 'f' }),
    );

    let p: Promise<unknown> | undefined;
    act(() => {
      p = result.current.run({});
    });
    await waitFor(() => expect(result.current.isPending).toBe(true));

    await act(async () => {
      resolve('done');
      await p;
    });
    expect(result.current.isPending).toBe(false);
  });

  it('passes interpolation values to the i18n title', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('nope'));
    const { result } = renderHook(() =>
      useMutationWithToast(
        { mutateAsync },
        { failureKey: 'f', failureValues: { name: 'Alice' } },
      ),
    );
    await act(async () => {
      await result.current.run({});
    });
    expect(errorMock).toHaveBeenCalledWith('f:{"name":"Alice"}', 'nope');
  });
});
