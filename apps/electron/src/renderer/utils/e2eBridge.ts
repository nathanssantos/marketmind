import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import { useDrawingStore } from '../store/drawingStore';
import { useIndicatorStore } from '../store/indicatorStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { usePriceStore } from '../store/priceStore';
import type { CanvasManager } from './canvas/CanvasManager';

declare global {
  interface Window {
    __drawingStore?: typeof useDrawingStore;
    __indicatorStore?: typeof useIndicatorStore;
    __preferencesStore?: typeof usePreferencesStore;
    __priceStore?: typeof usePriceStore;
    __canvasManager?: CanvasManager | null;
    __isPanning?: boolean;
  }
}

export const installE2EBridge = (): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__drawingStore = useDrawingStore;
  window.__indicatorStore = useIndicatorStore;
  window.__preferencesStore = usePreferencesStore;
  window.__priceStore = usePriceStore;
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
