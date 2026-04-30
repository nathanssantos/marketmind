import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardNavigation, KEYBOARD_SHORTCUTS } from './useKeyboardNavigation';
import { CHART_CANVAS_DATA_ATTR, useKeyboardShortcutStore } from '@renderer/services/keyboardShortcuts';

const createMockManager = () => ({
  pan: vi.fn(),
  panVertical: vi.fn(),
  zoom: vi.fn(),
  resetVerticalZoom: vi.fn(),
  getViewport: vi.fn(() => ({ start: 0, end: 100, klineWidth: 10 })),
  setViewport: vi.fn(),
  getKlineCount: vi.fn(() => 1000),
});

describe('useKeyboardNavigation', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockManager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    useKeyboardShortcutStore.setState({ shortcuts: {}, helpOpen: false });
    mockCanvas = document.createElement('canvas');
    mockManager = createMockManager();
    document.body.appendChild(mockCanvas);
  });

  afterEach(() => {
    document.body.removeChild(mockCanvas);
    vi.clearAllMocks();
  });

  it('returns a focusCanvas function', () => {
    const canvasRef = { current: mockCanvas };
    const { result } = renderHook(() =>
      useKeyboardNavigation({ canvasRef, manager: mockManager as never, enabled: true }),
    );
    expect(typeof result.current.focusCanvas).toBe('function');
  });

  it('marks the canvas as a chart keyboard target when enabled', () => {
    const canvasRef = { current: mockCanvas };
    renderHook(() =>
      useKeyboardNavigation({ canvasRef, manager: mockManager as never, enabled: true }),
    );
    expect(mockCanvas.hasAttribute(CHART_CANVAS_DATA_ATTR)).toBe(true);
    expect(mockCanvas.getAttribute('tabindex')).toBe('0');
  });

  it('does not set the chart-keyboard-target attribute when disabled', () => {
    const canvasRef = { current: mockCanvas };
    renderHook(() =>
      useKeyboardNavigation({ canvasRef, manager: mockManager as never, enabled: false }),
    );
    expect(mockCanvas.hasAttribute(CHART_CANVAS_DATA_ATTR)).toBe(false);
  });

  it('registers chart shortcuts on mount when enabled', () => {
    const canvasRef = { current: mockCanvas };
    renderHook(() =>
      useKeyboardNavigation({ canvasRef, manager: mockManager as never, enabled: true }),
    );
    const ids = Object.keys(useKeyboardShortcutStore.getState().shortcuts);
    expect(ids).toEqual(
      expect.arrayContaining([
        'chart.panLeft',
        'chart.panRight',
        'chart.panLeftFast',
        'chart.panRightFast',
        'chart.panUp',
        'chart.panDown',
        'chart.zoomIn',
        'chart.zoomOut',
        'chart.resetZoom',
        'chart.goToStart',
        'chart.goToEnd',
      ]),
    );
  });

  it('does not register shortcuts when disabled', () => {
    const canvasRef = { current: mockCanvas };
    renderHook(() =>
      useKeyboardNavigation({ canvasRef, manager: mockManager as never, enabled: false }),
    );
    expect(Object.keys(useKeyboardShortcutStore.getState().shortcuts)).toHaveLength(0);
  });

  it('unregisters shortcuts on unmount', () => {
    const canvasRef = { current: mockCanvas };
    const { unmount } = renderHook(() =>
      useKeyboardNavigation({ canvasRef, manager: mockManager as never, enabled: true }),
    );
    expect(Object.keys(useKeyboardShortcutStore.getState().shortcuts).length).toBeGreaterThan(0);
    unmount();
    expect(Object.keys(useKeyboardShortcutStore.getState().shortcuts)).toHaveLength(0);
  });

  it('registered actions invoke manager methods', () => {
    const canvasRef = { current: mockCanvas };
    renderHook(() =>
      useKeyboardNavigation({ canvasRef, manager: mockManager as never, enabled: true }),
    );

    const { shortcuts } = useKeyboardShortcutStore.getState();
    const evt = new KeyboardEvent('keydown', { key: 'ArrowLeft' });

    shortcuts['chart.panLeft']!.action(evt);
    expect(mockManager.pan).toHaveBeenCalledWith(50);

    shortcuts['chart.panRightFast']!.action(evt);
    expect(mockManager.pan).toHaveBeenCalledWith(-150);

    shortcuts['chart.zoomIn']!.action(evt);
    expect(mockManager.zoom).toHaveBeenCalledWith(1);

    shortcuts['chart.goToStart']!.action(evt);
    expect(mockManager.setViewport).toHaveBeenCalledWith(expect.objectContaining({ start: 0 }));

    shortcuts['chart.goToEnd']!.action(evt);
    expect(mockManager.setViewport).toHaveBeenCalledWith(expect.objectContaining({ end: 1000 }));
  });

  it('exports the legacy KEYBOARD_SHORTCUTS map for back-compat callers', () => {
    expect(KEYBOARD_SHORTCUTS.PAN_LEFT).toBe('ArrowLeft');
    expect(KEYBOARD_SHORTCUTS.GO_TO_END).toBe('End');
  });
});
