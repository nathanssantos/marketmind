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
  RulerIcon,
  LongPositionIcon,
  ShortPositionIcon,
} from '@renderer/components/icons';
import {
  LuCalendarDays,
  LuFlipVertical2,
  LuMagnet,
} from 'react-icons/lu';


interface ChartToolButtonProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

/**
 * Canonical button for the vertical chart-tools toolbar. Tooltip placed
 * right-side (vertical-toolbar convention) + ToggleIconButton at size=2xs.
 * Used by `DrawingToolButton` (drawing tool selection) and the bottom-rail
 * toggles (magnet, tooltip, market events, flip) so all 26 buttons share
 * the same shape.
 */
const ChartToolButton = memo(({ active, label, icon, onClick }: ChartToolButtonProps) => (
  <TooltipWrapper label={label} showArrow placement="right">
    <ToggleIconButton
      active={active}
      size="2xs"
      aria-label={label}
      onClick={onClick}
    >
      {icon}
    </ToggleIconButton>
  </TooltipWrapper>
));

ChartToolButton.displayName = 'ChartToolButton';

const DrawingToolButton = memo(({ tool, label, icon }: { tool: DrawingType; label: string; icon: React.ReactNode }) => {
  const activeTool = useDrawingStore(s => s.activeTool);
  const setActiveTool = useDrawingStore(s => s.setActiveTool);

  return (
    <ChartToolButton
      active={activeTool === tool}
      label={label}
      icon={icon}
      onClick={() => setActiveTool(tool)}
    />
  );
});

DrawingToolButton.displayName = 'DrawingToolButton';

export const ChartToolsToolbar = memo(() => {
  const { t } = useTranslation();

  const [showEventRow, setShowEventRow] = useChartPref('showEventRow', false);
  const [chartFlipped, setChartFlipped] = useChartPref<boolean>('chartFlipped', false);

  const magnetEnabled = useDrawingStore(s => s.magnetEnabled);
  const setMagnetEnabled = useDrawingStore(s => s.setMagnetEnabled);

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
        <Separator orientation="horizontal" width="100%" />
        <ChartToolButton
          active={magnetEnabled}
          label={t('chart.tools.magnet')}
          icon={<LuMagnet />}
          onClick={handleMagnetToggle}
        />
        <Separator orientation="horizontal" width="100%" />
        <ChartToolButton
          active={showEventRow}
          label={t('chart.controls.marketEvents')}
          icon={<LuCalendarDays />}
          onClick={handleEventRowToggle}
        />
        <ChartToolButton
          active={chartFlipped}
          label={t('chart.controls.flip')}
          icon={<LuFlipVertical2 />}
          onClick={handleFlipToggle}
        />
      </VStack>
    </Box>
  );
});

ChartToolsToolbar.displayName = 'ChartToolsToolbar';
