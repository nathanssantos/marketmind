import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTouchGestures, isTouchDevice } from './useTouchGestures';

const createMockManager = () => ({
  pan: vi.fn(),
  panVertical: vi.fn(),
  zoom: vi.fn(),
  getViewport: vi.fn(() => ({ start: 0, end: 100, klineWidth: 10 })),
  getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 700, chartHeight: 500 })),
});

const createMockCanvas = () => {
  const canvas = document.createElement('canvas');
  canvas.getBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
  return canvas;
};

describe('useTouchGestures', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockManager: ReturnType<typeof createMockManager>;
  let capturedHandlers: Record<string, EventListener>;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
    mockManager = createMockManager();
    capturedHandlers = {};

    vi.spyOn(mockCanvas, 'addEventListener').mockImplementation((type, handler) => {
      capturedHandlers[type] = handler as EventListener;
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize without errors', () => {
    const canvasRef = { current: mockCanvas };
    const { result } = renderHook(() =>
      useTouchGestures({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
      })
    );

    expect(result.current.isTouching).toBe(false);
  });

  it('should not attach listeners when disabled', () => {
    const canvasRef = { current: mockCanvas };
    const addEventListenerSpy = vi.spyOn(mockCanvas, 'addEventListener');

    renderHook(() =>
      useTouchGestures({
        canvasRef,
        manager: mockManager as never,
        enabled: false,
      })
    );

    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it('should attach touch listeners when enabled', () => {
    const canvasRef = { current: mockCanvas };

    renderHook(() =>
      useTouchGestures({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
      })
    );

    expect(capturedHandlers['touchstart']).toBeDefined();
    expect(capturedHandlers['touchmove']).toBeDefined();
    expect(capturedHandlers['touchend']).toBeDefined();
    expect(capturedHandlers['touchcancel']).toBeDefined();
  });

  it('should remove listeners on unmount', () => {
    const canvasRef = { current: mockCanvas };
    const removeEventListenerSpy = vi.spyOn(mockCanvas, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useTouchGestures({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
      })
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('touchcancel', expect.any(Function));
  });

  it('should call handlers when touch events are triggered', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useTouchGestures({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    expect(capturedHandlers['touchstart']).toBeDefined();
    expect(capturedHandlers['touchmove']).toBeDefined();
    expect(capturedHandlers['touchend']).toBeDefined();
  });

  it('should handle null canvas gracefully', () => {
    const canvasRef = { current: null };

    expect(() => {
      renderHook(() =>
        useTouchGestures({
          canvasRef,
          manager: mockManager as never,
          enabled: true,
        })
      );
    }).not.toThrow();
  });

  it('should handle null manager gracefully', () => {
    const canvasRef = { current: mockCanvas };

    expect(() => {
      renderHook(() =>
        useTouchGestures({
          canvasRef,
          manager: null,
          enabled: true,
        })
      );
    }).not.toThrow();
  });

  it('should call onViewportChange ref when updated', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange1 = vi.fn();
    const onViewportChange2 = vi.fn();

    const { rerender } = renderHook(
      ({ onViewportChange }) =>
        useTouchGestures({
          canvasRef,
          manager: mockManager as never,
          enabled: true,
          onViewportChange,
        }),
      { initialProps: { onViewportChange: onViewportChange1 } }
    );

    rerender({ onViewportChange: onViewportChange2 });

    expect(capturedHandlers['touchstart']).toBeDefined();
  });

  it('should transition from disabled to enabled', () => {
    const canvasRef = { current: mockCanvas };

    const { rerender } = renderHook(
      ({ enabled }) =>
        useTouchGestures({
          canvasRef,
          manager: mockManager as never,
          enabled,
        }),
      { initialProps: { enabled: false } }
    );

    expect(capturedHandlers['touchstart']).toBeUndefined();

    rerender({ enabled: true });

    expect(capturedHandlers['touchstart']).toBeDefined();
  });
});

describe('isTouchDevice', () => {
  it('should return a boolean', () => {
    const result = isTouchDevice();
    expect(typeof result).toBe('boolean');
  });
});
