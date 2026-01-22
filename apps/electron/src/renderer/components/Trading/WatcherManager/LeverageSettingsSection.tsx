import { Box, Collapsible, Flex, Group, Stack, Text } from '@chakra-ui/react';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

export interface LeverageSettingsSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  leverage: number;
  marginType: 'ISOLATED' | 'CROSSED';
  onLeverageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMarginTypeChange: (value: 'ISOLATED' | 'CROSSED') => void;
  isPending: boolean;
}

export const LeverageSettingsSection = ({
  isExpanded,
  onToggle,
  leverage,
  marginType,
  onLeverageChange,
  onMarginTypeChange,
  isPending,
}: LeverageSettingsSectionProps) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={onToggle}
        _hover={{ bg: 'bg.muted' }}
        p={2}
        mx={-2}
        borderRadius="md"
      >
        <Box>
          <Text fontSize="lg" fontWeight="bold">
            {t('settings.algorithmicAutoTrading.leverage.title', 'Futures Settings')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('settings.algorithmicAutoTrading.leverage.description', 'Configure leverage and margin type for futures trading')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <Stack gap={4} mt={4}>
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
            </Flex>
            <Box p={3} bg="orange.50" borderRadius="md" _dark={{ bg: 'orange.900/20' }}>
              <Text fontSize="xs" color="fg.muted">
                {t('settings.algorithmicAutoTrading.leverage.warning', 'Higher leverage increases both potential gains and losses. Use with caution.')}
              </Text>
            </Box>
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
