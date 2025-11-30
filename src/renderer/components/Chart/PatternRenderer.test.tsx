import { render } from '@testing-library/react';
import { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '../../../shared/types';
import { PatternHoverProvider } from '../../context/PatternHoverContext';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { PatternRenderer } from './PatternRenderer';

const renderWithProvider = (component: ReactElement) => {
    return render(
        <PatternHoverProvider>
            {component}
        </PatternHoverProvider>
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

describe('PatternRenderer', () => {
    const mockKlines: Kline[] = Array.from({ length: 50 }, (_, i) => ({
        openTime: 1000000 + i * 60000,
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

    const mockOnPatternHover = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render canvas with correct dimensions', () => {
        const { container } = renderWithProvider(
            <PatternRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                klines={mockKlines}
                patterns={[]}
                width={800}
                height={600}
                mousePosition={null}
                onPatternHover={mockOnPatternHover}
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
            <PatternRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                klines={mockKlines}
                patterns={[
                    {
                        type: 'support',
                        points: [
                            { openTime: 1000000, price: 100 },
                            { openTime: 1060000, price: 100 },
                        ],
                        confidence: 0.8,
                    },
                ]}
                width={800}
                height={600}
                mousePosition={null}
                onPatternHover={mockOnPatternHover}
            />
        );

        expect(mockContext.save).toHaveBeenCalled();
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.rect).toHaveBeenCalledWith(0, 0, 720, 550);
        expect(mockContext.clip).toHaveBeenCalled();
    });

    it('should not render when canvasManager is null', () => {
        const { container } = renderWithProvider(
            <PatternRenderer
                canvasManager={null}
                klines={mockKlines}
                patterns={[]}
                width={800}
                height={600}
                mousePosition={null}
                onPatternHover={mockOnPatternHover}
            />
        );

        const canvas = container.querySelector('canvas');
        expect(canvas).toBeTruthy();
    });

    it('should skip invisible patterns', () => {
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
            <PatternRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                klines={mockKlines}
                patterns={[
                    {
                        type: 'support',
                        points: [
                            { openTime: 1000000, price: 100 },
                            { openTime: 1060000, price: 100 },
                        ],
                        visible: false,
                        confidence: 0.8,
                    },
                ]}
                width={800}
                height={600}
                mousePosition={null}
                onPatternHover={mockOnPatternHover}
            />
        );

        expect(mockContext.moveTo).not.toHaveBeenCalled();
        expect(mockContext.lineTo).not.toHaveBeenCalled();
    });

    it('should call onPatternHover when mouse hovers over pattern tag', () => {
        const mockContext = createMockContext();
        HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;

        const pattern = {
            id: 1,
            type: 'support' as const,
            points: [
                { openTime: 1000000, price: 100 },
                { openTime: 1060000, price: 100 },
            ],
            confidence: 0.8,
        };

        renderWithProvider(
            <PatternRenderer
                canvasManager={mockCanvasManager as CanvasManager}
                klines={mockKlines}
                patterns={[pattern]}
                width={800}
                height={600}
                mousePosition={{ x: 55, y: 195 }}
                onPatternHover={mockOnPatternHover}
            />
        );

        expect(mockOnPatternHover).toHaveBeenCalled();
    });
});
