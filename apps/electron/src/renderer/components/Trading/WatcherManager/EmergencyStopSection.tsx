import { Box, Flex, Text } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui';
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
      <Box
        p={3}
        bg="red.subtle"
        borderRadius="md"
        borderWidth="1px"
        borderColor="red.muted"
      >
        <Flex align="center" gap={2} mb={2}>
          <Box color="red.fg">
            <LuTriangleAlert size={18} />
          </Box>
          <Box>
            <Text fontSize="sm" fontWeight="semibold" color="red.fg">
              {t('tradingProfiles.emergencyStop.confirmTitle')}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              {t('tradingProfiles.emergencyStop.confirmDescription')}
            </Text>
          </Box>
        </Flex>
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
      </Box>
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
