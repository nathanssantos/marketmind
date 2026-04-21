import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import { useDrawingStore } from '../store/drawingStore';
import { useIndicatorStore } from '../store/indicatorStore';
import { usePreferencesStore } from '../store/preferencesStore';
import { usePriceStore } from '../store/priceStore';

declare global {
  interface Window {
    __drawingStore?: typeof useDrawingStore;
    __indicatorStore?: typeof useIndicatorStore;
    __preferencesStore?: typeof usePreferencesStore;
    __priceStore?: typeof usePriceStore;
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
