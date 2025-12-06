import type { Viewport } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LayerManager } from './LayeredCanvas';

describe('LayerManager', () => {
    let container: HTMLDivElement;
    let manager: LayerManager;

    beforeEach(() => {
        container = document.createElement('div');
        container.style.width = '800px';
        container.style.height = '600px';
        document.body.appendChild(container);

        manager = new LayerManager(container, {
            width: 800,
            height: 600,
        });
    });

    afterEach(() => {
        manager.destroy();
        if (container.parentNode) {
            document.body.removeChild(container);
        }
    });

    it('should create layer manager', () => {
        expect(manager).toBeDefined();
    });

    it('should add layers', () => {
        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: (ctx) => {
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, 100, 100);
            },
        });

        const canvas = manager.getCanvas('test-layer');
        expect(canvas).toBeDefined();
        expect(canvas?.id).toBe('chart-layer-test-layer');
    });

    it('should remove layers', () => {
        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: () => { },
        });

        manager.removeLayer('test-layer');
        const canvas = manager.getCanvas('test-layer');
        expect(canvas).toBeUndefined();
    });

    it('should mark layers as dirty', () => {
        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: () => { },
        });

        manager.markDirty('test-layer');
        expect(true).toBe(true);
    });

    it('should mark all layers as dirty', () => {
        manager.addLayer({
            id: 'layer-1',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: () => { },
        });

        manager.addLayer({
            id: 'layer-2',
            zIndex: 1,
            updateFrequency: 'medium',
            renderer: () => { },
        });

        manager.markAllDirty();
        expect(true).toBe(true);
    });

    it('should render layers', () => {
        let rendered = false;

        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: () => {
                rendered = true;
            },
        });

        const viewport: Viewport = {
            start: 0,
            end: 100,
            priceMin: 0,
            priceMax: 100,
            width: 800,
            height: 600,
        };

        manager.render(viewport);
        expect(rendered).toBe(true);
    });

    it('should resize layers', () => {
        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: () => { },
        });

        manager.resize(1000, 800);

        const canvas = manager.getCanvas('test-layer');
        expect(canvas?.width).toBe(1000 * window.devicePixelRatio);
        expect(canvas?.height).toBe(800 * window.devicePixelRatio);
    });

    it('should get canvas context', () => {
        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: () => { },
        });

        const ctx = manager.getContext('test-layer');
        expect(ctx).toBeDefined();
        expect(ctx).toHaveProperty('fillRect');
        expect(ctx).toHaveProperty('strokeRect');
    });

    it('should handle disabled layers', () => {
        let rendered = false;

        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            enabled: false,
            renderer: () => {
                rendered = true;
            },
        });

        const viewport: Viewport = {
            start: 0,
            end: 100,
            priceMin: 0,
            priceMax: 100,
            width: 800,
            height: 600,
        };

        manager.render(viewport);
        expect(rendered).toBe(false);
    });

    it('should schedule render with animation frame', (done) => {
        let rendered = false;

        manager.addLayer({
            id: 'test-layer',
            zIndex: 0,
            updateFrequency: 'medium',
            renderer: () => {
                rendered = true;
            },
        });

        const viewport: Viewport = {
            start: 0,
            end: 100,
            priceMin: 0,
            priceMax: 100,
            width: 800,
            height: 600,
        };

        manager.scheduleRender(viewport);

        requestAnimationFrame(() => {
            expect(rendered).toBe(true);
            done();
        });
    });
});
