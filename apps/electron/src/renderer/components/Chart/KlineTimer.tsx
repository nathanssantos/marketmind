import { Box } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { CHART_CONFIG } from '@shared/constants';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export interface KlineTimerProps {
    timeframe: string;
    lastKlineTime?: number | undefined;
    stochasticPanelHeight?: number;
    rsiPanelHeight?: number;
}

const TIMEFRAME_MINUTES: Record<string, number> = {
    '1m': 1,
    '3m': 3,
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '2h': 120,
    '4h': 240,
    '6h': 360,
    '8h': 480,
    '12h': 720,
    '1d': 1440,
    '3d': 4320,
    '1w': 10080,
    '1M': 43200,
};

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

export const KlineTimer = ({ timeframe, lastKlineTime, stochasticPanelHeight = 0, rsiPanelHeight = 0 }: KlineTimerProps): ReactElement | null => {
    const colors = useChartColors();
    const [timeRemaining, setTimeRemaining] = useState<number>(0);

    useEffect(() => {
        const intervalMinutes = TIMEFRAME_MINUTES[timeframe];
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

    if (!TIMEFRAME_MINUTES[timeframe] || !lastKlineTime) {
        return null;
    }

    const intervalMinutes = TIMEFRAME_MINUTES[timeframe] ?? 60;
    const isShortTimeframe = intervalMinutes <= 60;
    const hours = Math.floor(timeRemaining / 3600);
    const fontSize = isShortTimeframe ? '15px' : hours >= 10 ? '9px' : '11px';

    return (
        <Box
            position="absolute"
            bottom={`${8 + stochasticPanelHeight + rsiPanelHeight}px`}
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
