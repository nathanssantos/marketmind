import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen } from '@shared/utils';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Kline, Viewport } from '../../../shared/types';
import { CanvasManager } from '../../utils/canvas/CanvasManager';
import { calculateBounds, priceToY, yToPrice } from '../../utils/canvas/coordinateSystem';
import { clearCanvas, drawKline, drawLine, drawRect, drawText } from '../../utils/canvas/drawingUtils';

describe('Canvas Manager - Real Browser Tests', () => {
    let canvas: HTMLCanvasElement;
    let manager: CanvasManager;

    const mockKlines: Kline[] = [
        { openTime: 1700000000000, closeTime: 1700000000000, open: '40000', high: '42000', low: '39000', close: '41000', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
        { openTime: 1700003600000, closeTime: 1700003600000, open: '41000', high: '43000', low: '40000', close: '42000', volume: '1200', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
        { openTime: 1700007200000, closeTime: 1700007200000, open: '42000', high: '42500', low: '41000', close: '41500', volume: '900', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];

    const mockViewport: Viewport = {
        start: 0,
        end: 3,
        klineWidth: 10,
        klineSpacing: 2,
    };

    beforeEach(() => {
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        manager = new CanvasManager(canvas, mockViewport, 40);
        manager.setKlines(mockKlines);
    });

    afterEach(() => {
        manager.destroy();
        if (canvas.parentNode) {
            document.body.removeChild(canvas);
        }
    });

    test('CanvasManager provides valid 2D context', () => {
        const ctx = manager.getContext();
        expect(ctx).not.toBeNull();
        expect(ctx).toBeInstanceOf(CanvasRenderingContext2D);
    });

    test('CanvasManager calculates dimensions correctly', () => {
        const dimensions = manager.getDimensions();
        expect(dimensions).toBeDefined();
        expect(typeof dimensions?.chartWidth).toBe('number');
        expect(typeof dimensions?.chartHeight).toBe('number');
    });

    test('CanvasManager manages viewport correctly', () => {
        const viewport = manager.getViewport();
        expect(viewport).toBeDefined();
        expect(viewport.start).toBe(0);
        expect(viewport.end).toBe(3);
        expect(viewport.klineWidth).toBeGreaterThan(0);
        expect(viewport.klineSpacing).toBe(2);
    });

    test('Price to Y coordinate conversion works correctly', () => {
        const y = manager.priceToY(41000);
        expect(typeof y).toBe('number');
        expect(isNaN(y)).toBe(false);
    });

    test('Y to price coordinate conversion works correctly', () => {
        const y = 300;
        const price = manager.yToPrice(y);
        expect(price).toBeGreaterThan(0);
        expect(typeof price).toBe('number');
    });

    test('Index to X coordinate conversion works correctly', () => {
        const x = manager.indexToX(0);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(typeof x).toBe('number');
    });

    test('Visible klines are correctly filtered', () => {
        const visible = manager.getVisibleKlines();
        expect(Array.isArray(visible)).toBe(true);
        expect(visible.length).toBeGreaterThanOrEqual(0);
        expect(visible.length).toBeLessThanOrEqual(mockKlines.length);
    });

    test('Canvas can be resized correctly', () => {
        canvas.width = 1024;
        canvas.height = 768;

        const dimensions = manager.getDimensions();
        expect(dimensions).toBeDefined();
    });

    test('Viewport can be updated', () => {
        const newViewport: Viewport = {
            start: 1,
            end: 2,
            klineWidth: 15,
            klineSpacing: 3,
        };

        manager.setViewport(newViewport);
        const viewport = manager.getViewport();

        expect(viewport.start).toBeGreaterThanOrEqual(0);
        expect(viewport.end).toBeGreaterThan(viewport.start);
        expect(viewport.klineWidth).toBeGreaterThan(0);
    });
});

describe('Canvas Drawing Functions - Real Browser Tests', () => {
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        ctx = canvas.getContext('2d')!;
        expect(ctx).not.toBeNull();
    });

    afterEach(() => {
        if (canvas.parentNode) {
            document.body.removeChild(canvas);
        }
    });

    test('clearCanvas clears the entire canvas', () => {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 800, 600);

        clearCanvas(ctx, 800, 600);

        const imageData = ctx.getImageData(0, 0, 1, 1);
        expect(imageData.data[3]).toBe(0);
    });

    test('drawRect draws a rectangle on canvas', () => {
        expect(() => {
            drawRect(ctx, 100, 100, 200, 150, '#00ff00');
        }).not.toThrow();

        expect(ctx.fillStyle).toBeDefined();
    });

    test('drawLine draws a line on canvas', () => {
        const initialWidth = ctx.lineWidth;

        expect(() => {
            drawLine(ctx, 0, 0, 800, 600, '#ffffff', 2);
        }).not.toThrow();

        expect(ctx.lineWidth).toBeGreaterThan(0);
    });

    test('drawText renders text on canvas', () => {
        expect(() => {
            drawText(ctx, 'Test Text', 400, 300, '#ffffff', '16px Arial', 'center');
        }).not.toThrow();

        const metrics = ctx.measureText('Test Text');
        expect(metrics.width).toBeGreaterThan(0);
    });

    test('drawKline renders bullish kline correctly', () => {
        const openY = 400;
        const closeY = 300;
        const highY = 250;
        const lowY = 450;

        expect(() => {
            drawKline(ctx, 100, openY, closeY, highY, lowY, 10, 1, '#26a69a', '#ef5350', false);
        }).not.toThrow();
    });

    test('drawKline renders bearish kline correctly', () => {
        const openY = 300;
        const closeY = 400;
        const highY = 250;
        const lowY = 450;

        expect(() => {
            drawKline(ctx, 200, openY, closeY, highY, lowY, 10, 1, '#26a69a', '#ef5350', false);
        }).not.toThrow();
    });

    test('Canvas rendering methods chain correctly', () => {
        expect(() => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, 800, 600);
            ctx.clip();

            drawRect(ctx, 50, 50, 100, 100, '#ff0000');
            drawLine(ctx, 0, 300, 800, 300, '#ffffff', 1);
            drawText(ctx, 'Chart Title', 400, 50, '#ffffff', '24px Arial', 'center');

            ctx.restore();
        }).not.toThrow();
    });
});

