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
        p={4}
        bg="red.50"
        borderRadius="lg"
        borderWidth="2px"
        borderColor="red.500"
        _dark={{ bg: 'red.900/30' }}
      >
        <Flex align="center" gap={3} mb={3}>
          <Box color="red.500">
            <LuTriangleAlert size={24} />
          </Box>
          <Box>
            <Text fontWeight="bold" color="red.600" _dark={{ color: 'red.300' }}>
              {t('tradingProfiles.emergencyStop.confirmTitle')}
            </Text>
            <Text fontSize="sm" color="fg.muted">
              {t('tradingProfiles.emergencyStop.confirmDescription')}
            </Text>
          </Box>
        </Flex>
        <Flex gap={2} justify="flex-end">
          <Button
            size="sm"
            variant="outline"
            onClick={onHideConfirm}
            disabled={isEmergencyStopping}
          >
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
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
