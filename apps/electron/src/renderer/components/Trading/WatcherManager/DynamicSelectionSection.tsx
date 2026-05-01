import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { Button, Callout, FormRow, FormSection, Switch } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { LuChartBar, LuRefreshCw, LuZap } from 'react-icons/lu';
import type { DirectionMode } from './WatchersList';
import { QuickStartSection, type BtcTrendInfo, type BtcTrendStatus } from './QuickStartSection';

export interface RotationStatus {
  isActive: boolean;
  nextRotation: string | null;
}

export interface DynamicSelectionSectionProps {
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
    <FormSection
      title={
        <HStack gap={2}>
          <span>{t('tradingProfiles.dynamicSelection.title')}</span>
          {isAutoRotationEnabled && (
            <Box px={2} py={0.5} bg="blue.subtle" color="blue.fg" borderRadius="full" fontSize="xs" fontWeight="medium">
              <Flex align="center" gap={1}>
                <LuZap size={10} />
                {t('tradingProfiles.dynamicSelection.autoRotation')}
              </Flex>
            </Box>
          )}
        </HStack>
      }
      description={t('tradingProfiles.dynamicSelection.description')}
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

        <FormRow
          label={t('tradingProfiles.dynamicSelection.autoRotation')}
          helper={t('tradingProfiles.dynamicSelection.autoRotationDescription')}
        >
          <Switch
            checked={isAutoRotationEnabled}
            onCheckedChange={onAutoRotationToggle}
            disabled={isPending}
          />
        </FormRow>

        {isAutoRotationEnabled && (
          <Flex justify="space-between" align="center" pl={4}>
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
    </FormSection>
  );
};
