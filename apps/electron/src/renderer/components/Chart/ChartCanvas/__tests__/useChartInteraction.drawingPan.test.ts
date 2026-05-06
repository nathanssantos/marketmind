import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useChartInteraction } from '../useChartInteraction';

const makeMouseEvent = (overrides: Partial<MouseEvent & { button?: number }> = {}): React.MouseEvent<HTMLCanvasElement> => {
  return {
    button: 0,
    clientX: 100,
    clientY: 100,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...overrides,
  } as unknown as React.MouseEvent<HTMLCanvasElement>;
};

const makeCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }),
  });
  return canvas;
};

const makeManagerMock = () => ({
  getDimensions: () => ({ width: 800, height: 600, chartWidth: 760, chartHeight: 520, volumeHeight: 0 }),
  indexToX: () => 400,
  yToPrice: () => 50000,
  markDirty: vi.fn(),
});

const makeBaseProps = (drawingIsDrawing: boolean, innerHandleMouseDown: ReturnType<typeof vi.fn>) => {
  const canvasRef = createRef<HTMLCanvasElement>();
  Object.defineProperty(canvasRef, 'current', { value: makeCanvas(), writable: true });

  return {
    manager: makeManagerMock() as never,
    canvasRef,
    klines: [],
    advancedConfig: undefined,
    showVolume: false,
    isPanning: false,
    shiftPressed: false,
    altPressed: false,
    mousePositionRef: { current: null },
    orderPreviewRef: { current: null },
    hoveredMAIndexRef: { current: undefined },
    hoveredOrderIdRef: { current: null },
    lastHoveredOrderRef: { current: null },
    setHoveredKline: vi.fn(),
    setOrderToClose: vi.fn(),
    getHoveredOrder: vi.fn(() => null),
    getClickedOrderId: vi.fn(() => null),
    getSLTPAtPosition: vi.fn(() => null),
    orderDragHandler: {
      isDragging: false,
      handleMouseMove: vi.fn(),
      handleMouseDown: vi.fn(() => false),
      handleMouseUp: vi.fn(),
      handleSLTPMouseDown: vi.fn(() => false),
    },
    gridInteraction: undefined,
    drawingInteraction: {
      isDrawing: vi.fn(() => drawingIsDrawing),
      handleMouseDown: vi.fn(() => false),
      handleMouseMove: vi.fn(() => false),
      handleMouseUp: vi.fn(() => true),
      cancelInteraction: vi.fn(() => false),
      getCursor: vi.fn(() => null),
      snapToOHLC: vi.fn((x: number, y: number) => ({ x, y, snapped: false })),
    },
    cursorManager: {
      setCursor: vi.fn(),
      getCursor: vi.fn(() => 'crosshair'),
    },
    handleMouseMove: vi.fn(),
    handleMouseDown: innerHandleMouseDown,
    handleMouseUp: vi.fn(),
    handleMouseLeave: vi.fn(),
  };
};

describe('useChartInteraction — drawing / pan regression', () => {
  it('does not fall through to pan handler while a multi-point drawing is in progress', () => {
    const innerHandleMouseDown = vi.fn();
    // Drawing's handleMouseDown returns true to claim the click — covers the
    // case where a phase-aware drawing handler (e.g. channel placing-third
    // finalize) processes the mousedown.
    const props = makeBaseProps(true, innerHandleMouseDown);
    props.drawingInteraction!.handleMouseDown = vi.fn(() => true);

    const { result } = renderHook(() => useChartInteraction(props));

    result.current.handleCanvasMouseDown(makeMouseEvent({ clientX: 200, clientY: 200 }));

    // Drawing handler MUST be called so it can finalize / advance phase.
    expect(props.drawingInteraction!.handleMouseDown).toHaveBeenCalledTimes(1);
    // Pan must NOT receive the click — the drawing claimed it.
    expect(innerHandleMouseDown).not.toHaveBeenCalled();
  });

  it('allows pan to start when no drawing is in progress and drawing rejects the click', () => {
    const innerHandleMouseDown = vi.fn();
    const props = makeBaseProps(false, innerHandleMouseDown);

    const { result } = renderHook(() => useChartInteraction(props));

    result.current.handleCanvasMouseDown(makeMouseEvent({ clientX: 200, clientY: 200 }));

    expect(props.drawingInteraction!.handleMouseDown).toHaveBeenCalledTimes(1);
    expect(innerHandleMouseDown).toHaveBeenCalledTimes(1);
  });

  it('clears pan state via handleMouseUp when drawing claims the mouseup', () => {
    const props = makeBaseProps(true, vi.fn());
    props.mousePositionRef = { current: { x: 300, y: 300 } } as never;

    const { result } = renderHook(() => useChartInteraction(props));

    result.current.handleCanvasMouseUp();

    expect(props.drawingInteraction!.handleMouseUp).toHaveBeenCalledTimes(1);
    expect(props.handleMouseUp).toHaveBeenCalledTimes(1);
  });

  it('still calls handleMouseUp when no drawing claims the mouseup', () => {
    const props = makeBaseProps(false, vi.fn());

    const { result } = renderHook(() => useChartInteraction(props));

    result.current.handleCanvasMouseUp();

    expect(props.drawingInteraction!.handleMouseUp).not.toHaveBeenCalled();
    expect(props.handleMouseUp).toHaveBeenCalledTimes(1);
  });
});
