import { Card } from '@/renderer/components/ui/card';
import { useColorMode } from '@/renderer/components/ui/color-mode';
import { Box, Heading, Text } from '@chakra-ui/react';
import type { BacktestEquityPoint } from '@shared/types/backtesting';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface EquityCurveChartProps {
    equityCurve: BacktestEquityPoint[];
    initialCapital: number;
}

const TEXT_PADDING_LEFT = 5;
const TEXT_PADDING_TOP = 3;
const LABEL_COUNT = 5;
const LABEL_BOTTOM_OFFSET = 10;

export const EquityCurveChart = ({ equityCurve, initialCapital }: EquityCurveChartProps): React.ReactElement => {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { colorMode } = useColorMode();

    const equityColor = useMemo(() => colorMode === 'dark' ? '#63b3ed' : '#3182ce', [colorMode]);
    const drawdownColor = useMemo(() => colorMode === 'dark' ? '#fc8181' : '#e53e3e', [colorMode]);
    const gridColor = useMemo(() => colorMode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', [colorMode]);
    const textColor = useMemo(() => colorMode === 'dark' ? '#e2e8f0' : '#2d3748', [colorMode]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || equityCurve.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 20, right: 60, bottom: 40, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.clearRect(0, 0, width, height);

        const equityValues = equityCurve.map((point) => point.equity);
        const drawdownValues = equityCurve.map((point) => point.drawdown);

        const maxEquity = Math.max(...equityValues);
        const minEquity = Math.min(...equityValues, initialCapital);
        const maxDrawdown = Math.max(...drawdownValues);

        const equityRange = maxEquity - minEquity;
        const equityScale = chartHeight / equityRange;

        const drawdownScale = chartHeight / maxDrawdown;

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + (chartHeight * i) / gridLines;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();

            const equityValue = maxEquity - (equityRange * i) / gridLines;
            ctx.fillStyle = textColor;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`$${equityValue.toFixed(0)}`, padding.left - TEXT_PADDING_LEFT, y + TEXT_PADDING_TOP);
        }

        ctx.beginPath();
        ctx.strokeStyle = equityColor;
        ctx.lineWidth = 2;
        equityCurve.forEach((point, index) => {
            const x = padding.left + (chartWidth * index) / (equityCurve.length - 1);
            const y = padding.top + chartHeight - (point.equity - minEquity) * equityScale;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        ctx.fillStyle = `${drawdownColor}33`;
        ctx.beginPath();
        equityCurve.forEach((point, index) => {
            const x = padding.left + (chartWidth * index) / (equityCurve.length - 1);
            const y = padding.top + point.drawdown * drawdownScale;

            if (index === 0) {
                ctx.moveTo(x, padding.top);
            }
            ctx.lineTo(x, y);
        });
        ctx.lineTo(padding.left + chartWidth, padding.top);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = drawdownColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        equityCurve.forEach((point, index) => {
            const x = padding.left + (chartWidth * index) / (equityCurve.length - 1);
            const y = padding.top + point.drawdown * drawdownScale;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        ctx.fillStyle = textColor;
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';

        const labelInterval = Math.floor(equityCurve.length / LABEL_COUNT);
        equityCurve.forEach((point, index) => {
            if (index % labelInterval === 0 || index === equityCurve.length - 1) {
                const x = padding.left + (chartWidth * index) / (equityCurve.length - 1);
                const date = new Date(point.time);
                const label = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                });
                ctx.fillText(label, x, height - LABEL_BOTTOM_OFFSET);
            }
        });

        ctx.fillStyle = equityColor;
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Equity', padding.left + 10, padding.top + 15);

        ctx.fillStyle = drawdownColor;
        ctx.fillText('Drawdown', padding.left + 70, padding.top + 15);
    }, [
        equityCurve,
        initialCapital,
        equityColor,
        drawdownColor,
        gridColor,
        textColor,
    ]);

    return (
        <Card.Root>
            <Card.Header>
                <Heading size="md">{t('backtesting.equityCurve.title')}</Heading>
                <Text fontSize="sm" color="gray.500" mt={1}>
                    {t('backtesting.equityCurve.description')}
                </Text>
            </Card.Header>
            <Card.Body>
                <Box w="full" h="300px">
                    <canvas
                        ref={canvasRef}
                        style={{ width: '100%', height: '100%' }}
                        data-testid="equity-curve-canvas"
                    />
                </Box>
            </Card.Body>
        </Card.Root>
    );
};
