import { Box, HStack, IconButton } from '@chakra-ui/react';
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

export interface ChartToolsToolbarProps {
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

  const toggleMA = useCallback((index: number): void => {
    const updated = movingAverages.map((ma, i) =>
      i === index ? { ...ma, visible: !ma.visible } : ma
    );
    onMovingAveragesChange(updated);
  }, [movingAverages, onMovingAveragesChange]);

  const handleGridToggle = useCallback(() => onShowGridChange(!showGrid), [showGrid, onShowGridChange]);
  const handlePriceLineToggle = useCallback(() => onShowCurrentPriceLineChange(!showCurrentPriceLine), [showCurrentPriceLine, onShowCurrentPriceLineChange]);
  const handleCrosshairToggle = useCallback(() => onShowCrosshairChange(!showCrosshair), [showCrosshair, onShowCrosshairChange]);
  const handleProfitLossToggle = useCallback(() => onShowProfitLossAreasChange(!showProfitLossAreas), [showProfitLossAreas, onShowProfitLossAreasChange]);
  const handleFibToggle = useCallback(() => onShowFibonacciProjectionChange(!showFibonacciProjection), [showFibonacciProjection, onShowFibonacciProjectionChange]);
  const handleRulerToggle = useCallback(() => onShowMeasurementRulerChange(!showMeasurementRuler), [showMeasurementRuler, onShowMeasurementRulerChange]);
  const handleAreaToggle = useCallback(() => onShowMeasurementAreaChange(!showMeasurementArea), [showMeasurementArea, onShowMeasurementAreaChange]);
  const handleTooltipToggle = useCallback(() => onShowTooltipChange(!showTooltip), [showTooltip, onShowTooltipChange]);
  const handleEventRowToggle = useCallback(() => onShowEventRowChange(!showEventRow), [showEventRow, onShowEventRowChange]);

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
      </HStack>
    </Box>
  );
});

ChartToolsToolbar.displayName = 'ChartToolsToolbar';
