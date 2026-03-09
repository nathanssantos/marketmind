import { describe, it, expect, beforeEach } from 'vitest';
import { GRID_ORDER_LIMITS, useGridOrderStore } from './gridOrderStore';

describe('gridOrderStore', () => {
  beforeEach(() => {
    useGridOrderStore.setState({
      isGridModeActive: false,
      gridSide: 'BUY',
      gridCount: GRID_ORDER_LIMITS.DEFAULT_ORDERS,
      snapEnabled: true,
      snapDistancePx: GRID_ORDER_LIMITS.DEFAULT_SNAP_DISTANCE_PX,
      isDrawingGrid: false,
      startPrice: null,
      endPrice: null,
    });
  });

  it('should have correct default values', () => {
    const state = useGridOrderStore.getState();
    expect(state.isGridModeActive).toBe(false);
    expect(state.gridSide).toBe('BUY');
    expect(state.gridCount).toBe(GRID_ORDER_LIMITS.DEFAULT_ORDERS);
    expect(state.snapEnabled).toBe(true);
    expect(state.snapDistancePx).toBe(GRID_ORDER_LIMITS.DEFAULT_SNAP_DISTANCE_PX);
    expect(state.isDrawingGrid).toBe(false);
    expect(state.startPrice).toBeNull();
    expect(state.endPrice).toBeNull();
  });

  it('should toggle grid mode and reset drawing state', () => {
    const { toggleGridMode, setIsDrawingGrid, setStartPrice } = useGridOrderStore.getState();
    setIsDrawingGrid(true);
    setStartPrice(100);

    toggleGridMode();
    const state = useGridOrderStore.getState();
    expect(state.isGridModeActive).toBe(true);
    expect(state.isDrawingGrid).toBe(false);
    expect(state.startPrice).toBeNull();
  });

  it('should set grid mode active and reset drawing', () => {
    const { setGridModeActive, setIsDrawingGrid, setStartPrice } = useGridOrderStore.getState();
    setIsDrawingGrid(true);
    setStartPrice(100);

    setGridModeActive(true);
    expect(useGridOrderStore.getState().isGridModeActive).toBe(true);
    expect(useGridOrderStore.getState().isDrawingGrid).toBe(false);
    expect(useGridOrderStore.getState().startPrice).toBeNull();
  });

  it('should clamp grid count within limits', () => {
    const { setGridCount } = useGridOrderStore.getState();

    setGridCount(1);
    expect(useGridOrderStore.getState().gridCount).toBe(GRID_ORDER_LIMITS.MIN_ORDERS);

    setGridCount(100);
    expect(useGridOrderStore.getState().gridCount).toBe(GRID_ORDER_LIMITS.MAX_ORDERS);

    setGridCount(15);
    expect(useGridOrderStore.getState().gridCount).toBe(15);
  });

  it('should clamp snap distance within limits', () => {
    const { setSnapDistancePx } = useGridOrderStore.getState();

    setSnapDistancePx(1);
    expect(useGridOrderStore.getState().snapDistancePx).toBe(GRID_ORDER_LIMITS.MIN_SNAP_DISTANCE_PX);

    setSnapDistancePx(100);
    expect(useGridOrderStore.getState().snapDistancePx).toBe(GRID_ORDER_LIMITS.MAX_SNAP_DISTANCE_PX);

    setSnapDistancePx(15);
    expect(useGridOrderStore.getState().snapDistancePx).toBe(15);
  });

  it('should set grid side', () => {
    const { setGridSide } = useGridOrderStore.getState();
    setGridSide('SELL');
    expect(useGridOrderStore.getState().gridSide).toBe('SELL');
  });

  it('should manage drawing state', () => {
    const { setIsDrawingGrid, setStartPrice, setEndPrice } = useGridOrderStore.getState();

    setIsDrawingGrid(true);
    setStartPrice(50000);
    setEndPrice(51000);

    const state = useGridOrderStore.getState();
    expect(state.isDrawingGrid).toBe(true);
    expect(state.startPrice).toBe(50000);
    expect(state.endPrice).toBe(51000);
  });

  it('should reset drawing state', () => {
    const { setIsDrawingGrid, setStartPrice, setEndPrice, resetDrawing } = useGridOrderStore.getState();

    setIsDrawingGrid(true);
    setStartPrice(50000);
    setEndPrice(51000);
    resetDrawing();

    const state = useGridOrderStore.getState();
    expect(state.isDrawingGrid).toBe(false);
    expect(state.startPrice).toBeNull();
    expect(state.endPrice).toBeNull();
  });

  it('should toggle snap enabled', () => {
    const { setSnapEnabled } = useGridOrderStore.getState();
    expect(useGridOrderStore.getState().snapEnabled).toBe(true);

    setSnapEnabled(false);
    expect(useGridOrderStore.getState().snapEnabled).toBe(false);
  });
});
