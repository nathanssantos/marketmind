import { Box } from '@chakra-ui/react';
import type { Kline, Order } from '@marketmind/types';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { useEffect, useRef, useState } from 'react';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import { ChartControls } from '../ChartControls';
import { ChartTooltip } from '../ChartTooltip';
import { useChartData } from '../hooks/useChartData';
import { useChartInteraction } from '../hooks/useChartInteraction';
import { useChartLayers } from '../hooks/useChartLayers';
import { useChartViewport } from '../hooks/useChartViewport';
import { useTradeVisualization } from '../hooks/useTradeVisualization';
import type { Timeframe } from '../TimeframeSelector';
import type { MovingAverageConfig } from '../useMovingAverageRenderer';
import { LayeredCanvas, useLayerManager } from './LayeredCanvas';

export interface FullChartProps {
    symbol: string;
    timeframe: string;
    klines: Kline[];
    trades?: any[];
    orders?: Order[];
    liveData?: boolean;
    tradingEnabled?: boolean;
    setupDetection?: boolean;
    width?: number;
    height?: number;
    showVolume?: boolean;
    showGrid?: boolean;
    showIndicators?: boolean;
    showOrders?: boolean;
    showTrades?: boolean;
    onKlineClick?: (kline: Kline, index: number) => void;
    onOrderClick?: (order: Order) => void;
}

export const FullChart = ({
    timeframe,
    klines,
    trades = [],
    orders = [],
    width = 1200,
    height = 600,
    showVolume = true,
    showGrid = true,
    showIndicators = true,
    showOrders = true,
    showTrades = true,
}: FullChartProps) => {
    const colors = useChartColors();
    const containerRef = useRef<HTMLDivElement>(null);
    const { setManager } = useLayerManager();
    const [hoveredKline, setHoveredKline] = useState<Kline | null>(null);

    const [showVolumeState, setShowVolumeState] = useState(showVolume);
    const [showGridState, setShowGridState] = useState(showGrid);
    const [showCurrentPriceLine, setShowCurrentPriceLine] = useState(true);
    const [showCrosshair, setShowCrosshair] = useState(true);
    const [chartType, setChartType] = useState<'kline' | 'line'>('kline');
    const [movingAverages, setMovingAverages] = useState<MovingAverageConfig[]>([]);
    const [advancedConfig, setAdvancedConfig] = useState<AdvancedControlsConfig>({
        rightMargin: 100,
        volumeHeightRatio: 0.2,
        klineSpacing: 8,
        klineWickWidth: 1,
        gridLineWidth: 1,
        currentPriceLineWidth: 2,
        currentPriceLineStyle: 'solid' as const,
        paddingTop: 40,
        paddingBottom: 40,
        paddingLeft: 10,
        paddingRight: 10,
    });
    const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>(timeframe as Timeframe);

    const { viewport } = useChartViewport({
        klines,
        width,
        height,
    });

    const { visibleData } = useChartData({
        klines,
        viewport,
    });

    const { mousePosition } = useChartInteraction({
        canvasRef: containerRef as any,
        viewport: viewport as any,
        onZoom: (delta) => (delta > 0 ? undefined : undefined),
        onPan: (deltaX) => (deltaX > 0 ? undefined : undefined),
    });

    useTradeVisualization({
        trades: showTrades ? (trades ?? []) : [],
        viewport: {
            start: viewport.start,
            end: viewport.end,
            minPrice: viewport.priceMin,
            maxPrice: viewport.priceMax,
        },
        canvasWidth: width,
        canvasHeight: height,
        showStopLoss: true,
        showTakeProfit: true,
    });

    const layers = useChartLayers({
        klines: visibleData,
        viewport,
        theme: colors,
        showGrid,
        showVolume,
        showIndicators,
        orders: showOrders ? orders : [],
        mousePosition,
    });

    useEffect(() => {
        if (!mousePosition || !visibleData.length) {
            setHoveredKline(null);
            return;
        }

        const klineIndex = Math.floor(mousePosition.klineIndex);
        const kline = visibleData[klineIndex];

        if (kline) {
            setHoveredKline(kline);
        } else {
            setHoveredKline(null);
        }
    }, [mousePosition, visibleData]);

    return (
        <Box position="relative" width={width} height={height} ref={containerRef}>
            <LayeredCanvas
                width={width}
                height={height}
                viewport={viewport}
                layers={layers}
                onLayerManagerReady={setManager}
            />

            {/* Tooltip overlay */}
            {hoveredKline && mousePosition && (
                <ChartTooltip
                    kline={hoveredKline}
                    x={mousePosition.x}
                    y={mousePosition.y}
                    visible={true}
                />
            )}

            {/* Chart controls */}
            <ChartControls
                showVolume={showVolumeState}
                showGrid={showGridState}
                showCurrentPriceLine={showCurrentPriceLine}
                showCrosshair={showCrosshair}
                chartType={chartType}
                movingAverages={movingAverages}
                advancedConfig={advancedConfig}
                timeframe={currentTimeframe}
                onShowVolumeChange={setShowVolumeState}
                onShowGridChange={setShowGridState}
                onShowCurrentPriceLineChange={setShowCurrentPriceLine}
                onShowCrosshairChange={setShowCrosshair}
                onChartTypeChange={setChartType}
                onMovingAveragesChange={setMovingAverages}
                onAdvancedConfigChange={setAdvancedConfig}
                onTimeframeChange={setCurrentTimeframe}
            />
        </Box>
    );
};
