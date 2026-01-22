import { useMemo } from 'react';
import { TOOLTIP_CONFIG, type TooltipPositionProps } from './types';

interface UseTooltipPositionOptions extends TooltipPositionProps {
  tooltipHeight?: number;
}

export const useTooltipPosition = ({
  x,
  y,
  containerWidth = window.innerWidth,
  containerHeight = window.innerHeight,
  tooltipHeight = TOOLTIP_CONFIG.heightDefault,
}: UseTooltipPositionOptions) => {
  return useMemo(() => {
    const { width: tooltipWidth, offset } = TOOLTIP_CONFIG;

    let leftPos = x + offset;
    let topPos = y + offset;

    if (leftPos + tooltipWidth > containerWidth) {
      leftPos = x - tooltipWidth - offset;
    }

    if (topPos + tooltipHeight > containerHeight) {
      topPos = y - tooltipHeight - offset;
    }

    if (leftPos < 0) {
      leftPos = offset;
    }

    if (topPos < 0) {
      topPos = offset;
    }

    return { left: leftPos, top: topPos };
  }, [x, y, containerWidth, containerHeight, tooltipHeight]);
};
