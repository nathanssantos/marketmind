import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useApiBanStore } from '../store/apiBanStore';
import { useConnectionStore } from '../store/connectionStore';
import { usePollingInterval } from './usePollingInterval';

describe('usePollingInterval', () => {
  const initialBanState = useApiBanStore.getState();
  const initialConnectionState = useConnectionStore.getState();

  beforeEach(() => {
    useApiBanStore.setState({ ...initialBanState, banExpiresAt: 0 });
    useConnectionStore.setState({ ...initialConnectionState, wsConnected: false });
  });

  afterEach(() => {
    useApiBanStore.setState(initialBanState);
    useConnectionStore.setState(initialConnectionState);
  });

  it('returns the fallback when WS is disconnected', () => {
    useConnectionStore.setState({ ...initialConnectionState, wsConnected: false });
    const { result } = renderHook(() => usePollingInterval(15_000));
    expect(result.current).toBe(15_000);
  });

  it('returns the WS-connected default when WS is connected', () => {
    useConnectionStore.setState({ ...initialConnectionState, wsConnected: true });
    const { result } = renderHook(() => usePollingInterval(15_000));
    expect(result.current).toBe(5_000);
  });

  it('returns false (no polling) when API banned, regardless of WS', () => {
    useConnectionStore.setState({ ...initialConnectionState, wsConnected: true });
    useApiBanStore.setState({ ...initialBanState, banExpiresAt: Date.now() + 60_000 });
    const { result } = renderHook(() => usePollingInterval(15_000));
    expect(result.current).toBe(false);
  });

  describe('wsBacked option', () => {
    it('returns false when WS connected and wsBacked=true (push-only mode)', () => {
      useConnectionStore.setState({ ...initialConnectionState, wsConnected: true });
      const { result } = renderHook(() => usePollingInterval(15_000, { wsBacked: true }));
      expect(result.current).toBe(false);
    });

    it('still falls back to fallbackMs when WS disconnected and wsBacked=true', () => {
      useConnectionStore.setState({ ...initialConnectionState, wsConnected: false });
      const { result } = renderHook(() => usePollingInterval(15_000, { wsBacked: true }));
      expect(result.current).toBe(15_000);
    });

    it('uses standard 5s polling when WS connected and wsBacked is undefined or false', () => {
      useConnectionStore.setState({ ...initialConnectionState, wsConnected: true });
      const { result: undef } = renderHook(() => usePollingInterval(15_000));
      const { result: falsy } = renderHook(() => usePollingInterval(15_000, { wsBacked: false }));
      expect(undef.current).toBe(5_000);
      expect(falsy.current).toBe(5_000);
    });
  });
});
