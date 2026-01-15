import { Box, Separator, HStack, IconButton } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuCalendarDays,
  LuChartCandlestick,
  LuChartLine,
  LuCrosshair,
  LuDollarSign,
  LuGrid3X3,
  LuMessageSquare,
  LuRectangleHorizontal,
  LuRuler,
  LuScan,
  LuTriangleRight,
} from 'react-icons/lu';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { TooltipWrapper } from '../ui/Tooltip';
import { IndicatorTogglePopover } from './IndicatorTogglePopover';

export interface ChartToolsToolbarProps {
  chartType: 'kline' | 'line';
  showGrid: boolean;
  showCurrentPriceLine: boolean;
  showCrosshair: boolean;
  showProfitLossAreas: boolean;
  showFibonacciProjection: boolean;
  showMeasurementRuler: boolean;
  showMeasurementArea: boolean;
  showTooltip: boolean;
  showVolume: boolean;
  showStochastic: boolean;
  showRSI: boolean;
  showBollingerBands: boolean;
  showATR: boolean;
  showVWAP: boolean;
  showEventRow: boolean;
  movingAverages: MovingAverageConfig[];
  onChartTypeChange: (type: 'kline' | 'line') => void;
  onShowGridChange: (show: boolean) => void;
  onShowCurrentPriceLineChange: (show: boolean) => void;
  onShowCrosshairChange: (show: boolean) => void;
  onShowProfitLossAreasChange: (show: boolean) => void;
  onShowFibonacciProjectionChange: (show: boolean) => void;
  onShowMeasurementRulerChange: (show: boolean) => void;
  onShowMeasurementAreaChange: (show: boolean) => void;
  onShowTooltipChange: (show: boolean) => void;
  onShowVolumeChange: (show: boolean) => void;
  onShowStochasticChange: (show: boolean) => void;
  onShowRSIChange: (show: boolean) => void;
  onShowBollingerBandsChange: (show: boolean) => void;
  onShowATRChange: (show: boolean) => void;
  onShowVWAPChange: (show: boolean) => void;
  onShowEventRowChange: (show: boolean) => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
}

export const ChartToolsToolbar = memo(({
  chartType,
  showGrid,
  showCurrentPriceLine,
  showCrosshair,
  showProfitLossAreas,
  showFibonacciProjection,
  showMeasurementRuler,
  showMeasurementArea,
  showTooltip,
  showVolume,
  showStochastic,
  showRSI,
  showBollingerBands,
  showATR,
  showVWAP,
  showEventRow,
  movingAverages,
  onChartTypeChange,
  onShowGridChange,
  onShowCurrentPriceLineChange,
  onShowCrosshairChange,
  onShowProfitLossAreasChange,
  onShowFibonacciProjectionChange,
  onShowMeasurementRulerChange,
  onShowMeasurementAreaChange,
  onShowTooltipChange,
  onShowVolumeChange,
  onShowStochasticChange,
  onShowRSIChange,
  onShowBollingerBandsChange,
  onShowATRChange,
  onShowVWAPChange,
  onShowEventRowChange,
  onMovingAveragesChange,
}: ChartToolsToolbarProps) => {
  const { t } = useTranslation();

  const toggleMA = (index: number): void => {
    const updated = movingAverages.map((ma, i) =>
      i === index ? { ...ma, visible: ma.visible === false ? true : false } : ma
    );
    onMovingAveragesChange(updated);
  };

  return (
    <Box
      position="absolute"
      top={2}
      left={2}
      zIndex={10}
      bg="bg.panel"
      borderRadius="md"
      border="1px solid"
      borderColor="border"
      boxShadow="sm"
      p={1}
    >
      <HStack gap={1}>
        <TooltipWrapper label={t('chart.controls.klineChart')} showArrow placement="right">
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
        <TooltipWrapper label={t('chart.controls.lineChart')} showArrow placement="right">
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
        <Separator orientation="vertical" height="16px" />
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
        <TooltipWrapper label={t('chart.controls.grid')} showArrow placement="right">
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
        <TooltipWrapper label={t('chart.controls.currentPrice')} showArrow placement="right">
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
        <TooltipWrapper label={t('chart.controls.crosshair')} showArrow placement="right">
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
        <TooltipWrapper label={t('chart.controls.profitLossAreas')} showArrow placement="right">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.profitLossAreas')}
            onClick={() => onShowProfitLossAreasChange(!showProfitLossAreas)}
            colorPalette={showProfitLossAreas ? 'blue' : 'gray'}
            variant={showProfitLossAreas ? 'solid' : 'ghost'}
          >
            <LuRectangleHorizontal />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.fibonacciProjection')} showArrow placement="right">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.fibonacciProjection')}
            onClick={() => onShowFibonacciProjectionChange(!showFibonacciProjection)}
            colorPalette={showFibonacciProjection ? 'blue' : 'gray'}
            variant={showFibonacciProjection ? 'solid' : 'ghost'}
          >
            <LuTriangleRight style={{ transform: 'scaleX(-1)' }} />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.measurementRuler')} showArrow placement="right">
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
        <TooltipWrapper label={t('chart.controls.measurementArea')} showArrow placement="right">
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
        <TooltipWrapper label={t('chart.controls.tooltip')} showArrow placement="right">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.tooltip')}
            onClick={() => onShowTooltipChange(!showTooltip)}
            colorPalette={showTooltip ? 'blue' : 'gray'}
            variant={showTooltip ? 'solid' : 'ghost'}
          >
            <LuMessageSquare />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.marketEvents')} showArrow placement="right">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.marketEvents')}
            onClick={() => onShowEventRowChange(!showEventRow)}
            colorPalette={showEventRow ? 'blue' : 'gray'}
            variant={showEventRow ? 'solid' : 'ghost'}
          >
            <LuCalendarDays />
          </IconButton>
        </TooltipWrapper>
      </HStack>
    </Box>
  );
});

ChartToolsToolbar.displayName = 'ChartToolsToolbar';
