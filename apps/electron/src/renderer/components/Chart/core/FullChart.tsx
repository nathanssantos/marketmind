import { Box } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import type { Kline, Order, Trade } from '@shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    trades?: Trade[];
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

/**
 * FullChart - Complete production trading chart with all features
 * 
 * This is the main chart component for the trading interface.
 * It uses LayeredCanvas for optimized rendering performance.
 * 
 * Features:
 * - Multi-layer canvas rendering (6 layers)
 * - Real-time updates
 * - Interactive controls (zoom, pan)
 * - Trade and order visualization
 * - Setup detection markers
 * - Tooltips and crosshair
 */
export const FullChart = ({
    symbol,
    timeframe,
    klines,
    trades = [],
    orders = [],
    liveData = true,
    tradingEnabled = true,
    setupDetection = true,
    width = 1200,
    height = 600,
    showVolume = true,
    showGrid = true,
    showIndicators = true,
    showOrders = true,
    showTrades = true,
    onKlineClick,
    onOrderClick,
}: FullChartProps) => {
    const colors = useChartColors();
    const containerRef = useRef<HTMLDivElement>(null);
    const { setManager, markDirty } = useLayerManager();
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
        paddingTop: 40,
        paddingBottom: 40,
        paddingLeft: 10,
        paddingRight: 10,
    });
    const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>(timeframe as Timeframe);

    const { viewport, zoomIn, zoomOut, panLeft, panRight, reset } = useChartViewport({
        klines,
        width,
        height,
    });

    const { visibleData } = useChartData({
        klines,
        viewport,
    });

    const { mousePosition, isDragging, isHovering } = useChartInteraction({
        canvasRef: containerRef,
        viewport,
        onZoom: (delta) => (delta > 0 ? zoomIn() : zoomOut()),
        onPan: (deltaX) => (deltaX > 0 ? panLeft() : panRight()),
    });

    const { tradeMarkers, slLines, tpLines } = useTradeVisualization({
        trades: showTrades ? trades : [],
        klines: visibleData,
        viewport,
        showEntry: true,
        showExit: true,
        showSL: true,
        showTP: true,
    });

    const layers = useChartLayers({
        klines: visibleData,
        viewport,
        theme: colors,
        showGrid,
        showVolume,
        showIndicators,
        tradeMarkers: showTrades ? tradeMarkers : [],
        slLines: showTrades ? slLines : [],
        tpLines: showTrades ? tpLines : [],
        orders: showOrders ? orders : [],
        mousePosition,
    });

    // Update hovered kline based on mouse position
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

    const handleKlineClick = useCallback(
        (kline: Kline, index: number) => {
            onKlineClick?.(kline, index);
        },
        [onKlineClick]
    );

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
