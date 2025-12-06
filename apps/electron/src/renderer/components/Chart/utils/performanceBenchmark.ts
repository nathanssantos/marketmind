/**
 * Performance Benchmark Utility
 * 
 * Compares single-canvas vs multi-layer canvas rendering performance
 */

export interface BenchmarkResult {
    name: string;
    averageFrameTime: number;
    framesPerSecond: number;
    totalFrames: number;
    duration: number;
    memoryUsed?: number;
}

export interface BenchmarkConfig {
    duration: number; // milliseconds
    operations: (() => void)[];
    name: string;
}

/**
 * Run a performance benchmark
 */
export const runBenchmark = async (config: BenchmarkConfig): Promise<BenchmarkResult> => {
    const { duration, operations, name } = config;
    const startTime = performance.now();
    const frameTimes: number[] = [];
    let frameCount = 0;

    // Measure initial memory if available
    const initialMemory = (performance as any).memory?.usedJSHeapSize;

    return new Promise((resolve) => {
        const measureFrame = () => {
            const frameStart = performance.now();

            // Execute all operations
            operations.forEach((op) => op());

            const frameEnd = performance.now();
            const frameTime = frameEnd - frameStart;
            frameTimes.push(frameTime);
            frameCount++;

            const elapsed = frameEnd - startTime;

            if (elapsed < duration) {
                requestAnimationFrame(measureFrame);
            } else {
                // Calculate results
                const totalTime = performance.now() - startTime;
                const averageFrameTime =
                    frameTimes.reduce((sum, time) => sum + time, 0) / frameTimes.length;
                const fps = 1000 / averageFrameTime;

                const finalMemory = (performance as any).memory?.usedJSHeapSize;
                const memoryUsed = finalMemory && initialMemory 
                    ? finalMemory - initialMemory 
                    : undefined;

                resolve({
                    name,
                    averageFrameTime,
                    framesPerSecond: fps,
                    totalFrames: frameCount,
                    duration: totalTime,
                    memoryUsed,
                });
            }
        };

        requestAnimationFrame(measureFrame);
    });
};

/**
 * Compare two rendering approaches
 */
export const compareBenchmarks = async (
    singleCanvas: BenchmarkConfig,
    multiLayer: BenchmarkConfig
): Promise<{
    single: BenchmarkResult;
    multi: BenchmarkResult;
    improvement: {
        fpsGain: number;
        frameTimeReduction: number;
        memoryOverhead: number;
    };
}> => {
    console.log('🔬 Running performance benchmarks...');

    const singleResult = await runBenchmark(singleCanvas);
    console.log(`✅ Single canvas: ${singleResult.framesPerSecond.toFixed(1)} FPS`);

    const multiResult = await runBenchmark(multiLayer);
    console.log(`✅ Multi-layer: ${multiResult.framesPerSecond.toFixed(1)} FPS`);

    const fpsGain = ((multiResult.framesPerSecond - singleResult.framesPerSecond) / singleResult.framesPerSecond) * 100;
    const frameTimeReduction = ((singleResult.averageFrameTime - multiResult.averageFrameTime) / singleResult.averageFrameTime) * 100;
    const memoryOverhead = multiResult.memoryUsed && singleResult.memoryUsed
        ? multiResult.memoryUsed - singleResult.memoryUsed
        : 0;

    console.log(`📊 Performance gain: ${fpsGain.toFixed(1)}%`);
    console.log(`⏱️  Frame time reduction: ${frameTimeReduction.toFixed(1)}%`);
    if (memoryOverhead !== 0) {
        console.log(`💾 Memory overhead: ${(memoryOverhead / 1024 / 1024).toFixed(2)} MB`);
    }

    return {
        single: singleResult,
        multi: multiResult,
        improvement: {
            fpsGain,
            frameTimeReduction,
            memoryOverhead,
        },
    };
};

/**
 * Render benchmark results to console table
 */
export const printBenchmarkResults = (results: BenchmarkResult[]) => {
    console.table(
        results.map((r) => ({
            Name: r.name,
            'Avg Frame Time (ms)': r.averageFrameTime.toFixed(2),
            FPS: r.framesPerSecond.toFixed(1),
            'Total Frames': r.totalFrames,
            'Duration (ms)': r.duration.toFixed(0),
            'Memory (MB)': r.memoryUsed ? (r.memoryUsed / 1024 / 1024).toFixed(2) : 'N/A',
        }))
    );
};

/**
 * Example usage for chart rendering
 */
export const runChartBenchmark = async (
    klines: any[],
    viewport: any
): Promise<void> => {
    const operations = {
        singleCanvas: () => {
            // Simulate single canvas full redraw
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 600;
            const ctx = canvas.getContext('2d')!;

            // Grid
            ctx.strokeStyle = '#333';
            for (let i = 0; i < 10; i++) {
                ctx.beginPath();
                ctx.moveTo(0, (i / 10) * 600);
                ctx.lineTo(1200, (i / 10) * 600);
                ctx.stroke();
            }

            // Klines
            ctx.fillStyle = '#00ff00';
            klines.slice(0, 100).forEach((_, i) => {
                ctx.fillRect(i * 12, 100, 10, 400);
            });

            // Indicators
            ctx.strokeStyle = '#ff0000';
            ctx.beginPath();
            klines.slice(0, 100).forEach((_, i) => {
                ctx.lineTo(i * 12, 300 + Math.sin(i / 10) * 50);
            });
            ctx.stroke();

            // Orders
            ctx.strokeStyle = '#ffff00';
            ctx.beginPath();
            ctx.moveTo(0, 250);
            ctx.lineTo(1200, 250);
            ctx.stroke();

            // Crosshair
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(600, 0);
            ctx.lineTo(600, 600);
            ctx.stroke();
        },

        multiLayer: () => {
            // Simulate multi-layer (only crosshair updates)
            const canvas = document.createElement('canvas');
            canvas.width = 1200;
            canvas.height = 600;
            const ctx = canvas.getContext('2d')!;

            // Only redraw interaction layer
            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(600, 0);
            ctx.lineTo(600, 600);
            ctx.stroke();
        },
    };

    const results = await compareBenchmarks(
        {
            name: 'Single Canvas (Full Redraw)',
            duration: 2000,
            operations: [operations.singleCanvas],
        },
        {
            name: 'Multi-Layer (Partial Redraw)',
            duration: 2000,
            operations: [operations.multiLayer],
        }
    );

    printBenchmarkResults([results.single, results.multi]);

    return;
};
