import { Box, Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { TimeframeSelector } from '@renderer/components/Chart/TimeframeSelector';
import { CollapsibleSection, Slider, Switch } from '@renderer/components/ui';
import type { TimeInterval } from '@marketmind/types';
import { useTranslation } from 'react-i18next';

export interface TrailingStopSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  trailingStopEnabled: boolean;
  onTrailingStopEnabledChange: (enabled: boolean) => void;
  indicatorInterval?: TimeInterval;
  onIndicatorIntervalChange?: (interval: TimeInterval) => void;
  trailingActivationPercentLong: number;
  onTrailingActivationPercentLongChange: (value: number) => void;
  trailingActivationPercentShort: number;
  onTrailingActivationPercentShortChange: (value: number) => void;
  trailingDistancePercentLong: number;
  onTrailingDistancePercentLongChange: (value: number) => void;
  trailingDistancePercentShort: number;
  onTrailingDistancePercentShortChange: (value: number) => void;
  trailingDistanceMode?: 'auto' | 'fixed';
  onTrailingDistanceModeChange?: (mode: 'auto' | 'fixed') => void;
  trailingStopOffsetPercent?: number;
  onTrailingStopOffsetPercentChange?: (value: number) => void;
  useAdaptiveTrailing: boolean;
  onUseAdaptiveTrailingChange: (enabled: boolean) => void;
  isPending: boolean;
  compact?: boolean;
  activationModeLong?: 'auto' | 'manual';
  onActivationModeLongChange?: (mode: 'auto' | 'manual') => void;
  activationModeShort?: 'auto' | 'manual';
  onActivationModeShortChange?: (mode: 'auto' | 'manual') => void;
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
  trailingDistanceMode = 'fixed',
  onTrailingDistanceModeChange,
  trailingStopOffsetPercent = 0,
  onTrailingStopOffsetPercentChange,
  useAdaptiveTrailing,
  onUseAdaptiveTrailingChange,
  isPending,
  compact = false,
  indicatorInterval = '30m',
  onIndicatorIntervalChange,
  activationModeLong = 'auto',
  onActivationModeLongChange,
  activationModeShort = 'auto',
  onActivationModeShortChange,
}: TrailingStopSectionProps) => {
  const { t } = useTranslation();

  const labelSize = compact ? 'xs' as const : 'sm' as const;
  const descSize = 'xs' as const;
  const sectionPadding = compact ? 2 : 3;
  const gapSize = compact ? 2 : 4;

  const content = (
    <VStack gap={gapSize} align="stretch">
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
          {onIndicatorIntervalChange && (
            <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontSize={labelSize} fontWeight="medium">
                    {t('watcherManager.trailingStop.indicatorInterval')}
                  </Text>
                  {!compact && (
                    <Text fontSize={descSize} color="fg.muted">
                      {t('watcherManager.trailingStop.indicatorIntervalDescription')}
                    </Text>
                  )}
                </Box>
                <TimeframeSelector
                  selectedTimeframe={indicatorInterval}
                  onTimeframeChange={onIndicatorIntervalChange}
                />
              </Flex>
            </Box>
          )}

          {onActivationModeLongChange && (
            <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
              <Flex justify="space-between" align="center">
                <Text fontSize={labelSize} fontWeight="medium">
                  {t('watcherManager.trailingStop.activationModeLong')}
                </Text>
                <HStack gap={1}>
                  <Box
                    as="button"
                    px={2}
                    py={0.5}
                    fontSize="xs"
                    fontWeight="semibold"
                    borderRadius="full"
                    cursor="pointer"
                    bg={activationModeLong === 'auto' ? 'green.500' : 'bg.emphasized'}
                    color={activationModeLong === 'auto' ? 'white' : 'fg.muted'}
                    onClick={() => onActivationModeLongChange('auto')}
                  >
                    {t('watcherManager.trailingStop.modeAuto')}
                  </Box>
                  <Box
                    as="button"
                    px={2}
                    py={0.5}
                    fontSize="xs"
                    fontWeight="semibold"
                    borderRadius="full"
                    cursor="pointer"
                    bg={activationModeLong === 'manual' ? 'green.500' : 'bg.emphasized'}
                    color={activationModeLong === 'manual' ? 'white' : 'fg.muted'}
                    onClick={() => onActivationModeLongChange('manual')}
                  >
                    {t('watcherManager.trailingStop.modeManual')}
                  </Box>
                </HStack>
              </Flex>
            </Box>
          )}

          {onActivationModeShortChange && (
            <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
              <Flex justify="space-between" align="center">
                <Text fontSize={labelSize} fontWeight="medium">
                  {t('watcherManager.trailingStop.activationModeShort')}
                </Text>
                <HStack gap={1}>
                  <Box
                    as="button"
                    px={2}
                    py={0.5}
                    fontSize="xs"
                    fontWeight="semibold"
                    borderRadius="full"
                    cursor="pointer"
                    bg={activationModeShort === 'auto' ? 'red.500' : 'bg.emphasized'}
                    color={activationModeShort === 'auto' ? 'white' : 'fg.muted'}
                    onClick={() => onActivationModeShortChange('auto')}
                  >
                    {t('watcherManager.trailingStop.modeAuto')}
                  </Box>
                  <Box
                    as="button"
                    px={2}
                    py={0.5}
                    fontSize="xs"
                    fontWeight="semibold"
                    borderRadius="full"
                    cursor="pointer"
                    bg={activationModeShort === 'manual' ? 'red.500' : 'bg.emphasized'}
                    color={activationModeShort === 'manual' ? 'white' : 'fg.muted'}
                    onClick={() => onActivationModeShortChange('manual')}
                  >
                    {t('watcherManager.trailingStop.modeManual')}
                  </Box>
                </HStack>
              </Flex>
            </Box>
          )}

          {activationModeLong !== 'manual' && (
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
          )}

          {activationModeShort !== 'manual' && (
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
          )}

          {onTrailingDistanceModeChange && (
            <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontSize={labelSize} fontWeight="medium">
                    {t('watcherManager.trailingStop.stopOffsetMode')}
                  </Text>
                  {!compact && (
                    <Text fontSize={descSize} color="fg.muted">
                      {trailingDistanceMode === 'auto'
                        ? t('watcherManager.trailingStop.stopOffsetModeAutoDescription')
                        : t('watcherManager.trailingStop.stopOffsetModeFixedDescription')}
                    </Text>
                  )}
                </Box>
                <HStack gap={1}>
                  <Box
                    as="button"
                    px={2}
                    py={0.5}
                    fontSize="xs"
                    fontWeight="semibold"
                    borderRadius="full"
                    cursor="pointer"
                    bg={trailingDistanceMode === 'auto' ? 'blue.500' : 'bg.emphasized'}
                    color={trailingDistanceMode === 'auto' ? 'white' : 'fg.muted'}
                    onClick={() => onTrailingDistanceModeChange('auto')}
                  >
                    {t('watcherManager.trailingStop.stopOffsetModeAuto')}
                  </Box>
                  <Box
                    as="button"
                    px={2}
                    py={0.5}
                    fontSize="xs"
                    fontWeight="semibold"
                    borderRadius="full"
                    cursor="pointer"
                    bg={trailingDistanceMode === 'fixed' ? 'blue.500' : 'bg.emphasized'}
                    color={trailingDistanceMode === 'fixed' ? 'white' : 'fg.muted'}
                    onClick={() => onTrailingDistanceModeChange('fixed')}
                  >
                    {t('watcherManager.trailingStop.stopOffsetModeFixed')}
                  </Box>
                </HStack>
              </Flex>
            </Box>
          )}

          {trailingDistanceMode === 'fixed' && onTrailingStopOffsetPercentChange && (
            <Box p={sectionPadding} bg="bg.subtle" borderRadius="md">
              <Flex justify="space-between" align="center" mb={compact ? 1 : 2}>
                <Box>
                  <Text fontSize={labelSize} fontWeight="medium">
                    {t('watcherManager.trailingStop.stopOffsetPercent')}
                  </Text>
                  {!compact && (
                    <Text fontSize={descSize} color="fg.muted">
                      {t('watcherManager.trailingStop.stopOffsetPercentDescription')}
                    </Text>
                  )}
                </Box>
                <Text fontSize={labelSize} fontWeight="bold" color="blue.500">
                  {(trailingStopOffsetPercent * 100).toFixed(1)}%
                </Text>
              </Flex>
              <Slider
                value={[trailingStopOffsetPercent * 100]}
                onValueChange={(values) => onTrailingStopOffsetPercentChange(values[0]! / 100)}
                min={0}
                max={10}
                step={0.1}
              />
            </Box>
          )}

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
                {(trailingDistancePercentLong * 100).toFixed(1)}%
              </Text>
            </Flex>
            <Slider
              value={[trailingDistancePercentLong * 100]}
              onValueChange={(values) => onTrailingDistancePercentLongChange(values[0]! / 100)}
              min={10}
              max={80}
              step={0.1}
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
                {(trailingDistancePercentShort * 100).toFixed(1)}%
              </Text>
            </Flex>
            <Slider
              value={[trailingDistancePercentShort * 100]}
              onValueChange={(values) => onTrailingDistancePercentShortChange(values[0]! / 100)}
              min={10}
              max={80}
              step={0.1}
            />
          </Box>

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
    <CollapsibleSection
      title={t('watcherManager.trailingStop.title')}
      description={t('watcherManager.trailingStop.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
    >
      {content}
    </CollapsibleSection>
  );
};
