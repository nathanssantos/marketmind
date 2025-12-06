import type { Viewport } from '@shared/types';
import { useCallback, useEffect, useRef } from 'react';

export type LayerUpdateFrequency = 'static' | 'low' | 'medium' | 'high';

export interface LayerConfig {
    id: string;
    zIndex: number;
    updateFrequency: LayerUpdateFrequency;
    renderer: (ctx: CanvasRenderingContext2D, viewport: Viewport) => void;
    enabled?: boolean;
}

export interface LayerManagerOptions {
    width: number;
    height: number;
    devicePixelRatio?: number;
}

export class LayerManager {
    private layers: Map<string, HTMLCanvasElement> = new Map();
    private contexts: Map<string, CanvasRenderingContext2D> = new Map();
    private configs: Map<string, LayerConfig> = new Map();
    private dirtyLayers: Set<string> = new Set();
    private animationFrameId: number | null = null;
    private options: LayerManagerOptions;

    constructor(
        private container: HTMLDivElement,
        options: LayerManagerOptions
    ) {
        this.options = {
            devicePixelRatio: window.devicePixelRatio || 1,
            ...options,
        };
    }

    addLayer(config: LayerConfig): void {
        if (this.layers.has(config.id)) {
            console.warn(`Layer ${config.id} already exists`);
            return;
        }

        const canvas = document.createElement('canvas');
        canvas.id = `chart-layer-${config.id}`;
        canvas.style.position = 'absolute';
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.zIndex = config.zIndex.toString();
        canvas.style.pointerEvents = config.id === 'interaction' ? 'auto' : 'none';

        canvas.width = this.options.width * (this.options.devicePixelRatio || 1);
        canvas.height = this.options.height * (this.options.devicePixelRatio || 1);

        const ctx = canvas.getContext('2d', { alpha: config.id !== 'grid' });
        if (!ctx) {
            console.error(`Failed to get 2D context for layer ${config.id}`);
            return;
        }

        ctx.scale(
            this.options.devicePixelRatio || 1,
            this.options.devicePixelRatio || 1
        );

        this.container.appendChild(canvas);
        this.layers.set(config.id, canvas);
        this.contexts.set(config.id, ctx);
        this.configs.set(config.id, config);
        this.dirtyLayers.add(config.id);
    }

    removeLayer(layerId: string): void {
        const canvas = this.layers.get(layerId);
        if (canvas) {
            this.container.removeChild(canvas);
            this.layers.delete(layerId);
            this.contexts.delete(layerId);
            this.configs.delete(layerId);
            this.dirtyLayers.delete(layerId);
        }
    }

    markDirty(layerId: string): void {
        if (!this.configs.has(layerId)) {
            console.warn(`Layer ${layerId} does not exist`);
            return;
        }
        this.dirtyLayers.add(layerId);
    }

    markAllDirty(): void {
        this.configs.forEach((_, layerId) => {
            this.dirtyLayers.add(layerId);
        });
    }

    resize(width: number, height: number): void {
        this.options.width = width;
        this.options.height = height;

        this.layers.forEach((canvas, layerId) => {
            canvas.width = width * (this.options.devicePixelRatio || 1);
            canvas.height = height * (this.options.devicePixelRatio || 1);

            const ctx = this.contexts.get(layerId);
            if (ctx) {
                ctx.scale(
                    this.options.devicePixelRatio || 1,
                    this.options.devicePixelRatio || 1
                );
            }

            this.dirtyLayers.add(layerId);
        });
    }

    render(viewport: Viewport): void {
        if (this.dirtyLayers.size === 0) return;

        const layersToRender = Array.from(this.dirtyLayers);

        layersToRender.forEach((layerId) => {
            const canvas = this.layers.get(layerId);
            const ctx = this.contexts.get(layerId);
            const config = this.configs.get(layerId);

            if (!canvas || !ctx || !config) return;
            if (config.enabled === false) return;

            ctx.clearRect(0, 0, this.options.width, this.options.height);

            try {
                config.renderer(ctx, viewport);
            } catch (error) {
                console.error(`Error rendering layer ${layerId}:`, error);
            }
        });

        this.dirtyLayers.clear();
    }

    scheduleRender(viewport: Viewport): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.animationFrameId = requestAnimationFrame(() => {
            this.render(viewport);
            this.animationFrameId = null;
        });
    }

    getCanvas(layerId: string): HTMLCanvasElement | undefined {
        return this.layers.get(layerId);
    }

    getContext(layerId: string): CanvasRenderingContext2D | undefined {
        return this.contexts.get(layerId);
    }

    destroy(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }

        this.layers.forEach((canvas) => {
            this.container.removeChild(canvas);
        });

        this.layers.clear();
        this.contexts.clear();
        this.configs.clear();
        this.dirtyLayers.clear();
    }
}

export interface LayeredCanvasProps {
    width: number;
    height: number;
    viewport: Viewport;
    layers: LayerConfig[];
    onLayerManagerReady?: (manager: LayerManager) => void;
    className?: string;
}

export const LayeredCanvas = ({
    width,
    height,
    viewport,
    layers,
    onLayerManagerReady,
    className,
}: LayeredCanvasProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const managerRef = useRef<LayerManager | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const manager = new LayerManager(containerRef.current, {
            width,
            height,
        });

        layers.forEach((layer) => {
            manager.addLayer(layer);
        });

        managerRef.current = manager;
        onLayerManagerReady?.(manager);

        return () => {
            manager.destroy();
            managerRef.current = null;
        };
    }, []);

    useEffect(() => {
        if (!managerRef.current) return;
        managerRef.current.resize(width, height);
    }, [width, height]);

    useEffect(() => {
        if (!managerRef.current) return;
        managerRef.current.scheduleRender(viewport);
    }, [viewport]);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: 'relative',
                width: `${width}px`,
                height: `${height}px`,
                overflow: 'hidden',
            }}
        />
    );
};

export const useLayerManager = () => {
    const managerRef = useRef<LayerManager | null>(null);

    const setManager = useCallback((manager: LayerManager) => {
        managerRef.current = manager;
    }, []);

    const markDirty = useCallback((layerId: string) => {
        managerRef.current?.markDirty(layerId);
    }, []);

    const markAllDirty = useCallback(() => {
        managerRef.current?.markAllDirty();
    }, []);

    const getCanvas = useCallback((layerId: string) => {
        return managerRef.current?.getCanvas(layerId);
    }, []);

    const getContext = useCallback((layerId: string) => {
        return managerRef.current?.getContext(layerId);
    }, []);

    return {
        setManager,
        markDirty,
        markAllDirty,
        getCanvas,
        getContext,
        manager: managerRef.current,
    };
};
