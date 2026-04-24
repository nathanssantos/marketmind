import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import type { Socket } from 'socket.io-client';
import { useConnectionStore } from '../store/connectionStore';
import { useDrawingStore } from '../store/drawingStore';
import { useIndicatorStore } from '../store/indicatorStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { usePriceStore } from '../store/priceStore';
import type { CanvasManager } from './canvas/CanvasManager';

interface SocketTestBridge {
  emit: (event: string, payload: unknown) => void;
  getListenerCount: (event: string) => number;
  listEvents: () => string[];
}

declare global {
  interface Window {
    __drawingStore?: typeof useDrawingStore;
    __indicatorStore?: typeof useIndicatorStore;
    __preferencesStore?: typeof usePreferencesStore;
    __priceStore?: typeof usePriceStore;
    __connectionStore?: typeof useConnectionStore;
    __canvasManager?: CanvasManager | null;
    __isPanning?: boolean;
    __socket?: Socket | null;
    __socketTestBridge?: SocketTestBridge;
  }
}

export const installE2EBridge = (): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__drawingStore = useDrawingStore;
  window.__indicatorStore = useIndicatorStore;
  window.__preferencesStore = usePreferencesStore;
  window.__priceStore = usePriceStore;
  window.__connectionStore = useConnectionStore;
};

export const exposeCanvasManagerForE2E = (manager: CanvasManager | null): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__canvasManager = manager;
};

export const exposeIsPanningForE2E = (isPanning: boolean): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__isPanning = isPanning;
};

export const exposeSocketForE2E = (socket: Socket | null): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__socket = socket;
  if (socket) {
    window.__socketTestBridge = {
      emit: (event: string, payload: unknown): void => {
        const listeners = socket.listeners(event) as Array<(...args: unknown[]) => void>;
        for (const listener of listeners) {
          try {
            listener(payload);
          } catch {
            /* swallow errors in test bridge — same as socket.io would */
          }
        }
      },
      getListenerCount: (event: string): number => socket.listeners(event).length,
      listEvents: (): string[] => {
        const anySocket = socket as unknown as { _callbacks?: Record<string, unknown> };
        const callbacks = anySocket._callbacks ?? {};
        return Object.keys(callbacks).map((k) => (k.startsWith('$') ? k.slice(1) : k));
      },
    };
  } else {
    window.__socketTestBridge = undefined;
  }
};
