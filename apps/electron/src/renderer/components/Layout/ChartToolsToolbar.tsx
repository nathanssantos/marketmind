import { Box, HStack, IconButton } from '@chakra-ui/react';
import { useChartPref } from '@renderer/store/preferencesStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuCalendarDays,
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
import { TrailingStopPopover } from './TrailingStopPopover';

export interface ChartToolsToolbarProps {
  symbol?: string;
  movingAverages: MovingAverageConfig[];
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
}

export const ChartToolsToolbar = memo(({
  symbol,
  movingAverages,
  onMovingAveragesChange,
}: ChartToolsToolbarProps) => {
  const { t } = useTranslation();

  const [showGrid, setShowGrid] = useChartPref('showGrid', true);
  const [showCurrentPriceLine, setShowCurrentPriceLine] = useChartPref('showCurrentPriceLine', true);
  const [showCrosshair, setShowCrosshair] = useChartPref('showCrosshair', true);
  const [showProfitLossAreas, setShowProfitLossAreas] = useChartPref('showProfitLossAreas', true);
  const [showFibonacciProjection, setShowFibonacciProjection] = useChartPref('showFibonacciProjection', false);
  const [showMeasurementRuler, setShowMeasurementRuler] = useChartPref('showMeasurementRuler', false);
  const [showMeasurementArea, setShowMeasurementArea] = useChartPref('showMeasurementArea', false);
  const [showTooltip, setShowTooltip] = useChartPref('showTooltip', false);
  const [showEventRow, setShowEventRow] = useChartPref('showEventRow', false);

  const toggleMA = useCallback((index: number): void => {
    const updated = movingAverages.map((ma, i) =>
      i === index ? { ...ma, visible: !ma.visible } : ma
    );
    onMovingAveragesChange(updated);
  }, [movingAverages, onMovingAveragesChange]);

  const handleGridToggle = useCallback(() => setShowGrid(!showGrid), [showGrid, setShowGrid]);
  const handlePriceLineToggle = useCallback(() => setShowCurrentPriceLine(!showCurrentPriceLine), [showCurrentPriceLine, setShowCurrentPriceLine]);
  const handleCrosshairToggle = useCallback(() => setShowCrosshair(!showCrosshair), [showCrosshair, setShowCrosshair]);
  const handleProfitLossToggle = useCallback(() => setShowProfitLossAreas(!showProfitLossAreas), [showProfitLossAreas, setShowProfitLossAreas]);
  const handleFibToggle = useCallback(() => setShowFibonacciProjection(!showFibonacciProjection), [showFibonacciProjection, setShowFibonacciProjection]);
  const handleRulerToggle = useCallback(() => setShowMeasurementRuler(!showMeasurementRuler), [showMeasurementRuler, setShowMeasurementRuler]);
  const handleAreaToggle = useCallback(() => setShowMeasurementArea(!showMeasurementArea), [showMeasurementArea, setShowMeasurementArea]);
  const handleTooltipToggle = useCallback(() => setShowTooltip(!showTooltip), [showTooltip, setShowTooltip]);
  const handleEventRowToggle = useCallback(() => setShowEventRow(!showEventRow), [showEventRow, setShowEventRow]);

  return (
    <Box
      position="absolute"
      top={2}
      left="50%"
      transform="translateX(-50%)"
      zIndex={10}
      bg="bg.panel"
      borderRadius="md"
      border="1px solid"
      borderColor="border"
      boxShadow="sm"
      p={1}
    >
      <HStack gap={1}>
        <IndicatorTogglePopover
          movingAverages={movingAverages}
          onMovingAverageToggle={toggleMA}
        />
        <TooltipWrapper label={t('chart.controls.grid')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.grid')}
            onClick={handleGridToggle}
            colorPalette={showGrid ? 'blue' : 'gray'}
            variant={showGrid ? 'solid' : 'ghost'}
          >
            <LuGrid3X3 />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.currentPrice')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.currentPrice')}
            onClick={handlePriceLineToggle}
            colorPalette={showCurrentPriceLine ? 'blue' : 'gray'}
            variant={showCurrentPriceLine ? 'solid' : 'ghost'}
          >
            <LuDollarSign />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.crosshair')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.crosshair')}
            onClick={handleCrosshairToggle}
            colorPalette={showCrosshair ? 'blue' : 'gray'}
            variant={showCrosshair ? 'solid' : 'ghost'}
          >
            <LuCrosshair />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.profitLossAreas')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.profitLossAreas')}
            onClick={handleProfitLossToggle}
            colorPalette={showProfitLossAreas ? 'blue' : 'gray'}
            variant={showProfitLossAreas ? 'solid' : 'ghost'}
          >
            <LuRectangleHorizontal />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.fibonacciProjection')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.fibonacciProjection')}
            onClick={handleFibToggle}
            colorPalette={showFibonacciProjection ? 'blue' : 'gray'}
            variant={showFibonacciProjection ? 'solid' : 'ghost'}
          >
            <LuTriangleRight style={{ transform: 'scaleX(-1)' }} />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.measurementRuler')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.measurementRuler')}
            onClick={handleRulerToggle}
            colorPalette={showMeasurementRuler ? 'blue' : 'gray'}
            variant={showMeasurementRuler ? 'solid' : 'ghost'}
          >
            <LuRuler />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.measurementArea')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.measurementArea')}
            onClick={handleAreaToggle}
            colorPalette={showMeasurementArea ? 'blue' : 'gray'}
            variant={showMeasurementArea ? 'solid' : 'ghost'}
          >
            <LuScan />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.tooltip')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.tooltip')}
            onClick={handleTooltipToggle}
            colorPalette={showTooltip ? 'blue' : 'gray'}
            variant={showTooltip ? 'solid' : 'ghost'}
          >
            <LuMessageSquare />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.marketEvents')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.controls.marketEvents')}
            onClick={handleEventRowToggle}
            colorPalette={showEventRow ? 'blue' : 'gray'}
            variant={showEventRow ? 'solid' : 'ghost'}
          >
            <LuCalendarDays />
          </IconButton>
        </TooltipWrapper>
        {symbol && <TrailingStopPopover symbol={symbol} />}
      </HStack>
    </Box>
  );
});

ChartToolsToolbar.displayName = 'ChartToolsToolbar';
