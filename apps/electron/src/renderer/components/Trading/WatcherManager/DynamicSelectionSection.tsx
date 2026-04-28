import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { Button, Callout, CollapsibleSection, Switch } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { LuChartBar, LuRefreshCw, LuZap } from 'react-icons/lu';
import type { DirectionMode } from './WatchersList';
import { QuickStartSection, type BtcTrendInfo, type BtcTrendStatus } from './QuickStartSection';

export interface RotationStatus {
  isActive: boolean;
  nextRotation: string | null;
}

export interface DynamicSelectionSectionProps {
  isExpanded: boolean;
  onToggle: () => void;
  isIB?: boolean;
  directionMode?: DirectionMode;
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
  isIB,
  directionMode,
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
    <CollapsibleSection
      title={t('tradingProfiles.dynamicSelection.title')}
      description={t('tradingProfiles.dynamicSelection.description')}
      open={isExpanded}
      onOpenChange={onToggle}
      size="lg"
      variant="static"
      badge={isAutoRotationEnabled ? (
        <Box px={2} py={0.5} bg="blue.100" color="blue.800" borderRadius="full" fontSize="xs" fontWeight="medium" _dark={{ bg: 'blue.900', color: 'blue.200' }}>
          <Flex align="center" gap={1}>
            <LuZap size={10} />
            {t('tradingProfiles.dynamicSelection.autoRotation')}
          </Flex>
        </Box>
      ) : undefined}
    >
      <Stack gap={4}>
        <QuickStartSection
          isIB={isIB}
          directionMode={directionMode}
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

        <Box p={4} bg="bg.muted" borderRadius="md" borderWidth="1px" borderColor="border">
          <Flex justify="space-between" align="center">
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
          {isAutoRotationEnabled && (
            <Flex justify="space-between" align="center" mt={3} pt={3} borderTopWidth="1px" borderColor="border">
              <Box>
                <Text fontSize="sm" fontWeight="medium">
                  {t('tradingProfiles.dynamicSelection.rotationStatus')}
                </Text>
                {isLoadingRotationStatus ? (
                  <Text fontSize="xs" color="fg.muted">
                    {t('common.loading')}
                  </Text>
                ) : rotationStatus?.isActive ? (
                  <Text fontSize="xs" color="green.fg">
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
          )}
        </Box>

        <Flex justify="space-between" align="center" gap={2}>
          <Box flex={1}>
            <Callout tone="info" icon={<LuZap />} compact>
              {t('tradingProfiles.dynamicSelection.infoText')}
            </Callout>
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
      </Stack>
    </CollapsibleSection>
  );
};
