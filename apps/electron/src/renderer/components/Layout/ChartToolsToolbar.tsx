import { Box, HStack, IconButton, Separator } from '@chakra-ui/react';
import type { DrawingType } from '@marketmind/chart-studies';
import { useChartPref } from '@renderer/store/preferencesStore';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuCalendarDays,
  LuMagnet,
  LuMessageSquare,
  LuMinus,
  LuPencil,
  LuRectangleHorizontal,
  LuRuler,
  LuScan,
  LuSquare,
  LuTriangleRight,
} from 'react-icons/lu';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { TooltipWrapper } from '../ui/Tooltip';
import { IndicatorTogglePopover } from './IndicatorTogglePopover';

export interface ChartToolsToolbarProps {
  movingAverages: MovingAverageConfig[];
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
}

export const ChartToolsToolbar = memo(({
  movingAverages,
  onMovingAveragesChange,
}: ChartToolsToolbarProps) => {
  const { t } = useTranslation();

  const [showProfitLossAreas, setShowProfitLossAreas] = useChartPref('showProfitLossAreas', true);
  const [showFibonacciProjection, setShowFibonacciProjection] = useChartPref('showFibonacciProjection', true);
  const [showTooltip, setShowTooltip] = useChartPref('showTooltip', false);
  const [showEventRow, setShowEventRow] = useChartPref('showEventRow', false);

  const activeTool = useDrawingStore(s => s.activeTool);
  const magnetEnabled = useDrawingStore(s => s.magnetEnabled);
  const setActiveTool = useDrawingStore(s => s.setActiveTool);
  const setMagnetEnabled = useDrawingStore(s => s.setMagnetEnabled);

  const toggleMA = useCallback((index: number): void => {
    const updated = movingAverages.map((ma, i) =>
      i === index ? { ...ma, visible: !ma.visible } : ma
    );
    onMovingAveragesChange(updated);
  }, [movingAverages, onMovingAveragesChange]);

  const handleProfitLossToggle = useCallback(() => setShowProfitLossAreas(!showProfitLossAreas), [showProfitLossAreas, setShowProfitLossAreas]);
  const handleFibToggle = useCallback(() => setShowFibonacciProjection(!showFibonacciProjection), [showFibonacciProjection, setShowFibonacciProjection]);
  const handleTooltipToggle = useCallback(() => setShowTooltip(!showTooltip), [showTooltip, setShowTooltip]);
  const handleEventRowToggle = useCallback(() => setShowEventRow(!showEventRow), [showEventRow, setShowEventRow]);
  const handleMagnetToggle = useCallback(() => setMagnetEnabled(!magnetEnabled), [magnetEnabled, setMagnetEnabled]);

  const handleToolClick = useCallback((tool: DrawingType) => {
    setActiveTool(tool);
  }, [setActiveTool]);

  const isToolActive = (tool: DrawingType) => activeTool === tool;

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
        <Separator orientation="vertical" height="4" />
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
        <Separator orientation="vertical" height="4" />
        <TooltipWrapper label={t('chart.tools.pencil', 'Pencil')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.tools.pencil', 'Pencil')}
            onClick={() => handleToolClick('pencil')}
            colorPalette={isToolActive('pencil') ? 'blue' : 'gray'}
            variant={isToolActive('pencil') ? 'solid' : 'ghost'}
          >
            <LuPencil />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.line', 'Line')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.tools.line', 'Line')}
            onClick={() => handleToolClick('line')}
            colorPalette={isToolActive('line') ? 'blue' : 'gray'}
            variant={isToolActive('line') ? 'solid' : 'ghost'}
          >
            <LuMinus />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.rectangle', 'Rectangle')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.tools.rectangle', 'Rectangle')}
            onClick={() => handleToolClick('rectangle')}
            colorPalette={isToolActive('rectangle') ? 'blue' : 'gray'}
            variant={isToolActive('rectangle') ? 'solid' : 'ghost'}
          >
            <LuSquare />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.fibonacci', 'Fibonacci')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.tools.fibonacci', 'Fibonacci')}
            onClick={() => handleToolClick('fibonacci')}
            colorPalette={isToolActive('fibonacci') ? 'blue' : 'gray'}
            variant={isToolActive('fibonacci') ? 'solid' : 'ghost'}
          >
            <LuTriangleRight />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.ruler', 'Ruler')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.tools.ruler', 'Ruler')}
            onClick={() => handleToolClick('ruler')}
            colorPalette={isToolActive('ruler') ? 'blue' : 'gray'}
            variant={isToolActive('ruler') ? 'solid' : 'ghost'}
          >
            <LuRuler />
          </IconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.area', 'Area')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.tools.area', 'Area')}
            onClick={() => handleToolClick('area')}
            colorPalette={isToolActive('area') ? 'blue' : 'gray'}
            variant={isToolActive('area') ? 'solid' : 'ghost'}
          >
            <LuScan />
          </IconButton>
        </TooltipWrapper>
        <Separator orientation="vertical" height="4" />
        <TooltipWrapper label={t('chart.tools.magnet', 'OHLC Magnet')} showArrow placement="bottom">
          <IconButton
            size="2xs"
            aria-label={t('chart.tools.magnet', 'OHLC Magnet')}
            onClick={handleMagnetToggle}
            colorPalette={magnetEnabled ? 'blue' : 'gray'}
            variant={magnetEnabled ? 'solid' : 'ghost'}
          >
            <LuMagnet />
          </IconButton>
        </TooltipWrapper>
        <Separator orientation="vertical" height="4" />
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
