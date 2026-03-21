import { Box, VStack } from '@chakra-ui/react';
import { Separator, ToggleIconButton, TooltipWrapper } from '@renderer/components/ui';
import type { DrawingType } from '@marketmind/chart-studies';
import { useChartPref } from '@renderer/store/preferencesStore';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuArrowUpRight,
  LuCalendarDays,
  LuColumns2,
  LuMagnet,
  LuMessageSquare,
  LuMinus,
  LuPencil,
  LuRectangleHorizontal,
  LuRuler,
  LuScan,
  LuSquare,
  LuTriangleRight,
  LuType,
} from 'react-icons/lu';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
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

  const [showProfitLossAreas, setShowProfitLossAreas] = useChartPref('showProfitLossAreas', false);
  const [showTooltip, setShowTooltip] = useChartPref('showTooltip', false);
  const [showEventRow, setShowEventRow] = useChartPref('showEventRow', false);
  const [showOrb, setShowOrb] = useChartPref('showOrb', false);

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
  const handleTooltipToggle = useCallback(() => setShowTooltip(!showTooltip), [showTooltip, setShowTooltip]);
  const handleEventRowToggle = useCallback(() => setShowEventRow(!showEventRow), [showEventRow, setShowEventRow]);
  const handleOrbToggle = useCallback(() => setShowOrb(!showOrb), [showOrb, setShowOrb]);
  const handleMagnetToggle = useCallback(() => setMagnetEnabled(!magnetEnabled), [magnetEnabled, setMagnetEnabled]);

  const handleToolClick = useCallback((tool: DrawingType) => {
    setActiveTool(tool);
  }, [setActiveTool]);

  const isToolActive = (tool: DrawingType) => activeTool === tool;

  return (
    <Box
      flexShrink={0}
      bg="bg.panel"
      borderRight="1px solid"
      borderColor="border"
      py={1}
      px={0.5}
      overflowY="auto"
    >
      <VStack gap={0.5}>
        <IndicatorTogglePopover
          movingAverages={movingAverages}
          onMovingAverageToggle={toggleMA}
        />
        <Separator orientation="horizontal" width="100%" />
        <TooltipWrapper label={t('chart.tools.pencil', 'Pencil')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('pencil')}
            size="2xs"
            aria-label={t('chart.tools.pencil', 'Pencil')}
            onClick={() => handleToolClick('pencil')}
          >
            <LuPencil />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.line', 'Line')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('line')}
            size="2xs"
            aria-label={t('chart.tools.line', 'Line')}
            onClick={() => handleToolClick('line')}
          >
            <LuMinus />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.arrow', 'Arrow')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('arrow')}
            size="2xs"
            aria-label={t('chart.tools.arrow', 'Arrow')}
            onClick={() => handleToolClick('arrow')}
          >
            <LuArrowUpRight />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.text', 'Text')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('text')}
            size="2xs"
            aria-label={t('chart.tools.text', 'Text')}
            onClick={() => handleToolClick('text')}
          >
            <LuType />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.rectangle', 'Rectangle')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('rectangle')}
            size="2xs"
            aria-label={t('chart.tools.rectangle', 'Rectangle')}
            onClick={() => handleToolClick('rectangle')}
          >
            <LuSquare />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.fibonacci', 'Fibonacci')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('fibonacci')}
            size="2xs"
            aria-label={t('chart.tools.fibonacci', 'Fibonacci')}
            onClick={() => handleToolClick('fibonacci')}
          >
            <LuTriangleRight />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.ruler', 'Ruler')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('ruler')}
            size="2xs"
            aria-label={t('chart.tools.ruler', 'Ruler')}
            onClick={() => handleToolClick('ruler')}
          >
            <LuRuler />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.tools.area', 'Area')} showArrow placement="right">
          <ToggleIconButton
            active={isToolActive('area')}
            size="2xs"
            aria-label={t('chart.tools.area', 'Area')}
            onClick={() => handleToolClick('area')}
          >
            <LuScan />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.profitLossAreas')} showArrow placement="right">
          <ToggleIconButton
            active={showProfitLossAreas}
            size="2xs"
            aria-label={t('chart.controls.profitLossAreas')}
            onClick={handleProfitLossToggle}
          >
            <LuRectangleHorizontal />
          </ToggleIconButton>
        </TooltipWrapper>
        <Separator orientation="horizontal" width="100%" />
        <TooltipWrapper label={t('chart.tools.magnet', 'OHLC Magnet')} showArrow placement="right">
          <ToggleIconButton
            active={magnetEnabled}
            size="2xs"
            aria-label={t('chart.tools.magnet', 'OHLC Magnet')}
            onClick={handleMagnetToggle}
          >
            <LuMagnet />
          </ToggleIconButton>
        </TooltipWrapper>
        <Separator orientation="horizontal" width="100%" />
        <TooltipWrapper label={t('chart.controls.tooltip')} showArrow placement="right">
          <ToggleIconButton
            active={showTooltip}
            size="2xs"
            aria-label={t('chart.controls.tooltip')}
            onClick={handleTooltipToggle}
          >
            <LuMessageSquare />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.marketEvents')} showArrow placement="right">
          <ToggleIconButton
            active={showEventRow}
            size="2xs"
            aria-label={t('chart.controls.marketEvents')}
            onClick={handleEventRowToggle}
          >
            <LuCalendarDays />
          </ToggleIconButton>
        </TooltipWrapper>
        <TooltipWrapper label={t('chart.controls.openingRange')} showArrow placement="right">
          <ToggleIconButton
            active={showOrb}
            size="2xs"
            aria-label={t('chart.controls.openingRange')}
            onClick={handleOrbToggle}
          >
            <LuColumns2 />
          </ToggleIconButton>
        </TooltipWrapper>
      </VStack>
    </Box>
  );
});

ChartToolsToolbar.displayName = 'ChartToolsToolbar';
