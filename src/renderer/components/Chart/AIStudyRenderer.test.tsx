import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candle } from '../../../shared/types';
import { AIStudyHoverProvider } from '../../context/AIStudyHoverContext';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { AIStudyRenderer } from './AIStudyRenderer';

const renderWithProvider = (component: React.ReactElement) => {
    return render(
        <AIStudyHoverProvider>
            {component}
        </AIStudyHoverProvider>
    );
};

const createMockContext = () => ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    clip: vi.fn(),
    clearRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 50 })),
    arc: vi.fn(),
    fill: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    fillStyle: '',
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'top' as CanvasTextBaseline,
});

describe('AIStudyRenderer', () => {
    const mockCandles: Candle[] = Array.from({ length: 50 }, (_, i) => ({
        timestamp: 1000000 + i * 60000,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 1000,
    }));

    const mockCanvasManager: Partial<CanvasManager> = {
        getDimensions: vi.fn(() => ({
            width: 800,
            height: 600,
            chartWidth: 720,
            chartHeight: 550,
            volumeHeight: 100,
        })),
        indexToCenterX: vi.fn((index) => 50 + index * 10),
        indexToX: vi.fn((index) => 45 + index * 10),
        priceToY: vi.fn((price) => 300 - price),
    };

    const mockOnStudyHover = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render canvas with correct dimensions', () => {
        const { container } = renderWithProvider(
            <AIStudyRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                candles={mockCandles}
                studies={[]}
                width={800}
                height={600}
                mousePosition={null}
                onStudyHover={mockOnStudyHover}
            />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeTruthy();
        expect(canvas?.width).toBe(800);
        expect(canvas?.height).toBe(600);
    });

    it('should apply clipping region based on chartWidth and chartHeight', () => {
        const mockContext = createMockContext();

        const mockGetContext = vi.fn(() => mockContext);

        HTMLCanvasElement.prototype.getContext = mockGetContext as any;

        renderWithProvider(
            <AIStudyRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                candles={mockCandles}
                studies={[
                    {
                        type: 'support',
                        points: [
                            { timestamp: 1000000, price: 100 },
                            { timestamp: 1060000, price: 100 },
                        ],
                        confidence: 0.8,
                    },
                ]}
                width={800}
                height={600}
                mousePosition={null}
                onStudyHover={mockOnStudyHover}
            />
        );

        expect(mockContext.save).toHaveBeenCalled();
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.rect).toHaveBeenCalledWith(0, 0, 720, 550);
        expect(mockContext.clip).toHaveBeenCalled();
    });

    it('should not render when canvasManager is null', () => {
        const { container } = renderWithProvider(
            <AIStudyRenderer
                canvasManager={null}
                candles={mockCandles}
                studies={[]}
                width={800}
                height={600}
                mousePosition={null}
                onStudyHover={mockOnStudyHover}
            />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeTruthy();
    });

    it('should skip invisible studies', () => {
        const mockContext = {
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            rect: vi.fn(),
            clip: vi.fn(),
            clearRect: vi.fn(),
            strokeStyle: '',
            lineWidth: 0,
            setLineDash: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
        };

        HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;

        renderWithProvider(
            <AIStudyRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                candles={mockCandles}
                studies={[
                    {
                        type: 'support',
                        points: [
                            { timestamp: 1000000, price: 100 },
                            { timestamp: 1060000, price: 100 },
                        ],
                        visible: false,
                        confidence: 0.8,
                    },
                ]}
                width={800}
                height={600}
                mousePosition={null}
                onStudyHover={mockOnStudyHover}
            />
        );

        expect(mockContext.moveTo).not.toHaveBeenCalled();
        expect(mockContext.lineTo).not.toHaveBeenCalled();
    });

    it('should call onStudyHover when mouse hovers over study tag', () => {
        const mockContext = createMockContext();
        HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;

        const study = {
            id: 1,
            type: 'support' as const,
            points: [
                { timestamp: 1000000, price: 100 },
                { timestamp: 1060000, price: 100 },
            ],
            confidence: 0.8,
        };

        renderWithProvider(
            <AIStudyRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                candles={mockCandles}
                studies={[study]}
                width={800}
                height={600}
                mousePosition={{ x: 55, y: 195 }}
                onStudyHover={mockOnStudyHover}
            />
        );

        expect(mockOnStudyHover).toHaveBeenCalled();
    });
});
