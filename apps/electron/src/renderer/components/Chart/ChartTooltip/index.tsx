import { memo, type ReactElement } from 'react';
import { KlineTooltip } from './KlineTooltip';
import { MarketEventTooltip } from './MarketEventTooltip';
import { MeasurementTooltip } from './MeasurementTooltip';
import { MovingAverageTooltip } from './MovingAverageTooltip';
import { OrderTooltip } from './OrderTooltip';
import { SetupTooltip } from './SetupTooltip';
import type { ChartTooltipProps } from './types';
import { TOOLTIP_CONFIG } from './types';
import { useTooltipPosition } from './useTooltipPosition';

export type { ChartTooltipProps } from './types';

export const ChartTooltip = memo(({
  kline,
  x,
  y,
  visible,
  containerWidth = window.innerWidth,
  containerHeight = window.innerHeight,
  movingAverage,
  measurement,
  order,
  currentPrice,
  setup,
  marketEvent,
}: ChartTooltipProps): ReactElement | null => {
  const tooltipHeight = measurement ? TOOLTIP_CONFIG.heightMeasurement : TOOLTIP_CONFIG.heightDefault;

  const { left, top } = useTooltipPosition({
    x,
    y,
    containerWidth,
    containerHeight,
    tooltipHeight,
  });

  if (!visible || (!kline && !movingAverage && !measurement && !order && !setup && !marketEvent)) {
    return null;
  }

  if (measurement) {
    return <MeasurementTooltip measurement={measurement} kline={kline} left={left} top={top} />;
  }

  if (order) {
    return <OrderTooltip order={order} currentPrice={currentPrice} left={left} top={top} />;
  }

  if (movingAverage) {
    return <MovingAverageTooltip movingAverage={movingAverage} kline={kline} left={left} top={top} />;
  }

  if (setup) {
    return <SetupTooltip setup={setup} left={left} top={top} />;
  }

  if (marketEvent) {
    return <MarketEventTooltip marketEvent={marketEvent} left={left} top={top} />;
  }

  if (kline) {
    return <KlineTooltip kline={kline} left={left} top={top} />;
  }

  return null;
});

ChartTooltip.displayName = 'ChartTooltip';
