import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BacktestProgressReporter } from '../../services/backtesting/BacktestProgressReporter';
import type { WebSocketService } from '../../services/websocket';

const createWsStub = () => ({
  emitBacktestProgress: vi.fn(),
  emitBacktestComplete: vi.fn(),
  emitBacktestFailed: vi.fn(),
});

const buildReporter = (wsStub?: ReturnType<typeof createWsStub>) =>
  new BacktestProgressReporter({
    backtestId: 'bt-1',
    userId: 'user-1',
    wsService: (wsStub ?? null) as unknown as WebSocketService | null,
  });

describe('BacktestProgressReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when wsService is null (CLI compatibility)', () => {
    const reporter = buildReporter();
    expect(() => {
      reporter.setPhase('simulating', 100);
      reporter.tick(50);
      reporter.complete('result-1');
      reporter.fail('boom');
    }).not.toThrow();
  });

  it('emits a progress event on setPhase', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);

    reporter.setPhase('fetchingKlines', 1);

    expect(ws.emitBacktestProgress).toHaveBeenCalledTimes(1);
    expect(ws.emitBacktestProgress).toHaveBeenCalledWith('user-1', expect.objectContaining({
      backtestId: 'bt-1',
      phase: 'fetchingKlines',
      processed: 0,
      total: 1,
      etaMs: null,
    }));
  });

  it('throttles tick events to roughly one per 5%', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);
    reporter.setPhase('simulating', 100);
    ws.emitBacktestProgress.mockClear();

    for (let i = 1; i <= 100; i += 1) {
      reporter.tick(i);
    }

    expect(ws.emitBacktestProgress).toHaveBeenCalledTimes(20);
  });

  it('always emits the final tick when processed === total', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);
    reporter.setPhase('simulating', 10);
    ws.emitBacktestProgress.mockClear();

    reporter.tick(10);

    expect(ws.emitBacktestProgress).toHaveBeenCalledTimes(1);
    expect(ws.emitBacktestProgress).toHaveBeenCalledWith('user-1', expect.objectContaining({
      processed: 10,
      total: 10,
    }));
  });

  it('returns null ETA at exactly 5% progress (floor)', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);
    reporter.setPhase('simulating', 20);
    ws.emitBacktestProgress.mockClear();

    vi.advanceTimersByTime(1_000);
    reporter.tick(1);

    expect(ws.emitBacktestProgress).toHaveBeenCalledWith('user-1', expect.objectContaining({
      processed: 1,
      total: 20,
      etaMs: null,
    }));
  });

  it('computes ETA after the 5% floor', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);
    reporter.setPhase('simulating', 100);
    ws.emitBacktestProgress.mockClear();

    vi.advanceTimersByTime(10_000);
    reporter.tick(10);

    const last = ws.emitBacktestProgress.mock.calls.at(-1)?.[1];
    expect(last?.etaMs).toBeGreaterThan(0);
    expect(last?.etaMs).toBeLessThanOrEqual(90_000 + 1);
  });

  it('emits backtest:complete with duration', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);

    vi.advanceTimersByTime(2_500);
    reporter.complete('result-9');

    expect(ws.emitBacktestComplete).toHaveBeenCalledWith('user-1', expect.objectContaining({
      backtestId: 'bt-1',
      resultId: 'result-9',
      durationMs: 2_500,
    }));
  });

  it('emits backtest:failed with error message', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);

    reporter.fail('engine exploded');

    expect(ws.emitBacktestFailed).toHaveBeenCalledWith('user-1', {
      backtestId: 'bt-1',
      error: 'engine exploded',
    });
  });

  it('switching phases resets the throttle so phase 2 emits immediately', () => {
    const ws = createWsStub();
    const reporter = buildReporter(ws);

    reporter.setPhase('fetchingKlines', 1);
    reporter.tick(1);
    ws.emitBacktestProgress.mockClear();

    reporter.setPhase('simulating', 50);

    expect(ws.emitBacktestProgress).toHaveBeenCalledTimes(1);
    expect(ws.emitBacktestProgress).toHaveBeenCalledWith('user-1', expect.objectContaining({
      phase: 'simulating',
      total: 50,
    }));
  });
});
