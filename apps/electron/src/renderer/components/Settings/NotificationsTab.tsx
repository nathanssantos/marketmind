import { Callout, FormRow, FormSection, Switch } from '@renderer/components/ui';
import { useUIPref } from '@renderer/store/preferencesStore';
import { Stack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

export const NotificationsTab = () => {
  const { t } = useTranslation();

  const [orderToastsEnabled, setOrderToastsEnabled] = useUIPref<boolean>('orderToastsEnabled', true);
  const [setupToastsEnabled, setSetupToastsEnabled] = useUIPref<boolean>('setupToastsEnabled', true);
  const [soundEnabled, setSoundEnabled] = useUIPref<boolean>('notificationSoundEnabled', false);

  return (
    <Stack gap={5}>
      <FormSection
        title={t('settings.notifications.toasts.title')}
        description={t('settings.notifications.toasts.description')}
      >
        <FormRow
          label={t('settings.notifications.toasts.orderUpdates')}
          helper={t('settings.notifications.toasts.orderUpdatesHelper')}
        >
          <Switch
            checked={orderToastsEnabled}
            onCheckedChange={setOrderToastsEnabled}
            data-testid="notifications-order-toasts"
          />
        </FormRow>
        <FormRow
          label={t('settings.notifications.toasts.setupDetected')}
          helper={t('settings.notifications.toasts.setupDetectedHelper')}
        >
          <Switch
            checked={setupToastsEnabled}
            onCheckedChange={setSetupToastsEnabled}
            data-testid="notifications-setup-toasts"
          />
        </FormRow>
      </FormSection>

      <FormSection
        title={t('settings.notifications.sound.title')}
        description={t('settings.notifications.sound.description')}
      >
        <FormRow
          label={t('settings.notifications.sound.enable')}
          helper={t('settings.notifications.sound.enableHelper')}
        >
          <Switch
            checked={soundEnabled}
            onCheckedChange={setSoundEnabled}
            data-testid="notifications-sound-enabled"
          />
        </FormRow>
      </FormSection>

      <Callout tone="info" title={t('settings.notifications.comingSoon.title')}>
        {t('settings.notifications.comingSoon.description')}
      </Callout>
    </Stack>
  );
};
