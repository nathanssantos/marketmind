import { useGlobalActionsOptional } from '@/renderer/context/GlobalActionsContext';
import { Box, Flex, HStack, IconButton } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuBot,
  LuChartCandlestick,
  LuChartLine,
  LuCrosshair,
  LuDollarSign,
  LuGrid3X3,
  LuHistory,
  LuPlus,
  LuSettings
} from 'react-icons/lu';
import { useChartWindows } from '../../hooks/useChartWindows';
import type { MarketDataService } from '../../services/market/MarketDataService';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { SymbolSelector } from '../SymbolSelector';
import { TradingProfilesModal } from '../Trading/TradingProfilesModal';
import { Logo } from '../ui/logo';
import { TooltipWrapper } from '../ui/Tooltip';
import { IndicatorTogglePopover } from './IndicatorTogglePopover';

export interface ToolbarProps {
  marketService?: MarketDataService;
  symbol: string;
  timeframe: Timeframe;
  chartType: 'kline' | 'line';
  showVolume: boolean;
  showGrid: boolean;
  showCurrentPriceLine: boolean;
  showCrosshair: boolean;
  showStochastic: boolean;
  showRSI: boolean;
  showBollingerBands: boolean;
  showATR: boolean;
  showVWAP: boolean;
  movingAverages: MovingAverageConfig[];
  isTradingOpen: boolean;
  isChatOpen: boolean;
  isNewsOpen: boolean;
  isBacktestOpen: boolean;
  showNewWindowButton?: boolean;
  showSidebarButtons?: boolean;
  onSymbolChange: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onChartTypeChange: (type: 'kline' | 'line') => void;
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onShowCurrentPriceLineChange: (show: boolean) => void;
  onShowCrosshairChange: (show: boolean) => void;
  onShowStochasticChange: (show: boolean) => void;
  onShowRSIChange: (show: boolean) => void;
  onShowBollingerBandsChange: (show: boolean) => void;
  onShowATRChange: (show: boolean) => void;
  onShowVWAPChange: (show: boolean) => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
  onToggleTrading: () => void;
  onToggleChat: () => void;
  onToggleNews: () => void;
  onToggleBacktest: () => void;
  onDetectPatterns: () => void;
}

