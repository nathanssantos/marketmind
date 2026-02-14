import { Box, Flex, Group, Stack, Text } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { CollapsibleSection } from '@renderer/components/ui/CollapsibleSection';
import { useTranslation } from 'react-i18next';

export interface LeverageSettingsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  leverage: number;
  marginType: 'ISOLATED' | 'CROSSED';
  onLeverageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMarginTypeChange: (value: 'ISOLATED' | 'CROSSED') => void;
  positionMode: 'ONE_WAY' | 'HEDGE';
  onPositionModeChange: (mode: 'ONE_WAY' | 'HEDGE') => void;
  isPending: boolean;
}

export const LeverageSettingsSection = ({
  isExpanded,
  onToggle,
  leverage,
  marginType,
  onLeverageChange,
  onMarginTypeChange,
  positionMode,
  onPositionModeChange,
  isPending,
}: LeverageSettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <CollapsibleSection
      title={t('settings.algorithmicAutoTrading.leverage.title', 'Futures Settings')}
      description={t('settings.algorithmicAutoTrading.leverage.description', 'Configure leverage and margin type for futures trading')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
    >
          <Stack gap={4}>
            <Flex gap={4} align="flex-end" wrap="wrap">
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
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={1}>
                  {t('settings.algorithmicAutoTrading.marginType.label', 'Margin Type')}
                </Text>
                <Group attached>
                  <Button
                    size="sm"
                    variant={marginType === 'ISOLATED' ? 'solid' : 'outline'}
                    onClick={() => onMarginTypeChange('ISOLATED')}
                    disabled={isPending}
                  >
                    Isolated
                  </Button>
                  <Button
                    size="sm"
                    variant={marginType === 'CROSSED' ? 'solid' : 'outline'}
                    onClick={() => onMarginTypeChange('CROSSED')}
                    disabled={isPending}
                  >
                    Cross
                  </Button>
                </Group>
              </Box>
              <Box>
                <Text fontSize="sm" fontWeight="medium" mb={1}>
                  {t('settings.algorithmicAutoTrading.leverage.positionMode', 'Position Mode')}
                </Text>
                <Group attached>
                  <Button
                    size="sm"
                    variant={positionMode === 'ONE_WAY' ? 'solid' : 'outline'}
                    onClick={() => onPositionModeChange('ONE_WAY')}
                    disabled={isPending}
                  >
                    {t('settings.algorithmicAutoTrading.leverage.oneWay', 'One-Way')}
                  </Button>
                  <Button
                    size="sm"
                    variant={positionMode === 'HEDGE' ? 'solid' : 'outline'}
                    onClick={() => onPositionModeChange('HEDGE')}
                    disabled={isPending}
                  >
                    {t('settings.algorithmicAutoTrading.leverage.hedge', 'Hedge')}
                  </Button>
                </Group>
              </Box>
            </Flex>
            <Box p={3} bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900/20' }}>
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.leverage.warning', 'Higher leverage increases both potential gains and losses. Use with caution.')}
              </Text>
            </Box>
          </Stack>
    </CollapsibleSection>
  );
};
