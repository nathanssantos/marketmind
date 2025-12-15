import { useGlobalActionsOptional } from '@/renderer/context/GlobalActionsContext';
import { useUIStore } from '@/renderer/store/uiStore';
import { Box, Flex, HStack, IconButton, Text } from '@chakra-ui/react';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { usePatternDetectionConfigStore } from '@renderer/store/patternDetectionConfigStore';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuActivity,
  LuArrowRightToLine,
  LuBot,
  LuChartBar,
  LuChartCandlestick,
  LuChartLine,
  LuCrosshair,
  LuDollarSign,
  LuGrid3X3,
  LuHistory,
  LuLightbulb,
  LuMessageSquare,
  LuMoon,
  LuNewspaper,
  LuPlus,
  LuRadar,
  LuRuler,
  LuScan,
  LuSettings,
  LuSun,
  LuTerminal,
  LuTrendingUp,
  LuGauge,
} from 'react-icons/lu';
import { TradingProfilesModal } from '../Trading/TradingProfilesModal';
import { useChartWindows } from '../../hooks/useChartWindows';
import type { MarketDataService } from '../../services/market/MarketDataService';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { SymbolSelector } from '../SymbolSelector';
import { useColorMode } from '../ui/color-mode';
import { TooltipWrapper } from '../ui/Tooltip';
import { PatternTogglePopover } from './PatternTogglePopover';
import { SetupTogglePopover } from './SetupTogglePopover';

export interface ToolbarProps {
  marketService?: MarketDataService;
  symbol: string;
  timeframe: Timeframe;
  chartType: 'kline' | 'line';
  showVolume: boolean;
  showGrid: boolean;
  showCurrentPriceLine: boolean;
  showCrosshair: boolean;
  showMeasurementRuler: boolean;
  showMeasurementArea: boolean;
  showStochastic: boolean;
  showRSI: boolean;
  showBollingerBands: boolean;
  showATR: boolean;
  movingAverages: MovingAverageConfig[];
  isTradingOpen: boolean;
  isChatOpen: boolean;
  isNewsOpen: boolean;
  isBacktestOpen: boolean;
  showNewWindowButton?: boolean;
  showSidebarButtons?: boolean;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onChartTypeChange: (type: 'kline' | 'line') => void;
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onShowCurrentPriceLineChange: (show: boolean) => void;
  onShowCrosshairChange: (show: boolean) => void;
  onShowMeasurementRulerChange: (show: boolean) => void;
  onShowMeasurementAreaChange: (show: boolean) => void;
  onShowStochasticChange: (show: boolean) => void;
  onShowRSIChange: (show: boolean) => void;
  onShowBollingerBandsChange: (show: boolean) => void;
  onShowATRChange: (show: boolean) => void;
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
  showMeasurementRuler,
  showMeasurementArea,
  showStochastic,
  showRSI,
  showBollingerBands,
  showATR,
  movingAverages,
  isTradingOpen,
  isChatOpen,
  isNewsOpen,
  isBacktestOpen,
  showNewWindowButton = true,
  showSidebarButtons = true,
  onSymbolChange,
  onTimeframeChange,
  onChartTypeChange,
  onShowVolumeChange,
  onShowGridChange,
  onShowCurrentPriceLineChange,
  onShowCrosshairChange,
  onShowMeasurementRulerChange,
  onShowMeasurementAreaChange,
  onShowStochasticChange,
  onShowRSIChange,
  onShowBollingerBandsChange,
  onShowATRChange,
  onMovingAveragesChange,
  onToggleTrading,
  onToggleChat,
  onToggleNews,
  onToggleBacktest,
  onDetectPatterns,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const { colorMode, toggleColorMode } = useColorMode();
  const globalActions = useGlobalActionsOptional();
  const { openChartWindow } = useChartWindows();
  const algorithmicDetectionSettings = useUIStore((state) => state.algorithmicDetectionSettings);
  const setAlgorithmicDetectionSettings = useUIStore((state) => state.setAlgorithmicDetectionSettings);
  const patternConfig = usePatternDetectionConfigStore((state) => state.config);
  const setPatternConfig = usePatternDetectionConfigStore((state) => state.setConfig);

  const [isTradingProfilesModalOpen, setIsTradingProfilesModalOpen] = useState(false);

  const { wallets } = useBackendWallet();
  const walletId = wallets[0]?.id;
  const { watcherStatus } = useBackendAutoTrading(walletId ?? '');

  const isPatternDetectionActive = algorithmicDetectionSettings.autoDisplayPatterns;
  const isExtensionsActive = patternConfig.showExtensions;
  const isBackendWatcherActive = watcherStatus?.active ?? false;

  const handleOpenNewWindow = (): void => {
    void openChartWindow(symbol, timeframe);
  };

