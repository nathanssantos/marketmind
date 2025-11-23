import { Box, Flex, HStack, IconButton, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuChartBar,
  LuChartCandlestick,
  LuChartLine,
  LuCrosshair,
  LuDollarSign,
  LuGrid3X3,
  LuMessageSquare,
  LuNewspaper,
  LuRuler,
  LuScan
} from 'react-icons/lu';
import type { MarketDataService } from '../../services/market/MarketDataService';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { SymbolSelector } from '../SymbolSelector';
import { TooltipWrapper } from '../ui/Tooltip';

export interface ToolbarProps {
  marketService: MarketDataService;
  symbol: string;
  timeframe: Timeframe;
  chartType: 'candlestick' | 'line';
  showVolume: boolean;
  showGrid: boolean;
  showCurrentPriceLine: boolean;
  showCrosshair: boolean;
  showMeasurementRuler: boolean;
  showMeasurementArea: boolean;
  movingAverages: MovingAverageConfig[];
  isSimulatorActive: boolean;
  isTradingOpen: boolean;
  isChatOpen: boolean;
  isNewsOpen: boolean;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onChartTypeChange: (type: 'candlestick' | 'line') => void;
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onShowCurrentPriceLineChange: (show: boolean) => void;
  onShowCrosshairChange: (show: boolean) => void;
  onShowMeasurementRulerChange: (show: boolean) => void;
  onShowMeasurementAreaChange: (show: boolean) => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
  onToggleSimulator: () => void;
  onToggleTrading: () => void;
  onToggleChat: () => void;
  onToggleNews: () => void;
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
  movingAverages,
  isSimulatorActive,
  isTradingOpen,
  isChatOpen,
  isNewsOpen,
  onSymbolChange,
  onTimeframeChange,
  onChartTypeChange,
  onShowVolumeChange,
  onShowGridChange,
  onShowCurrentPriceLineChange,
  onShowCrosshairChange,
  onShowMeasurementRulerChange,
  onShowMeasurementAreaChange,
  onMovingAveragesChange,
  onToggleSimulator,
  onToggleTrading,
  onToggleChat,
  onToggleNews,
}: ToolbarProps) => {
  const { t } = useTranslation();

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
      top="48px"
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
          <TooltipWrapper label={t('chart.controls.candlestickChart')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.candlestickChart')}
              onClick={() => onChartTypeChange('candlestick')}
              colorPalette={chartType === 'candlestick' ? 'blue' : 'gray'}
              variant={chartType === 'candlestick' ? 'solid' : 'ghost'}
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
              <LuChartBar />
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
          </>
        )}
      </Flex>

      <Box flex={1} />

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
      </Flex>
    </Flex>
  );
});

Toolbar.displayName = 'Toolbar';
