import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { Box, Collapsible, Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';

export interface TrailingStopSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  trailingStopEnabled: boolean;
  onTrailingStopEnabledChange: (enabled: boolean) => void;
  trailingActivationPercentLong: number;
  onTrailingActivationPercentLongChange: (value: number) => void;
  trailingActivationPercentShort: number;
  onTrailingActivationPercentShortChange: (value: number) => void;
  trailingDistancePercentLong: number;
  onTrailingDistancePercentLongChange: (value: number) => void;
  trailingDistancePercentShort: number;
  onTrailingDistancePercentShortChange: (value: number) => void;
  useAdaptiveTrailing: boolean;
  onUseAdaptiveTrailingChange: (enabled: boolean) => void;
  useProfitLockDistance: boolean;
  onUseProfitLockDistanceChange: (enabled: boolean) => void;
  isPending: boolean;
  compact?: boolean;
}

export const TrailingStopSection = ({
  isExpanded,
  onToggle,
  trailingStopEnabled,
  onTrailingStopEnabledChange,
  trailingActivationPercentLong,
  onTrailingActivationPercentLongChange,
  trailingActivationPercentShort,
  onTrailingActivationPercentShortChange,
  trailingDistancePercentLong,
  onTrailingDistancePercentLongChange,
  trailingDistancePercentShort,
  onTrailingDistancePercentShortChange,
  useAdaptiveTrailing,
  onUseAdaptiveTrailingChange,
  useProfitLockDistance,
  onUseProfitLockDistanceChange,
  isPending,
  compact = false,
}: TrailingStopSectionProps) => {
  const { t } = useTranslation();

  const labelSize = compact ? 'xs' as const : 'sm' as const;
  const descSize = 'xs' as const;
  const sectionPadding = compact ? 2 : 3;
  const gapSize = compact ? 2 : 4;

  const content = (
    <VStack gap={gapSize} mt={compact ? 0 : 4} align="stretch">
      <HStack justify="space-between" p={sectionPadding} bg="bg.subtle" borderRadius="md">
        <Box>
          <Text fontSize={labelSize} fontWeight="medium">
            {t('watcherManager.trailingStop.enabled')}
          </Text>
          {!compact && (
            <Text fontSize={descSize} color="fg.muted">
              {t('watcherManager.trailingStop.enabledDescription')}
            </Text>
          )}
        </Box>
        <Switch
          checked={trailingStopEnabled}
          onCheckedChange={onTrailingStopEnabledChange}
          disabled={isPending}
          size={compact ? 'sm' : undefined}
        />
      </HStack>

      {trailingStopEnabled && (
        <>
          <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
            <Flex justify="space-between" align="center" mb={compact ? 1 : 2}>
              <Box>
                <Text fontSize={labelSize} fontWeight="medium">
                  {t('watcherManager.trailingStop.activationLong')}
                </Text>
                {!compact && (
                  <Text fontSize={descSize} color="fg.muted">
                    {t('watcherManager.trailingStop.activationLongDescription')}
                  </Text>
                )}
              </Box>
              <Text fontSize={labelSize} fontWeight="bold" color="green.500">
                {(trailingActivationPercentLong * 100).toFixed(1)}%
              </Text>
            </Flex>
            <Slider
              value={[trailingActivationPercentLong * 100]}
              onValueChange={(values) => onTrailingActivationPercentLongChange(values[0]! / 100)}
              min={50}
              max={200}
              step={0.1}
            />
          </Box>

          <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
            <Flex justify="space-between" align="center" mb={compact ? 1 : 2}>
              <Box>
                <Text fontSize={labelSize} fontWeight="medium">
                  {t('watcherManager.trailingStop.activationShort')}
                </Text>
                {!compact && (
                  <Text fontSize={descSize} color="fg.muted">
                    {t('watcherManager.trailingStop.activationShortDescription')}
                  </Text>
                )}
              </Box>
              <Text fontSize={labelSize} fontWeight="bold" color="red.500">
                {(trailingActivationPercentShort * 100).toFixed(1)}%
              </Text>
            </Flex>
            <Slider
              value={[trailingActivationPercentShort * 100]}
              onValueChange={(values) => onTrailingActivationPercentShortChange(values[0]! / 100)}
              min={50}
              max={200}
              step={0.1}
            />
          </Box>

          <HStack justify="space-between" p={sectionPadding} bg="bg.subtle" borderRadius="md">
            <Box>
              <Text fontSize={labelSize} fontWeight="medium">
                {t('watcherManager.trailingStop.profitLock')}
              </Text>
              {!compact && (
                <Text fontSize={descSize} color="fg.muted">
                  {t('watcherManager.trailingStop.profitLockDescription')}
                </Text>
              )}
            </Box>
            <Switch
              checked={useProfitLockDistance}
              onCheckedChange={onUseProfitLockDistanceChange}
              disabled={isPending}
              size={compact ? 'sm' : undefined}
            />
          </HStack>

          {useProfitLockDistance && (
            <>
              <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
                <Flex justify="space-between" align="center" mb={compact ? 1 : 2}>
                  <Box>
                    <Text fontSize={labelSize} fontWeight="medium">
                      {t('watcherManager.trailingStop.trailingDistanceLong')}
                    </Text>
                    {!compact && (
                      <Text fontSize={descSize} color="fg.muted">
                        {t('watcherManager.trailingStop.trailingDistanceLongDescription')}
                      </Text>
                    )}
                  </Box>
                  <Text fontSize={labelSize} fontWeight="bold" color="green.500">
                    {(trailingDistancePercentLong * 100).toFixed(0)}%
                  </Text>
                </Flex>
                <Slider
                  value={[trailingDistancePercentLong * 100]}
                  onValueChange={(values) => onTrailingDistancePercentLongChange(values[0]! / 100)}
                  min={10}
                  max={80}
                  step={5}
                />
              </Box>

              <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
                <Flex justify="space-between" align="center" mb={compact ? 1 : 2}>
                  <Box>
                    <Text fontSize={labelSize} fontWeight="medium">
                      {t('watcherManager.trailingStop.trailingDistanceShort')}
                    </Text>
                    {!compact && (
                      <Text fontSize={descSize} color="fg.muted">
                        {t('watcherManager.trailingStop.trailingDistanceShortDescription')}
                      </Text>
                    )}
                  </Box>
                  <Text fontSize={labelSize} fontWeight="bold" color="red.500">
                    {(trailingDistancePercentShort * 100).toFixed(0)}%
                  </Text>
                </Flex>
                <Slider
                  value={[trailingDistancePercentShort * 100]}
                  onValueChange={(values) => onTrailingDistancePercentShortChange(values[0]! / 100)}
                  min={10}
                  max={80}
                  step={5}
                />
              </Box>
            </>
          )}

          <HStack justify="space-between" p={sectionPadding} bg="bg.subtle" borderRadius="md">
            <Box>
              <Text fontSize={labelSize} fontWeight="medium">
                {t('watcherManager.trailingStop.adaptiveMode')}
              </Text>
              {!compact && (
                <Text fontSize={descSize} color="fg.muted">
                  {t('watcherManager.trailingStop.adaptiveModeDescription')}
                </Text>
              )}
            </Box>
            <Switch
              checked={useAdaptiveTrailing}
              onCheckedChange={onUseAdaptiveTrailingChange}
              disabled={isPending}
              size={compact ? 'sm' : undefined}
            />
          </HStack>
        </>
      )}
    </VStack>
  );

  if (compact) return <Box>{content}</Box>;

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
            {t('watcherManager.trailingStop.title')}
          </Text>
          <Text fontSize="sm" color="fg.muted">
            {t('watcherManager.trailingStop.description')}
          </Text>
        </Box>
        {isExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={isExpanded}>
        <Collapsible.Content>
          {content}
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