export const Toolbar = memo(({
  marketService,
  symbol,
  timeframe,
  chartType,
  showVolume,
  showGrid,
  showCurrentPriceLine,
  showCrosshair,
  showStochastic,
  showRSI,
  showBollingerBands,
  showATR,
  showVWAP,
  movingAverages,
  isTradingOpen,
  isChatOpen: _isChatOpen,
  isNewsOpen: _isNewsOpen,
  isBacktestOpen: _isBacktestOpen,
  showNewWindowButton = true,
  showSidebarButtons = true,
  onSymbolChange,
  onTimeframeChange,
  onChartTypeChange,
  onShowVolumeChange,
  onShowGridChange,
  onShowCurrentPriceLineChange,
  onShowCrosshairChange,
  onShowStochasticChange,
  onShowRSIChange,
  onShowBollingerBandsChange,
  onShowATRChange,
  onShowVWAPChange,
  onMovingAveragesChange,
  onToggleTrading,
  onToggleChat: _onToggleChat,
  onToggleNews: _onToggleNews,
  onToggleBacktest,
  onDetectPatterns: _onDetectPatterns,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const { openChartWindow } = useChartWindows();

  const [isTradingProfilesModalOpen, setIsTradingProfilesModalOpen] = useState(false);

  const handleOpenNewWindow = (): void => {
    void openChartWindow(symbol, timeframe);
  };

  const handleOpenTradingProfilesModal = (): void => {
    setIsTradingProfilesModalOpen(true);
  };

  const toggleMA = (index: number): void => {
    const updated = movingAverages.map((ma, i) =>
      i === index
        ? { ...ma, visible: ma.visible === false ? true : false }
        : ma
    );
    onMovingAveragesChange(updated);
  };

  return (
    <Flex
      position="fixed"
      top={0}
      left={0}
      right={0}
      height="41px"
      px={4}
      py={1}
      align="center"
      justifyContent="space-between"
      gap={4}
      bg="bg.panel"
      borderBottom="1px solid"
      borderColor="border"
      zIndex={99}
      overflowX="auto"
      overflowY="hidden"
      css={{
        '&::-webkit-scrollbar': {
          height: '4px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'var(--chakra-colors-border)',
          borderRadius: '2px',
        },
      }}
    >
      <Flex align="center" gap={4} flex={1} overflowX="auto">
        <Box flexShrink={0}>
          <Logo size={24} />
        </Box>

        <Box w="1px" h="32px" bg="border" flexShrink={0} />

        <Box flexShrink={0}>
          <SymbolSelector
            marketService={marketService}
            value={symbol}
            onChange={onSymbolChange}
            showMarketTypeToggle
          />
        </Box>

        {showNewWindowButton && (
          <TooltipWrapper label={t('chart.controls.newWindow')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.newWindow')}
              onClick={handleOpenNewWindow}
              colorPalette="blue"
              variant="ghost"
            >
              <LuPlus />
            </IconButton>
          </TooltipWrapper>
        )}

        <Box w="1px" h="32px" bg="border" flexShrink={0} />

        <Box flexShrink={0}>
          <TimeframeSelector
            selectedTimeframe={timeframe}
            onTimeframeChange={onTimeframeChange}
          />
        </Box>

        <Box w="1px" h="32px" bg="border" flexShrink={0} />

        <Flex gap={3} align="center" flexShrink={0}>
          <HStack gap={1}>
            <TooltipWrapper label={t('chart.controls.klineChart')} showArrow>
              <IconButton
                size="2xs"
                aria-label={t('chart.controls.klineChart')}
                onClick={() => onChartTypeChange('kline')}
                colorPalette={chartType === 'kline' ? 'blue' : 'gray'}
                variant={chartType === 'kline' ? 'solid' : 'ghost'}
              >
                <LuChartCandlestick />
              </IconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.lineChart')} showArrow>
              <IconButton
                size="2xs"
                aria-label={t('chart.controls.lineChart')}
                onClick={() => onChartTypeChange('line')}
                colorPalette={chartType === 'line' ? 'blue' : 'gray'}
                variant={chartType === 'line' ? 'solid' : 'ghost'}
              >
                <LuChartLine />
              </IconButton>
            </TooltipWrapper>
          </HStack>

          <Box w="1px" h="32px" bg="border" flexShrink={0} />

          <HStack gap={1}>
            <IndicatorTogglePopover
              showVolume={showVolume}
              showStochastic={showStochastic}
              showRSI={showRSI}
              showBollingerBands={showBollingerBands}
              showATR={showATR}
              showVWAP={showVWAP}
              movingAverages={movingAverages}
              onShowVolumeChange={onShowVolumeChange}
              onShowStochasticChange={onShowStochasticChange}
              onShowRSIChange={onShowRSIChange}
              onShowBollingerBandsChange={onShowBollingerBandsChange}
              onShowATRChange={onShowATRChange}
              onShowVWAPChange={onShowVWAPChange}
              onMovingAverageToggle={toggleMA}
            />
            <TooltipWrapper label={t('chart.controls.grid')} showArrow>
              <IconButton
                size="2xs"
                aria-label={t('chart.controls.grid')}
                onClick={() => onShowGridChange(!showGrid)}
                colorPalette={showGrid ? 'blue' : 'gray'}
                variant={showGrid ? 'solid' : 'ghost'}
              >
                <LuGrid3X3 />
              </IconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.currentPrice')} showArrow>
              <IconButton
                size="2xs"
                aria-label={t('chart.controls.currentPrice')}
                onClick={() => onShowCurrentPriceLineChange(!showCurrentPriceLine)}
                colorPalette={showCurrentPriceLine ? 'blue' : 'gray'}
                variant={showCurrentPriceLine ? 'solid' : 'ghost'}
              >
                <LuDollarSign />
              </IconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('chart.controls.crosshair')} showArrow>
              <IconButton
                size="2xs"
                aria-label={t('chart.controls.crosshair')}
                onClick={() => onShowCrosshairChange(!showCrosshair)}
                colorPalette={showCrosshair ? 'blue' : 'gray'}
                variant={showCrosshair ? 'solid' : 'ghost'}
              >
                <LuCrosshair />
              </IconButton>
            </TooltipWrapper>
          </HStack>

          {movingAverages.length > 0 && showSidebarButtons && (
            <>
              <Box w="1px" h="32px" bg="border" flexShrink={0} />

              <HStack gap={1} flexWrap="nowrap">
                <TooltipWrapper
                  label={t('tradingProfiles.title')}
                  showArrow
                  placement="top"
                >
                  <IconButton
                    size="2xs"
                    aria-label={t('tradingProfiles.title')}
                    onClick={handleOpenTradingProfilesModal}
                    colorPalette="blue"
                    variant="solid"
                  >
                    <LuBot />
                  </IconButton>
                </TooltipWrapper>
                <TooltipWrapper label="Backtest Strategy" showArrow placement="top">
                  <IconButton
                    size="2xs"
                    aria-label="Backtest Strategy"
                    onClick={onToggleBacktest}
                    colorPalette="blue"
                    variant="solid"
                  >
                    <LuHistory />
                  </IconButton>
                </TooltipWrapper>
              </HStack>
            </>
          )}

          {showSidebarButtons && (
            <>
              <Box w="1px" h="32px" bg="border" flexShrink={0} />

              <TooltipWrapper label={t('header.settings')} placement="bottom" showArrow>
                <IconButton
                  aria-label={t('header.settings')}
                  onClick={globalActions?.openSettings}
                  variant="solid"
                  colorPalette="blue"
                  size="2xs"
                >
                  <LuSettings />
                </IconButton>
              </TooltipWrapper>
            </>
          )}
        </Flex>
      </Flex>

      {showSidebarButtons && (
        <HStack gap={1} flexShrink={0}>
          <TooltipWrapper label={t('trading.sidebar.title')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('trading.sidebar.title')}
              onClick={onToggleTrading}
              colorPalette={isTradingOpen ? 'blue' : 'gray'}
              variant={isTradingOpen ? 'solid' : 'ghost'}
            >
              <LuDollarSign />
            </IconButton>
          </TooltipWrapper>
        </HStack>
      )}

      <TradingProfilesModal
        isOpen={isTradingProfilesModalOpen}
        onClose={() => setIsTradingProfilesModalOpen(false)}
      />
    </Flex>
  );
});

Toolbar.displayName = 'Toolbar';
