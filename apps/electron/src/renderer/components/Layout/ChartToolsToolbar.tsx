import { Box, VStack } from '@chakra-ui/react';
import { Separator, ToggleIconButton, TooltipWrapper } from '@renderer/components/ui';
import type { DrawingType } from '@marketmind/chart-studies';
import { useChartPref } from '@renderer/store/preferencesStore';
import { useDrawingStore } from '@renderer/store/drawingStore';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PencilIcon,
  LineIcon,
  HorizontalLineIcon,
  VerticalLineIcon,
  TrendLineIcon,
  ArrowIcon,
  RayIcon,
  ChannelIcon,
  RectangleIcon,
  EllipseIcon,
  AreaIcon,
  FibonacciIcon,
  PriceRangeIcon,
  PitchforkIcon,
  GannFanIcon,
  HighlighterIcon,
  TextIcon,
  AnchoredVwapIcon,
  RulerIcon,
  LongPositionIcon,
  ShortPositionIcon,
} from '@renderer/components/icons';
import {
  LuCalendarDays,
  LuFlipVertical2,
  LuMagnet,
  LuMessageSquare,
} from 'react-icons/lu';


const DrawingToolButton = memo(({ tool, label, icon }: { tool: DrawingType; label: string; icon: React.ReactNode }) => {
  const activeTool = useDrawingStore(s => s.activeTool);
  const setActiveTool = useDrawingStore(s => s.setActiveTool);

  return (
    <TooltipWrapper label={label} showArrow placement="right">
      <ToggleIconButton
        active={activeTool === tool}
        size="2xs"
        aria-label={label}
        onClick={() => setActiveTool(tool)}
      >
        {icon}
      </ToggleIconButton>
    </TooltipWrapper>
  );
});

DrawingToolButton.displayName = 'DrawingToolButton';

export const ChartToolsToolbar = memo(() => {
  const { t } = useTranslation();

  const [showTooltip, setShowTooltip] = useChartPref('showTooltip', false);
  const [showEventRow, setShowEventRow] = useChartPref('showEventRow', false);
  const [chartFlipped, setChartFlipped] = useChartPref<boolean>('chartFlipped', false);

  const magnetEnabled = useDrawingStore(s => s.magnetEnabled);
  const setMagnetEnabled = useDrawingStore(s => s.setMagnetEnabled);

  const handleTooltipToggle = useCallback(() => setShowTooltip(!showTooltip), [showTooltip, setShowTooltip]);
  const handleEventRowToggle = useCallback(() => setShowEventRow(!showEventRow), [showEventRow, setShowEventRow]);
  const handleMagnetToggle = useCallback(() => setMagnetEnabled(!magnetEnabled), [magnetEnabled, setMagnetEnabled]);
  const handleFlipToggle = useCallback(() => setChartFlipped(!chartFlipped), [chartFlipped, setChartFlipped]);

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
        <DrawingToolButton tool="pencil" label={t('chart.tools.pencil')} icon={<PencilIcon />} />
        <DrawingToolButton tool="highlighter" label={t('chart.tools.highlighter')} icon={<HighlighterIcon />} />
        <Separator orientation="horizontal" width="100%" />
        <DrawingToolButton tool="line" label={t('chart.tools.line')} icon={<LineIcon />} />
        <DrawingToolButton tool="horizontalLine" label={t('chart.tools.horizontalLine')} icon={<HorizontalLineIcon />} />
        <DrawingToolButton tool="verticalLine" label={t('chart.tools.verticalLine')} icon={<VerticalLineIcon />} />
        <DrawingToolButton tool="trendLine" label={t('chart.tools.trendLine')} icon={<TrendLineIcon />} />
        <DrawingToolButton tool="arrow" label={t('chart.tools.arrow')} icon={<ArrowIcon />} />
        <DrawingToolButton tool="ray" label={t('chart.tools.ray')} icon={<RayIcon />} />
        <Separator orientation="horizontal" width="100%" />
        <DrawingToolButton tool="channel" label={t('chart.tools.channel')} icon={<ChannelIcon />} />
        <DrawingToolButton tool="rectangle" label={t('chart.tools.rectangle')} icon={<RectangleIcon />} />
        <DrawingToolButton tool="ellipse" label={t('chart.tools.ellipse')} icon={<EllipseIcon />} />
        <DrawingToolButton tool="area" label={t('chart.tools.area')} icon={<AreaIcon />} />
        <Separator orientation="horizontal" width="100%" />
        <DrawingToolButton tool="fibonacci" label={t('chart.tools.fibonacci')} icon={<FibonacciIcon />} />
        <DrawingToolButton tool="priceRange" label={t('chart.tools.priceRange')} icon={<PriceRangeIcon />} />
        <DrawingToolButton tool="ruler" label={t('chart.tools.ruler')} icon={<RulerIcon />} />
        <DrawingToolButton tool="pitchfork" label={t('chart.tools.pitchfork')} icon={<PitchforkIcon />} />
        <DrawingToolButton tool="gannFan" label={t('chart.tools.gannFan')} icon={<GannFanIcon />} />
        <Separator orientation="horizontal" width="100%" />
        <DrawingToolButton tool="longPosition" label={t('chart.tools.longPosition')} icon={<LongPositionIcon />} />
        <DrawingToolButton tool="shortPosition" label={t('chart.tools.shortPosition')} icon={<ShortPositionIcon />} />
        <Separator orientation="horizontal" width="100%" />
        <DrawingToolButton tool="text" label={t('chart.tools.text')} icon={<TextIcon />} />
        <DrawingToolButton tool="anchoredVwap" label={t('chart.tools.anchoredVwap')} icon={<AnchoredVwapIcon />} />
        <Separator orientation="horizontal" width="100%" />
        <TooltipWrapper label={t('chart.tools.magnet')} showArrow placement="right">
          <ToggleIconButton
            active={magnetEnabled}
            size="2xs"
            aria-label={t('chart.tools.magnet')}
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
        <TooltipWrapper label={t('chart.controls.flip', { defaultValue: 'Flip chart (invert Y axis)' })} showArrow placement="right">
          <ToggleIconButton
            active={chartFlipped}
            size="2xs"
            aria-label={t('chart.controls.flip', { defaultValue: 'Flip chart' })}
            onClick={handleFlipToggle}
          >
            <LuFlipVertical2 />
          </ToggleIconButton>
        </TooltipWrapper>
      </VStack>
    </Box>
  );
});

ChartToolsToolbar.displayName = 'ChartToolsToolbar';
