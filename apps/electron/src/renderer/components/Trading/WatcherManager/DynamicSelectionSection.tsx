import { Box, Collapsible, Flex, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { Switch } from '@renderer/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { LuChartBar, LuChevronDown, LuChevronUp, LuRefreshCw, LuZap } from 'react-icons/lu';
import { QuickStartSection, type BtcTrendInfo, type BtcTrendStatus } from './QuickStartSection';

export interface RotationStatus {
  isActive: boolean;
  nextRotation: string | null;
}

export interface DynamicSelectionSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  isDynamicSelectionEnabled: boolean;
  onDynamicSelectionToggle: (value: boolean) => void;
  isAutoRotationEnabled: boolean;
  onAutoRotationToggle: (value: boolean) => void;
  rotationStatus?: RotationStatus;
  isLoadingRotationStatus: boolean;
  onTriggerRotation: () => void;
  isTriggeringRotation: boolean;
  quickStartMarketType: MarketType;
  quickStartTimeframe: TimeInterval;
  quickStartCount: number;
  effectiveMax: number;
  isLoadingMax: boolean;
  filteredSymbolsCount: number;
  isLoadingFiltered: boolean;
  isStartingWatchersBulk: boolean;
  btcTrendStatus?: BtcTrendStatus;
  btcTrendInfo?: BtcTrendInfo | null;
  skippedTrendCount?: number;
  showBtcTrend: boolean;
  formatCapitalTooltip: () => string;
  onMarketTypeChange: (type: MarketType) => void;
  onTimeframeChange: (timeframe: TimeInterval) => void;
  onCountChange: (count: number) => void;
  onQuickStart: () => void;
  onViewRankings: () => void;
  isPending: boolean;
}

export const DynamicSelectionSection = ({
  isExpanded,
  onToggle,
  isDynamicSelectionEnabled,
  onDynamicSelectionToggle,
  isAutoRotationEnabled,
  onAutoRotationToggle,
  rotationStatus,
  isLoadingRotationStatus,
  onTriggerRotation,
  isTriggeringRotation,
  quickStartMarketType,
  quickStartTimeframe,
  quickStartCount,
  effectiveMax,
  isLoadingMax,
  filteredSymbolsCount,
  isLoadingFiltered,
  isStartingWatchersBulk,
  btcTrendStatus,
  btcTrendInfo,
  skippedTrendCount = 0,
  showBtcTrend,
  formatCapitalTooltip,
  onMarketTypeChange,
  onTimeframeChange,
  onCountChange,
  onQuickStart,
  onViewRankings,
  isPending,
}: DynamicSelectionSectionProps) => {
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
              {t('tradingProfiles.dynamicSelection.title')}
            </Text>
            {isDynamicSelectionEnabled && (
              <Box
                px={2}
                py={0.5}
                bg="blue.100"
                color="blue.800"
                borderRadius="full"
                fontSize="xs"
                fontWeight="medium"
                _dark={{ bg: 'blue.900', color: 'blue.200' }}
              >
                <Flex align="center" gap={1}>
                  <LuZap size={10} />
                  {t('common.active')}
                </Flex>
              </Box>
            )}
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {t('tradingProfiles.dynamicSelection.description')}
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
                  {t('tradingProfiles.dynamicSelection.enable')}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                  {t('tradingProfiles.dynamicSelection.enableDescription')}
                </Text>
              </Box>
              <Switch
                checked={isDynamicSelectionEnabled}
                onCheckedChange={onDynamicSelectionToggle}
                disabled={isPending}
              />
            </Flex>

            {isDynamicSelectionEnabled && (
              <>
                <Box p={4} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
                  <Flex justify="space-between" align="center">
                    <Box>
                      <Text fontSize="sm" fontWeight="medium">
                        {t('tradingProfiles.dynamicSelection.rotationStatus')}
                      </Text>
                      {isLoadingRotationStatus ? (
                        <Text fontSize="xs" color="fg.muted">
                          {t('common.loading')}
                        </Text>
                      ) : rotationStatus?.isActive ? (
                        <Text fontSize="xs" color="green.500">
                          {t('tradingProfiles.dynamicSelection.nextRotation', {
                            time: rotationStatus.nextRotation
                              ? new Date(rotationStatus.nextRotation).toLocaleTimeString()
                              : '-',
                          })}
                        </Text>
                      ) : (
                        <Text fontSize="xs" color="fg.muted">
                          {t('tradingProfiles.dynamicSelection.rotationInactive')}
                        </Text>
                      )}
                    </Box>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onTriggerRotation}
                      loading={isTriggeringRotation}
                      disabled={isPending}
                    >
                      <LuRefreshCw />
                      {t('tradingProfiles.dynamicSelection.triggerNow')}
                    </Button>
                  </Flex>
                  <Flex justify="space-between" align="center" mt={3} pt={3} borderTopWidth="1px" borderColor="border">
                    <Box>
                      <Text fontSize="sm" fontWeight="medium">
                        {t('tradingProfiles.dynamicSelection.autoRotation')}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {t('tradingProfiles.dynamicSelection.autoRotationDescription')}
                      </Text>
                    </Box>
                    <Switch
                      checked={isAutoRotationEnabled}
                      onCheckedChange={onAutoRotationToggle}
                      disabled={isPending}
                    />
                  </Flex>
                </Box>

                <QuickStartSection
                  marketType={quickStartMarketType}
                  timeframe={quickStartTimeframe}
                  count={quickStartCount}
                  effectiveMax={effectiveMax}
                  isLoadingMax={isLoadingMax}
                  filteredSymbolsCount={filteredSymbolsCount}
                  isLoadingFiltered={isLoadingFiltered}
                  isStarting={isStartingWatchersBulk}
                  btcTrendStatus={btcTrendStatus}
                  btcTrendInfo={btcTrendInfo}
                  skippedTrendCount={skippedTrendCount}
                  showBtcTrend={showBtcTrend}
                  formatCapitalTooltip={formatCapitalTooltip}
                  onMarketTypeChange={onMarketTypeChange}
                  onTimeframeChange={onTimeframeChange}
                  onCountChange={onCountChange}
                  onQuickStart={onQuickStart}
                />

                <Flex justify="space-between" align="center">
                  <Box p={3} bg="blue.50" borderRadius="md" _dark={{ bg: 'blue.900/20' }} flex={1}>
                    <Flex gap={2} align="flex-start">
                      <LuZap size={16} style={{ marginTop: 2, flexShrink: 0 }} />
                      <Text fontSize="xs" color="fg.muted">
                        {t('tradingProfiles.dynamicSelection.infoText')}
                      </Text>
                    </Flex>
                  </Box>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onViewRankings}
                    ml={2}
                  >
                    <LuChartBar />
                    {t('tradingProfiles.dynamicSelection.viewRankings')}
                  </Button>
                </Flex>
              </>
            )}
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
};
