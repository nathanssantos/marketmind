import type { TimeInterval } from '@marketmind/types';
import { INTERVAL_MINUTES } from '@marketmind/types';
import { Box } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { CHART_CONFIG } from '@shared/constants';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export interface KlineTimerProps {
    timeframe: string;
    lastKlineTime?: number | undefined;
    totalPanelHeight?: number;
}

const formatTime = (seconds: number): string => {
    if (seconds < 0) return '00:00';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const KlineTimer = ({ timeframe, lastKlineTime, totalPanelHeight = 0 }: KlineTimerProps): ReactElement | null => {
    const colors = useChartColors();
    const [timeRemaining, setTimeRemaining] = useState<number>(0);

    useEffect(() => {
        const intervalMinutes = INTERVAL_MINUTES[timeframe as TimeInterval];
        if (!intervalMinutes || !lastKlineTime) {
            setTimeRemaining(0);
            return;
        }

        const updateTimer = (): void => {
            const now = Date.now();
            const nextKlineTime = lastKlineTime + (intervalMinutes * 60 * 1000);
            const remaining = Math.max(0, Math.floor((nextKlineTime - now) / 1000));

            if (remaining === 0) {
                const periodsElapsed = Math.floor((now - lastKlineTime) / (intervalMinutes * 60 * 1000));
                if (periodsElapsed > 0) {
                    const adjustedNextKlineTime = lastKlineTime + ((periodsElapsed + 1) * intervalMinutes * 60 * 1000);
                    const adjustedRemaining = Math.max(0, Math.floor((adjustedNextKlineTime - now) / 1000));
                    setTimeRemaining(adjustedRemaining);
                    return;
                }
            }

            setTimeRemaining(remaining);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [timeframe, lastKlineTime]);

    if (!INTERVAL_MINUTES[timeframe as TimeInterval] || !lastKlineTime) {
        return null;
    }

    const intervalMinutes = INTERVAL_MINUTES[timeframe as TimeInterval] ?? 60;
    const isShortTimeframe = intervalMinutes <= 60;
    const hours = Math.floor(timeRemaining / 3600);
    const fontSize = isShortTimeframe ? '15px' : hours >= 10 ? '9px' : '11px';

    return (
        <Box
            position="absolute"
            bottom={`${8 + totalPanelHeight}px`}
            right={0}
            width={`${CHART_CONFIG.CANVAS_PADDING_RIGHT}px`}
            textAlign="center"
            color={colors.axisLabel}
            fontSize={fontSize}
            fontFamily="monospace"
            fontWeight="600"
            zIndex={10}
            userSelect="none"
        >
            {formatTime(timeRemaining)}
        </Box>
    );
};
