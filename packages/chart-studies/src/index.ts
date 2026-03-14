export type {
  DrawingType,
  DrawingBase,
  LineDrawing,
  RulerDrawing,
  RectangleDrawing,
  AreaDrawing,
  PencilDrawing,
  FibonacciLevel,
  FibonacciDrawing,
  Drawing,
  TwoPointDrawingType,
  DrawingHandle,
  CoordinateMapper,
} from './types';

export {
  HIT_THRESHOLD,
  HANDLE_RADIUS,
  HANDLE_HIT_RADIUS,
  PENCIL_HIT_THRESHOLD,
  DRAWING_COLORS,
  FIBONACCI_DEFAULT_LEVELS,
} from './constants';

export {
  pointToLineDistance,
  pointInRect,
  pointNearRectBorder,
  pointNearPath,
  pointNearHandle,
  hitTestDrawing,
  hitTestDrawings,
} from './hit-testing';
export type { HitTestResult } from './hit-testing';

export {
  serializeDrawingData,
  deserializeDrawingData,
} from './serialization';
export type { KlineTimeLookup, TimeToIndexLookup } from './serialization';
