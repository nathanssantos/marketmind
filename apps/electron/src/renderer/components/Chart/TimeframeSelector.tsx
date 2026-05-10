import { Button, Popover, PopoverActionItem, PopoverList } from '@renderer/components/ui';
import type { TimeInterval } from '@marketmind/types';
import { UI_INTERVALS } from '@marketmind/types';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuClock } from 'react-icons/lu';

export type Timeframe = TimeInterval;

export interface TimeframeSelectorProps {
  selectedTimeframe: TimeInterval;
  onTimeframeChange: (timeframe: TimeInterval) => void;
}

export const TimeframeSelector = ({
  selectedTimeframe,
  onTimeframeChange,
}: TimeframeSelectorProps): ReactElement => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (timeframe: TimeInterval) => {
    onTimeframeChange(timeframe);
    setIsOpen(false);
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(e) => setIsOpen(e.open)}
      showArrow={false}
      width="200px"
      positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
      trigger={
        <Button
          aria-label={t('chart.controls.timeframe')}
          size="2xs"
          variant="outline"
          color="fg.muted"
          fontWeight="medium"
          gap={1.5}
        >
          <LuClock />
          {selectedTimeframe}
        </Button>
      }
    >
      <PopoverList maxH="300px">
        {UI_INTERVALS.map((timeframe) => (
          <PopoverActionItem
            key={timeframe}
            label={timeframe}
            active={selectedTimeframe === timeframe}
            onClick={() => handleSelect(timeframe)}
          />
        ))}
      </PopoverList>
    </Popover>
  );
};
