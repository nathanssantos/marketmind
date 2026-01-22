import { Radio, RadioGroup } from '@/renderer/components/ui/radio';
import { Box, Collapsible, Flex, Grid, Stack, Text } from '@chakra-ui/react';
import { NumberInput } from '@renderer/components/ui/number-input';
import { Switch } from '@renderer/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
import { FilterToggle } from './FilterToggle';
import type { WatcherConfig } from './types';

export interface OpportunityCostSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  config: WatcherConfig | undefined;
  walletId: string;
  onConfigUpdate: (updates: Partial<WatcherConfig>) => void;
  onFilterToggle: (filterKey: string, value: boolean) => void;
  isPending: boolean;
}

export const OpportunityCostSection = ({
  isExpanded,
  onToggle,
  config,
  walletId,
  onConfigUpdate,
  onFilterToggle,
  isPending,
}: OpportunityCostSectionProps) => {
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
          <Flex align="center" gap={2}>
            <Text fontSize="lg" fontWeight="bold">
              {t('settings.algorithmicAutoTrading.opportunityCost.title')}
            </Text>
            {config?.opportunityCostEnabled && (
              <Box
                px={2}
                py={0.5}
                bg="purple.100"
                color="purple.800"
                borderRadius="full"
                fontSize="xs"
                fontWeight="medium"
                _dark={{ bg: 'purple.900', color: 'purple.200' }}
              >
                {t('common.active')}
              </Box>
            )}
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {t('settings.algorithmicAutoTrading.opportunityCost.description')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          <Stack gap={4} mt={4}>
            <Flex justify="space-between" align="center" p={3} bg="bg.muted" borderRadius="md">
              <Box>
                <Text fontSize="sm" fontWeight="medium">
                  {t('settings.algorithmicAutoTrading.opportunityCost.enable')}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {t('settings.algorithmicAutoTrading.opportunityCost.enableDescription')}
                </Text>
              </Box>
              <Switch
                checked={config?.opportunityCostEnabled ?? false}
                onCheckedChange={(value) => {
                  if (!walletId) return;
                  onConfigUpdate({ opportunityCostEnabled: value });
                }}
                disabled={isPending}
              />
            </Flex>

            {config?.opportunityCostEnabled && (
              <>
                <Box p={3} bg="bg.muted" borderRadius="md">
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t('settings.algorithmicAutoTrading.opportunityCost.maxHoldingPeriod')}
                  </Text>
                  <Flex gap={2} align="center">
                    <NumberInput
                      min={5}
                      max={100}
                      value={String(config?.maxHoldingPeriodBars ?? 20)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (!walletId) return;
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value) && value >= 5 && value <= 100) {
                          onConfigUpdate({ maxHoldingPeriodBars: value });
                        }
                      }}
                      size="sm"
                      w="100px"
                    />
                    <Text fontSize="sm" color="fg.muted">
                      {t('settings.algorithmicAutoTrading.opportunityCost.bars')}
                    </Text>
                  </Flex>
                </Box>

                <Box p={3} bg="bg.muted" borderRadius="md">
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t('settings.algorithmicAutoTrading.opportunityCost.staleThreshold')}
                  </Text>
                  <Flex gap={2} align="center">
                    <NumberInput
                      min={0.1}
                      max={5}
                      step={0.1}
                      value={config?.stalePriceThresholdPercent ?? '0.5'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        if (!walletId) return;
                        const value = parseFloat(e.target.value);
                        if (!isNaN(value) && value >= 0.1 && value <= 5) {
                          onConfigUpdate({ stalePriceThresholdPercent: value.toString() });
                        }
                      }}
                      size="sm"
                      w="100px"
                    />
                    <Text fontSize="sm" color="fg.muted">%</Text>
                  </Flex>
                </Box>

                <Box p={3} bg="bg.muted" borderRadius="md">
                  <Text fontSize="sm" fontWeight="medium" mb={2}>
                    {t('settings.algorithmicAutoTrading.opportunityCost.actionWhenStale')}
                  </Text>
                  <RadioGroup
                    value={config?.staleTradeAction ?? 'TIGHTEN_STOP'}
                    onValueChange={(e) => {
                      if (!walletId) return;
                      onConfigUpdate({
                        staleTradeAction: e.value as 'ALERT_ONLY' | 'TIGHTEN_STOP' | 'AUTO_CLOSE',
                      });
                    }}
                  >
                    <Stack gap={2}>
                      <Radio value="ALERT_ONLY">
                        {t('settings.algorithmicAutoTrading.opportunityCost.alertOnly')}
                      </Radio>
                      <Radio value="TIGHTEN_STOP">
                        {t('settings.algorithmicAutoTrading.opportunityCost.tightenStop')}
                      </Radio>
                      <Radio value="AUTO_CLOSE">
                        {t('settings.algorithmicAutoTrading.opportunityCost.autoClose')}
                      </Radio>
                    </Stack>
                  </RadioGroup>
                </Box>

                <FilterToggle
                  label={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.title')}
                  description={t('settings.algorithmicAutoTrading.opportunityCost.timeBasedTightening.description')}
                  checked={config?.timeBasedStopTighteningEnabled ?? true}
                  onChange={(value) => onFilterToggle('timeBasedStopTighteningEnabled', value)}
                  disabled={isPending}
                />

                {config?.timeBasedStopTighteningEnabled && (
                  <Box p={3} bg="bg.muted" borderRadius="md" ml={4}>
                    <Grid templateColumns="1fr 1fr" gap={4}>
                      <Box>
                        <Text fontSize="sm" mb={1}>
                          {t('settings.algorithmicAutoTrading.opportunityCost.tightenAfterBars')}
                        </Text>
                        <NumberInput
                          min={1}
                          max={50}
                          value={String(config?.timeTightenAfterBars ?? 10)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            if (!walletId) return;
                            const value = parseInt(e.target.value, 10);
                            if (!isNaN(value) && value >= 1 && value <= 50) {
                              onConfigUpdate({ timeTightenAfterBars: value });
                            }
                          }}
                          size="sm"
                        />
                      </Box>
                      <Box>
                        <Text fontSize="sm" mb={1}>
                          {t('settings.algorithmicAutoTrading.opportunityCost.tightenPercentPerBar')}
                        </Text>
                        <Flex gap={2} align="center">
                          <NumberInput
                            min={1}
                            max={20}
                            value={config?.timeTightenPercentPerBar ?? '5'}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                              if (!walletId) return;
                              const value = parseFloat(e.target.value);
                              if (!isNaN(value) && value >= 1 && value <= 20) {
                                onConfigUpdate({ timeTightenPercentPerBar: value.toString() });
                              }
                            }}
                            size="sm"
                          />
                          <Text fontSize="sm">%</Text>
                        </Flex>
                      </Box>
                    </Grid>
                  </Box>
                )}
              </>
            )}
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
