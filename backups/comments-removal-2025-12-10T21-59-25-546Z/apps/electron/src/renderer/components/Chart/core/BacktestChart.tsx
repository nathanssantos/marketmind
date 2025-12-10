import { Box, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import type { Kline } from '@marketmind/types';
import { useCallback, useState } from 'react';
import { FaPause, FaPlay, FaStepBackward, FaStepForward } from 'react-icons/fa';
import { useBacktestPlayback, type PlaybackSpeed } from '../hooks/useBacktestPlayback';
import { useChartData } from '../hooks/useChartData';
import { useChartLayers } from '../hooks/useChartLayers';
import { useChartViewport } from '../hooks/useChartViewport';
import { LayeredCanvas, useLayerManager } from './LayeredCanvas';

export interface BacktestChartProps {
    klines: Kline[];
    trades: any[];
    width?: number;
    height?: number;
    showEquityCurve?: boolean;
    playbackSpeed?: number;
    autoPlay?: boolean;
    onProgress?: (index: number) => void;
    markers?: {
        showEntry?: boolean;
        showExit?: boolean;
        showSL?: boolean;
        showTP?: boolean;
    };
}

export const BacktestChart = ({
    klines,
    trades,
    width = 1000,
    height = 600,
    showEquityCurve = true,
    playbackSpeed = 1,
    autoPlay = false,
    onProgress,
}: BacktestChartProps) => {
    const colors = useChartColors();
    const { setManager } = useLayerManager();
    const [equityCurveHeight] = useState(100);

    const {
        currentIndex,
        state,
        play,
        pause,
        stepForward,
        stepBackward,
        setSpeed,
    } = useBacktestPlayback({
        totalKlines: klines.length,
        defaultSpeed: playbackSpeed as PlaybackSpeed,
        autoPlay,
        onIndexChange: onProgress,
    });

    const isPlaying = state === 'playing';

    const visibleKlines = klines.slice(0, currentIndex + 1);
    const currentKline = klines[currentIndex];
    const visibleTrades = currentKline ? trades.filter(
        (t) =>
            t.entryTime <= currentKline.closeTime &&
            t.exitTime &&
            t.exitTime <= currentKline.closeTime
    ) : [];

    const { viewport } = useChartViewport({
        klines: visibleKlines,
        width,
        height: showEquityCurve ? height - equityCurveHeight : height,
    });

    const { visibleData } = useChartData({
        klines: visibleKlines,
        viewport,
    });

    // Trade visualization removed - not needed for backtest chart

    const layers = useChartLayers({
        klines: visibleData,
        viewport,
        theme: colors,
        showGrid: true,
        showVolume: true,
        showIndicators: true,
    });

    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    }, [isPlaying, play, pause]);

    const handleSpeedChange = useCallback(
        (newSpeed: number) => {
            setSpeed(newSpeed as PlaybackSpeed);
        },
        [setSpeed]
    );

    const calculateEquityCurve = useCallback(() => {
        let equity = 10000;
        return visibleTrades.map((trade) => {
            equity += trade.profit || 0;
            return equity;
        });
    }, [visibleTrades]);

    const equityCurve = calculateEquityCurve();

    return (
        <VStack gap={0} width={width} align="stretch">
            <Box position="relative" width={width} height={height}>
                <LayeredCanvas
                    width={width}
                    height={showEquityCurve ? height - equityCurveHeight : height}
                    viewport={viewport}
                    layers={layers}
                    onLayerManagerReady={setManager}
                />
            </Box>

            {showEquityCurve && (
                <Box
                    width={width}
                    height={equityCurveHeight}
                    bg="gray.800"
                    borderTop="1px solid"
                    borderColor="gray.700"
                    position="relative"
                >
                    <canvas
                        width={width}
                        height={equityCurveHeight}
                        style={{ display: 'block' }}
                        ref={(canvas) => {
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d');
                            if (!ctx || equityCurve.length === 0) return;

                            ctx.clearRect(0, 0, width, equityCurveHeight);

                            const minEquity = Math.min(...equityCurve, 10000);
                            const maxEquity = Math.max(...equityCurve, 10000);
                            const range = maxEquity - minEquity || 1;

                            ctx.strokeStyle = '#00ff00';
                            ctx.lineWidth = 2;
                            ctx.beginPath();

                            equityCurve.forEach((equity, i) => {
                                const x = (i / equityCurve.length) * width;
                                const y =
                                    equityCurveHeight -
                                    ((equity - minEquity) / range) * (equityCurveHeight - 20) -
                                    10;

                                if (i === 0) {
                                    ctx.moveTo(x, y);
                                } else {
                                    ctx.lineTo(x, y);
                                }
                            });

                            ctx.stroke();

                            ctx.strokeStyle = '#666';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            const baselineY =
                                equityCurveHeight -
                                ((10000 - minEquity) / range) * (equityCurveHeight - 20) -
                                10;
                            ctx.moveTo(0, baselineY);
                            ctx.lineTo(width, baselineY);
                            ctx.stroke();
                        }}
                    />
                    <Text
                        position="absolute"
                        top={2}
                        right={4}
                        fontSize="xs"
                        color="green.400"
                    >
                        Equity: $
                        {equityCurve.length > 0
                            ? equityCurve[equityCurve.length - 1]?.toFixed(2) ?? '10000.00'
                            : '10000.00'}
                    </Text>
                </Box>
            )}

            <HStack
                gap={4}
                p={3}
                bg="gray.800"
                borderTop="1px solid"
                borderColor="gray.700"
                justify="space-between"
            >
                <HStack gap={2}>
                    <IconButton
                        aria-label="Step backward"
                        size="sm"
                        onClick={stepBackward}
                        disabled={currentIndex === 0}
                    >
                        <FaStepBackward />
                    </IconButton>
                    <IconButton
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        size="sm"
                        onClick={handlePlayPause}
                    >
                        {isPlaying ? <FaPause /> : <FaPlay />}
                    </IconButton>
                    <IconButton
                        aria-label="Step forward"
                        size="sm"
                        onClick={stepForward}
                        disabled={currentIndex >= klines.length - 1}
                    >
                        <FaStepForward />
                    </IconButton>
                </HStack>

                <HStack gap={2}>
                    <Text fontSize="sm">
                        Kline {currentIndex + 1} / {klines.length}
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                        |
                    </Text>
                    <Text fontSize="sm">Trades: {visibleTrades.length}</Text>
                </HStack>

                <HStack gap={2}>
                    <Text fontSize="sm">Speed:</Text>
                    {[0.5, 1, 2, 5, 10].map((speed) => (
                        <Box
                            key={speed}
                            as="button"
                            px={2}
                            py={1}
                            fontSize="xs"
                            borderRadius="md"
                            bg={playbackSpeed === speed ? 'blue.600' : 'gray.700'}
                            _hover={{ bg: 'blue.500' }}
                            onClick={() => handleSpeedChange(speed)}
                        >
                            {speed}x
                        </Box>
                    ))}
                </HStack>
            </HStack>
        </VStack>
    );
};
