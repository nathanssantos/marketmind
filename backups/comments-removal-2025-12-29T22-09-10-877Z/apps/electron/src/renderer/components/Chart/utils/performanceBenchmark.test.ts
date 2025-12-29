import { describe, expect, it } from 'vitest';
import { compareBenchmarks, runBenchmark } from './performanceBenchmark';

describe('performanceBenchmark', () => {
    it('should run a basic benchmark', async () => {
        const result = await runBenchmark({
            name: 'Test Benchmark',
            duration: 100,
            operations: [() => Math.random()],
        });

        expect(result.name).toBe('Test Benchmark');
        expect(result.totalFrames).toBeGreaterThan(0);
        expect(result.averageFrameTime).toBeGreaterThan(0);
        expect(result.framesPerSecond).toBeGreaterThan(0);
    });

    it('should compare two benchmarks', async () => {
        const comparison = await compareBenchmarks(
            {
                name: 'Slow Operation',
                duration: 100,
                operations: [
                    () => {
                        for (let i = 0; i < 10000; i++) Math.random();
                    },
                ],
            },
            {
                name: 'Fast Operation',
                duration: 100,
                operations: [() => Math.random()],
            }
        );

        expect(comparison.single).toBeDefined();
        expect(comparison.multi).toBeDefined();
        expect(comparison.improvement).toBeDefined();
        expect(comparison.improvement.fpsGain).toBeGreaterThan(0);
    });

    it('should calculate performance improvements', async () => {
        const comparison = await compareBenchmarks(
            {
                name: 'Baseline',
                duration: 100,
                operations: [
                    () => {
                        const arr = new Array(1000).fill(0);
                        arr.forEach((_, i) => i * 2);
                    },
                ],
            },
            {
                name: 'Optimized',
                duration: 100,
                operations: [() => {}],
            }
        );

        expect(typeof comparison.improvement.frameTimeReduction).toBe('number');
    });
});
