import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const infoMock = vi.fn();
const successMock = vi.fn();
const warningMock = vi.fn();
const errorMock = vi.fn();

let socketHandler: ((payload: unknown) => void) | null = null;

let setupToastsEnabled = true;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string; symbol?: string; setupType?: string; direction?: string }) => {
      if (opts?.symbol) return `${opts.symbol} ${opts.setupType ?? ''}${opts.direction ?? ''}`.trim();
      return opts?.defaultValue ?? _key;
    },
  }),
}));

vi.mock('./useToast', () => ({
  useToast: () => ({
    info: infoMock,
    success: successMock,
    warning: warningMock,
    error: errorMock,
  }),
}));

vi.mock('./useBackendAuth', () => ({
  useBackendAuth: () => ({ currentUser: { id: 'u1' } }),
}));

vi.mock('../store/preferencesStore', () => ({
  useUIPref: <T,>(_key: string, _defaultValue: T): [T, (v: T) => void] => [
    setupToastsEnabled as unknown as T,
    () => undefined,
  ],
}));

vi.mock('./socket', () => ({
  useUserChannelSubscription: () => undefined,
  useSocketEvent: (event: string, handler: (payload: unknown) => void, enabled?: boolean) => {
    if (event === 'setup-detected' && enabled !== false) {
      socketHandler = handler;
    }
  },
}));

import { useSetupToasts } from './useSetupToasts';

describe('useSetupToasts', () => {
  beforeEach(() => {
    socketHandler = null;
    infoMock.mockClear();
    setupToastsEnabled = true;
  });
  afterEach(() => {
    socketHandler = null;
  });

  it('subscribes to setup-detected socket events', () => {
    renderHook(() => useSetupToasts());
    expect(socketHandler).not.toBeNull();
  });

  it('fires info toast when setup arrives and toasts enabled', () => {
    renderHook(() => useSetupToasts());
    socketHandler?.({ symbol: 'BTCUSDT', setupType: 'rsi-bull', direction: 'LONG' });
    expect(infoMock).toHaveBeenCalled();
  });

  it('does NOT fire toast when setupToastsEnabled=false', () => {
    setupToastsEnabled = false;
    renderHook(() => useSetupToasts());
    socketHandler?.({ symbol: 'BTCUSDT', setupType: 'rsi-bull', direction: 'LONG' });
    expect(infoMock).not.toHaveBeenCalled();
  });

  it('skips payload without symbol', () => {
    renderHook(() => useSetupToasts());
    socketHandler?.({ setupType: 'rsi-bull', direction: 'LONG' });
    expect(infoMock).not.toHaveBeenCalled();
  });

  it('skips payload without setupType', () => {
    renderHook(() => useSetupToasts());
    socketHandler?.({ symbol: 'BTCUSDT', direction: 'LONG' });
    expect(infoMock).not.toHaveBeenCalled();
  });

  it('handles missing direction gracefully', () => {
    renderHook(() => useSetupToasts());
    socketHandler?.({ symbol: 'BTCUSDT', setupType: 'rsi-bull' });
    expect(infoMock).toHaveBeenCalled();
  });
});
