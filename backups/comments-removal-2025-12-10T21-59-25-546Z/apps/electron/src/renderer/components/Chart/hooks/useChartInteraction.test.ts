import { act, renderHook, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChartInteraction } from './useChartInteraction';

describe('useChartInteraction', () => {
  let canvasRef: React.RefObject<HTMLCanvasElement>;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    canvasRef = createRef() as React.RefObject<HTMLCanvasElement>;
    (canvasRef as any).current = canvas;
  });

  const viewport = {
    start: 0,
    end: 100,
    minPrice: 50000,
    maxPrice: 60000,
  };

  it('should initialize with null mouse position', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    expect(result.current.mousePosition).toBeNull();
    expect(result.current.isDragging).toBe(false);
    expect(result.current.isHovering).toBe(false);
  });

  it('should update mouse position on mousemove', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    act(() => {
      const event = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });
      canvas.dispatchEvent(event);
    });

    expect(result.current.mousePosition).not.toBeNull();
    expect(result.current.mousePosition?.x).toBe(400);
    expect(result.current.mousePosition?.y).toBe(300);
  });

  it('should calculate kline index correctly', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    act(() => {
      const event = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });
      canvas.dispatchEvent(event);
    });

    expect(result.current.mousePosition?.klineIndex).toBe(50);
  });

  it('should calculate price correctly', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    act(() => {
      const event = new MouseEvent('mousemove', {
        clientX: 400,
        clientY: 300,
      });
      canvas.dispatchEvent(event);
    });

    expect(result.current.mousePosition?.price).toBe(55000);
  });

  it('should set dragging state on mousedown', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    act(() => {
      const event = new MouseEvent('mousedown', {
        clientX: 400,
        clientY: 300,
      });
      canvas.dispatchEvent(event);
    });

    expect(result.current.isDragging).toBe(true);
  });

  it('should clear dragging state on mouseup', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300 }));
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 300 }));
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('should call onPan when dragging', async () => {
    const onPan = vi.fn();
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport, onPan })
    );

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300 }));
    });

    await waitFor(() => {
      expect(result.current.isDragging).toBe(true);
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 450, clientY: 300 }));
    });

    await waitFor(() => {
      expect(onPan).toHaveBeenCalledWith(50);
    });
  });

  it('should call onZoom on wheel event', () => {
    const onZoom = vi.fn();
    renderHook(() =>
      useChartInteraction({ canvasRef, viewport, onZoom })
    );

    act(() => {
      const event = new WheelEvent('wheel', { deltaY: 100, clientX: 400 });
      canvas.dispatchEvent(event);
    });

    expect(onZoom).toHaveBeenCalledWith(-1, 400);
  });

  it('should call onClick on mouseup without drag', async () => {
    const onClick = vi.fn();
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport, onClick })
    );

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300 }));
    });

    await waitFor(() => {
      expect(result.current.isDragging).toBe(true);
    });

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 400, clientY: 300 }));
    });

    await waitFor(() => {
      expect(onClick).toHaveBeenCalled();
    });
  });

  it('should not call onClick when dragged', () => {
    const onClick = vi.fn();
    renderHook(() =>
      useChartInteraction({ canvasRef, viewport, onClick })
    );

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 400, clientY: 300 }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 450, clientY: 300 }));
    });

    expect(onClick).not.toHaveBeenCalled();
  });

  it('should set hovering state on mouseenter', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseenter'));
    });

    expect(result.current.isHovering).toBe(true);
  });

  it('should clear state on mouseleave', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport })
    );

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mouseenter'));
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300 }));
      canvas.dispatchEvent(new MouseEvent('mouseleave'));
    });

    expect(result.current.isHovering).toBe(false);
    expect(result.current.mousePosition).toBeNull();
    expect(result.current.isDragging).toBe(false);
  });

  it('should not respond when disabled', () => {
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef, viewport, enabled: false })
    );

    act(() => {
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 400, clientY: 300 }));
    });

    expect(result.current.mousePosition).toBeNull();
  });

  it('should handle missing canvas ref', () => {
    const emptyRef = createRef() as React.RefObject<HTMLCanvasElement>;
    const { result } = renderHook(() =>
      useChartInteraction({ canvasRef: emptyRef, viewport })
    );

    expect(result.current.mousePosition).toBeNull();
  });
});
