import { Box } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export interface CandleTimerProps {
    timeframe: string;
    lastCandleTime?: number | undefined;
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

export const CandleTimer = ({ timeframe, lastCandleTime }: CandleTimerProps): ReactElement | null => {
    const colors = useChartColors();
    const [timeRemaining, setTimeRemaining] = useState<number>(0);

    useEffect(() => {
        const intervalMinutes = TIMEFRAME_MINUTES[timeframe];
        if (!intervalMinutes || !lastCandleTime) {
            setTimeRemaining(0);
            return;
        }

        const updateTimer = (): void => {
            const now = Date.now();
            const nextCandleTime = lastCandleTime + (intervalMinutes * 60 * 1000);
            const remaining = Math.max(0, Math.floor((nextCandleTime - now) / 1000));
            setTimeRemaining(remaining);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [timeframe, lastCandleTime]);

    if (!TIMEFRAME_MINUTES[timeframe] || !lastCandleTime) {
        return null;
    }

    return (
        <Box
            position="absolute"
            bottom="8px"
            right="15px"
            color={colors.axisLabel}
            fontSize="11px"
            fontFamily="monospace"
            fontWeight="normal"
            zIndex={10}
            userSelect="none"
        >
            {formatTime(timeRemaining)}
        </Box>
    );
};
