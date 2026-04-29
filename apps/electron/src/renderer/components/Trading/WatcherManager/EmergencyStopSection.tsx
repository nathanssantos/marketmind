import { Flex, Stack } from '@chakra-ui/react';
import { Button, Callout } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { LuTriangleAlert } from 'react-icons/lu';

export interface EmergencyStopSectionProps {
  showConfirm: boolean;
  onShowConfirm: () => void;
  onHideConfirm: () => void;
  onEmergencyStop: () => void;
  isEmergencyStopping: boolean;
  hasActiveWatchers: boolean;
}

export const EmergencyStopSection = ({
  showConfirm,
  onShowConfirm,
  onHideConfirm,
  onEmergencyStop,
  isEmergencyStopping,
  hasActiveWatchers,
}: EmergencyStopSectionProps) => {
  const { t } = useTranslation();

  if (showConfirm) {
    return (
      <Callout
        tone="danger"
        icon={<LuTriangleAlert />}
        title={t('tradingProfiles.emergencyStop.confirmTitle')}
      >
        <Stack gap={2}>
          {t('tradingProfiles.emergencyStop.confirmDescription')}
          <Flex gap={2} justify="flex-end">
            <Button
              size="xs"
              variant="outline"
              onClick={onHideConfirm}
              disabled={isEmergencyStopping}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="xs"
              colorPalette="red"
              onClick={onEmergencyStop}
              loading={isEmergencyStopping}
            >
              <LuTriangleAlert />
              {t('tradingProfiles.emergencyStop.confirm')}
            </Button>
          </Flex>
        </Stack>
      </Callout>
    );
  }

  if (hasActiveWatchers) {
    return (
      <Button
        size="sm"
        variant="outline"
        colorPalette="red"
        onClick={onShowConfirm}
        w="full"
      >
        <LuTriangleAlert />
        {t('tradingProfiles.emergencyStop.button')}
      </Button>
    );
  }

  return null;
};
