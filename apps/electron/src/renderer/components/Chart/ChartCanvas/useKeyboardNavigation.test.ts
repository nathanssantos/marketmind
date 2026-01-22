import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardNavigation, KEYBOARD_SHORTCUTS } from './useKeyboardNavigation';

const createMockManager = () => ({
  pan: vi.fn(),
  panVertical: vi.fn(),
  zoom: vi.fn(),
  resetVerticalZoom: vi.fn(),
  getViewport: vi.fn(() => ({ start: 0, end: 100, klineWidth: 10 })),
  setViewport: vi.fn(),
  getBounds: vi.fn(() => ({ maxIndex: 1000, minPrice: 100, maxPrice: 200, maxVolume: 1000 })),
});

const createMockCanvas = () => {
  const canvas = document.createElement('canvas');
  return canvas;
};

const createKeyboardEvent = (key: string, modifiers: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean } = {}): KeyboardEvent => {
  return new KeyboardEvent('keydown', {
    key,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    altKey: modifiers.altKey ?? false,
    bubbles: true,
  });
};

describe('useKeyboardNavigation', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockManager: ReturnType<typeof createMockManager>;

  beforeEach(() => {
    mockCanvas = createMockCanvas();
    mockManager = createMockManager();
    document.body.appendChild(mockCanvas);
  });

  afterEach(() => {
    document.body.removeChild(mockCanvas);
    vi.clearAllMocks();
  });

  it('should initialize and return focusCanvas function', () => {
    const canvasRef = { current: mockCanvas };
    const { result } = renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
      })
    );

    expect(result.current.focusCanvas).toBeDefined();
    expect(typeof result.current.focusCanvas).toBe('function');
  });

  it('should set tabindex attribute on canvas when enabled', () => {
    const canvasRef = { current: mockCanvas };

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
      })
    );

    expect(mockCanvas.getAttribute('tabindex')).toBe('0');
  });

  it('should not attach listeners when disabled', () => {
    const canvasRef = { current: mockCanvas };
    const addEventListenerSpy = vi.spyOn(mockCanvas, 'addEventListener');

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: false,
      })
    );

    expect(addEventListenerSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should pan left on ArrowLeft when focused', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('ArrowLeft'));
    });

    expect(mockManager.pan).toHaveBeenCalledWith(50);
  });

  it('should pan right on ArrowRight when focused', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('ArrowRight'));
    });

    expect(mockManager.pan).toHaveBeenCalledWith(-50);
  });

  it('should pan faster with modifier key', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('ArrowLeft', { ctrlKey: true }));
    });

    expect(mockManager.pan).toHaveBeenCalledWith(150);
  });

  it('should zoom in on + key when focused', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('+'));
    });

    expect(mockManager.zoom).toHaveBeenCalledWith(1);
  });

  it('should zoom out on - key when focused', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('-'));
    });

    expect(mockManager.zoom).toHaveBeenCalledWith(-1);
  });

  it('should reset vertical zoom on Ctrl+0', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('0', { ctrlKey: true }));
    });

    expect(mockManager.resetVerticalZoom).toHaveBeenCalled();
  });

  it('should go to start on Home key', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('Home'));
    });

    expect(mockManager.setViewport).toHaveBeenCalled();
  });

  it('should go to end on End key', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.focus();
    });

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('End'));
    });

    expect(mockManager.setViewport).toHaveBeenCalled();
  });

  it('should not respond to keys when not focused', () => {
    const canvasRef = { current: mockCanvas };
    const onViewportChange = vi.fn();

    renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
        onViewportChange,
      })
    );

    act(() => {
      mockCanvas.dispatchEvent(createKeyboardEvent('ArrowLeft'));
    });

    expect(mockManager.pan).not.toHaveBeenCalled();
  });

  it('should handle null canvas gracefully', () => {
    const canvasRef = { current: null };

    expect(() => {
      renderHook(() =>
        useKeyboardNavigation({
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
        useKeyboardNavigation({
          canvasRef,
          manager: null,
          enabled: true,
        })
      );
    }).not.toThrow();
  });

  it('should cleanup listeners on unmount', () => {
    const canvasRef = { current: mockCanvas };
    const removeEventListenerSpy = vi.spyOn(mockCanvas, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
      })
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('blur', expect.any(Function));
  });

  it('should focus canvas when focusCanvas is called', () => {
    const canvasRef = { current: mockCanvas };
    const focusSpy = vi.spyOn(mockCanvas, 'focus');

    const { result } = renderHook(() =>
      useKeyboardNavigation({
        canvasRef,
        manager: mockManager as never,
        enabled: true,
      })
    );

    act(() => {
      result.current.focusCanvas();
    });

    expect(focusSpy).toHaveBeenCalled();
  });
});

describe('KEYBOARD_SHORTCUTS', () => {
  it('should have all expected shortcut definitions', () => {
    expect(KEYBOARD_SHORTCUTS.PAN_LEFT).toBe('ArrowLeft');
    expect(KEYBOARD_SHORTCUTS.PAN_RIGHT).toBe('ArrowRight');
    expect(KEYBOARD_SHORTCUTS.ZOOM_IN).toBe('+');
    expect(KEYBOARD_SHORTCUTS.ZOOM_OUT).toBe('-');
    expect(KEYBOARD_SHORTCUTS.GO_TO_START).toBe('Home');
    expect(KEYBOARD_SHORTCUTS.GO_TO_END).toBe('End');
  });
});
