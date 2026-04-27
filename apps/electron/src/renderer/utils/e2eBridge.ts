import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import type { Socket } from 'socket.io-client';
import { useBacktestModalStore } from '../store/backtestModalStore';
import { useConnectionStore } from '../store/connectionStore';
import { useDrawingStore } from '../store/drawingStore';
import { useIndicatorStore } from '../store/indicatorStore';
import { useLayoutStore } from '../store/layoutStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { usePriceStore } from '../store/priceStore';
import { useScreenerStore } from '../store/screenerStore';
import { useUIStore } from '../store/uiStore';
import type { CanvasManager } from './canvas/CanvasManager';

interface SocketTestBridge {
  emit: (event: string, payload: unknown) => void;
  getListenerCount: (event: string) => number;
  listEvents: () => string[];
}

interface GlobalActionsBridge {
  openSettings: (tab?: string) => void;
  openSymbolSelector: () => void;
  navigateToSymbol: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
  closeAll: () => void;
  setTimeframe: (tf: string) => void;
  setChartType: (type: string) => void;
  setMarketType: (marketType: 'SPOT' | 'FUTURES') => void;
}

declare global {
  interface Window {
    __drawingStore?: typeof useDrawingStore;
    __indicatorStore?: typeof useIndicatorStore;
    __layoutStore?: typeof useLayoutStore;
    __preferencesStore?: typeof usePreferencesStore;
    __priceStore?: typeof usePriceStore;
    __connectionStore?: typeof useConnectionStore;
    __uiStore?: typeof useUIStore;
    __backtestModalStore?: typeof useBacktestModalStore;
    __screenerStore?: typeof useScreenerStore;
    __canvasManager?: CanvasManager | null;
    __isPanning?: boolean;
    __socket?: Socket | null;
    __socketTestBridge?: SocketTestBridge;
    __globalActions?: GlobalActionsBridge;
    __setColorMode?: (mode: 'light' | 'dark') => void;
  }
}

export const installE2EBridge = (): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__drawingStore = useDrawingStore;
  window.__indicatorStore = useIndicatorStore;
  window.__layoutStore = useLayoutStore;
  window.__preferencesStore = usePreferencesStore;
  window.__priceStore = usePriceStore;
  window.__connectionStore = useConnectionStore;
  window.__uiStore = useUIStore;
  window.__backtestModalStore = useBacktestModalStore;
  window.__screenerStore = useScreenerStore;
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

export const exposeGlobalActionsForE2E = (actions: GlobalActionsBridge): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__globalActions = actions;
};

export const exposeColorModeForE2E = (setter: (mode: 'light' | 'dark') => void): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__setColorMode = setter;
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
