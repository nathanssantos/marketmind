import { IS_E2E_BYPASS_AUTH } from '@shared/constants';
import { useIndicatorStore } from '../store/indicatorStore';
import { usePreferencesStore } from '../store/preferencesStore';

declare global {
  interface Window {
    __indicatorStore?: typeof useIndicatorStore;
    __preferencesStore?: typeof usePreferencesStore;
  }
}

export const installE2EBridge = (): void => {
  if (!IS_E2E_BYPASS_AUTH) return;
  if (typeof window === 'undefined') return;
  window.__indicatorStore = useIndicatorStore;
  window.__preferencesStore = usePreferencesStore;
};
