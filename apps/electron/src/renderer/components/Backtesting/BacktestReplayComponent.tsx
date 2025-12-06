/**
 * Backtest Replay Component
 * 
 * Provides interactive candle-by-candle replay of backtest results:
 * - Play/Pause/Step controls
 * - Speed adjustment (1x, 2x, 5x, 10x)
 * - Visual trade markers (entry/exit)
 * - Real-time metrics update
 * - Jump to specific dates
 * 
 * References:
 * - Interactive visualization best practices
 * - TradingView-style replay functionality
 */

import { Box, Button, HStack, Text, VStack } from '@chakra-ui/react';
import type { Kline } from '@marketmind/types';
import type { BacktestResult, BacktestTrade } from '@marketmind/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface BacktestReplayProps {
    result: BacktestResult;
    klines: Kline[];
    onCurrentIndexChange?: (index: number) => void;
    onTradeHighlight?: (trade: BacktestTrade | null) => void;
}

type PlaybackSpeed = 1 | 2 | 5 | 10;

export const BacktestReplayComponent = ({
    result,
    klines,
    onCurrentIndexChange,
    onTradeHighlight,
}: BacktestReplayProps) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState<PlaybackSpeed>(1);
    const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

    const currentKline = klines[currentIndex];
    const currentDate = currentKline ? new Date(currentKline.openTime) : null;

    const visibleTrades = result.trades.filter((trade) => {
        const entryTime = new Date(trade.entryTime).getTime();
        const currentTime = currentKline?.openTime || 0;
        return entryTime <= currentTime;
    });

    const activeTrade = visibleTrades.find((trade) => {
        const entryTime = new Date(trade.entryTime).getTime();
        const exitTime = trade.exitTime ? new Date(trade.exitTime).getTime() : Infinity;
        const currentTime = currentKline?.openTime || 0;
        return entryTime <= currentTime && exitTime > currentTime;
    });

    const calculateCurrentMetrics = useCallback(() => {
        const completedTrades = visibleTrades.filter((trade) => {
            if (!trade.exitTime) return false;
            const exitTime = new Date(trade.exitTime).getTime();
            const currentTime = currentKline?.openTime || 0;
            return exitTime <= currentTime;
        });

        if (completedTrades.length === 0) {
            return {
                totalTrades: 0,
                winningTrades: 0,
                losingTrades: 0,
                winRate: 0,
                totalPnL: 0,
                currentEquity: result.config.initialCapital,
            };
        }

        const winningTrades = completedTrades.filter((t) => (t.pnl ?? 0) > 0).length;
        const losingTrades = completedTrades.filter((t) => (t.pnl ?? 0) <= 0).length;
        const totalPnL = completedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

        return {
            totalTrades: completedTrades.length,
            winningTrades,
            losingTrades,
            winRate: winningTrades / completedTrades.length,
            totalPnL,
            currentEquity: result.config.initialCapital + totalPnL,
        };
    }, [currentIndex, visibleTrades, currentKline, result.config.initialCapital]);

    const currentMetrics = calculateCurrentMetrics();

    const handlePlay = useCallback(() => {
        setIsPlaying(true);
    }, []);

    const handlePause = useCallback(() => {
        setIsPlaying(false);
    }, []);

    const handleStep = useCallback(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, klines.length - 1));
    }, [klines.length]);

    const handleStepBack = useCallback(() => {
        setCurrentIndex((prev) => Math.max(prev - 1, 0));
    }, []);

    const handleReset = useCallback(() => {
        setCurrentIndex(0);
        setIsPlaying(false);
    }, []);

    const handleSpeedChange = useCallback((newSpeed: PlaybackSpeed) => {
        setSpeed(newSpeed);
    }, []);

    const handleSliderChange = useCallback((value: number) => {
        setCurrentIndex(value);
        setIsPlaying(false);
    }, []);

    useEffect(() => {
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                setCurrentIndex((prev) => {
                    if (prev >= klines.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000 / speed);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isPlaying, speed, klines.length]);

    useEffect(() => {
        onCurrentIndexChange?.(currentIndex);
    }, [currentIndex, onCurrentIndexChange]);

    useEffect(() => {
        onTradeHighlight?.(activeTrade || null);
    }, [activeTrade, onTradeHighlight]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const formatPercentage = (value: number) => {
        return `${(value * 100).toFixed(2)}%`;
    };

    const formatDate = (date: Date | null) => {
        if (!date) return 'N/A';
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    return (
        <VStack gap={4} align="stretch" p={4} bg="gray.50" borderRadius="md">
            <HStack justify="space-between">
                <Text fontSize="lg" fontWeight="bold">
                    Backtest Replay
                </Text>
                <Text fontSize="sm" color="gray.600">
                    {formatDate(currentDate)}
                </Text>
            </HStack>

            <HStack gap={2} justify="center">
                <Button
                    aria-label="Reset"
                    onClick={handleReset}
                    size="sm"
                >
                    ⏮
                </Button>

                <Button
                    aria-label="Step back"
                    onClick={handleStepBack}
                    disabled={currentIndex === 0}
                    size="sm"
                >
                    ⏪
                </Button>

                {isPlaying ? (
                    <Button
                        aria-label="Pause"
                        onClick={handlePause}
                        size="md"
                        colorScheme="orange"
                    >
                        ⏸
                    </Button>
                ) : (
                    <Button
                        aria-label="Play"
                        onClick={handlePlay}
                        disabled={currentIndex >= klines.length - 1}
                        size="md"
                        colorScheme="green"
                    >
                        ▶
                    </Button>
                )}

                <Button
                    aria-label="Step forward"
                    onClick={handleStep}
                    disabled={currentIndex >= klines.length - 1}
                    size="sm"
                >
                    ⏩
                </Button>
            </HStack>

            <Box>
                <HStack justify="space-between" mb={2}>
                    <Text fontSize="xs" color="gray.600">
                        Candle {currentIndex + 1} of {klines.length}
                    </Text>
                    <HStack gap={2}>
                        {([1, 2, 5, 10] as PlaybackSpeed[]).map((s) => (
                            <Button
                                key={s}
                                size="xs"
                                variant={speed === s ? 'solid' : 'outline'}
                                colorScheme={speed === s ? 'blue' : 'gray'}
                                onClick={() => handleSpeedChange(s)}
                            >
                                {s}x
                            </Button>
                        ))}
                    </HStack>
                </HStack>

                <input
                    type="range"
                    value={currentIndex}
                    min={0}
                    max={klines.length - 1}
                    onChange={(e) => handleSliderChange(Number(e.target.value))}
                    style={{ width: '100%' }}
                    aria-label="Progress slider"
                />
            </Box>

            <VStack gap={2} align="stretch" bg="white" p={3} borderRadius="md">
                <HStack justify="space-between">
                    <Text fontSize="sm" fontWeight="semibold">Current Metrics</Text>
                    {activeTrade && (
                        <Text fontSize="xs" color="orange.600" fontWeight="bold">
                            📊 Active Trade
                        </Text>
                    )}
                </HStack>

                <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.600">Equity:</Text>
                    <Text fontSize="sm" fontWeight="bold" color={currentMetrics.totalPnL >= 0 ? 'green.600' : 'red.600'}>
                        {formatCurrency(currentMetrics.currentEquity)}
                    </Text>
                </HStack>

                <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.600">Total P&L:</Text>
                    <Text fontSize="sm" fontWeight="bold" color={currentMetrics.totalPnL >= 0 ? 'green.600' : 'red.600'}>
                        {formatCurrency(currentMetrics.totalPnL)}
                    </Text>
                </HStack>

                <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.600">Total Trades:</Text>
                    <Text fontSize="sm">{currentMetrics.totalTrades}</Text>
                </HStack>

                <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.600">Win Rate:</Text>
                    <Text fontSize="sm" color={currentMetrics.winRate >= 0.5 ? 'green.600' : 'red.600'}>
                        {formatPercentage(currentMetrics.winRate)}
                    </Text>
                </HStack>

                <HStack justify="space-between">
                    <Text fontSize="xs" color="gray.600">W/L:</Text>
                    <Text fontSize="sm">
                        {currentMetrics.winningTrades}/{currentMetrics.losingTrades}
                    </Text>
                </HStack>
            </VStack>

            {activeTrade && (
                <VStack gap={2} align="stretch" bg="orange.50" p={3} borderRadius="md" borderLeft="4px solid" borderColor="orange.500">
                    <Text fontSize="sm" fontWeight="semibold" color="orange.800">
                        Active Trade Details
                    </Text>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.600">Setup:</Text>
                        <Text fontSize="sm" fontWeight="medium">{activeTrade.setupType || 'N/A'}</Text>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.600">Side:</Text>
                        <Text fontSize="sm" fontWeight="medium" color={activeTrade.side === 'LONG' ? 'green.600' : 'red.600'}>
                            {activeTrade.side}
                        </Text>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.600">Entry:</Text>
                        <Text fontSize="sm">{formatCurrency(activeTrade.entryPrice)}</Text>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.600">Entry Time:</Text>
                        <Text fontSize="xs">{formatDate(new Date(activeTrade.entryTime))}</Text>
                    </HStack>
                    <HStack justify="space-between">
                        <Text fontSize="xs" color="gray.600">Quantity:</Text>
                        <Text fontSize="sm">{activeTrade.quantity.toFixed(4)}</Text>
                    </HStack>
                </VStack>
            )}
        </VStack>
    );
};
