import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { compareBenchmarks, runBenchmark, printBenchmarkResults, runChartBenchmark } from './performanceBenchmark';
import type { BenchmarkResult } from './performanceBenchmark';

describe('performanceBenchmark', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'table').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

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

    describe('printBenchmarkResults', () => {
        it('should print benchmark results to console table', () => {
            const mockResults: BenchmarkResult[] = [
                {
                    name: 'Test 1',
                    averageFrameTime: 16.67,
                    framesPerSecond: 60,
                    totalFrames: 120,
                    duration: 2000,
                    memoryUsed: 1024 * 1024,
                },
                {
                    name: 'Test 2',
                    averageFrameTime: 8.33,
                    framesPerSecond: 120,
                    totalFrames: 240,
                    duration: 2000,
                    memoryUsed: undefined,
                },
            ];

            printBenchmarkResults(mockResults);

            expect(console.table).toHaveBeenCalledTimes(1);
            expect(console.table).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ Name: 'Test 1' }),
                    expect.objectContaining({ Name: 'Test 2' }),
                ])
            );
        });

        it('should format numbers correctly', () => {
            const mockResults: BenchmarkResult[] = [
                {
                    name: 'Precise Test',
                    averageFrameTime: 16.666666,
                    framesPerSecond: 60.12345,
                    totalFrames: 100,
                    duration: 1666.666,
                    memoryUsed: 5242880,
                },
            ];

            printBenchmarkResults(mockResults);

            expect(console.table).toHaveBeenCalledWith([
                {
                    Name: 'Precise Test',
                    'Avg Frame Time (ms)': '16.67',
                    FPS: '60.1',
                    'Total Frames': 100,
                    'Duration (ms)': '1667',
                    'Memory (MB)': '5.00',
                },
            ]);
        });

        it('should handle empty results array', () => {
            printBenchmarkResults([]);
            expect(console.table).toHaveBeenCalledWith([]);
        });

        it('should show N/A for missing memory data', () => {
            const mockResults: BenchmarkResult[] = [
                {
                    name: 'No Memory',
                    averageFrameTime: 10,
                    framesPerSecond: 100,
                    totalFrames: 50,
                    duration: 500,
                    memoryUsed: undefined,
                },
            ];

            printBenchmarkResults(mockResults);

            expect(console.table).toHaveBeenCalledWith([
                expect.objectContaining({ 'Memory (MB)': 'N/A' }),
            ]);
        });
    });

    describe('runChartBenchmark', () => {
        it('should run chart benchmark with klines data', async () => {
            const mockKlines = Array(100).fill({
                open: 100,
                high: 110,
                low: 90,
                close: 105,
            });

            const mockViewport = { start: 0, end: 100 };

            await runChartBenchmark(mockKlines, mockViewport);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Running performance benchmarks'));
        });

        it('should complete without throwing', async () => {
            const mockKlines = Array(50).fill({});
            const mockViewport = {};

            await expect(runChartBenchmark(mockKlines, mockViewport)).resolves.toBeUndefined();
        });

        it('should print benchmark results', async () => {
            const mockKlines = [];
            const mockViewport = {};

            await runChartBenchmark(mockKlines, mockViewport);

            expect(console.table).toHaveBeenCalled();
        });

        it('should log performance gain', async () => {
            const mockKlines = [];
            const mockViewport = {};

            await runChartBenchmark(mockKlines, mockViewport);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Performance gain'));
        });

        it('should log frame time reduction', async () => {
            const mockKlines = [];
            const mockViewport = {};

            await runChartBenchmark(mockKlines, mockViewport);

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Frame time reduction'));
        });
    });

    describe('runBenchmark with memory', () => {
        it('should handle performance.memory if available', async () => {
            const result = await runBenchmark({
                name: 'Memory Test',
                duration: 50,
                operations: [() => {}],
            });

            expect(result).toHaveProperty('memoryUsed');
        });

        it('should run multiple operations', async () => {
            let count = 0;
            const result = await runBenchmark({
                name: 'Multi-Op Test',
                duration: 50,
                operations: [
                    () => count++,
                    () => count++,
                    () => count++,
                ],
            });

            expect(count).toBeGreaterThan(0);
            expect(result.totalFrames).toBeGreaterThan(0);
        });
    });

    describe('compareBenchmarks edge cases', () => {
        it('should handle equal performance', async () => {
            const comparison = await compareBenchmarks(
                {
                    name: 'Same A',
                    duration: 50,
                    operations: [() => {}],
                },
                {
                    name: 'Same B',
                    duration: 50,
                    operations: [() => {}],
                }
            );

            expect(comparison.improvement).toBeDefined();
            expect(typeof comparison.improvement.fpsGain).toBe('number');
            expect(typeof comparison.improvement.frameTimeReduction).toBe('number');
        });

        it('should log FPS for both benchmarks', async () => {
            await compareBenchmarks(
                {
                    name: 'First',
                    duration: 50,
                    operations: [() => {}],
                },
                {
                    name: 'Second',
                    duration: 50,
                    operations: [() => {}],
                }
            );

            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Single canvas'));
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Multi-layer'));
        });
    });
});
