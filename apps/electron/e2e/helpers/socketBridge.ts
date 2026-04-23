import type { Page } from '@playwright/test';

interface SocketTestBridgeDeclaration {
  emit: (event: string, payload: unknown) => void;
  getListenerCount: (event: string) => number;
  listEvents: () => string[];
}

interface ConnectionStoreState {
  wsConnected: boolean;
  setWsConnected: (connected: boolean) => void;
}

interface ConnectionStoreBridge {
  getState: () => ConnectionStoreState;
  setState?: (partial: Partial<ConnectionStoreState>) => void;
}

declare global {
  interface Window {
    __socketTestBridge?: SocketTestBridgeDeclaration;
    __connectionStore?: ConnectionStoreBridge;
  }
}

/**
 * Wait until the socket.io client has been instantiated (post-mount) and
 * optionally until a specific event handler has been registered.
 */
export const waitForSocket = async (
  page: Page,
  options: { event?: string; minListeners?: number; timeoutMs?: number } = {},
): Promise<void> => {
  const { event, minListeners = 1, timeoutMs = 10_000 } = options;
  await page.waitForFunction(
    ({ event: e, min }) => {
      if (!window.__socketTestBridge) return false;
      if (!e) return true;
      return window.__socketTestBridge.getListenerCount(e) >= min;
    },
    { event, min: minListeners },
    { timeout: timeoutMs },
  );
};

/**
 * Force the `wsConnected` flag on the connection store. Useful in E2E where
 * there is no real backend to produce a `connect` event.
 */
export const setWsConnected = async (page: Page, connected: boolean): Promise<void> => {
  await page.waitForFunction(() => typeof window.__connectionStore !== 'undefined', { timeout: 10_000 });
  await page.evaluate((flag) => {
    const store = window.__connectionStore;
    if (!store) throw new Error('__connectionStore not exposed (VITE_E2E_BYPASS_AUTH not set?)');
    store.getState().setWsConnected(flag);
  }, connected);
};

/**
 * Trigger a socket.io client-side event by directly invoking its registered
 * listeners. This bypasses the actual websocket transport so E2E tests can
 * simulate any backend-emitted event without needing a live backend.
 *
 * Example:
 *   await emitSocketEvent(page, 'stream:health', { symbol: 'BTCUSDT', ... });
 *   await emitSocketEvent(page, 'order:update', { orderId: '123', ... });
 */
export const emitSocketEvent = async (
  page: Page,
  event: string,
  payload: unknown,
): Promise<void> => {
  await page.evaluate(
    ({ e, p }) => {
      if (!window.__socketTestBridge) {
        throw new Error('__socketTestBridge not exposed (VITE_E2E_BYPASS_AUTH not set, or socket not yet connected)');
      }
      window.__socketTestBridge.emit(e, p);
    },
    { e: event, p: payload },
  );
};

/**
 * Read all event names that have at least one listener attached to the socket.
 * Handy when diagnosing a test where the bridge isn't triggering anything.
 */
export const listSocketEvents = async (page: Page): Promise<string[]> => {
  return page.evaluate(() => {
    if (!window.__socketTestBridge) return [];
    return window.__socketTestBridge.listEvents();
  });
};
