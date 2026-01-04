export interface TooltipPositionOptions {
  x: number;
  y: number;
  tooltipWidth: number;
  tooltipHeight: number;
  containerWidth: number;
  containerHeight: number;
  offset?: number;
}

export interface TooltipPosition {
  left: number;
  top: number;
}

export const calculateTooltipPosition = ({
  x,
  y,
  tooltipWidth,
  tooltipHeight,
  containerWidth,
  containerHeight,
  offset = 10,
}: TooltipPositionOptions): TooltipPosition => {
  let left = x + offset;
  let top = y + offset;

  if (left + tooltipWidth > containerWidth) {
    left = x - tooltipWidth - offset;
  }

  if (top + tooltipHeight > containerHeight) {
    top = y - tooltipHeight - offset;
  }

  if (left < 0) {
    left = offset;
  }

  if (top < 0) {
    top = offset;
  }

  return { left, top };
};