  const togglePatternDetection = (): void => {
    setAlgorithmicDetectionSettings({
      autoDisplayPatterns: !algorithmicDetectionSettings.autoDisplayPatterns,
    });
  };

  const handleOpenTradingProfilesModal = (): void => {
    setIsTradingProfilesModalOpen(true);
  };

  const toggleExtensions = (): void => {
    setPatternConfig({
      showExtensions: !patternConfig.showExtensions,
    });
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
      height="48px"
      px={4}
      py={2}
      align="center"
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
      <Box flexShrink={0}>
        <SymbolSelector
          marketService={marketService}
          value={symbol}
          onChange={onSymbolChange}
        />
      </Box>

      {showNewWindowButton && (
        <>
          <Box w="1px" h="32px" bg="border" flexShrink={0} />

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
        </>
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
          <TooltipWrapper label={t('chart.controls.volume')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.volume')}
              onClick={() => onShowVolumeChange(!showVolume)}
              colorPalette={showVolume ? 'blue' : 'gray'}
              variant={showVolume ? 'solid' : 'ghost'}
            >
              <Box transform="rotate(-90deg)">
                <LuChartBar />
              </Box>
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('chart.controls.stochastic')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.stochastic')}
              onClick={() => onShowStochasticChange(!showStochastic)}
              colorPalette={showStochastic ? 'blue' : 'gray'}
              variant={showStochastic ? 'solid' : 'ghost'}
            >
              <LuChartLine />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('chart.controls.rsi')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.rsi')}
              onClick={() => onShowRSIChange(!showRSI)}
              colorPalette={showRSI ? 'blue' : 'gray'}
              variant={showRSI ? 'solid' : 'ghost'}
            >
              <LuActivity />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('chart.controls.bollingerBands')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.bollingerBands')}
              onClick={() => onShowBollingerBandsChange(!showBollingerBands)}
              colorPalette={showBollingerBands ? 'blue' : 'gray'}
              variant={showBollingerBands ? 'solid' : 'ghost'}
            >
              <LuTrendingUp />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('chart.controls.atr')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.atr')}
              onClick={() => onShowATRChange(!showATR)}
              colorPalette={showATR ? 'blue' : 'gray'}
              variant={showATR ? 'solid' : 'ghost'}
            >
              <LuGauge />
            </IconButton>
          </TooltipWrapper>
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
          <TooltipWrapper label={t('chart.controls.measurementRuler')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.measurementRuler')}
              onClick={() => onShowMeasurementRulerChange(!showMeasurementRuler)}
              colorPalette={showMeasurementRuler ? 'blue' : 'gray'}
              variant={showMeasurementRuler ? 'solid' : 'ghost'}
            >
              <LuRuler />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('chart.controls.measurementArea')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.measurementArea')}
              onClick={() => onShowMeasurementAreaChange(!showMeasurementArea)}
              colorPalette={showMeasurementArea ? 'blue' : 'gray'}
              variant={showMeasurementArea ? 'solid' : 'ghost'}
            >
              <LuScan />
            </IconButton>
          </TooltipWrapper>
        </HStack>

        {movingAverages.length > 0 && (
          <>
            <Box w="1px" h="32px" bg="border" flexShrink={0} />

            <HStack gap={1} flexWrap="nowrap">
              <TooltipWrapper label={t('chart.controls.autoPatterns')} showArrow placement="top">
                <IconButton
                  size="2xs"
                  aria-label={t('chart.controls.autoPatterns')}
                  onClick={togglePatternDetection}
                  colorPalette={isPatternDetectionActive ? 'blue' : 'gray'}
                  variant={isPatternDetectionActive ? 'solid' : 'ghost'}
                >
                  <LuRadar />
                </IconButton>
              </TooltipWrapper>
              <TooltipWrapper label={t('chart.controls.detectPatterns')} showArrow placement="top">
                <IconButton
                  size="2xs"
                  aria-label={t('chart.controls.detectPatterns')}
                  onClick={onDetectPatterns}
                  colorPalette="blue"
                  variant="solid"
                >
                  <LuLightbulb />
                </IconButton>
              </TooltipWrapper>
              <TooltipWrapper label={t('chart.controls.patternExtensions')} showArrow placement="top">
                <IconButton
                  size="2xs"
                  aria-label={t('chart.controls.patternExtensions')}
                  onClick={toggleExtensions}
                  colorPalette={isExtensionsActive ? 'blue' : 'gray'}
                  variant={isExtensionsActive ? 'solid' : 'ghost'}
                >
                  <LuArrowRightToLine />
                </IconButton>
              </TooltipWrapper>
              <PatternTogglePopover />
            </HStack>

            <Box w="1px" h="32px" bg="border" flexShrink={0} />

            <HStack gap={1} flexWrap="nowrap">
              {movingAverages.map((ma, index) => (
                <TooltipWrapper
                  key={index}
                  label={`${ma.type === 'EMA' ? 'EMA' : 'SMA'}${ma.period}`}
                  showArrow
                >
                  <IconButton
                    size="2xs"
                    aria-label={`${ma.type === 'EMA' ? 'EMA' : 'SMA'}${ma.period}`}
                    onClick={() => toggleMA(index)}
                    colorPalette={ma.visible !== false ? 'blue' : 'gray'}
                    variant={ma.visible !== false ? 'solid' : 'ghost'}
                    px={2}
                    style={{
                      position: 'relative',
                      borderLeft: ma.visible !== false ? `3px solid ${ma.color}` : undefined
                    }}
                  >
                    <Text fontSize="xs" fontWeight="medium">
                      {ma.type === 'EMA' ? 'EMA' : 'SMA'}{ma.period}
                    </Text>
                  </IconButton>
                </TooltipWrapper>
              ))}
            </HStack>

            {showSidebarButtons && (
              <>
                <Box w="1px" h="32px" bg="border" flexShrink={0} />

                <HStack gap={1} flexWrap="nowrap">
                  <SetupTogglePopover />
                  <TooltipWrapper
                    label={t('tradingProfiles.title')}
                    showArrow
                    placement="top"
                  >
                    <IconButton
                      size="2xs"
                      aria-label={t('tradingProfiles.title')}
                      onClick={handleOpenTradingProfilesModal}
                      colorPalette={isBackendWatcherActive ? 'green' : 'gray'}
                      variant={isBackendWatcherActive ? 'solid' : 'ghost'}
                    >
                      <LuBot />
                    </IconButton>
                  </TooltipWrapper>
                  <TooltipWrapper label="Backtest Strategy" showArrow placement="top">
                    <IconButton
                      size="2xs"
                      aria-label="Backtest Strategy"
                      onClick={onToggleBacktest}
                      colorPalette={isBacktestOpen ? 'purple' : 'gray'}
                      variant={isBacktestOpen ? 'solid' : 'ghost'}
                    >
                      <LuHistory />
                    </IconButton>
                  </TooltipWrapper>
                </HStack>
              </>
            )}
          </>
        )}
      </Flex>

      <Box flex={1} />

      {showSidebarButtons && (
        <Flex gap={1} align="center" flexShrink={0}>
          <TooltipWrapper label={t('news.title')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('news.title')}
              onClick={onToggleNews}
              colorPalette={isNewsOpen ? 'blue' : 'gray'}
              variant={isNewsOpen ? 'solid' : 'ghost'}
            >
              <LuNewspaper />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('common.openChat')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('common.openChat')}
              onClick={onToggleChat}
              colorPalette={isChatOpen ? 'blue' : 'gray'}
              variant={isChatOpen ? 'solid' : 'ghost'}
            >
              <LuMessageSquare />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('trading.sidebar.title')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('trading.sidebar.title')}
              onClick={onToggleTrading}
              colorPalette={isTradingOpen ? 'green' : 'gray'}
              variant={isTradingOpen ? 'solid' : 'ghost'}
            >
              <LuDollarSign />
            </IconButton>
          </TooltipWrapper>

          <Box w="1px" h="32px" bg="border" flexShrink={0} />

          <TooltipWrapper label={`${t('header.theme')}: ${colorMode === 'dark' ? t('header.themeDark') : t('header.themeLight')}`} placement="bottom" showArrow>
            <IconButton
              aria-label={t('header.toggleColorMode')}
              onClick={toggleColorMode}
              variant="ghost"
              size="2xs"
            >
              {colorMode === 'dark' ? <LuSun /> : <LuMoon />}
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('header.keyboardShortcuts')} placement="bottom" showArrow>
            <IconButton
              aria-label={t('header.showKeyboardShortcuts')}
              onClick={globalActions?.showKeyboardShortcuts}
              variant="ghost"
              size="2xs"
            >
              <LuTerminal />
            </IconButton>
          </TooltipWrapper>
          <TooltipWrapper label={t('header.settings')} placement="bottom" showArrow>
            <IconButton
              aria-label={t('header.settings')}
              onClick={globalActions?.openSettings}
              variant="ghost"
              size="2xs"
            >
              <LuSettings />
            </IconButton>
          </TooltipWrapper>
        </Flex>
      )}

      <TradingProfilesModal
        isOpen={isTradingProfilesModalOpen}
        onClose={() => setIsTradingProfilesModalOpen(false)}
      />
    </Flex>
  );
});

Toolbar.displayName = 'Toolbar';
