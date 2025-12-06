import { useChartColors } from '@renderer/hooks/useChartColors';
import type { Kline, Viewport } from '@shared/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSetupMarkerRenderer, type SetupMarker } from '../layers/AnnotationLayer';
import { createGridRenderer } from '../layers/GridLayer';
import { createIndicatorRenderer } from '../layers/IndicatorLayer';
import { createCrosshairRenderer } from '../layers/InteractionLayer';
import { createKlineRenderer } from '../layers/KlineLayer';
import type { LayerConfig } from './LayeredCanvas';
import { LayeredCanvas, useLayerManager } from './LayeredCanvas';

export interface MiniChartProps {
    klines: Kline[];
    trades?: Array<{
        entryIndex: number;
        entryPrice: number;
        exitIndex?: number;
        exitPrice?: number;
        direction: 'LONG' | 'SHORT';
        stopLoss?: number;
        takeProfit?: number;
    }>;
    width?: number;
    height?: number;
    showVolume?: boolean;
    showIndicators?: boolean;
    showGrid?: boolean;
    interactive?: boolean;
    movingAverages?: Array<{ period: number; color: string; type?: 'SMA' | 'EMA' }>;
    className?: string;
}

export const MiniChart = ({
    klines,
    trades = [],
    width = 600,
    height = 400,
    showIndicators = false,
    showGrid = true,
    interactive = false,
    movingAverages = [],
    className,
}: MiniChartProps) => {
    const colors = useChartColors();
    const { setManager, markDirty } = useLayerManager();
    const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);

    const viewport = useMemo<Viewport>(() => {
        if (klines.length === 0) {
            return {
                start: 0,
                end: 100,
                priceMin: 0,
                priceMax: 100,
                width,
                height,
                klineWidth: 2,
                klineSpacing: 1,
            };
        }

        const prices = klines.flatMap((k) => [Number(k.open), Number(k.high), Number(k.low), Number(k.close)]);
        const priceMin = Math.min(...prices);
        const priceMax = Math.max(...prices);
        const priceRange = priceMax - priceMin;

        const klineWidth = Math.max(1, width / klines.length * 0.7);
        const klineSpacing = Math.max(0.5, klineWidth * 0.2);

        return {
            start: 0,
            end: klines.length,
            priceMin: priceMin - priceRange * 0.05,
            priceMax: priceMax + priceRange * 0.05,
            width,
            height,
            klineWidth,
            klineSpacing,
        };
    }, [klines, width, height]);

    const setupMarkers = useMemo<SetupMarker[]>(() => {
        const markers: SetupMarker[] = [];

        trades.forEach((trade) => {
            markers.push({
                klineIndex: trade.entryIndex,
                price: trade.entryPrice,
                type: 'ENTRY',
                direction: trade.direction,
                label: 'Entry',
            });

            if (trade.exitIndex !== undefined && trade.exitPrice !== undefined) {
                markers.push({
                    klineIndex: trade.exitIndex,
                    price: trade.exitPrice,
                    type: 'EXIT',
                    direction: trade.direction,
                    label: 'Exit',
                });
            }

            if (trade.stopLoss !== undefined) {
                markers.push({
                    klineIndex: trade.entryIndex,
                    price: trade.stopLoss,
                    type: 'STOP_LOSS',
                    direction: trade.direction,
                    label: 'SL',
                });
            }

            if (trade.takeProfit !== undefined) {
                markers.push({
                    klineIndex: trade.entryIndex,
                    price: trade.takeProfit,
                    type: 'TAKE_PROFIT',
                    direction: trade.direction,
                    label: 'TP',
                });
            }
        });

        return markers;
    }, [trades]);

    const layers = useMemo<LayerConfig[]>(() => {
        const layerConfigs: LayerConfig[] = [];

        if (showGrid) {
            layerConfigs.push({
                id: 'grid',
                zIndex: 0,
                updateFrequency: 'static',
                renderer: createGridRenderer(klines, {}, colors),
            });
        }

        layerConfigs.push({
            id: 'klines',
            zIndex: 1,
            updateFrequency: 'medium',
            renderer: createKlineRenderer(klines, {}, colors),
        });

        if (showIndicators && movingAverages.length > 0) {
            layerConfigs.push({
                id: 'indicators',
                zIndex: 2,
                updateFrequency: 'medium',
                renderer: createIndicatorRenderer(klines, { movingAverages }),
            });
        }

        if (trades.length > 0) {
            layerConfigs.push({
                id: 'annotations',
                zIndex: 3,
                updateFrequency: 'low',
                renderer: createSetupMarkerRenderer(setupMarkers, {}, colors),
            });
        }

        if (interactive) {
            layerConfigs.push({
                id: 'interaction',
                zIndex: 4,
                updateFrequency: 'high',
                renderer: createCrosshairRenderer(klines, mousePosition, {}, colors),
            });
        }

        return layerConfigs;
    }, [klines, showGrid, showIndicators, movingAverages, trades, interactive, setupMarkers, mousePosition, colors]);

    const handleMouseMove = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!interactive) return;

            const rect = event.currentTarget.getBoundingClientRect();
            setMousePosition({
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
            });
        },
        [interactive]
    );

    const handleMouseLeave = useCallback(() => {
        setMousePosition(null);
    }, []);

    useEffect(() => {
        if (!interactive) return;
        markDirty('interaction');
    }, [mousePosition, interactive, markDirty]);

    return (
        <div
            className={className}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: interactive ? 'crosshair' : 'default' }}
        >
            <LayeredCanvas
                width={width}
                height={height}
                viewport={viewport}
                layers={layers}
                onLayerManagerReady={setManager}
            />
        </div>
    );
};
