import { Box } from '@chakra-ui/react';
import type { Kline } from '@shared/types';
import type { BacktestTrade } from '@shared/types/backtesting';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface BacktestChartProps {
    klines: Kline[];
    trades: BacktestTrade[];
    width?: number;
    height?: number;
}

export const BacktestChart = ({ klines, trades, width = 800, height = 400 }: BacktestChartProps) => {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || klines.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;

        const padding = 40;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;

        ctx.clearRect(0, 0, width, height);

        const prices = klines.flatMap(k => [Number(k.high), Number(k.low)]);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;

        const xScale = chartWidth / klines.length;
        const yScale = chartHeight / priceRange;

        const priceToY = (price: number) => {
            return padding + chartHeight - (price - minPrice) * yScale;
        };

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width - padding, y);
            ctx.stroke();

            const price = maxPrice - (priceRange / 5) * i;
            ctx.fillStyle = '#666';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(price.toFixed(2), padding - 5, y + 3);
        }

        klines.forEach((kline, index) => {
            const x = padding + index * xScale;
            const open = Number(kline.open);
            const close = Number(kline.close);
            const high = Number(kline.high);
            const low = Number(kline.low);

            const isBullish = close >= open;
            const color = isBullish ? '#26a69a' : '#ef5350';

            const highY = priceToY(high);
            const lowY = priceToY(low);
            const openY = priceToY(open);
            const closeY = priceToY(close);

            ctx.strokeStyle = color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x + xScale / 2, highY);
            ctx.lineTo(x + xScale / 2, lowY);
            ctx.stroke();

            const bodyWidth = Math.max(xScale * 0.7, 1);
            ctx.fillStyle = color;
            const bodyHeight = Math.abs(closeY - openY);
            const bodyY = Math.min(openY, closeY);
            ctx.fillRect(x + (xScale - bodyWidth) / 2, bodyY, bodyWidth, Math.max(bodyHeight, 1));
        });

        trades.forEach((trade) => {
            const entryTime = new Date(trade.entryTime).getTime();
            const entryIndex = klines.findIndex(k => new Date(k.openTime).getTime() >= entryTime);

            if (entryIndex === -1) return;

            const x = padding + entryIndex * xScale;
            const y = priceToY(trade.entryPrice);

            const isProfit = (trade.netPnl ?? 0) >= 0;
            const markerColor = isProfit ? '#4caf50' : '#f44336';
            const markerShape = trade.side === 'LONG' ? 'triangle-up' : 'triangle-down';

            ctx.fillStyle = markerColor;
            ctx.strokeStyle = markerColor;
            ctx.lineWidth = 2;

            if (markerShape === 'triangle-up') {
                ctx.beginPath();
                ctx.moveTo(x + xScale / 2, y - 8);
                ctx.lineTo(x + xScale / 2 - 6, y);
                ctx.lineTo(x + xScale / 2 + 6, y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(x + xScale / 2, y + 8);
                ctx.lineTo(x + xScale / 2 - 6, y);
                ctx.lineTo(x + xScale / 2 + 6, y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }

            if (trade.exitTime && trade.exitPrice) {
                const exitTime = new Date(trade.exitTime).getTime();
                const exitIndex = klines.findIndex(k => new Date(k.openTime).getTime() >= exitTime);

                if (exitIndex !== -1) {
                    const exitX = padding + exitIndex * xScale;
                    const exitY = priceToY(trade.exitPrice);

                    ctx.setLineDash([5, 5]);
                    ctx.strokeStyle = markerColor;
                    ctx.lineWidth = 1;
                    ctx.globalAlpha = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(x + xScale / 2, y);
                    ctx.lineTo(exitX + xScale / 2, exitY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.globalAlpha = 1;

                    ctx.fillStyle = markerColor;
                    ctx.beginPath();
                    ctx.arc(exitX + xScale / 2, exitY, 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });

        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${t('backtesting.chart.trades')}: ${trades.length}`, padding, height - 5);

        const winningTrades = trades.filter(t => (t.netPnl ?? 0) >= 0).length;
        const winRate = trades.length > 0 ? (winningTrades / trades.length * 100).toFixed(1) : '0';
        ctx.fillText(`${t('backtesting.chart.winRate')}: ${winRate}%`, padding + 150, height - 5);

    }, [klines, trades, width, height, t]);

    return (
        <Box position="relative" width={`${width}px`} height={`${height}px`}>
            <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />
        </Box>
    );
};
