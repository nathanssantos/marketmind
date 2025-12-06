import { Box, HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import type { Kline, Trade } from '@shared/types';
import { useCallback, useState } from 'react';
import { FaPause, FaPlay, FaStepBackward, FaStepForward } from 'react-icons/fa';
import { useBacktestPlayback } from '../hooks/useBacktestPlayback';
import { useChartData } from '../hooks/useChartData';
import { useChartLayers } from '../hooks/useChartLayers';
import { useChartViewport } from '../hooks/useChartViewport';
import { useTradeVisualization } from '../hooks/useTradeVisualization';
import { LayeredCanvas, useLayerManager } from './LayeredCanvas';

export interface BacktestChartProps {
    klines: Kline[];
    trades: Trade[];
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
    markers = {
        showEntry: true,
        showExit: true,
        showSL: true,
        showTP: true,
    },
}: BacktestChartProps) => {
    const colors = useChartColors();
    const { setManager, markDirty } = useLayerManager();
    const [equityCurveHeight] = useState(100);

    const {
        currentIndex,
        isPlaying,
        play,
        pause,
        stepForward,
        stepBackward,
        reset,
        setSpeed,
    } = useBacktestPlayback({
        totalKlines: klines.length,
        speed: playbackSpeed,
        autoPlay,
        onProgress,
    });

    const visibleKlines = klines.slice(0, currentIndex + 1);
    const visibleTrades = trades.filter(
        (t) =>
            t.entryTime <= klines[currentIndex]?.closeTime &&
            t.exitTime &&
            t.exitTime <= klines[currentIndex]?.closeTime
    );

    const { viewport, zoomIn, zoomOut, panLeft, panRight } = useChartViewport({
        klines: visibleKlines,
        width,
        height: showEquityCurve ? height - equityCurveHeight : height,
    });

    const { visibleData } = useChartData({
        klines: visibleKlines,
        viewport,
    });

    const { tradeMarkers, slLines, tpLines } = useTradeVisualization({
        trades: visibleTrades,
        klines: visibleKlines,
        viewport,
        showEntry: markers.showEntry,
        showExit: markers.showExit,
        showSL: markers.showSL,
        showTP: markers.showTP,
    });

    const layers = useChartLayers({
        klines: visibleData,
        viewport,
        theme: colors,
        showGrid: true,
        showVolume: true,
        showIndicators: true,
        tradeMarkers,
        slLines,
        tpLines,
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
            setSpeed(newSpeed);
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
        <VStack spacing={0} width={width} align="stretch">
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
                            ? equityCurve[equityCurve.length - 1].toFixed(2)
                            : '10000.00'}
                    </Text>
                </Box>
            )}

            <HStack
                spacing={4}
                p={3}
                bg="gray.800"
                borderTop="1px solid"
                borderColor="gray.700"
                justify="space-between"
            >
                <HStack spacing={2}>
                    <IconButton
                        aria-label="Step backward"
                        icon={<FaStepBackward />}
                        size="sm"
                        onClick={stepBackward}
                        isDisabled={currentIndex === 0}
                    />
                    <IconButton
                        aria-label={isPlaying ? 'Pause' : 'Play'}
                        icon={isPlaying ? <FaPause /> : <FaPlay />}
                        size="sm"
                        onClick={handlePlayPause}
                        colorScheme={isPlaying ? 'red' : 'green'}
                    />
                    <IconButton
                        aria-label="Step forward"
                        icon={<FaStepForward />}
                        size="sm"
                        onClick={stepForward}
                        isDisabled={currentIndex >= klines.length - 1}
                    />
                </HStack>

                <HStack spacing={2}>
                    <Text fontSize="sm">
                        Kline {currentIndex + 1} / {klines.length}
                    </Text>
                    <Text fontSize="sm" color="gray.400">
                        |
                    </Text>
                    <Text fontSize="sm">Trades: {visibleTrades.length}</Text>
                </HStack>

                <HStack spacing={2}>
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
