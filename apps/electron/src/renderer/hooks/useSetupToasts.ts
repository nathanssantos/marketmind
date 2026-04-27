import { useTranslation } from 'react-i18next';
import { useUIPref } from '../store/preferencesStore';
import { useBackendAuth } from './useBackendAuth';
import { useSocketEvent, useUserChannelSubscription } from './socket';
import { useToast } from './useToast';

interface SetupDetectedPayload {
  symbol?: string;
  setupType?: string;
  direction?: 'LONG' | 'SHORT';
  confidence?: number;
}

/**
 * Listens to backend `setup-detected` socket events and surfaces them as
 * info toasts when the user has setup notifications enabled. Mounted once
 * at app root via App.tsx alongside useOrderNotifications.
 */
export const useSetupToasts = () => {
  const { t } = useTranslation();
  const { info } = useToast();
  const { currentUser } = useBackendAuth();
  const userId = currentUser?.id;
  const [setupToastsEnabled] = useUIPref<boolean>('setupToastsEnabled', true);

  useUserChannelSubscription(userId);
  useSocketEvent(
    'setup-detected',
    (payload: unknown) => {
      if (!setupToastsEnabled) return;
      const setup = (payload ?? {}) as SetupDetectedPayload;
      if (!setup.symbol || !setup.setupType) return;
      const directionLabel = setup.direction
        ? ` ${setup.direction === 'LONG' ? '↑' : '↓'}`
        : '';
      info(
        t('trading.notifications.setupDetected.title', { defaultValue: 'New setup detected' }),
        t('trading.notifications.setupDetected.body', {
          defaultValue: '{{symbol}} {{setupType}}{{direction}}',
          symbol: setup.symbol,
          setupType: setup.setupType,
          direction: directionLabel,
        }),
        { symbol: setup.symbol },
      );
    },
    !!userId,
  );

  return null;
};
