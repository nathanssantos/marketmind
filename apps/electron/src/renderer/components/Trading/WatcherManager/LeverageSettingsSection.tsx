import { Box, Stack, Text } from '@chakra-ui/react';
import { CollapsibleSection, NumberInput } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';

export interface LeverageSettingsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  leverage: number;
  onLeverageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isPending: boolean;
}

export const LeverageSettingsSection = ({
  isExpanded,
  onToggle,
  leverage,
  onLeverageChange,
  isPending,
}: LeverageSettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.leverage.title', 'Auto-Trading Leverage')}
      description={t('settings.algorithmicAutoTrading.leverage.autoTradingDescription', 'Default leverage for auto-trading entries on new symbols')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
      variant="static"
    >
          <Stack gap={4}>
            <Box flex="0 0 120px">
              <Text fontSize="sm" fontWeight="medium" mb={1}>
                {t('settings.algorithmicAutoTrading.leverage.label', 'Leverage')}
              </Text>
              <NumberInput
                min={1}
                max={125}
                value={leverage}
                onChange={onLeverageChange}
                size="sm"
                disabled={isPending}
              />
            </Box>
            <Box p={3} bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900/20' }}>
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.leverage.warning', 'Higher leverage increases both potential gains and losses. Use with caution.')}
              </Text>
            </Box>
          </Stack>
    </CollapsibleSection>
  );
};