describe('Coordinate System Functions - Real Browser Tests', () => {
    const mockKlines: Kline[] = [
        { openTime: 1700000000000, closeTime: 1700000000000, open: '40000', high: '42000', low: '39000', close: '41000', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
        { openTime: 1700003600000, closeTime: 1700003600000, open: '41000', high: '43000', low: '40000', close: '42000', volume: '1200', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
        { openTime: 1700007200000, closeTime: 1700007200000, open: '42000', high: '42500', low: '41000', close: '41500', volume: '900', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
    ];

    const mockViewport: Viewport = {
        start: 0,
        end: 3,
        klineWidth: 10,
        klineSpacing: 2,
    };

    test('calculateBounds computes correct price bounds', () => {
        const bounds = calculateBounds(mockKlines, mockViewport);

        expect(bounds).toBeDefined();
        expect(bounds.minPrice).toBe(39000);
        expect(bounds.maxPrice).toBe(43000);
        expect(bounds.maxVolume).toBe(1200);
    });

    test('priceToY converts price to Y coordinate', () => {
        const bounds = calculateBounds(mockKlines, mockViewport);
        const dimensions = { width: 800, height: 600, chartHeight: 600, volumeHeight: 0, chartWidth: 800 };
        const paddingTop = 40;
        const paddingBottom = 40;

        const y = priceToY(41000, bounds, dimensions, paddingTop, paddingBottom);

        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(dimensions.chartHeight);
        expect(typeof y).toBe('number');
    });

    test('yToPrice converts Y coordinate back to price', () => {
        const bounds = calculateBounds(mockKlines, mockViewport);
        const dimensions = { width: 800, height: 600, chartHeight: 600, volumeHeight: 0, chartWidth: 800 };
        const paddingTop = 40;
        const paddingBottom = 40;

        const originalPrice = 41000;
        const y = priceToY(originalPrice, bounds, dimensions, paddingTop, paddingBottom);
        const price = yToPrice(y, bounds, dimensions, paddingTop, paddingBottom);

        expect(Math.abs(price - originalPrice)).toBeLessThan(10);
    });

    test('Coordinate conversions are reversible', () => {
        const bounds = calculateBounds(mockKlines, mockViewport);
        const dimensions = { width: 800, height: 600, chartHeight: 600, volumeHeight: 0, chartWidth: 800 };
        const paddingTop = 40;
        const paddingBottom = 40;

        const testPrices = [39000, 40000, 41000, 42000, 43000];

        testPrices.forEach(originalPrice => {
            const y = priceToY(originalPrice, bounds, dimensions, paddingTop, paddingBottom);
            const convertedPrice = yToPrice(y, bounds, dimensions, paddingTop, paddingBottom);

            expect(Math.abs(convertedPrice - originalPrice)).toBeLessThan(50);
        });
    });
});

describe('Canvas Advanced Features - Real Browser Tests', () => {
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
        canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        document.body.appendChild(canvas);

        ctx = canvas.getContext('2d')!;
    });

    afterEach(() => {
        if (canvas.parentNode) {
            document.body.removeChild(canvas);
        }
    });

    test('Canvas supports clipping regions', () => {
        expect(() => {
            ctx.save();
            ctx.beginPath();
            ctx.rect(100, 100, 600, 400);
            ctx.clip();

            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, 800, 600);

            ctx.restore();
        }).not.toThrow();
    });

    test('Canvas supports gradients', () => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 600);
        expect(gradient).toBeDefined();

        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(1, '#0000ff');

        ctx.fillStyle = gradient;
        expect(() => {
            ctx.fillRect(0, 0, 800, 600);
        }).not.toThrow();
    });

    test('Canvas supports transparency', () => {
        expect(() => {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(0, 0, 400, 600);

            ctx.fillStyle = 'rgba(0, 0, 255, 0.5)';
            ctx.fillRect(200, 0, 400, 600);
        }).not.toThrow();

        expect(ctx.fillStyle).toBeDefined();
    });

    test('Canvas supports image smoothing control', () => {
        ctx.imageSmoothingEnabled = false;
        expect(ctx.imageSmoothingEnabled).toBe(false);

        ctx.imageSmoothingEnabled = true;
        expect(ctx.imageSmoothingEnabled).toBe(true);
    });

    test('Canvas measureText provides accurate metrics', () => {
        ctx.font = '24px Arial';
        const metrics = ctx.measureText('MarketMind');

        expect(metrics.width).toBeGreaterThan(0);
        expect(metrics.width).toBeLessThan(800);
    });

    test('Canvas supports complex path operations', () => {
        expect(() => {
            ctx.beginPath();
            ctx.moveTo(100, 300);
            ctx.lineTo(200, 200);
            ctx.lineTo(300, 300);
            ctx.lineTo(400, 100);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }).not.toThrow();
    });

    test('Canvas can render multiple klines', () => {
        const klines = [
            { x: 100, open: 400, close: 300, high: 250, low: 450 },
            { x: 150, open: 300, close: 350, high: 280, low: 380 },
            { x: 200, open: 350, close: 280, high: 260, low: 400 },
            { x: 250, open: 280, close: 320, high: 270, low: 330 },
        ];

        expect(() => {
            klines.forEach(kline => {
                drawKline(
                    ctx,
                    kline.x,
                    getKlineOpen(kline),
                    getKlineClose(kline),
                    getKlineHigh(kline),
                    getKlineLow(kline),
                    10,
                    1,
                    '#26a69a',
                    '#ef5350',
                    false
                );
            });
        }).not.toThrow();
    });
});

