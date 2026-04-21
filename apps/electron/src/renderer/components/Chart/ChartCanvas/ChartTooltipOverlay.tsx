import { ChartTooltip } from '../ChartTooltip';
import { useTooltipData } from './tooltipStore';

interface ChartTooltipOverlayProps {
  enabled: boolean;
}

export const ChartTooltipOverlay = ({ enabled }: ChartTooltipOverlayProps) => {
  const tooltipData = useTooltipData();
  if (!enabled) return null;
  return (
    <ChartTooltip
      kline={tooltipData.kline}
      x={tooltipData.x}
      y={tooltipData.y}
      visible={tooltipData.visible}
      containerWidth={tooltipData.containerWidth ?? window.innerWidth}
      containerHeight={tooltipData.containerHeight ?? window.innerHeight}
      {...(tooltipData.movingAverage && { movingAverage: tooltipData.movingAverage })}
      {...(tooltipData.measurement && { measurement: tooltipData.measurement })}
      {...(tooltipData.order && { order: tooltipData.order })}
      {...(tooltipData.currentPrice && { currentPrice: tooltipData.currentPrice })}
      {...(tooltipData.setup && { setup: tooltipData.setup })}
      {...(tooltipData.marketEvent && { marketEvent: tooltipData.marketEvent })}
    />
  );
};
