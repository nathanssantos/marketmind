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
  ArrowDrawing,
  RayDrawing,
  ChannelDrawing,
  HorizontalLineDrawing,
  TextDrawing,
  TrendLineDrawing,
  PriceRangeDrawing,
  VerticalLineDrawing,
  HighlighterDrawing,
  EllipseDrawing,
  PitchforkDrawing,
  GannFanDrawing,
  LongPositionDrawing,
  ShortPositionDrawing,
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
  DEFAULT_LINE_WIDTH,
  DEFAULT_FONT_SIZE,
  GANN_ANGLES,
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

export { resolveDrawingIndices } from './resolveIndices';
