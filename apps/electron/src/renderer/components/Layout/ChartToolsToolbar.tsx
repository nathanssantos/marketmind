import { Box, HStack, IconButton } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuMessageSquare, LuRuler, LuScan } from 'react-icons/lu';
import { TooltipWrapper } from '../ui/Tooltip';

export interface ChartToolsToolbarProps {
  showMeasurementRuler: boolean;
  showMeasurementArea: boolean;
  showTooltip: boolean;
  onShowMeasurementRulerChange: (show: boolean) => void;
  onShowMeasurementAreaChange: (show: boolean) => void;
  onShowTooltipChange: (show: boolean) => void;
}

export const ChartToolsToolbar = memo(({
  showMeasurementRuler,
  showMeasurementArea,
  showTooltip,
  onShowMeasurementRulerChange,
  onShowMeasurementAreaChange,
  onShowTooltipChange,
}: ChartToolsToolbarProps) => {
  const { t } = useTranslation();

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
      </HStack>
    </Box>
  );
});

ChartToolsToolbar.displayName = 'ChartToolsToolbar';
